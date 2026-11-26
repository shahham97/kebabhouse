import 'server-only';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireStaff, type StaffActor } from '@/lib/auth';
import { ForbiddenError, UnauthorizedError } from '@/lib/errors';
import { computeVariantAvailability } from '@/modules/catalog/availability';
import type { Permission } from '@/config/permissions';

export type AdminPageGuardResult =
  | { ok: true; actor: StaffActor }
  | { ok: false; forbiddenMessage: string };

/**
 * Server-side page guard for all Admin pages.
 * Calls requireStaff(permission):
 * - Unauthenticated -> redirect('/admin/login')
 * - Missing permission -> returns { ok: false, forbiddenMessage } (never leaks data)
 */
export async function guardAdminPage(permission: Permission): Promise<AdminPageGuardResult> {
  try {
    const actor = await requireStaff(permission);
    return { ok: true, actor };
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      redirect('/admin/login');
    }
    if (err instanceof ForbiddenError) {
      return { ok: false, forbiddenMessage: err.message };
    }
    throw err;
  }
}

function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export async function getAdminDashboardData(storeId: string) {
  const startOfToday = getStartOfToday();
  const now = new Date();

  const [
    todayPaymentsAgg,
    totalPaymentsAgg,
    paidOrdersCount,
    ordersByStatusRaw,
    ordersByChannelRaw,
    ordersByFulfilmentRaw,
    paymentsByMethodRaw,
    allInventoryItems,
    pendingPos,
    upcomingScheduledOrders,
    recentOrders,
    totalOrdersCount,
    totalAuditCount,
    notificationsTodayCount,
  ] = await Promise.all([
    db.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        createdAt: { gte: startOfToday },
        order: { storeId },
      },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    db.payment.aggregate({
      where: {
        status: 'SUCCEEDED',
        order: { storeId },
      },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    db.order.count({
      where: {
        storeId,
        paymentStatus: { in: ['PAID', 'PARTIALLY_PAID'] },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
    }),
    db.order.groupBy({
      by: ['status'],
      where: { storeId },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ['channel'],
      where: { storeId },
      _count: { id: true },
    }),
    db.order.groupBy({
      by: ['fulfilment'],
      where: { storeId },
      _count: { id: true },
    }),
    db.payment.groupBy({
      by: ['method'],
      where: {
        status: 'SUCCEEDED',
        order: { storeId },
      },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
    db.inventoryItem.findMany({
      where: { storeId },
      include: { vendor: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    db.purchaseOrder.findMany({
      where: {
        storeId,
        status: { in: ['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED'] },
      },
      include: { vendor: { select: { name: true } } },
      orderBy: { orderedAt: 'desc' },
      take: 10,
    }),
    db.order.findMany({
      where: {
        storeId,
        timing: 'SCHEDULED',
        status: { notIn: ['COMPLETED', 'CANCELLED', 'REFUNDED'] },
        scheduledFor: { gte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
      select: {
        id: true,
        number: true,
        customerName: true,
        fulfilment: true,
        scheduledFor: true,
        totalCents: true,
        status: true,
      },
    }),
    db.order.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        number: true,
        channel: true,
        fulfilment: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        totalCents: true,
        createdAt: true,
      },
    }),
    db.order.count({ where: { storeId } }),
    db.auditLog.count(),
    db.notificationLog.count({
      where: {
        createdAt: { gte: startOfToday },
        status: 'SENT',
      },
    }),
  ]);

  const todayRevenueCents = todayPaymentsAgg._sum.amountCents ?? 0;
  const totalRevenueCents = totalPaymentsAgg._sum.amountCents ?? 0;
  const aovCents = paidOrdersCount > 0 ? Math.round(totalRevenueCents / paidOrdersCount) : 0;

  const lowStockItems = allInventoryItems
    .filter((item) => Number(item.onHand) <= Number(item.minThreshold))
    .map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      onHand: Number(item.onHand),
      minThreshold: Number(item.minThreshold),
      vendorName: item.vendor?.name ?? 'Unassigned',
    }));

  return {
    todayRevenueCents,
    todayPaymentsCount: todayPaymentsAgg._count.id,
    totalRevenueCents,
    paidOrdersCount,
    aovCents,
    ordersByStatus: ordersByStatusRaw.map((r) => ({ status: r.status, count: r._count.id })),
    ordersByChannel: ordersByChannelRaw.map((r) => ({ channel: r.channel, count: r._count.id })),
    ordersByFulfilment: ordersByFulfilmentRaw.map((r) => ({
      fulfilment: r.fulfilment,
      count: r._count.id,
    })),
    revenueByPaymentMethod: paymentsByMethodRaw.map((r) => ({
      method: r.method,
      amountCents: r._sum.amountCents ?? 0,
      count: r._count.id,
    })),
    lowStockItems,
    pendingPos: pendingPos.map((po) => ({
      id: po.id,
      number: po.number,
      status: po.status,
      totalCents: po.totalCents,
      vendorName: po.vendor.name,
      orderedAt: po.orderedAt.toISOString(),
    })),
    upcomingScheduledOrders: upcomingScheduledOrders.map((o) => ({
      id: o.id,
      number: o.number,
      customerName: o.customerName,
      fulfilment: o.fulfilment,
      scheduledFor: o.scheduledFor ? o.scheduledFor.toISOString() : null,
      totalCents: o.totalCents,
      status: o.status,
    })),
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      number: o.number,
      channel: o.channel,
      fulfilment: o.fulfilment,
      customerName: o.customerName,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalCents: o.totalCents,
      createdAt: o.createdAt.toISOString(),
    })),
    systemHealth: {
      ordersCount: totalOrdersCount,
      auditCount: totalAuditCount,
      notificationsSentToday: notificationsTodayCount,
    },
  };
}

