import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';
import { CACHE_TAGS } from '@/lib/cache';
import { getCustomerActor, getStaffActor, signTrackingToken } from '@/lib/auth';
import {
  computeVariantAvailability,
  toCustomerVariantView,
  type CustomerAvailabilityStatus,
} from '@/modules/catalog/availability';

export const STORE_SLUG = 'star-kebab';

export interface PublicModifierOption {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  soldOut: boolean;
}

export interface PublicModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  options: PublicModifierOption[];
}

export interface PublicVariant {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  prepMinutes: number;
  soldOut: boolean;
  isOrderable: boolean;
  status: CustomerAvailabilityStatus;
}

export interface PublicProduct {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  allergens: string[];
  spicyLevel: number;
  soldOut: boolean;
  isBestSeller: boolean;
  isMultiVariant: boolean;
  variants: PublicVariant[];
  modifierGroups: PublicModifierGroup[];
}

export interface PublicMenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  products: PublicProduct[];
}

function parseStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((x): x is string => typeof x === 'string');
}

function mapProduct(
  p: {
    id: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    imageUrl: string | null;
    tagsJson: unknown;
    allergensJson: unknown;
    spicyLevel: number;
    soldOut: boolean;
    isBestSeller: boolean;
    isMultiVariant: boolean;
    category?: { name: string };
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      priceCents: number;
      prepMinutes: number;
      active: boolean;
      soldOut: boolean;
      comingSoon: boolean;
      recipeLines?: Array<{
        quantity: unknown;
        inventoryItem: { onHand: unknown };
      }>;
    }>;
    modifierGroups: Array<{
      modifierGroup: {
        id: string;
        name: string;
        minSelect: number;
        maxSelect: number;
        required: boolean;
        options: Array<{
          id: string;
          name: string;
          priceDeltaCents: number;
          isDefault: boolean;
          soldOut: boolean;
        }>;
      };
    }>;
  },
  fallbackCategoryName = ''
): PublicProduct {
  return {
    id: p.id,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? fallbackCategoryName,
    name: p.name,
    slug: p.slug,
    description: p.description,
    imageUrl: p.imageUrl,
    tags: parseStringArray(p.tagsJson),
    allergens: parseStringArray(p.allergensJson),
    spicyLevel: p.spicyLevel,
    soldOut: p.soldOut,
    isBestSeller: p.isBestSeller,
    isMultiVariant: p.isMultiVariant,
    variants: p.variants.map((v) => {
      const avail = computeVariantAvailability({
        active: v.active,
        soldOut: v.soldOut || p.soldOut,
        comingSoon: v.comingSoon,
        recipeLines: (v.recipeLines ?? []).map((rl) => ({
          quantity: Number(rl.quantity),
          onHand: Number(rl.inventoryItem.onHand),
        })),
      });
      const customerView = toCustomerVariantView(avail);
      return {
        id: v.id,
        name: v.name,
        sku: v.sku,
        priceCents: v.priceCents,
        prepMinutes: v.prepMinutes,
        soldOut: !customerView.isOrderable,
        isOrderable: customerView.isOrderable,
        status: customerView.status,
      };
    }),
    modifierGroups: p.modifierGroups.map((pmg) => ({
      id: pmg.modifierGroup.id,
      name: pmg.modifierGroup.name,
      minSelect: pmg.modifierGroup.minSelect,
      maxSelect: pmg.modifierGroup.maxSelect,
      required: pmg.modifierGroup.required,
      options: pmg.modifierGroup.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDeltaCents: o.priceDeltaCents,
        isDefault: o.isDefault,
        soldOut: o.soldOut,
      })),
    })),
  };
}

