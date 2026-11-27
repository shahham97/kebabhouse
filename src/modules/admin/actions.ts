'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { defineAction } from '@/lib/action';
import { destroyStaffSession, hashSecret, invalidateStaffSessionCache, type StaffActor } from '@/lib/auth';
import { CACHE_TAGS, safeRevalidateTag } from '@/lib/cache';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import { receivePurchaseOrderGoods } from '@/modules/inventory/service';
import { normalizeVariantFlags } from '@/modules/catalog/availability';

function requireStaffActor(actor: { type: string }): StaffActor {
  if (actor.type !== 'staff') {
    throw new ForbiddenError('Staff session required');
  }
  return actor as StaffActor;
}

function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `item-${Date.now()}`;
}

// ============================================================
// AUTH / LOGOUT
// ============================================================

export async function adminLogoutAction(): Promise<void> {
  await destroyStaffSession();
  redirect('/admin/login');
}

// ============================================================
// CATALOGUE ACTIONS (no hard deletes)
// ============================================================

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(80),
  description: z.string().trim().max(300).optional().default(''),
  defaultStationId: z.string().trim().optional().nullable(),
  showInMenu: z.boolean().optional().default(true),
});

export const createCategoryAction = defineAction({
  name: 'admin.catalog.createCategory',
  permission: 'catalog.manage',
  schema: createCategorySchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const slug = `${slugify(input.name)}-${crypto.randomBytes(2).toString('hex')}`;
    const maxSort = await db.category.aggregate({
      where: { storeId: staff.storeId },
      _max: { sortOrder: true },
    });

    const created = await db.category.create({
      data: {
        storeId: staff.storeId,
        name: input.name,
        slug,
        description: input.description,
        defaultStationId: input.defaultStationId || null,
        showInMenu: input.showInMenu,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: created.id, name: created.name };
  },
});

const createProductSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  stationId: z.string().optional().nullable(),
  name: z.string().trim().min(1, 'Product name is required').max(120),
  description: z.string().trim().max(1000).optional().default(''),
  taxCode: z.enum(['GST', 'GST_FREE']).default('GST'),
  visibility: z.enum(['WEB', 'TILL', 'BOTH']).default('BOTH'),
  isBestSeller: z.boolean().optional().default(false),
  isMultiVariant: z.boolean().optional().default(true),
  defaultVariantName: z.string().trim().min(1).max(60).default('Regular'),
  defaultPriceCents: z.number().int().min(0, 'Price must be >= 0'),
  defaultPrepMinutes: z.number().int().min(1).max(180).default(8),
});

export const createProductAction = defineAction({
  name: 'admin.catalog.createProduct',
  permission: 'catalog.manage',
  schema: createProductSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const category = await db.category.findFirst({
      where: { id: input.categoryId, storeId: staff.storeId },
    });
    if (!category) throw new NotFoundError('Category not found');

    const slug = `${slugify(input.name)}-${crypto.randomBytes(2).toString('hex')}`;
    const sku = `SK-${slugify(input.name).slice(0, 8).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const variantLabel = input.isMultiVariant ? input.defaultVariantName : 'Standard';

    const product = await db.product.create({
      data: {
        storeId: staff.storeId,
        categoryId: category.id,
        stationId: input.stationId || category.defaultStationId || null,
        name: input.name,
        slug,
        description: input.description,
        taxCode: input.taxCode,
        visibility: input.visibility,
        isBestSeller: input.isBestSeller,
        isMultiVariant: input.isMultiVariant,
        variants: {
          create: {
            name: variantLabel,
            sku,
            priceCents: input.defaultPriceCents,
            prepMinutes: input.defaultPrepMinutes,
            sortOrder: 0,
          },
        },
      },
      include: { variants: true },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: product.id, name: product.name };
  },
});

const addVariantSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  name: z.string().trim().min(1, 'Variant name is required').max(60),
  sku: z.string().trim().max(40).optional(),
  priceCents: z.number().int().min(0, 'Price must be >= 0'),
  prepMinutes: z.number().int().min(1).max(180).default(8),
});

export const addVariantAction = defineAction({
  name: 'admin.catalog.addVariant',
  permission: 'catalog.manage',
  schema: addVariantSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const product = await db.product.findFirst({
      where: { id: input.productId, storeId: staff.storeId },
      include: { _count: { select: { variants: true } } },
    });
    if (!product) throw new NotFoundError('Product not found');

    const sku =
      input.sku && input.sku.length > 0
        ? input.sku.toUpperCase()
        : `SK-${slugify(product.name).slice(0, 6).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    try {
      const variant = await db.variant.create({
        data: {
          productId: product.id,
          name: input.name,
          sku,
          priceCents: input.priceCents,
          prepMinutes: input.prepMinutes,
          sortOrder: product._count.variants,
        },
      });

      safeRevalidateTag(CACHE_TAGS.menu);
      revalidatePath('/admin/catalog');
      return { id: variant.id, name: variant.name };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A variant with that name already exists on this product');
      }
      throw err;
    }
  },
});