export async function getAdminOrders(storeId: string, statusFilter?: string, page = 1, pageSize = 30) {
  const safePage = Math.max(1, page);
  const where = {
    storeId,
    ...(statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  };

  const [orders, totalCount] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        items: true,
        payments: true,
        tickets: {
          include: {
            station: { select: { name: true, code: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
    }),
    db.order.count({ where }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      publicId: o.publicId,
      number: o.number,
      channel: o.channel,
      fulfilment: o.fulfilment,
      tableNumber: o.tableNumber,
      timing: o.timing,
      scheduledFor: o.scheduledFor?.toISOString() ?? null,
      status: o.status,
      paymentStatus: o.paymentStatus,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      subtotalCents: o.subtotalCents,
      discountCents: o.discountCents,
      deliveryFeeCents: o.deliveryFeeCents,
      surchargeCents: o.surchargeCents,
      gstCents: o.gstCents,
      totalCents: o.totalCents,
      amountPaidCents: o.amountPaidCents,
      createdAt: o.createdAt.toISOString(),
      itemCount: o.items.reduce((sum, i) => sum + i.quantity, 0),
      itemsSummary: o.items.map((i) => `${i.quantity}x ${i.productName} (${i.variantName})`).join(', '),
      paymentMethods: o.payments.map((p) => p.method).join(', ') || 'UNPAID',
      tickets: o.tickets.map((t) => ({
        id: t.id,
        stationName: t.station.name,
        stationCode: t.station.code,
        stationColor: t.station.color,
        status: t.status,
      })),
    })),
    totalCount,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
  };
}

export async function getAdminStations(storeId: string) {
  const stations = await db.station.findMany({
    where: { storeId },
    orderBy: { sortOrder: 'asc' },
    include: {
      tickets: {
        where: { status: { in: ['NEW', 'PREPARING'] } },
        select: { id: true, status: true },
      },
      _count: {
        select: { products: true, categories: true },
      },
    },
  });

  return stations.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    color: s.color,
    sortOrder: s.sortOrder,
    autoComplete: s.autoComplete,
    active: s.active,
    openTicketsCount: s.tickets.length,
    newTicketsCount: s.tickets.filter((t) => t.status === 'NEW').length,
    preparingTicketsCount: s.tickets.filter((t) => t.status === 'PREPARING').length,
    productsCount: s._count.products,
    categoriesCount: s._count.categories,
  }));
}