async function fetchStorefrontContext() {
  const store = await db.store.findUnique({
    where: { slug: STORE_SLUG },
    include: {
      openingHours: { orderBy: { dayOfWeek: 'asc' } },
      deliveryZones: { where: { active: true }, orderBy: { feeCents: 'asc' } },
      timeSlotRules: true,
      cmsNavItems: { where: { visible: true }, orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!store) {
    throw new Error(`Store "${STORE_SLUG}" not found. Run database seed first.`);
  }

  const now = new Date();
  const announcements = await db.announcement.findMany({
    where: {
      storeId: store.id,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const headerNav = store.cmsNavItems.filter((n) => n.location === 'HEADER');
  const footerNav = store.cmsNavItems.filter((n) => n.location === 'FOOTER');

  return {
    store: {
      id: store.id,
      name: store.name,
      slug: store.slug,
      abn: store.abn,
      phone: store.phone,
      email: store.email,
      address: store.address,
      timezone: store.timezone,
      currency: store.currency,
      gstRatePct: store.gstRatePct,
      gstRegistered: store.gstRegistered,
      cardSurchargeBps: store.cardSurchargeBps,
      onlinePaused: store.onlinePaused,
      pauseMessage: store.pauseMessage,
      pauseResumeAt: store.pauseResumeAt,
      heroImageUrl: store.heroImageUrl,
    },
    announcements,
    headerNav,
    footerNav,
    openingHours: store.openingHours,
    deliveryZones: store.deliveryZones,
    timeSlotRules: store.timeSlotRules,
  };
}

export const getStorefrontContext = unstable_cache(
  fetchStorefrontContext,
  ['storefront-context'],
  { revalidate: 300, tags: [CACHE_TAGS.settings, CACHE_TAGS.cms] }
);

async function fetchPublicMenu(): Promise<PublicMenuCategory[]> {
  const store = await db.store.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true },
  });
  if (!store) return [];

  const categories = await db.category.findMany({
    where: { storeId: store.id, showInMenu: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      products: {
        where: {
          active: true,
          visibility: { in: ['WEB', 'BOTH'] },
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          tagsJson: true,
          allergensJson: true,
          spicyLevel: true,
          soldOut: true,
          isBestSeller: true,
          isMultiVariant: true,
          variants: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              name: true,
              sku: true,
              priceCents: true,
              prepMinutes: true,
              active: true,
              soldOut: true,
              comingSoon: true,
              recipeLines: {
                select: {
                  quantity: true,
                  inventoryItem: { select: { onHand: true } },
                },
              },
            },
          },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            select: {
              modifierGroup: {
                select: {
                  id: true,
                  name: true,
                  minSelect: true,
                  maxSelect: true,
                  required: true,
                  options: {
                    where: { active: true },
                    orderBy: { sortOrder: 'asc' },
                    select: {
                      id: true,
                      name: true,
                      priceDeltaCents: true,
                      isDefault: true,
                      soldOut: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.imageUrl,
      products: cat.products
        .filter((p) => p.variants.length > 0)
        .map((p) => mapProduct(p, cat.name)),
    }))
    .filter((cat) => cat.products.length > 0);
}

export const getPublicMenu = unstable_cache(
  fetchPublicMenu,
  ['storefront-public-menu'],
  { revalidate: 300, tags: [CACHE_TAGS.menu] }
);

async function fetchActiveDeals() {
  const store = await db.store.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true },
  });
  if (!store) return [];

  const now = new Date();
  return db.deal.findMany({
    where: {
      storeId: store.id,
      active: true,
      channels: { in: ['WEB', 'BOTH'] },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        include: {
          variant: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      },
    },
  });
}

export const getActiveDeals = unstable_cache(
  fetchActiveDeals,
  ['storefront-active-deals'],
  { revalidate: 300, tags: [CACHE_TAGS.deals] }
);

async function fetchActiveCoupons() {
  const store = await db.store.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true },
  });
  if (!store) return [];

  const now = new Date();
  return db.coupon.findMany({
    where: {
      storeId: store.id,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export const getActiveCoupons = unstable_cache(
  fetchActiveCoupons,
  ['storefront-active-coupons'],
  { revalidate: 300, tags: [CACHE_TAGS.deals] }
);

async function fetchBestSellers(): Promise<PublicProduct[]> {
  const store = await db.store.findUnique({
    where: { slug: STORE_SLUG },
    select: { id: true },
  });
  if (!store) return [];

  const products = await db.product.findMany({
    where: {
      storeId: store.id,
      active: true,
      isBestSeller: true,
      visibility: { in: ['WEB', 'BOTH'] },
    },
    orderBy: { sortOrder: 'asc' },
    take: 8,
    select: {
      id: true,
      categoryId: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      tagsJson: true,
      allergensJson: true,
      spicyLevel: true,
      soldOut: true,
      isBestSeller: true,
      isMultiVariant: true,
      category: { select: { name: true } },
      variants: {
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          priceCents: true,
          prepMinutes: true,
          active: true,
          soldOut: true,
          comingSoon: true,
          recipeLines: {
            select: {
              quantity: true,
              inventoryItem: { select: { onHand: true } },
            },
          },
        },
      },
      modifierGroups: {
        orderBy: { sortOrder: 'asc' },
        select: {
          modifierGroup: {
            select: {
              id: true,
              name: true,
              minSelect: true,
              maxSelect: true,
              required: true,
              options: {
                where: { active: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                  id: true,
                  name: true,
                  priceDeltaCents: true,
                  isDefault: true,
                  soldOut: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return products.filter((p) => p.variants.length > 0).map((p) => mapProduct(p));
}

export const getBestSellers = unstable_cache(
  fetchBestSellers,
  ['storefront-best-sellers'],
  { revalidate: 300, tags: [CACHE_TAGS.menu] }
);

export async function getOrderForTracking(publicId: string, token?: string | null) {
  const order = await db.order.findUnique({
    where: { publicId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'asc' } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
      store: {
        select: {
          id: true,
          name: true,
          phone: true,
          abn: true,
          address: true,
          timezone: true,
        },
      },
    },
  });

  if (!order) return null;

  const expectedToken = signTrackingToken(order.publicId);
  const tokenValid = !!token && token === expectedToken;

  if (!tokenValid) {
    const [customer, staff] = await Promise.all([getCustomerActor(), getStaffActor()]);
    const ownsOrder = customer && order.customerId && customer.id === order.customerId;
    if (!ownsOrder && !staff) {
      return null;
    }
  }

  return order;
}

export async function getCustomerAccountData(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      loyaltyAccount: {
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 25,
          },
        },
      },
      addresses: {
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          items: true,
        },
      },
    },
  });

  return customer;
}
