import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../src/config/permissions';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Star Kebab platform on TiDB Cloud...');

  // 1. Seed Permission catalogue (batched for fast remote TiDB seeding)
  await prisma.permission.createMany({
    data: PERMISSIONS.map((p) => ({
      key: p.key,
      module: p.module,
      label: p.label,
      description: p.description,
    })),
    skipDuplicates: true,
  });
  const allPerms = await prisma.permission.findMany();
  const permMap = new Map<string, string>(allPerms.map((p) => [p.key, p.id]));

  // 2. Seed Store: Star Kebab
  const store = await prisma.store.upsert({
    where: { slug: 'star-kebab' },
    update: {},
    create: {
      name: 'Star Kebab',
      slug: 'star-kebab',
      abn: '51 824 753 556',
      phone: '(02) 9876 5432',
      email: 'hello@starkebab.com.au',
      address: '148 King Street, Newtown NSW 2042',
      timezone: 'Australia/Sydney',
      currency: 'AUD',
      gstRatePct: 10,
      gstRegistered: true,
      cardSurchargeBps: 0,
      holidaySurchargeBps: 0,
      soloMode: false,
      autoAcceptWeb: true,
      onlinePaused: false,
      negativeStockPolicy: 'warn',
    },
  });

  // 3. Opening Hours (incl. late night Fri/Sat)
  const hours = [
    { dayOfWeek: 0, openTime: '11:00', closeTime: '23:00' },
    { dayOfWeek: 1, openTime: '11:00', closeTime: '23:00' },
    { dayOfWeek: 2, openTime: '11:00', closeTime: '23:00' },
    { dayOfWeek: 3, openTime: '11:00', closeTime: '23:00' },
    { dayOfWeek: 4, openTime: '11:00', closeTime: '23:30' },
    { dayOfWeek: 5, openTime: '11:00', closeTime: '02:00' },
    { dayOfWeek: 6, openTime: '11:00', closeTime: '02:00' },
  ];
  for (const h of hours) {
    await prisma.openingHours.upsert({
      where: { storeId_dayOfWeek: { storeId: store.id, dayOfWeek: h.dayOfWeek } },
      update: h,
      create: { storeId: store.id, ...h },
    });
  }

  // 4. TimeSlotRules
  for (const rule of [
    { fulfilment: 'PICKUP', slotMinutes: 15, minLeadMinutes: 20, maxDaysAhead: 7, maxOrdersPerSlot: 12, maxItemsPerSlot: 50 },
    { fulfilment: 'DELIVERY', slotMinutes: 15, minLeadMinutes: 35, maxDaysAhead: 7, maxOrdersPerSlot: 8, maxItemsPerSlot: 40 },
  ]) {
    await prisma.timeSlotRule.upsert({
      where: { storeId_fulfilment: { storeId: store.id, fulfilment: rule.fulfilment } },
      update: rule,
      create: { storeId: store.id, ...rule },
    });
  }

  // 5. Delivery Zones
  const existingZones = await prisma.deliveryZone.count({ where: { storeId: store.id } });
  if (existingZones === 0) {
    await prisma.deliveryZone.createMany({
      data: [
        { storeId: store.id, name: 'Inner West Express', postcodes: '2042,2043,2044,2048,2050', feeCents: 495, minOrderCents: 2000, travelMinutes: 18 },
        { storeId: store.id, name: 'Sydney CBD & Surrounds', postcodes: '2000,2007,2008,2009,2010,2015,2016', feeCents: 695, minOrderCents: 2500, travelMinutes: 25 },
      ],
    });
  }

  // 6. Roles & Staff Users
  const superAdminRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Super Admin' } },
    update: { isSystem: true, maxDiscountPct: 100 },
    create: { storeId: store.id, name: 'Super Admin', description: 'Full platform access (locked)', isSystem: true, maxDiscountPct: 100 },
  });

  const counterRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Counter Staff' } },
    update: { maxDiscountPct: 10 },
    create: { storeId: store.id, name: 'Counter Staff', description: 'Till POS, serve, collect, dispatch, payments', isSystem: false, maxDiscountPct: 10 },
  });

  const kitchenRole = await prisma.role.upsert({
    where: { storeId_name: { storeId: store.id, name: 'Kitchen Chef' } },
    update: {},
    create: { storeId: store.id, name: 'Kitchen Chef', description: 'Kitchen station screens only', isSystem: false, maxDiscountPct: 0 },
  });

  // Assign permissions to roles (batched)
  const counterPermKeys = [
    'orders.view', 'orders.create', 'orders.serve', 'orders.dispatch',
    'orders.history.view', 'till.use', 'till.mark_all_ready', 'payments.take', 'discounts.apply',
  ];
  const kitchenPermKeys = ['kitchen.view', 'kitchen.prepare', 'kitchen.recall'];

  await prisma.rolePermission.createMany({
    data: [
      ...[...permMap.values()].map((permissionId) => ({ roleId: superAdminRole.id, permissionId })),
      ...counterPermKeys.map((k) => permMap.get(k)).filter((x): x is string => !!x).map((permissionId) => ({ roleId: counterRole.id, permissionId })),
      ...kitchenPermKeys.map((k) => permMap.get(k)).filter((x): x is string => !!x).map((permissionId) => ({ roleId: kitchenRole.id, permissionId })),
    ],
    skipDuplicates: true,
  });

  const adminPass = await bcrypt.hash('StarAdmin123!', 10);
  const staffPass = await bcrypt.hash('StarStaff123!', 10);
  const pin1111 = await bcrypt.hash('1111', 10);
  const pin2222 = await bcrypt.hash('2222', 10);
  const pin3333 = await bcrypt.hash('3333', 10);

  await prisma.staffUser.upsert({
    where: { email: 'admin@starkebab.com.au' },
    update: { name: 'Usama (Owner)' },
    create: {
      storeId: store.id,
      email: 'admin@starkebab.com.au',
      name: 'Usama (Owner)',
      passwordHash: adminPass,
      pinHash: pin1111,
      roleId: superAdminRole.id,
    },
  });

  await prisma.staffUser.upsert({
    where: { email: 'staff@starkebab.com.au' },
    update: { name: "Liam O'Connor (Counter Staff)" },
    create: {
      storeId: store.id,
      email: 'staff@starkebab.com.au',
      name: "Liam O'Connor (Counter Staff)",
      passwordHash: staffPass,
      pinHash: pin2222,
      roleId: counterRole.id,
    },
  });

  await prisma.staffUser.upsert({
    where: { email: 'chef@starkebab.com.au' },
    update: { name: 'Jack Thompson (Grill Chef)' },
    create: {
      storeId: store.id,
      email: 'chef@starkebab.com.au',
      name: 'Jack Thompson (Grill Chef)',
      passwordHash: staffPass,
      pinHash: pin3333,
      roleId: kitchenRole.id,
    },
  });

  // 7. Kitchen Stations (data-driven!)
  const stationDefs = [
    { code: 'kebab', name: 'Kebab Station', color: '#C8401E', sortOrder: 1, autoComplete: false },
    { code: 'snack-pack', name: 'Snack Pack (HSP)', color: '#F4A62A', sortOrder: 2, autoComplete: false },
    { code: 'pizza', name: 'Pizza & Pide Oven', color: '#D97706', sortOrder: 3, autoComplete: false },
    { code: 'grill', name: 'Charcoal Grill', color: '#B42318', sortOrder: 4, autoComplete: false },
    { code: 'fryer', name: 'Fryer & Entrées', color: '#2F7D4A', sortOrder: 5, autoComplete: false },
    { code: 'counter', name: 'Counter & Drinks', color: '#6B5E55', sortOrder: 6, autoComplete: true },
  ];
  const stations = new Map<string, string>();
  for (const s of stationDefs) {
    const st = await prisma.station.upsert({
      where: { storeId_code: { storeId: store.id, code: s.code } },
      update: s,
      create: { storeId: store.id, ...s },
    });
    stations.set(s.code, st.id);
  }
  await prisma.store.update({
    where: { id: store.id },
    data: { defaultStationId: stations.get('kebab') },
  });

  // 8. Categories
  const categoryDefs = [
    { slug: 'kebabs', name: 'Charcoal Kebabs', description: 'Carved fresh off the vertical spit, wrapped in warm Turkish flatbread.', imageUrl: '/images/kebab-wrap.jpg', sortOrder: 1, station: 'kebab' },
    { slug: 'snack-packs', name: 'Halal Snack Packs', description: 'Crispy seasoned chips piled high with doner meat, melted cheese & holy trinity sauces.', imageUrl: '/images/hsp-box.jpg', sortOrder: 2, station: 'snack-pack' },
    { slug: 'pizza-pide', name: 'Wood-Fired Pizza & Pide', description: 'Hand-stretched Turkish pide and gourmet pizzas baked in our stone deck oven.', imageUrl: '/images/turkish-pizza.jpg', sortOrder: 3, station: 'pizza' },
    { slug: 'charcoal-grill', name: 'Charcoal Grill Plates', description: 'Skewers flame-grilled over ironbark charcoal, served with saffron rice & salad.', imageUrl: '/images/grill-plate.jpg', sortOrder: 4, station: 'grill' },
    { slug: 'sides-entrees', name: 'Sides & Entrées', description: 'Golden chips, house-made falafel, dips, and warm garlic bread.', imageUrl: '/images/sides-chips.jpg', sortOrder: 5, station: 'fryer' },
    { slug: 'drinks', name: 'Cold Drinks', description: 'Ice-cold cans, bottles, and traditional Turkish Ayran.', imageUrl: '/images/sides-chips.jpg', sortOrder: 6, station: 'counter' },
  ];
  const categories = new Map<string, string>();
  for (const c of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: c.slug } },
      update: { name: c.name, description: c.description, imageUrl: c.imageUrl, sortOrder: c.sortOrder, defaultStationId: stations.get(c.station) },
      create: { storeId: store.id, slug: c.slug, name: c.name, description: c.description, imageUrl: c.imageUrl, sortOrder: c.sortOrder, defaultStationId: stations.get(c.station) },
    });
    categories.set(c.slug, cat.id);
  }

  // 9. Modifier Groups (Meat, Sauces, Salad, Extras)
  const ensureModGroup = async (
    name: string,
    minSelect: number,
    maxSelect: number,
    required: boolean,
    sortOrder: number,
    options: Array<{ name: string; priceDeltaCents: number; isDefault?: boolean }>
  ) => {
    let group = await prisma.modifierGroup.findFirst({ where: { storeId: store.id, name } });
    if (!group) {
      group = await prisma.modifierGroup.create({
        data: {
          storeId: store.id,
          name,
          minSelect,
          maxSelect,
          required,
          sortOrder,
          options: {
            create: options.map((o, i) => ({
              name: o.name,
              priceDeltaCents: o.priceDeltaCents,
              isDefault: !!o.isDefault,
              sortOrder: i + 1,
            })),
          },
        },
      });
    }
    return group;
  };

  const meatGroup = await ensureModGroup('Choice of Meat', 1, 1, true, 1, [
    { name: 'Charcoal Lamb', priceDeltaCents: 0, isDefault: true },
    { name: 'Marinated Chicken', priceDeltaCents: 0 },
    { name: 'Mixed Lamb & Chicken', priceDeltaCents: 100 },
    { name: 'Crispy Herb Falafel (V)', priceDeltaCents: 0 },
  ]);

  const sauceGroup = await ensureModGroup('Sauces (Up to 3)', 0, 3, false, 2, [
    { name: 'Garlic Toum', priceDeltaCents: 0, isDefault: true },
    { name: 'House Chilli', priceDeltaCents: 0 },
    { name: 'Smoky BBQ', priceDeltaCents: 0 },
    { name: 'Tomato Sauce', priceDeltaCents: 0 },
    { name: 'Sweet Chilli', priceDeltaCents: 0 },
    { name: 'Mint Yoghurt', priceDeltaCents: 0 },
    { name: 'Hummus', priceDeltaCents: 50 },
  ]);

  const saladGroup = await ensureModGroup('Fresh Salads', 0, 5, false, 3, [
    { name: 'Crisp Lettuce', priceDeltaCents: 0, isDefault: true },
    { name: 'Ripe Tomato', priceDeltaCents: 0, isDefault: true },
    { name: 'Red Onion', priceDeltaCents: 0, isDefault: true },
    { name: 'Fresh Tabouli', priceDeltaCents: 100 },
    { name: 'Pickled Jalapeños', priceDeltaCents: 50 },
  ]);

  const extrasGroup = await ensureModGroup('Add Extras', 0, 4, false, 4, [
    { name: 'Melted Tasty Cheese', priceDeltaCents: 150 },
    { name: 'Extra Carved Meat', priceDeltaCents: 350 },
    { name: 'Fetta Cheese', priceDeltaCents: 200 },
    { name: 'Halloumi Slices', priceDeltaCents: 300 },
  ]);

  // 10. Products & Variants
  const upsertProduct = async (p: {
    slug: string;
    categorySlug: string;
    name: string;
    description: string;
    imageUrl: string;
    tags: string[];
    allergens: string[];
    spicyLevel?: number;
    isBestSeller?: boolean;
    sortOrder: number;
    modifierGroupIds: string[];
    variants: Array<{ name: string; sku: string; priceCents: number; prepMinutes: number }>;
  }) => {
    const product = await prisma.product.upsert({
      where: { storeId_slug: { storeId: store.id, slug: p.slug } },
      update: {
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        tagsJson: p.tags,
        allergensJson: p.allergens,
        spicyLevel: p.spicyLevel ?? 0,
        isBestSeller: !!p.isBestSeller,
        sortOrder: p.sortOrder,
      },
      create: {
        storeId: store.id,
        categoryId: categories.get(p.categorySlug)!,
        slug: p.slug,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        tagsJson: p.tags,
        allergensJson: p.allergens,
        spicyLevel: p.spicyLevel ?? 0,
        isBestSeller: !!p.isBestSeller,
        sortOrder: p.sortOrder,
      },
    });

    for (let i = 0; i < p.variants.length; i++) {
      const v = p.variants[i]!;
      await prisma.variant.upsert({
        where: { productId_name: { productId: product.id, name: v.name } },
        update: { priceCents: v.priceCents, prepMinutes: v.prepMinutes, sortOrder: i + 1 },
        create: { productId: product.id, name: v.name, sku: v.sku, priceCents: v.priceCents, prepMinutes: v.prepMinutes, sortOrder: i + 1 },
      });
    }

    for (let i = 0; i < p.modifierGroupIds.length; i++) {
      const mgId = p.modifierGroupIds[i]!;
      await prisma.productModifierGroup.upsert({
        where: { productId_modifierGroupId: { productId: product.id, modifierGroupId: mgId } },
        update: { sortOrder: i + 1 },
        create: { productId: product.id, modifierGroupId: mgId, sortOrder: i + 1 },
      });
    }
    return product;
  };

  const classicKebab = await upsertProduct({
    slug: 'signature-charcoal-kebab',
    categorySlug: 'kebabs',
    name: 'Signature Charcoal Kebab',
    description: 'Slow-roasted halal meat shaved straight from the charcoal spit into toasted Turkish bread with crisp salads and house sauces.',
    imageUrl: '/images/kebab-wrap.jpg',
    tags: ['halal', 'popular'],
    allergens: ['gluten', 'sesame'],
    isBestSeller: true,
    sortOrder: 1,
    modifierGroupIds: [meatGroup.id, saladGroup.id, sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Regular', sku: 'SK-KEB-REG', priceCents: 1450, prepMinutes: 6 },
      { name: 'Large Jumbo', sku: 'SK-KEB-LRG', priceCents: 1850, prepMinutes: 7 },
    ],
  });

  await upsertProduct({
    slug: 'falafel-avocado-wrap',
    categorySlug: 'kebabs',
    name: 'Crispy Falafel & Hummus Wrap',
    description: 'Four house-spiced chickpea & herb falafels, creamy hummus, tabouli, lettuce, and garlic tahini wrapped in warm flatbread.',
    imageUrl: '/images/kebab-wrap.jpg',
    tags: ['halal', 'veg', 'vegan'],
    allergens: ['gluten', 'sesame'],
    sortOrder: 2,
    modifierGroupIds: [saladGroup.id, sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Regular', sku: 'SK-FAL-REG', priceCents: 1350, prepMinutes: 6 },
      { name: 'Large', sku: 'SK-FAL-LRG', priceCents: 1650, prepMinutes: 7 },
    ],
  });

  const hspProduct = await upsertProduct({
    slug: 'holy-trinity-hsp',
    categorySlug: 'snack-packs',
    name: 'Holy Trinity Halal Snack Pack',
    description: 'Our famous golden chips loaded with carved doner meat, melted cheese, and generous drizzles of garlic, BBQ, and chilli sauces.',
    imageUrl: '/images/hsp-box.jpg',
    tags: ['halal', 'popular', 'spicy'],
    allergens: ['dairy'],
    spicyLevel: 1,
    isBestSeller: true,
    sortOrder: 1,
    modifierGroupIds: [meatGroup.id, sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Small', sku: 'SK-HSP-SML', priceCents: 1600, prepMinutes: 7 },
      { name: 'Large', sku: 'SK-HSP-LRG', priceCents: 2150, prepMinutes: 8 },
      { name: 'Family Monster', sku: 'SK-HSP-FAM', priceCents: 3200, prepMinutes: 10 },
    ],
  });

  const pideProduct = await upsertProduct({
    slug: 'spiced-lamb-turkish-pide',
    categorySlug: 'pizza-pide',
    name: 'Spiced Lamb & Mozzarella Pide',
    description: 'Hand-stretched boat-shaped flatbread baked crisp in our stone oven with minced spiced lamb, roasted capsicum, tomato, and stretchy mozzarella.',
    imageUrl: '/images/turkish-pizza.jpg',
    tags: ['halal', 'popular'],
    allergens: ['gluten', 'dairy'],
    isBestSeller: true,
    sortOrder: 1,
    modifierGroupIds: [sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Full Pide', sku: 'SK-PID-FUL', priceCents: 2200, prepMinutes: 12 },
    ],
  });

  await upsertProduct({
    slug: 'charcoal-meat-lovers-pizza',
    categorySlug: 'pizza-pide',
    name: 'Star Kebab Meat Lovers Pizza',
    description: 'Stone-baked pizza topped with shaved lamb doner, marinated chicken, sucuk, red onion, mozzarella, and smoky BBQ swirl.',
    imageUrl: '/images/turkish-pizza.jpg',
    tags: ['halal'],
    allergens: ['gluten', 'dairy'],
    sortOrder: 2,
    modifierGroupIds: [sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Regular 10"', sku: 'SK-PIZ-10', priceCents: 1950, prepMinutes: 11 },
      { name: 'Large 13"', sku: 'SK-PIZ-13', priceCents: 2450, prepMinutes: 13 },
    ],
  });

  await upsertProduct({
    slug: 'mixed-charcoal-grill-plate',
    categorySlug: 'charcoal-grill',
    name: 'Mixed Charcoal Grill Plate',
    description: 'Two flame-kissed chicken shish & lamb adana skewers served over saffron basmati rice with tabouli, creamy hummus, and charred Turkish bread.',
    imageUrl: '/images/grill-plate.jpg',
    tags: ['halal', 'popular'],
    allergens: ['gluten', 'sesame'],
    isBestSeller: true,
    sortOrder: 1,
    modifierGroupIds: [sauceGroup.id, extrasGroup.id],
    variants: [
      { name: 'Single Plate', sku: 'SK-GRL-SGL', priceCents: 2650, prepMinutes: 14 },
      { name: 'Feast for Two', sku: 'SK-GRL-TWO', priceCents: 4800, prepMinutes: 16 },
    ],
  });

  await upsertProduct({
    slug: 'seasoned-hot-chips',
    categorySlug: 'sides-entrees',
    name: 'Seasoned Golden Chips',
    description: 'Double-cooked crispy chips dusted with our signature chicken-salt & paprika spice blend.',
    imageUrl: '/images/sides-chips.jpg',
    tags: ['halal', 'veg', 'vegan'],
    allergens: [],
    sortOrder: 1,
    modifierGroupIds: [sauceGroup.id],
    variants: [
      { name: 'Regular', sku: 'SK-CHP-REG', priceCents: 650, prepMinutes: 5 },
      { name: 'Large', sku: 'SK-CHP-LRG', priceCents: 950, prepMinutes: 5 },
    ],
  });

  await upsertProduct({
    slug: 'cold-can-375ml',
    categorySlug: 'drinks',
    name: 'Chilled Soft Drink Can (375ml)',
    description: 'Ice-cold Coca-Cola, Coke No Sugar, Solo, or Sunkist 375ml can.',
    imageUrl: '/images/sides-chips.jpg',
    tags: ['halal', 'veg', 'vegan'],
    allergens: [],
    sortOrder: 1,
    modifierGroupIds: [],
    variants: [
      { name: 'Coca-Cola', sku: 'SK-DRK-COK', priceCents: 400, prepMinutes: 1 },
      { name: 'Coke No Sugar', sku: 'SK-DRK-ZRO', priceCents: 400, prepMinutes: 1 },
      { name: 'Solo Lemon', sku: 'SK-DRK-SOL', priceCents: 400, prepMinutes: 1 },
    ],
  });

  // 11. Inventory Items, Vendor & Recipes
  const vendor = await prisma.vendor.findFirst({ where: { storeId: store.id, name: 'Sydney Halal Meats & Supplies' } })
    ?? await prisma.vendor.create({
      data: {
        storeId: store.id,
        name: 'Sydney Halal Meats & Supplies',
        abn: '74 112 908 441',
        contact: 'Omar Hassan',
        email: 'orders@sydneyhalalmeats.com.au',
        phone: '(02) 9555 0192',
        address: '42 Industrial Rd, Marrickville NSW 2204',
      },
    });

  const invDefs = [
    { code: 'ING-LAMB', name: 'Charcoal Lamb Doner Spit', unit: 'kg', onHand: '45.000', minThreshold: '10.000', costPerUnitCents: 1650 },
    { code: 'ING-CHKN', name: 'Marinated Chicken Doner', unit: 'kg', onHand: '40.000', minThreshold: '10.000', costPerUnitCents: 1250 },
    { code: 'ING-FLOUR', name: 'Stone-Oven Pizza & Pide Flour', unit: 'kg', onHand: '50.000', minThreshold: '12.000', costPerUnitCents: 220 },
    { code: 'ING-CHIPS', name: '10mm Crispy Chips', unit: 'kg', onHand: '60.000', minThreshold: '15.000', costPerUnitCents: 380 },
    { code: 'ING-CHEESE', name: 'Shredded Tasty & Mozzarella', unit: 'kg', onHand: '18.000', minThreshold: '5.000', costPerUnitCents: 1150 },
    { code: 'ING-BREAD', name: 'Turkish Flatbread Wraps', unit: 'piece', onHand: '200.000', minThreshold: '40.000', costPerUnitCents: 85 },
  ];
  const invMap = new Map<string, string>();
  for (const inv of invDefs) {
    const rec = await prisma.inventoryItem.upsert({
      where: { storeId_code: { storeId: store.id, code: inv.code } },
      update: {},
      create: { storeId: store.id, preferredVendorId: vendor.id, ...inv },
    });
    invMap.set(inv.code, rec.id);
  }

  // Link sample recipes for stock deduction testing
  const kebabReg = await prisma.variant.findFirst({ where: { productId: classicKebab.id, name: 'Regular' } });
  const hspLrg = await prisma.variant.findFirst({ where: { productId: hspProduct.id, name: 'Large' } });
  const pideFull = await prisma.variant.findFirst({ where: { productId: pideProduct.id, name: 'Full Pide' } });

  const existingRecipes = await prisma.recipeLine.count();
  if (existingRecipes === 0) {
    const lines = [];
    if (kebabReg) {
      lines.push({ variantId: kebabReg.id, inventoryItemId: invMap.get('ING-LAMB')!, quantity: '0.180' });
      lines.push({ variantId: kebabReg.id, inventoryItemId: invMap.get('ING-BREAD')!, quantity: '1.000' });
    }
    if (hspLrg) {
      lines.push({ variantId: hspLrg.id, inventoryItemId: invMap.get('ING-LAMB')!, quantity: '0.250' });
      lines.push({ variantId: hspLrg.id, inventoryItemId: invMap.get('ING-CHIPS')!, quantity: '0.350' });
      lines.push({ variantId: hspLrg.id, inventoryItemId: invMap.get('ING-CHEESE')!, quantity: '0.060' });
    }
    if (pideFull) {
      lines.push({ variantId: pideFull.id, inventoryItemId: invMap.get('ING-FLOUR')!, quantity: '0.250' });
      lines.push({ variantId: pideFull.id, inventoryItemId: invMap.get('ING-CHEESE')!, quantity: '0.120' });
    }
    if (lines.length > 0) await prisma.recipeLine.createMany({ data: lines });
  }

  // 12. Active Deals & Coupons & Loyalty Rules
  await prisma.deal.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'late-night-hsp-combo' } },
    update: {},
    create: {
      storeId: store.id,
      slug: 'late-night-hsp-combo',
      name: 'Late-Night HSP & Drink Combo',
      description: 'Large Holy Trinity HSP + any ice-cold 375ml can. Sydney\'s favourite late-night feed.',
      imageUrl: '/images/hsp-box.jpg',
      priceCents: 2290,
      badgeText: 'SAVE $2.60',
      sortOrder: 1,
    },
  });

  await prisma.deal.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'mates-kebab-feast' } },
    update: {},
    create: {
      storeId: store.id,
      slug: 'mates-kebab-feast',
      name: 'Mates Charcoal Feast for Two',
      description: '2 Regular Signature Kebabs + Large Seasoned Chips + 2 Cold Cans.',
      imageUrl: '/images/kebab-wrap.jpg',
      priceCents: 3890,
      badgeText: 'BEST VALUE',
      sortOrder: 2,
    },
  });

  await prisma.deal.upsert({
    where: { storeId_slug: { storeId: store.id, slug: 'pide-and-chips-special' } },
    update: {},
    create: {
      storeId: store.id,
      slug: 'pide-and-chips-special',
      name: 'Stone-Oven Pide & Chips Deal',
      description: 'Full Spiced Lamb Pide + Regular Seasoned Chips + Garlic Toum.',
      imageUrl: '/images/turkish-pizza.jpg',
      priceCents: 2590,
      badgeText: 'CHEF PICK',
      sortOrder: 3,
    },
  });

  await prisma.coupon.upsert({
    where: { storeId_code: { storeId: store.id, code: 'STAR15' } },
    update: {},
    create: {
      storeId: store.id,
      code: 'STAR15',
      kind: 'PERCENT',
      value: 15,
      minSpendCents: 2000,
      active: true,
    },
  });

  await prisma.coupon.upsert({
    where: { storeId_code: { storeId: store.id, code: 'WELCOME5' } },
    update: {},
    create: {
      storeId: store.id,
      code: 'WELCOME5',
      kind: 'FIXED',
      value: 500,
      minSpendCents: 2500,
      active: true,
    },
  });

  const existingLoyalty = await prisma.loyaltyRule.count({ where: { storeId: store.id } });
  if (existingLoyalty === 0) {
    await prisma.loyaltyRule.create({
      data: { storeId: store.id, pointsPerDollar: 1, redeemPointsBlock: 100, redeemValueCents: 500, active: true },
    });
  }

  // 13. Receipt Template & CMS
  const existingReceipt = await prisma.receiptTemplate.count({ where: { storeId: store.id } });
  if (existingReceipt === 0) {
    await prisma.receiptTemplate.create({
      data: {
        storeId: store.id,
        version: 1,
        headerText: 'TAX INVOICE — STAR KEBAB',
        footerText: '100% Halal Certified • Carved Fresh Daily on Ironbark Charcoal. Thanks mate!',
        showAbn: true,
        showGstLine: true,
        active: true,
      },
    });
  }

  const existingAnnouncement = await prisma.announcement.count({ where: { storeId: store.id } });
  if (existingAnnouncement === 0) {
    await prisma.announcement.create({
      data: {
        storeId: store.id,
        text: 'Open Late Fri & Sat till 2am • Use code STAR15 for 15% off orders over $20',
        linkHref: '/deals',
        active: true,
      },
    });
  }

  const existingNav = await prisma.cmsNavItem.count({ where: { storeId: store.id } });
  if (existingNav === 0) {
    await prisma.cmsNavItem.createMany({
      data: [
        { storeId: store.id, location: 'HEADER', label: 'Menu', href: '/menu', sortOrder: 1 },
        { storeId: store.id, location: 'HEADER', label: 'Deals', href: '/deals', sortOrder: 2 },
        { storeId: store.id, location: 'HEADER', label: 'About', href: '/about', sortOrder: 3 },
        { storeId: store.id, location: 'HEADER', label: 'Contact & Hours', href: '/contact', sortOrder: 4 },
        { storeId: store.id, location: 'FOOTER', label: 'Order Menu', href: '/menu', sortOrder: 1 },
        { storeId: store.id, location: 'FOOTER', label: 'Hot Deals', href: '/deals', sortOrder: 2 },
        { storeId: store.id, location: 'FOOTER', label: 'Privacy Policy', href: '/legal/privacy', sortOrder: 3 },
        { storeId: store.id, location: 'FOOTER', label: 'Terms & Refunds', href: '/legal/terms', sortOrder: 4 },
      ],
    });
  }

  // 14. Demo Customer
  const custPass = await bcrypt.hash('Customer123!', 10);
  const demoCustomer = await prisma.customer.upsert({
    where: { email: 'oliver@starkebab.com.au' },
    update: { name: 'Oliver Smith' },
    create: {
      email: 'oliver@starkebab.com.au',
      name: 'Oliver Smith',
      phone: '0412 345 678',
      passwordHash: custPass,
      emailVerified: true,
    },
  });
  await prisma.loyaltyAccount.upsert({
    where: { customerId: demoCustomer.id },
    update: {},
    create: { customerId: demoCustomer.id, balance: 250 },
  });

  console.log('✅ Star Kebab seed complete!');
  console.log('   Admin login:   admin@starkebab.com.au / StarAdmin123! (PIN: 1111)');
  console.log('   Counter login: till@starkebab.com.au  / StarStaff123! (PIN: 2222)');
  console.log('   Chef login:    chef@starkebab.com.au  / StarStaff123! (PIN: 3333)');
  console.log('   Customer:      alex@example.com.au    / Customer123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