export async function getAdminCatalog(storeId: string) {
  const [categories, products, modifierGroups, stations] = await Promise.all([
    db.category.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        defaultStation: { select: { id: true, name: true, code: true } },
        _count: { select: { products: true } },
      },
    }),
    db.product.findMany({
      where: { storeId },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        station: { select: { id: true, name: true, code: true } },
        variants: {
          orderBy: { sortOrder: 'asc' },
          include: {
            recipeLines: {
              include: {
                inventoryItem: { select: { onHand: true } },
              },
            },
          },
        },
      },
    }),
    db.modifierGroup.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { products: true } },
      },
    }),
    db.station.findMany({
      where: { storeId, active: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, code: true },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      sortOrder: c.sortOrder,
      showInMenu: c.showInMenu,
      defaultStationId: c.defaultStationId,
      defaultStationName: c.defaultStation?.name ?? null,
      productCount: c._count.products,
    })),
    products: products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      stationId: p.stationId,
      stationName: p.station?.name ?? null,
      name: p.name,
      slug: p.slug,
      description: p.description,
      imageUrl: p.imageUrl,
      spicyLevel: p.spicyLevel,
      taxCode: p.taxCode,
      visibility: p.visibility,
      active: p.active,
      soldOut: p.soldOut,
      isBestSeller: p.isBestSeller,
      variants: p.variants.map((v) => {
        const avail = computeVariantAvailability({
          active: v.active,
          soldOut: v.soldOut || p.soldOut,
          comingSoon: v.comingSoon,
          recipeLines: v.recipeLines.map((rl) => ({
            quantity: Number(rl.quantity),
            onHand: Number(rl.inventoryItem.onHand),
          })),
        });
        return {
          id: v.id,
          name: v.name,
          sku: v.sku,
          priceCents: v.priceCents,
          prepMinutes: v.prepMinutes,
          active: v.active,
          soldOut: v.soldOut,
          comingSoon: v.comingSoon,
          maxServings: avail.maxServings,
          computedOutOfStock: avail.computedOutOfStock,
          isOrderable: avail.isOrderable,
        };
      }),
    })),
    modifierGroups: modifierGroups.map((mg) => ({
      id: mg.id,
      name: mg.name,
      minSelect: mg.minSelect,
      maxSelect: mg.maxSelect,
      required: mg.required,
      linkedProductsCount: mg._count.products,
      options: mg.options.map((opt) => ({
        id: opt.id,
        name: opt.name,
        priceDeltaCents: opt.priceDeltaCents,
        isDefault: opt.isDefault,
        active: opt.active,
        soldOut: opt.soldOut,
      })),
    })),
    stations,
  };
}