const toggleIdSchema = z.object({
  id: z.string().min(1),
});

export const toggleProductActiveAction = defineAction({
  name: 'admin.catalog.toggleProductActive',
  permission: 'catalog.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.product.findFirst({
      where: { id: input.id, storeId: staff.storeId },
    });
    if (!existing) throw new NotFoundError('Product not found');

    const updated = await db.product.update({
      where: { id: existing.id },
      data: { active: !existing.active },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, active: updated.active };
  },
});

export const toggleVariantActiveAction = defineAction({
  name: 'admin.catalog.toggleVariantActive',
  permission: 'catalog.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.variant.findFirst({
      where: { id: input.id, product: { storeId: staff.storeId } },
    });
    if (!existing) throw new NotFoundError('Variant not found');

    const updated = await db.variant.update({
      where: { id: existing.id },
      data: { active: !existing.active },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, active: updated.active };
  },
});

export const toggleProductSoldOutAction = defineAction({
  name: 'admin.catalog.toggleProductSoldOut',
  permission: 'catalog.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.product.findFirst({
      where: { id: input.id, storeId: staff.storeId },
    });
    if (!existing) throw new NotFoundError('Product not found');

    const updated = await db.product.update({
      where: { id: existing.id },
      data: { soldOut: !existing.soldOut },
    });

    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, soldOut: updated.soldOut };
  },
});

// ============================================================
// STATIONS ACTIONS
// ============================================================

const createStationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Station code must be at least 2 characters')
    .max(24)
    .regex(/^[a-z0-9-]+$/i, 'Use letters, numbers, and hyphens only'),
  name: z.string().trim().min(1, 'Station name is required').max(60),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex code like #C8401E')
    .default('#C8401E'),
  autoComplete: z.boolean().optional().default(false),
});

export const createStationAction = defineAction({
  name: 'admin.stations.create',
  permission: 'kitchen.configure',
  schema: createStationSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const code = input.code.toLowerCase();
    const maxSort = await db.station.aggregate({
      where: { storeId: staff.storeId },
      _max: { sortOrder: true },
    });

    try {
      const station = await db.station.create({
        data: {
          storeId: staff.storeId,
          code,
          name: input.name,
          color: input.color,
          autoComplete: input.autoComplete,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });
      safeRevalidateTag(CACHE_TAGS.stations);
      revalidatePath('/admin/stations');
      return { id: station.id, code: station.code };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`Station code "${code}" already exists`);
      }
      throw err;
    }
  },
});

export const toggleStationAutoCompleteAction = defineAction({
  name: 'admin.stations.toggleAutoComplete',
  permission: 'kitchen.configure',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.station.findFirst({
      where: { id: input.id, storeId: staff.storeId },
    });
    if (!existing) throw new NotFoundError('Station not found');

    const updated = await db.station.update({
      where: { id: existing.id },
      data: { autoComplete: !existing.autoComplete },
    });
    safeRevalidateTag(CACHE_TAGS.stations);
    revalidatePath('/admin/stations');
    return { id: updated.id, autoComplete: updated.autoComplete };
  },
});

// ============================================================
// INVENTORY & RECIPES ACTIONS
// ============================================================

const createInventoryItemSchema = z.object({
  code: z.string().trim().min(2, 'Code is required').max(32),
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(300).optional().default(''),
  unit: z.enum(['kg', 'g', 'L', 'ml', 'piece', 'unit', 'packet', 'box']),
  onHand: z.number().min(0).default(0),
  minThreshold: z.number().min(0).default(5),
  costPerUnitCents: z.number().int().min(0).default(0),
  preferredVendorId: z.string().optional().nullable(),
});

export const createInventoryItemAction = defineAction({
  name: 'admin.inventory.createItem',
  permission: 'inventory.adjust',
  schema: createInventoryItemSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const code = input.code.toUpperCase();

    try {
      const item = await db.inventoryItem.create({
        data: {
          storeId: staff.storeId,
          code,
          name: input.name,
          description: input.description,
          unit: input.unit,
          onHand: new Prisma.Decimal(input.onHand),
          minThreshold: new Prisma.Decimal(input.minThreshold),
          costPerUnitCents: input.costPerUnitCents,
          preferredVendorId: input.preferredVendorId || null,
        },
      });

      if (input.onHand > 0) {
        await db.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            kind: 'COUNT',
            quantity: new Prisma.Decimal(input.onHand),
            unitCostCents: input.costPerUnitCents,
            sourceType: 'COUNT',
            sourceId: `init-${item.id}`,
            actorId: staff.id,
            reason: 'Initial opening stock',
          },
        });
      }

      revalidatePath('/admin/inventory');
      return { id: item.id, code: item.code };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`Inventory code "${code}" already exists`);
      }
      throw err;
    }
  },
});