export async function getAdminInventory(storeId: string) {
  const [inventoryItems, transactions, recipeLines, vendors, variants] = await Promise.all([
    db.inventoryItem.findMany({
      where: { storeId },
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    }),
    db.inventoryTransaction.findMany({
      where: { inventoryItem: { storeId } },
      include: {
        inventoryItem: { select: { code: true, name: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
    db.recipeLine.findMany({
      where: { inventoryItem: { storeId } },
      include: {
        inventoryItem: { select: { id: true, code: true, name: true, unit: true } },
        variant: {
          select: {
            id: true,
            name: true,
            product: { select: { name: true } },
          },
        },
        modifierOption: {
          select: {
            id: true,
            name: true,
            group: { select: { name: true } },
          },
        },
      },
    }),
    db.vendor.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    db.variant.findMany({
      where: { product: { storeId }, active: true },
      include: { product: { select: { name: true } } },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    }),
  ]);

  return {
    inventoryItems: inventoryItems.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      description: i.description,
      imageUrl: i.imageUrl,
      unit: i.unit,
      onHand: Number(i.onHand),
      minThreshold: Number(i.minThreshold),
      costPerUnitCents: i.costPerUnitCents,
      preferredVendorId: i.preferredVendorId,
      vendorName: i.vendor?.name ?? '—',
      isLowStock: Number(i.onHand) <= Number(i.minThreshold),
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      itemCode: t.inventoryItem.code,
      itemName: t.inventoryItem.name,
      unit: t.inventoryItem.unit,
      kind: t.kind,
      quantity: Number(t.quantity),
      unitCostCents: t.unitCostCents,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      reason: t.reason,
      createdAt: t.createdAt.toISOString(),
    })),
    recipeLines: recipeLines.map((rl) => ({
      id: rl.id,
      targetLabel: rl.variant
        ? `${rl.variant.product.name} — ${rl.variant.name}`
        : rl.modifierOption
          ? `Modifier: ${rl.modifierOption.group.name} / ${rl.modifierOption.name}`
          : 'Unlinked',
      inventoryItemId: rl.inventoryItem.id,
      inventoryItemName: rl.inventoryItem.name,
      unit: rl.inventoryItem.unit,
      quantity: Number(rl.quantity),
    })),
    vendors,
    variants: variants.map((v) => ({
      id: v.id,
      label: `${v.product.name} — ${v.name}`,
    })),
  };
}

export async function getAdminPurchasing(storeId: string) {
  const [vendors, purchaseOrders, inventoryItems] = await Promise.all([
    db.vendor.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchaseOrders: true, items: true } },
      },
    }),
    db.purchaseOrder.findMany({
      where: { storeId },
      orderBy: { orderedAt: 'desc' },
      include: {
        vendor: { select: { id: true, name: true } },
        lines: {
          include: {
            inventoryItem: { select: { id: true, code: true, name: true, unit: true } },
          },
        },
        receipts: {
          orderBy: { createdAt: 'desc' },
          include: { lines: true },
        },
      },
    }),
    db.inventoryItem.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, unit: true, costPerUnitCents: true },
    }),
  ]);

  return {
    vendors: vendors.map((v) => ({
      id: v.id,
      name: v.name,
      abn: v.abn,
      contact: v.contact,
      email: v.email,
      phone: v.phone,
      address: v.address,
      notes: v.notes,
      poCount: v._count.purchaseOrders,
      itemCount: v._count.items,
    })),
    purchaseOrders: purchaseOrders.map((po) => ({
      id: po.id,
      number: po.number,
      status: po.status,
      vendorId: po.vendorId,
      vendorName: po.vendor.name,
      invoiceRef: po.invoiceRef,
      totalCents: po.totalCents,
      notes: po.notes,
      orderedAt: po.orderedAt.toISOString(),
      lines: po.lines.map((l) => ({
        id: l.id,
        inventoryItemId: l.inventoryItemId,
        itemCode: l.inventoryItem.code,
        itemName: l.inventoryItem.name,
        unit: l.inventoryItem.unit,
        orderedQty: Number(l.orderedQty),
        receivedQty: Number(l.receivedQty),
        remainingQty: Math.max(0, Number(l.orderedQty) - Number(l.receivedQty)),
        unitCostCents: l.unitCostCents,
      })),
      receipts: po.receipts.map((r) => ({
        id: r.id,
        invoiceRef: r.invoiceRef,
        notes: r.notes,
        createdAt: r.createdAt.toISOString(),
        linesCount: r.lines.length,
      })),
    })),
    inventoryItems,
  };
}

export async function getAdminDealsAndCoupons(storeId: string) {
  const [deals, coupons, loyaltyRule] = await Promise.all([
    db.deal.findMany({
      where: { storeId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        items: {
          include: {
            variant: {
              select: {
                name: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    db.coupon.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    }),
    db.loyaltyRule.findFirst({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    deals: deals.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      description: d.description,
      priceCents: d.priceCents,
      badgeText: d.badgeText,
      channels: d.channels,
      active: d.active,
      startsAt: d.startsAt?.toISOString() ?? null,
      endsAt: d.endsAt?.toISOString() ?? null,
      itemsSummary: d.items
        .map((i) => `${i.quantity}x ${i.variant.product.name} (${i.variant.name})`)
        .join(', '),
    })),
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: c.value,
      minSpendCents: c.minSpendCents,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      firstOrderOnly: c.firstOrderOnly,
      active: c.active,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
    })),
    loyaltyRule: loyaltyRule
      ? {
          id: loyaltyRule.id,
          pointsPerDollar: loyaltyRule.pointsPerDollar,
          redeemPointsBlock: loyaltyRule.redeemPointsBlock,
          redeemValueCents: loyaltyRule.redeemValueCents,
          active: loyaltyRule.active,
        }
      : null,
  };
}

export async function getAdminCustomers(storeId: string) {
  const customers = await db.customer.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      loyaltyAccount: true,
      orders: {
        where: { storeId },
        select: { id: true, totalCents: true, paymentStatus: true, createdAt: true },
      },
    },
  });

  return customers.map((c) => {
    const paidOrders = c.orders.filter(
      (o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'PARTIALLY_PAID'
    );
    const totalSpentCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const lastOrder = c.orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      loyaltyPoints: c.loyaltyAccount?.balance ?? 0,
      orderCount: c.orders.length,
      totalSpentCents,
      lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getAdminFinance(storeId: string) {
  const [financialTransactions, expenses, cashSessions, paymentsByMethodRaw] = await Promise.all([
    db.financialTransaction.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.expense.findMany({
      where: { storeId },
      orderBy: { incurredAt: 'desc' },
      take: 100,
    }),
    db.cashSession.findMany({
      where: { storeId },
      orderBy: { openedAt: 'desc' },
      take: 25,
      include: {
        openedBy: { select: { name: true } },
        payments: {
          where: { status: 'SUCCEEDED', method: 'CASH' },
          select: { amountCents: true },
        },
        movements: {
          select: { kind: true, amountCents: true },
        },
      },
    }),
    db.payment.groupBy({
      by: ['method'],
      where: {
        status: 'SUCCEEDED',
        order: { storeId },
      },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
  ]);

  const totalInflowsCents = financialTransactions
    .filter((t) => t.direction === 'INFLOW')
    .reduce((sum, t) => sum + t.amountCents, 0);
  const totalOutflowsCents = financialTransactions
    .filter((t) => t.direction === 'OUTFLOW')
    .reduce((sum, t) => sum + t.amountCents, 0);

  const methodTotals: Record<string, { amountCents: number; count: number }> = {
    CASH: { amountCents: 0, count: 0 },
    CARD_EFTPOS: { amountCents: 0, count: 0 },
    CARD_ONLINE: { amountCents: 0, count: 0 },
  };
  for (const row of paymentsByMethodRaw) {
    methodTotals[row.method] = {
      amountCents: row._sum.amountCents ?? 0,
      count: row._count.id,
    };
  }

  return {
    summary: {
      totalInflowsCents,
      totalOutflowsCents,
      netCents: totalInflowsCents - totalOutflowsCents,
    },
    revenueByMethod: Object.entries(methodTotals).map(([method, data]) => ({
      method,
      amountCents: data.amountCents,
      count: data.count,
    })),
    financialTransactions: financialTransactions.map((t) => ({
      id: t.id,
      direction: t.direction,
      category: t.category,
      method: t.method,
      amountCents: t.amountCents,
      sourceType: t.sourceType,
      sourceId: t.sourceId,
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      category: e.category,
      description: e.description,
      amountCents: e.amountCents,
      incurredAt: e.incurredAt.toISOString(),
    })),
    cashSessions: cashSessions.map((cs) => {
      const cashSalesCents = cs.payments.reduce((sum, p) => sum + p.amountCents, 0);
      const movementsNetCents = cs.movements.reduce(
        (sum, m) => sum + (m.kind === 'IN' ? m.amountCents : -m.amountCents),
        0
      );
      const computedExpectedCents = cs.openingFloatCents + cashSalesCents + movementsNetCents;
      return {
        id: cs.id,
        openedByName: cs.openedBy.name,
        status: cs.status,
        openingFloatCents: cs.openingFloatCents,
        cashSalesCents,
        expectedCashCents: cs.expectedCashCents ?? computedExpectedCents,
        countedCashCents: cs.countedCashCents,
        varianceCents: cs.varianceCents,
        openedAt: cs.openedAt.toISOString(),
        closedAt: cs.closedAt?.toISOString() ?? null,
        notes: cs.notes,
      };
    }),
  };
}

export async function getAdminCms(storeId: string) {
  const [announcements, navItems, store] = await Promise.all([
    db.announcement.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    }),
    db.cmsNavItem.findMany({
      where: { storeId },
      orderBy: [{ location: 'asc' }, { sortOrder: 'asc' }],
    }),
    db.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        heroImageUrl: true,
        brandingJson: true,
      },
    }),
  ]);

  return {
    announcements: announcements.map((a) => ({
      id: a.id,
      text: a.text,
      linkHref: a.linkHref ?? '',
      active: a.active,
      startsAt: a.startsAt?.toISOString() ?? null,
      endsAt: a.endsAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    navItems: navItems.map((n) => ({
      id: n.id,
      location: n.location,
      label: n.label,
      href: n.href,
      sortOrder: n.sortOrder,
      visible: n.visible,
    })),
    storeBranding: {
      storeName: store.name,
      slug: store.slug,
      heroImageUrl: store.heroImageUrl,
      brandingJson: store.brandingJson as Record<string, string> | null,
    },
  };
}

export async function getAdminBilling(storeId: string) {
  const [store, templates] = await Promise.all([
    db.store.findUniqueOrThrow({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        abn: true,
        phone: true,
        email: true,
        address: true,
        gstRatePct: true,
        gstRegistered: true,
      },
    }),
    db.receiptTemplate.findMany({
      where: { storeId },
      orderBy: { version: 'desc' },
      take: 10,
    }),
  ]);

  return {
    store,
    templates: templates.map((t) => ({
      id: t.id,
      version: t.version,
      headerText: t.headerText,
      footerText: t.footerText,
      showAbn: t.showAbn,
      showGstLine: t.showGstLine,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function getAdminStaffAndRoles(storeId: string) {
  const [staffUsers, roles, permissions] = await Promise.all([
    db.staffUser.findMany({
      where: { storeId },
      include: {
        role: { select: { id: true, name: true, isSystem: true } },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    db.role.findMany({
      where: { storeId },
      include: {
        permissions: {
          include: { permission: { select: { id: true, key: true } } },
        },
        _count: { select: { staffUsers: true } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    }),
    db.permission.findMany({
      orderBy: [{ module: 'asc' }, { key: 'asc' }],
    }),
  ]);

  const permissionsByModule: Record<
    string,
    Array<{ id: string; key: string; label: string; description: string }>
  > = {};
  for (const p of permissions) {
    const bucket = (permissionsByModule[p.module] ??= []);
    bucket.push({
      id: p.id,
      key: p.key,
      label: p.label,
      description: p.description,
    });
  }

  return {
    staffUsers: staffUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      roleName: u.role.name,
      isSystemRole: u.role.isSystem,
      active: u.active,
      hasPin: Boolean(u.pinHash),
      sessionVersion: u.sessionVersion,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      maxDiscountPct: r.maxDiscountPct,
      staffCount: r._count.staffUsers,
      permissionIds: r.permissions.map((rp) => rp.permission.id),
      permissionKeys: r.permissions.map((rp) => rp.permission.key),
    })),
    permissionsByModule,
  };
}

export async function getAdminAuditLogs() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  return logs.map((l) => ({
    id: l.id,
    actorType: l.actorType,
    actorId: l.actorId,
    actorName: l.actorName || 'System',
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
    ip: l.ip ?? '',
    requestId: l.requestId,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function getAdminSettings(storeId: string) {
  const [store, openingHours, deliveryZones, timeSlotRules, receiptTemplates] = await Promise.all([
    db.store.findUniqueOrThrow({ where: { id: storeId } }),
    db.openingHours.findMany({
      where: { storeId },
      orderBy: { dayOfWeek: 'asc' },
    }),
    db.deliveryZone.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    }),
    db.timeSlotRule.findMany({
      where: { storeId },
      orderBy: { fulfilment: 'asc' },
    }),
    db.receiptTemplate.findMany({
      where: { storeId },
      orderBy: { version: 'desc' },
      take: 5,
    }),
  ]);

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
      holidaySurchargeBps: store.holidaySurchargeBps,
      soloMode: store.soloMode,
      autoAcceptWeb: store.autoAcceptWeb,
      onlinePaused: store.onlinePaused,
      pauseMessage: store.pauseMessage ?? '',
      negativeStockPolicy: store.negativeStockPolicy,
    },
    openingHours: openingHours.map((h) => ({
      id: h.id,
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: h.isClosed,
    })),
    deliveryZones: deliveryZones.map((z) => ({
      id: z.id,
      name: z.name,
      postcodes: z.postcodes,
      feeCents: z.feeCents,
      minOrderCents: z.minOrderCents,
      travelMinutes: z.travelMinutes,
      active: z.active,
    })),
    timeSlotRules: timeSlotRules.map((t) => ({
      id: t.id,
      fulfilment: t.fulfilment,
      slotMinutes: t.slotMinutes,
      minLeadMinutes: t.minLeadMinutes,
      maxDaysAhead: t.maxDaysAhead,
      maxOrdersPerSlot: t.maxOrdersPerSlot,
      maxItemsPerSlot: t.maxItemsPerSlot,
    })),
    receiptTemplates: receiptTemplates.map((r) => ({
      id: r.id,
      version: r.version,
      headerText: r.headerText,
      footerText: r.footerText,
      showAbn: r.showAbn,
      showGstLine: r.showGstLine,
      active: r.active,
    })),
  };
}