const postInventoryAdjustmentSchema = z.object({
  inventoryItemId: z.string().min(1, 'Select an inventory item'),
  kind: z.enum(['ADJUSTMENT', 'WASTE', 'COUNT']),
  quantity: z.number().refine((v) => Number.isFinite(v), 'Invalid quantity'),
  reason: z.string().trim().min(2, 'Provide a reason for the stock movement').max(300),
});

export const postInventoryAdjustmentAction = defineAction({
  name: 'admin.inventory.postAdjustment',
  permission: 'inventory.adjust',
  schema: postInventoryAdjustmentSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const item = await db.inventoryItem.findFirst({
      where: { id: input.inventoryItemId, storeId: staff.storeId },
    });
    if (!item) throw new NotFoundError('Inventory item not found');

    let delta: Prisma.Decimal;
    let sourceType: string;

    if (input.kind === 'WASTE') {
      if (input.quantity <= 0) {
        throw new ValidationError('Waste quantity must be greater than 0');
      }
      delta = new Prisma.Decimal(input.quantity).neg();
      sourceType = 'WASTE';
    } else if (input.kind === 'COUNT') {
      if (input.quantity < 0) {
        throw new ValidationError('Stocktake count cannot be negative');
      }
      delta = new Prisma.Decimal(input.quantity).sub(item.onHand);
      sourceType = 'COUNT';
    } else {
      if (input.quantity === 0) {
        throw new ValidationError('Adjustment delta cannot be 0');
      }
      delta = new Prisma.Decimal(input.quantity);
      sourceType = 'MANUAL';
    }

    const txn = await db.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        kind: input.kind,
        quantity: delta,
        unitCostCents: item.costPerUnitCents,
        sourceType,
        sourceId: crypto.randomUUID(),
        actorId: staff.id,
        reason: input.reason,
      },
    });

    const updated = await db.inventoryItem.update({
      where: { id: item.id },
      data: { onHand: { increment: delta } },
    });

    revalidatePath('/admin/inventory');
    return { id: txn.id, newOnHand: Number(updated.onHand) };
  },
});

const addRecipeLineSchema = z.object({
  variantId: z.string().min(1, 'Select a product variant'),
  inventoryItemId: z.string().min(1, 'Select an inventory item'),
  quantity: z.number().positive('Quantity must be positive'),
});

export const addRecipeLineAction = defineAction({
  name: 'admin.inventory.addRecipeLine',
  permission: 'inventory.adjust',
  schema: addRecipeLineSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const [variant, item] = await Promise.all([
      db.variant.findFirst({
        where: { id: input.variantId, product: { storeId: staff.storeId } },
      }),
      db.inventoryItem.findFirst({
        where: { id: input.inventoryItemId, storeId: staff.storeId },
      }),
    ]);

    if (!variant) throw new NotFoundError('Product variant not found');
    if (!item) throw new NotFoundError('Inventory item not found');

    const line = await db.recipeLine.create({
      data: {
        variantId: variant.id,
        inventoryItemId: item.id,
        quantity: new Prisma.Decimal(input.quantity),
      },
    });

    revalidatePath('/admin/inventory');
    return { id: line.id };
  },
});

// ============================================================
// VENDORS & PURCHASING ACTIONS
// ============================================================

const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'Vendor name is required').max(120),
  abn: z.string().trim().max(32).optional().default(''),
  contact: z.string().trim().max(100).optional().default(''),
  email: z.string().trim().email('Invalid email').or(z.literal('')).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});

export const createVendorAction = defineAction({
  name: 'admin.purchasing.createVendor',
  permission: 'vendors.manage',
  schema: createVendorSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const vendor = await db.vendor.create({
      data: {
        storeId: staff.storeId,
        name: input.name,
        abn: input.abn,
        contact: input.contact,
        email: input.email,
        phone: input.phone,
        address: input.address,
        notes: input.notes,
      },
    });
    revalidatePath('/admin/purchasing');
    revalidatePath('/admin/inventory');
    return { id: vendor.id, name: vendor.name };
  },
});

const createPurchaseOrderSchema = z.object({
  vendorId: z.string().min(1, 'Select a vendor'),
  invoiceRef: z.string().trim().max(80).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
  lines: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        orderedQty: z.number().positive('Ordered qty must be positive'),
        unitCostCents: z.number().int().min(0),
      })
    )
    .min(1, 'Add at least one line item'),
});

export const createPurchaseOrderAction = defineAction({
  name: 'admin.purchasing.createPO',
  permission: 'purchasing.receive',
  schema: createPurchaseOrderSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const vendor = await db.vendor.findFirst({
      where: { id: input.vendorId, storeId: staff.storeId },
    });
    if (!vendor) throw new NotFoundError('Vendor not found');

    const totalCents = input.lines.reduce(
      (sum, l) => sum + Math.round(l.orderedQty * l.unitCostCents),
      0
    );
    const poNumber = `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;

    const po = await db.purchaseOrder.create({
      data: {
        storeId: staff.storeId,
        vendorId: vendor.id,
        number: poNumber,
        status: 'ORDERED',
        invoiceRef: input.invoiceRef,
        notes: input.notes,
        totalCents,
        lines: {
          create: input.lines.map((l) => ({
            inventoryItemId: l.inventoryItemId,
            orderedQty: new Prisma.Decimal(l.orderedQty),
            unitCostCents: l.unitCostCents,
          })),
        },
      },
    });

    revalidatePath('/admin/purchasing');
    return { id: po.id, number: po.number };
  },
});

const receivePoGoodsSchema = z.object({
  purchaseOrderId: z.string().min(1),
  invoiceRef: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z
    .array(
      z.object({
        purchaseOrderLineId: z.string().min(1),
        receivedQty: z.number().min(0),
      })
    )
    .min(1),
});

export const receivePoGoodsAction = defineAction({
  name: 'admin.purchasing.receiveGoods',
  permission: 'purchasing.receive',
  schema: receivePoGoodsSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const po = await db.purchaseOrder.findFirst({
      where: { id: input.purchaseOrderId, storeId: staff.storeId },
    });
    if (!po) throw new NotFoundError('Purchase order not found');

    const nonZeroLines = input.lines.filter((l) => l.receivedQty > 0);
    if (nonZeroLines.length === 0) {
      throw new ValidationError('Enter a received quantity greater than 0 for at least one line');
    }

    const result = await receivePurchaseOrderGoods(db, {
      purchaseOrderId: po.id,
      invoiceRef: input.invoiceRef,
      notes: input.notes,
      actorId: staff.id,
      lines: nonZeroLines,
    });

    revalidatePath('/admin/purchasing');
    revalidatePath('/admin/inventory');
    return result;
  },
});

// ============================================================
// DEALS & COUPONS ACTIONS
// ============================================================

const createDealSchema = z.object({
  name: z.string().trim().min(1, 'Deal name is required').max(120),
  description: z.string().trim().max(1000).optional().default(''),
  priceCents: z.number().int().min(0),
  badgeText: z.string().trim().max(32).optional().default('HOT DEAL'),
  channels: z.enum(['WEB', 'TILL', 'BOTH']).default('BOTH'),
});

export const createDealAction = defineAction({
  name: 'admin.deals.createDeal',
  permission: 'deals.manage',
  schema: createDealSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const slug = `${slugify(input.name)}-${crypto.randomBytes(2).toString('hex')}`;

    const deal = await db.deal.create({
      data: {
        storeId: staff.storeId,
        name: input.name,
        slug,
        description: input.description,
        priceCents: input.priceCents,
        badgeText: input.badgeText || 'HOT DEAL',
        channels: input.channels,
        active: true,
      },
    });

    safeRevalidateTag(CACHE_TAGS.deals);
    revalidatePath('/admin/deals');
    return { id: deal.id, name: deal.name };
  },
});

export const toggleDealAction = defineAction({
  name: 'admin.deals.toggleDeal',
  permission: 'deals.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.deal.findFirst({
      where: { id: input.id, storeId: staff.storeId },
    });
    if (!existing) throw new NotFoundError('Deal not found');

    const updated = await db.deal.update({
      where: { id: existing.id },
      data: { active: !existing.active },
    });

    safeRevalidateTag(CACHE_TAGS.deals);
    revalidatePath('/admin/deals');
    return { id: updated.id, active: updated.active };
  },
});

const createCouponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Coupon code is required')
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, 'Use letters, numbers, underscores or hyphens'),
  kind: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().positive('Discount value must be positive'),
  minSpendCents: z.number().int().min(0).default(0),
  maxUses: z.number().int().positive().optional().nullable(),
  firstOrderOnly: z.boolean().optional().default(false),
});

export const createCouponAction = defineAction({
  name: 'admin.deals.createCoupon',
  permission: 'deals.manage',
  schema: createCouponSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    if (input.kind === 'PERCENT' && input.value > 100) {
      throw new ValidationError('Percentage discount cannot exceed 100%');
    }

    const code = input.code.toUpperCase();
    try {
      const coupon = await db.coupon.create({
        data: {
          storeId: staff.storeId,
          code,
          kind: input.kind,
          value: input.value,
          minSpendCents: input.minSpendCents,
          maxUses: input.maxUses ?? null,
          firstOrderOnly: input.firstOrderOnly,
          active: true,
        },
      });

      safeRevalidateTag(CACHE_TAGS.deals);
      revalidatePath('/admin/deals');
      return { id: coupon.id, code: coupon.code };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`Coupon code "${code}" already exists`);
      }
      throw err;
    }
  },
});

export const toggleCouponAction = defineAction({
  name: 'admin.deals.toggleCoupon',
  permission: 'deals.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const existing = await db.coupon.findFirst({
      where: { id: input.id, storeId: staff.storeId },
    });
    if (!existing) throw new NotFoundError('Coupon not found');

    const updated = await db.coupon.update({
      where: { id: existing.id },
      data: { active: !existing.active },
    });

    safeRevalidateTag(CACHE_TAGS.deals);
    revalidatePath('/admin/deals');
    return { id: updated.id, active: updated.active };
  },
});

// ============================================================
// FINANCE ACTIONS
// ============================================================

const createExpenseSchema = z.object({
  category: z.string().trim().min(1, 'Category is required').max(60),
  description: z.string().trim().min(2, 'Description is required').max(300),
  amountCents: z.number().int().positive('Amount must be greater than $0.00'),
  method: z.enum(['CASH', 'CARD_EFTPOS', 'BANK']).default('BANK'),
});

export const createExpenseAction = defineAction({
  name: 'admin.finance.createExpense',
  permission: 'finance.view',
  schema: createExpenseSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);

    const expense = await db.expense.create({
      data: {
        storeId: staff.storeId,
        category: input.category,
        description: input.description,
        amountCents: input.amountCents,
        actorId: staff.id,
      },
    });

    await db.financialTransaction.create({
      data: {
        storeId: staff.storeId,
        direction: 'OUTFLOW',
        category: 'EXPENSE',
        method: input.method,
        amountCents: input.amountCents,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        note: `${input.category}: ${input.description}`,
      },
    });

    revalidatePath('/admin/finance');
    return { id: expense.id };
  },
});

// ============================================================
// STAFF & DYNAMIC RBAC ACTIONS
// ============================================================

const createRoleSchema = z.object({
  name: z.string().trim().min(2, 'Role name is required').max(60),
  description: z.string().trim().max(250).optional().default(''),
  maxDiscountPct: z.number().int().min(0).max(100).default(0),
});

export const createRoleAction = defineAction({
  name: 'admin.roles.create',
  permission: 'roles.manage',
  schema: createRoleSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);

    try {
      const role = await db.role.create({
        data: {
          storeId: staff.storeId,
          name: input.name,
          description: input.description,
          maxDiscountPct: input.maxDiscountPct,
          isSystem: false,
        },
      });
      revalidatePath('/admin/roles');
      revalidatePath('/admin/staff');
      return { id: role.id, name: role.name };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError(`Role "${input.name}" already exists`);
      }
      throw err;
    }
  },
});

const updateRolePermissionsSchema = z.object({
  roleId: z.string().min(1),
  permissionIds: z.array(z.string().min(1)),
  maxDiscountPct: z.number().int().min(0).max(100).optional(),
});

export const updateRolePermissionsAction = defineAction({
  name: 'admin.roles.updatePermissions',
  permission: 'roles.manage',
  schema: updateRolePermissionsSchema,
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const role = await db.role.findFirst({
      where: { id: input.roleId, storeId: staff.storeId },
    });
    if (!role) throw new NotFoundError('Role not found');

    // Guard rail 1: Cannot edit system Super Admin role
    if (role.isSystem) {
      throw new ForbiddenError('The system Super Admin role is locked and cannot be modified');
    }

    // Guard rail 2: Cannot edit own role
    if (role.id === staff.roleId) {
      throw new ForbiddenError('You cannot modify permissions on your own assigned role');
    }

    if (typeof input.maxDiscountPct === 'number') {
      await db.role.update({
        where: { id: role.id },
        data: { maxDiscountPct: input.maxDiscountPct },
      });
    }

    await db.rolePermission.deleteMany({ where: { roleId: role.id } });

    const uniquePermIds = Array.from(new Set(input.permissionIds));
    if (uniquePermIds.length > 0) {
      await db.rolePermission.createMany({
        data: uniquePermIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
    }

    // Immediately invalidate sessions for all staff assigned to this role
    const bumped = await db.staffUser.updateMany({
      where: { storeId: staff.storeId, roleId: role.id },
      data: { sessionVersion: { increment: 1 } },
    });

    revalidatePath('/admin/roles');
    revalidatePath('/admin/staff');
    return { roleId: role.id, permissionCount: uniquePermIds.length, affectedStaff: bumped.count };
  },
});

const createStaffUserSchema = z.object({
  name: z.string().trim().min(2, 'Full name is required').max(100),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits')
    .optional()
    .or(z.literal('')),
  roleId: z.string().min(1, 'Select a role'),
});

export const createStaffUserAction = defineAction({
  name: 'admin.staff.create',
  permission: 'staff.manage',
  schema: createStaffUserSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const role = await db.role.findFirst({
      where: { id: input.roleId, storeId: staff.storeId },
    });
    if (!role) throw new NotFoundError('Role not found');
    if (role.isSystem && !staff.isSuperAdmin) {
      throw new ForbiddenError('Only Super Admin can assign the Super Admin role');
    }

    const passwordHash = await hashSecret(input.password);
    const pinHash = input.pin ? await hashSecret(input.pin) : null;

    try {
      const created = await db.staffUser.create({
        data: {
          storeId: staff.storeId,
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          pinHash,
          roleId: role.id,
          active: true,
        },
      });
      revalidatePath('/admin/staff');
      return { id: created.id, email: created.email };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictError('A staff member with that email already exists');
      }
      throw err;
    }
  },
});

export const toggleStaffActiveAction = defineAction({
  name: 'admin.staff.toggleActive',
  permission: 'staff.manage',
  schema: toggleIdSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    if (input.id === staff.id) {
      throw new ForbiddenError('You cannot disable your own staff account');
    }

    const target = await db.staffUser.findFirst({
      where: { id: input.id, storeId: staff.storeId },
      include: { role: true },
    });
    if (!target) throw new NotFoundError('Staff member not found');
    if (target.role.isSystem && !staff.isSuperAdmin) {
      throw new ForbiddenError('Only Super Admin can modify a Super Admin account');
    }

    const updated = await db.staffUser.update({
      where: { id: target.id },
      data: {
        active: !target.active,
        sessionVersion: { increment: 1 },
      },
    });

    revalidatePath('/admin/staff');
    return { id: updated.id, active: updated.active };
  },
});

// ============================================================
// CMS & SETTINGS ACTIONS
// ============================================================

const saveAnnouncementSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(2, 'Announcement text is required').max(300),
  linkHref: z.string().trim().max(200).optional().default(''),
  active: z.boolean().default(true),
});

export const saveAnnouncementAction = defineAction({
  name: 'admin.cms.saveAnnouncement',
  permission: 'cms.manage',
  schema: saveAnnouncementSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);

    if (input.id) {
      const existing = await db.announcement.findFirst({
        where: { id: input.id, storeId: staff.storeId },
      });
      if (!existing) throw new NotFoundError('Announcement not found');

      const updated = await db.announcement.update({
        where: { id: existing.id },
        data: {
          text: input.text,
          linkHref: input.linkHref || null,
          active: input.active,
        },
      });
      safeRevalidateTag(CACHE_TAGS.cms);
      revalidatePath('/admin/cms');
      return { id: updated.id };
    }

    const created = await db.announcement.create({
      data: {
        storeId: staff.storeId,
        text: input.text,
        linkHref: input.linkHref || null,
        active: input.active,
      },
    });
    safeRevalidateTag(CACHE_TAGS.cms);
    revalidatePath('/admin/cms');
    return { id: created.id };
  },
});

const updateStoreSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Store name is required').max(120),
  abn: z.string().trim().max(32).default(''),
  phone: z.string().trim().max(40).default(''),
  email: z.string().trim().email('Invalid email').or(z.literal('')).default(''),
  address: z.string().trim().max(300).default(''),
  gstRatePct: z.number().int().min(0).max(30).default(10),
  gstRegistered: z.boolean().default(true),
  cardSurchargeBps: z.number().int().min(0).max(1000).default(0),
  holidaySurchargeBps: z.number().int().min(0).max(5000).default(0),
  soloMode: z.boolean().default(false),
  autoAcceptWeb: z.boolean().default(true),
  onlinePaused: z.boolean().default(false),
  pauseMessage: z.string().trim().max(500).optional().default(''),
  negativeStockPolicy: z.enum(['warn', 'block']).default('warn'),
});

export const updateStoreSettingsAction = defineAction({
  name: 'admin.settings.updateStore',
  permission: 'settings.manage',
  schema: updateStoreSettingsSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);

    const updated = await db.store.update({
      where: { id: staff.storeId },
      data: {
        name: input.name,
        abn: input.abn,
        phone: input.phone,
        email: input.email,
        address: input.address,
        gstRatePct: input.gstRatePct,
        gstRegistered: input.gstRegistered,
        cardSurchargeBps: input.cardSurchargeBps,
        holidaySurchargeBps: input.holidaySurchargeBps,
        soloMode: input.soloMode,
        autoAcceptWeb: input.autoAcceptWeb,
        onlinePaused: input.onlinePaused,
        pauseMessage: input.pauseMessage || null,
        negativeStockPolicy: input.negativeStockPolicy,
      },
    });

    safeRevalidateTag(CACHE_TAGS.settings);
    safeRevalidateTag(CACHE_TAGS.cms);
    revalidatePath('/admin/settings');
    return { id: updated.id };
  },
});

const createDeliveryZoneSchema = z.object({
  name: z.string().trim().min(1, 'Zone name is required').max(80),
  postcodes: z.string().trim().min(4, 'Enter comma-separated AU postcodes').max(500),
  feeCents: z.number().int().min(0),
  minOrderCents: z.number().int().min(0),
  travelMinutes: z.number().int().min(5).max(180).default(20),
});

export const createDeliveryZoneAction = defineAction({
  name: 'admin.settings.createDeliveryZone',
  permission: 'settings.manage',
  schema: createDeliveryZoneSchema,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);

    const zone = await db.deliveryZone.create({
      data: {
        storeId: staff.storeId,
        name: input.name,
        postcodes: input.postcodes.replace(/\s+/g, ''),
        feeCents: input.feeCents,
        minOrderCents: input.minOrderCents,
        travelMinutes: input.travelMinutes,
        active: true,
      },
    });

    safeRevalidateTag(CACHE_TAGS.settings);
    revalidatePath('/admin/settings');
    return { id: zone.id, name: zone.name };
  },
});

// ============================================================
// FULL EDIT ACTIONS (CATEGORIES, PRODUCTS, VARIANTS, INGREDIENTS,
// CMS HEADER/FOOTER NAV, HERO IMAGE, STAFF CREDENTIALS, BILLING)
// ============================================================

export const updateCategoryAction = defineAction({
  name: 'admin.catalog.updateCategory',
  permission: 'catalog.manage',
  schema: z.object({
    categoryId: z.string().min(1),
    name: z.string().trim().min(1, 'Category name is required').max(80),
    description: z.string().trim().max(300).optional().default(''),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    defaultStationId: z.string().optional().nullable(),
    showInMenu: z.boolean().default(true),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const cat = await db.category.findFirst({
      where: { id: input.categoryId, storeId: staff.storeId },
    });
    if (!cat) throw new NotFoundError('Category not found');

    const updated = await db.category.update({
      where: { id: cat.id },
      data: {
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl || null,
        defaultStationId: input.defaultStationId || null,
        showInMenu: input.showInMenu,
      },
    });
    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, name: updated.name };
  },
});

export const updateProductAction = defineAction({
  name: 'admin.catalog.updateProduct',
  permission: 'catalog.manage',
  schema: z.object({
    productId: z.string().min(1),
    name: z.string().trim().min(1, 'Product name is required').max(120),
    description: z.string().trim().max(1000).optional().default(''),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    categoryId: z.string().min(1),
    spicyLevel: z.number().int().min(0).max(3).default(0),
    isBestSeller: z.boolean().default(false),
    isMultiVariant: z.boolean().optional(),
    active: z.boolean().default(true),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const prod = await db.product.findFirst({
      where: { id: input.productId, storeId: staff.storeId },
    });
    if (!prod) throw new NotFoundError('Product not found');

    const updated = await db.product.update({
      where: { id: prod.id },
      data: {
        name: input.name,
        description: input.description,
        imageUrl: input.imageUrl || null,
        categoryId: input.categoryId,
        spicyLevel: input.spicyLevel,
        isBestSeller: input.isBestSeller,
        ...(input.isMultiVariant !== undefined ? { isMultiVariant: input.isMultiVariant } : {}),
        active: input.active,
      },
    });
    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, name: updated.name };
  },
});

export const updateVariantAction = defineAction({
  name: 'admin.catalog.updateVariant',
  permission: 'catalog.manage',
  schema: z.object({
    variantId: z.string().min(1),
    name: z.string().trim().min(1, 'Variant name is required').max(80),
    sku: z.string().trim().min(1, 'SKU is required').max(60),
    priceCents: z.number().int().min(0, 'Price must be non-negative'),
    prepMinutes: z.number().int().min(1).max(120).default(8),
    active: z.boolean(),
    soldOut: z.boolean(),
    comingSoon: z.boolean(),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const v = await db.variant.findFirst({
      where: { id: input.variantId, product: { storeId: staff.storeId } },
    });
    if (!v) throw new NotFoundError('Variant not found');

    // Business rule: toggling Coming Soon ON automatically sets active = false (disabled)
    const normalized = normalizeVariantFlags({
      active: input.active,
      soldOut: input.soldOut,
      comingSoon: input.comingSoon,
    });

    const updated = await db.variant.update({
      where: { id: v.id },
      data: {
        name: input.name,
        sku: input.sku,
        priceCents: input.priceCents,
        prepMinutes: input.prepMinutes,
        active: normalized.active,
        soldOut: normalized.soldOut,
        comingSoon: normalized.comingSoon,
      },
    });
    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/catalog');
    return { id: updated.id, active: updated.active, comingSoon: updated.comingSoon };
  },
});

export const updateInventoryItemAction = defineAction({
  name: 'admin.inventory.updateItem',
  permission: 'inventory.adjust',
  schema: z.object({
    inventoryItemId: z.string().min(1),
    name: z.string().trim().min(1, 'Ingredient name is required').max(100),
    code: z.string().trim().min(1, 'Code is required').max(40),
    description: z.string().trim().max(300).optional().default(''),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    minThreshold: z.number().min(0),
    costPerUnitCents: z.number().int().min(0),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const item = await db.inventoryItem.findFirst({
      where: { id: input.inventoryItemId, storeId: staff.storeId },
    });
    if (!item) throw new NotFoundError('Ingredient not found');

    const updated = await db.inventoryItem.update({
      where: { id: item.id },
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        imageUrl: input.imageUrl || null,
        minThreshold: new Prisma.Decimal(input.minThreshold),
        costPerUnitCents: input.costPerUnitCents,
      },
    });
    safeRevalidateTag(CACHE_TAGS.menu);
    revalidatePath('/admin/inventory');
    return { id: updated.id, name: updated.name };
  },
});

export const saveCmsNavItemAction = defineAction({
  name: 'admin.cms.saveNavItem',
  permission: 'cms.manage',
  schema: z.object({
    id: z.string().optional(),
    location: z.enum(['HEADER', 'FOOTER']),
    label: z.string().trim().min(1, 'Label is required').max(60),
    href: z.string().trim().min(1, 'Link URL is required').max(200),
    sortOrder: z.number().int().min(0).default(0),
    visible: z.boolean().default(true),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    if (input.id) {
      const existing = await db.cmsNavItem.findFirst({
        where: { id: input.id, storeId: staff.storeId },
      });
      if (!existing) throw new NotFoundError('Navigation item not found');
      const updated = await db.cmsNavItem.update({
        where: { id: existing.id },
        data: {
          location: input.location,
          label: input.label,
          href: input.href,
          sortOrder: input.sortOrder,
          visible: input.visible,
        },
      });
      safeRevalidateTag(CACHE_TAGS.cms);
      revalidatePath('/admin/cms');
      return { id: updated.id };
    }

    const created = await db.cmsNavItem.create({
      data: {
        storeId: staff.storeId,
        location: input.location,
        label: input.label,
        href: input.href,
        sortOrder: input.sortOrder,
        visible: input.visible,
      },
    });
    safeRevalidateTag(CACHE_TAGS.cms);
    revalidatePath('/admin/cms');
    return { id: created.id };
  },
});

export const deleteCmsNavItemAction = defineAction({
  name: 'admin.cms.deleteNavItem',
  permission: 'cms.manage',
  schema: z.object({ id: z.string().min(1) }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    await db.cmsNavItem.deleteMany({
      where: { id: input.id, storeId: staff.storeId },
    });
    safeRevalidateTag(CACHE_TAGS.cms);
    revalidatePath('/admin/cms');
    return { deleted: true };
  },
});

export const updateHeroImageAction = defineAction({
  name: 'admin.cms.updateHeroImage',
  permission: 'cms.manage',
  schema: z.object({
    heroImageUrl: z.string().trim().min(1, 'Hero image URL is required').max(500),
  }),
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    await db.store.update({
      where: { id: staff.storeId },
      data: { heroImageUrl: input.heroImageUrl },
    });
    safeRevalidateTag(CACHE_TAGS.cms);
    safeRevalidateTag(CACHE_TAGS.settings);
    revalidatePath('/admin/cms');
    return { heroImageUrl: input.heroImageUrl };
  },
});

export const updateStaffCredentialsAction = defineAction({
  name: 'admin.staff.updateCredentials',
  permission: 'staff.manage',
  schema: z.object({
    staffUserId: z.string().min(1),
    name: z.string().trim().min(2, 'Name is required').max(100),
    email: z.string().trim().email('Enter a valid email address'),
    roleId: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
    newPin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits').optional().or(z.literal('')),
  }),
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const target = await db.staffUser.findFirst({
      where: { id: input.staffUserId, storeId: staff.storeId },
      include: { role: true },
    });
    if (!target) throw new NotFoundError('Staff member not found');

    const targetRole = await db.role.findFirst({
      where: { id: input.roleId, storeId: staff.storeId },
    });
    if (!targetRole) throw new NotFoundError('Role not found');
    if (targetRole.isSystem && !staff.isSuperAdmin) {
      throw new ForbiddenError('Only a Super Admin can assign the Super Admin role');
    }

    const passwordHash = input.newPassword ? await hashSecret(input.newPassword) : undefined;
    const pinHash = input.newPin ? await hashSecret(input.newPin) : undefined;

    await db.staffUser.update({
      where: { id: target.id },
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        roleId: targetRole.id,
        ...(passwordHash ? { passwordHash } : {}),
        ...(pinHash ? { pinHash, pinFailedCount: 0, pinLockedUntil: null } : {}),
        sessionVersion: { increment: 1 },
      },
    });

    invalidateStaffSessionCache();
    revalidatePath('/admin/staff');
    return { id: target.id };
  },
});

export const saveReceiptTemplateAction = defineAction({
  name: 'admin.billing.saveTemplate',
  permission: 'billing.manage',
  schema: z.object({
    headerText: z.string().trim().min(2, 'Header text is required').max(160),
    footerText: z.string().trim().min(2, 'Footer text is required').max(400),
    showAbn: z.boolean().default(true),
    showGstLine: z.boolean().default(true),
  }),
  tx: true,
  handler: async (input, { actor, db }) => {
    const staff = requireStaffActor(actor);
    const latest = await db.receiptTemplate.findFirst({
      where: { storeId: staff.storeId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    await db.receiptTemplate.updateMany({
      where: { storeId: staff.storeId, active: true },
      data: { active: false },
    });

    const created = await db.receiptTemplate.create({
      data: {
        storeId: staff.storeId,
        version: (latest?.version ?? 0) + 1,
        headerText: input.headerText,
        footerText: input.footerText,
        showAbn: input.showAbn,
        showGstLine: input.showGstLine,
        active: true,
      },
    });

    safeRevalidateTag(CACHE_TAGS.settings);
    revalidatePath('/admin/billing');
    return { id: created.id, version: created.version };
  },
});
