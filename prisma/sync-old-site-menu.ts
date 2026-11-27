import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const STORE_SLUG = 'star-kebab';

interface VariantSeed {
  name: string;
  priceCents: number;
  prepMinutes?: number;
}

interface ProductSeed {
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  tags?: string[];
  spicyLevel?: number;
  isBestSeller?: boolean;
  isMultiVariant: boolean;
  variants: VariantSeed[];
  modifierGroupNames?: string[];
}

interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  stationCode: string;
  products: ProductSeed[];
}

const single = (priceDollars: number, prepMinutes = 8): VariantSeed[] => [
  { name: 'Standard', priceCents: Math.round(priceDollars * 100), prepMinutes },
];

const rl = (reg: number, large: number, prepMinutes = 12): VariantSeed[] => [
  { name: 'Regular', priceCents: Math.round(reg * 100), prepMinutes },
  { name: 'Large', priceCents: Math.round(large * 100), prepMinutes: prepMinutes + 2 },
];

const MENU_DATA: CategorySeed[] = [
  {
    name: 'Kebab Rolls',
    slug: 'kebab-rolls',
    description: 'Served in fresh lavash Turkish bread with your choice of salad and sauce. Add chips & drink for $5.',
    imageUrl: '/images/kebab-wrap.jpg',
    stationCode: 'grill',
    products: [
      {
        name: 'Chicken Kebab Roll',
        slug: 'chicken-kebab-roll',
        description: 'In fresh lavash bread with your choice of salad and sauce.',
        imageUrl: '/images/kebab-wrap.jpg',
        tags: ['halal', 'popular'],
        isBestSeller: true,
        isMultiVariant: false,
        variants: single(16, 7),
        modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'],
      },
      {
        name: 'Lamb / Beef Kebab Roll',
        slug: 'lamb-beef-kebab-roll',
        description: 'In fresh lavash bread with your choice of salad and sauce.',
        imageUrl: '/images/kebab-wrap.jpg',
        tags: ['halal', 'popular'],
        isBestSeller: true,
        isMultiVariant: false,
        variants: single(16, 7),
        modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'],
      },
      {
        name: 'Mixed Meats Roll',
        slug: 'mixed-meats-roll',
        description: 'Shaved chicken and lamb/beef in fresh lavash bread with your choice of salad and sauce.',
        imageUrl: '/images/kebab-wrap.jpg',
        tags: ['halal', 'popular'],
        isBestSeller: true,
        isMultiVariant: false,
        variants: single(16, 7),
        modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'],
      },
      {
        name: 'Zucchini Kebab Roll',
        slug: 'zucchini-kebab-roll',
        description: 'Vegetarian zucchini roll in fresh lavash bread with your choice of salad and sauce.',
        imageUrl: '/images/kebab-wrap.jpg',
        tags: ['halal', 'veg'],
        isMultiVariant: false,
        variants: single(15, 7),
        modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'],
      },
      {
        name: 'Falafel Kebab Roll',
        slug: 'falafel-kebab-roll',
        description: 'Crispy traditional falafel in fresh lavash bread with your choice of salad and sauce.',
        imageUrl: '/images/kebab-wrap.jpg',
        tags: ['halal', 'veg'],
        isMultiVariant: false,
        variants: single(15, 7),
        modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'],
      },
    ],
  },
  {
    name: 'Snack Packs',
    slug: 'snack-packs',
    description: 'Served with golden chips, melted cheese, and up to 3 sauces of your choice.',
    imageUrl: '/images/hsp-box.jpg',
    stationCode: 'fryer',
    products: [
      {
        name: 'Chicken Snack Pack',
        slug: 'chicken-snack-pack',
        description: 'Shaved chicken served with hot chips, melted cheese & up to 3 sauces.',
        imageUrl: '/images/hsp-box.jpg',
        tags: ['halal', 'popular'],
        isBestSeller: true,
        isMultiVariant: true,
        variants: rl(18, 22, 8),
        modifierGroupNames: ['Choice of Sauces (Max 3)'],
      },
      {
        name: 'Mixed Snack Pack',
        slug: 'mixed-snack-pack',
        description: 'Mixed shaved meats served with hot chips, melted cheese & up to 3 sauces.',
        imageUrl: '/images/hsp-box.jpg',
        tags: ['halal', 'popular'],
        isBestSeller: true,
        isMultiVariant: true,
        variants: rl(18, 22, 8),
        modifierGroupNames: ['Choice of Sauces (Max 3)'],
      },
      {
        name: 'Lamb Snack Pack',
        slug: 'lamb-snack-pack',
        description: 'Shaved lamb served with hot chips, melted cheese & up to 3 sauces.',
        imageUrl: '/images/hsp-box.jpg',
        tags: ['halal', 'popular'],
        isMultiVariant: true,
        variants: rl(18, 22, 8),
        modifierGroupNames: ['Choice of Sauces (Max 3)'],
      },
    ],
  },
  {
    name: 'Turkish Pides',
    slug: 'turkish-pides',
    description: 'Hand-stretched stone-baked Turkish pides in Regular and Large sizes.',
    imageUrl: '/images/turkish-pizza.jpg',
    stationCode: 'oven',
    products: [
      { name: 'Spinach & Feta Pide', slug: 'pide-spinach-feta', description: 'Spinach, feta, parsley and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Turkish Salami Pide', slug: 'pide-turkish-salami', description: 'Turkish salami and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Minced Lamb Pide', slug: 'pide-minced-lamb', description: 'Minced lamb, onion, mushroom and tasty cheese.', tags: ['halal', 'popular'], isBestSeller: true, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Chicken & Mushroom Pide', slug: 'pide-chicken-mushroom', description: 'Chicken, mushroom and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Traditional Beef Pide', slug: 'pide-traditional-beef', description: 'Beef pieces, BBQ sauce, onion, capsicum, mushroom and cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Roasted Chicken Pide', slug: 'pide-roasted-chicken', description: 'Marinated roasted chicken, mozzarella cheese and parsley.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Shaved Meat Pide', slug: 'pide-shaved-meat', description: 'Shaved chicken, lamb & beef meat, onion, tomato, capsicum and mozzarella cheese.', tags: ['halal', 'popular'], isBestSeller: true, isMultiVariant: true, variants: rl(18, 28) },
      { name: 'Mediterranean Chicken Pide', slug: 'pide-mediterranean-chicken', description: 'Spinach, chicken, feta, tomato and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Lamb Pieces Pide', slug: 'pide-lamb-pieces', description: 'Lamb pieces, onion, tomato, capsicum and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Super Veggie Pide', slug: 'pide-super-veggie', description: 'Spinach, onion, tomato, capsicum, olives and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Spicy Salami Pide', slug: 'pide-spicy-salami', description: 'Salami, onion, mushroom, capsicum, chilli and tasty cheese.', tags: ['halal', 'spicy'], spicyLevel: 2, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Lahmacun', slug: 'pide-lahmacun', description: 'Minced lamb, onion, tomato and capsicum finely diced with Turkish paste.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Meat Lover Pide', slug: 'pide-meat-lover', description: 'Roasted chicken, lamb, Turkish salami, mushroom, capsicum, onion and mozzarella cheese with BBQ sauce.', tags: ['halal'], isMultiVariant: true, variants: rl(18, 28) },
      { name: 'Aussie Pide', slug: 'pide-aussie', description: 'Turkish salami, egg, capsicum sauce, onion, mushroom and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(18, 28) },
    ],
  },
  {
    name: 'Gourmet Pizzas',
    slug: 'gourmet-pizzas',
    description: 'Oven-baked 100% Halal gourmet pizzas in Regular and Large sizes.',
    imageUrl: '/images/turkish-pizza.jpg',
    stationCode: 'oven',
    products: [
      { name: 'Cheese Pizza', slug: 'pizza-cheese', description: 'Feta & mozzarella blend (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 20) },
      { name: 'Chicken & Pineapple Pizza', slug: 'pizza-chicken-pineapple', description: 'Chicken, pineapple and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Garlic Prawn Pizza', slug: 'pizza-garlic-prawn', description: 'Prawns, garlic, mushroom, tomato, herbs and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(18, 28) },
      { name: 'Halloumi Pizza', slug: 'pizza-halloumi', description: 'Halloumi cheese, spinach, olives, sundried tomatoes, roasted capsicum, feta and mozzarella (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Mediterranean Chilli Chicken Pizza', slug: 'pizza-med-chilli-chicken', description: 'Chicken, tomato, garlic, halloumi, spinach, fresh chilli and tasty cheese.', tags: ['halal', 'spicy'], spicyLevel: 2, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Peri Peri Chicken Pizza', slug: 'pizza-peri-peri-chicken', description: 'Chicken, roasted capsicum, onions, peri peri sauce and tasty cheese.', tags: ['halal', 'spicy'], spicyLevel: 1, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Spicy Salami & Veggie Pizza', slug: 'pizza-spicy-salami-veggie', description: 'Salami, onion, mushroom and fresh chilli.', tags: ['halal', 'spicy'], spicyLevel: 2, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Mexican Pizza', slug: 'pizza-mexican', description: 'Shredded beef pieces, onion, capsicum, mushroom, jalapeno and mozzarella cheese.', tags: ['halal', 'spicy'], spicyLevel: 2, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Tandoori Chicken Pizza', slug: 'pizza-tandoori-chicken', description: 'Tandoori chicken, Spanish onion, mushroom, tomato, chilli flakes and mozzarella.', tags: ['halal', 'spicy'], spicyLevel: 1, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Hawaiian Pizza', slug: 'pizza-hawaiian', description: 'Turkish salami, smoked beef, tomato base with pineapple and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Pickle Chicken Pizza', slug: 'pizza-pickle-chicken', description: 'Marinated chicken, pickles, onion, capsicum, mushroom and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Chunky Beef Pizza', slug: 'pizza-chunky-beef', description: 'Juicy beef chunks, tomato, white onion, capsicum, Moroccan spices, oregano & mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Cheese & Corn Pizza', slug: 'pizza-cheese-corn', description: 'Onion, tomato and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(8, 14) },
      { name: 'Zaatar Half / Half Pizza', slug: 'pizza-zaatar-half-half', description: 'Half tasty cheese, half oregano (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(8, 14) },
      { name: 'Zaatar Tomato Pizza', slug: 'pizza-zaatar-tomato', description: 'Zaatar, onion, tomato and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(8, 14) },
      { name: 'Zaatar Traditional Pizza', slug: 'pizza-zaatar-traditional', description: 'Zaatar and oregano (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(5, 14) },
      { name: 'Mediterranean Lamb Pizza', slug: 'pizza-mediterranean-lamb', description: 'Lamb, onion, tomato, capsicum and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Classic Lamb Pizza', slug: 'pizza-classic-lamb', description: 'Lamb, Spanish onion, spinach, sun-dried tomato, green capsicum and oregano.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Chicken & Cheese Pizza', slug: 'pizza-chicken-cheese', description: 'Chicken and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Chicken & Tomato Pizza', slug: 'pizza-chicken-tomato', description: 'Chicken with onion, capsicum and cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Garlic Pizza', slug: 'pizza-garlic', description: 'Garlic, herbs and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 20) },
      { name: 'Meatlovers Pizza', slug: 'pizza-meatlovers', description: 'Mix of chicken, lamb, salami, veggies and tasty cheese.', tags: ['halal', 'popular'], isMultiVariant: true, variants: rl(18, 28) },
      { name: 'Salami & Cheese Pizza', slug: 'pizza-salami-cheese', description: 'Turkish salami and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Vegetarian Pizza', slug: 'pizza-vegetarian', description: 'Tomato, onion, mushroom, capsicum, olives, spinach, feta and tasty cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Pesto Chicken Pizza', slug: 'pizza-pesto-chicken', description: 'Pesto, chicken, Spanish onion, mushrooms, tomato, aioli and tasty cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'BBQ Delight Pizza', slug: 'pizza-bbq-delight', description: 'Marinated chicken with BBQ base, onion, mushroom, capsicum and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Smoked Beef Pizza', slug: 'pizza-smoked-beef', description: 'Marinated smoked beef with tomato base, Spanish onion, capsicum, mushroom and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Moroccan Lamb Pizza', slug: 'pizza-moroccan-lamb', description: 'Lamb with Spanish onion, spinach, capsicum, mint yoghurt and wedge of lemon.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Pepper Chicken Pizza', slug: 'pizza-pepper-chicken', description: 'Pepper chicken, fresh green chilli, capsicum, shallots and chilli flakes.', tags: ['halal', 'spicy'], spicyLevel: 2, isMultiVariant: true, variants: rl(16, 26) },
      { name: 'Creamy Pepper Beef Pizza', slug: 'pizza-creamy-pepper', description: 'Marinated smoked beef on tomato base with Spanish onion, capsicum, mushrooms and mozzarella.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26) },
    ],
  },
  {
    name: 'Gozleme',
    slug: 'gozleme',
    description: 'Traditional hand-rolled Turkish flatbreads filled and griddled golden in Regular and Large.',
    imageUrl: '/images/turkish-pizza.jpg',
    stationCode: 'oven',
    products: [
      { name: 'Chicken Gozleme', slug: 'gozleme-chicken', description: 'Filled with seasoned chicken and melted cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26, 10) },
      { name: 'Classic Cheese Gozleme', slug: 'gozleme-classic-cheese', description: 'Filled with melted Turkish cheese blend (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26, 10) },
      { name: 'Salami Gozleme', slug: 'gozleme-salami', description: 'Filled with Turkish salami and melted cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26, 10) },
      { name: 'Mix Lamb Gozleme', slug: 'gozleme-mix-lamb', description: 'Filled with spiced lamb and melted cheese.', tags: ['halal'], isMultiVariant: true, variants: rl(16, 26, 10) },
      { name: 'Potato Gozleme', slug: 'gozleme-potato', description: 'Filled with seasoned potato and herbs (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26, 10) },
      { name: 'Spinach & Feta Gozleme', slug: 'gozleme-spinach-feta', description: 'Filled with fresh spinach and creamy feta cheese (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(16, 26, 10) },
    ],
  },
  {
    name: 'Mains & Skewers',
    slug: 'mains-skewers',
    description: 'Charcoal-grilled skewers and traditional Turkish mains served with Turkish rice and vegetables.',
    imageUrl: '/images/grill-plate.jpg',
    stationCode: 'grill',
    products: [
      { name: 'Chicken Skewers (2)', slug: 'main-chicken-skewers', description: '2 marinated charcoal chicken skewers served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(24, 14) },
      { name: 'Lamb Skewers (2)', slug: 'main-lamb-skewers', description: '2 marinated charcoal lamb skewers served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(26, 14) },
      { name: 'Beef Skewers (2)', slug: 'main-beef-skewers', description: '2 marinated charcoal beef skewers served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(26, 14) },
      { name: 'Mixed Skewers (3)', slug: 'main-mixed-skewers', description: '1 lamb, 1 beef and 1 chicken skewer served with rice and vegetables.', tags: ['halal', 'popular'], isBestSeller: true, isMultiVariant: false, variants: single(31, 15) },
      { name: 'Lamb Cutlets (4)', slug: 'main-lamb-cutlets', description: '4 flame-grilled lamb cutlets served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(31, 15) },
      { name: 'Lamb Shanks', slug: 'main-lamb-shanks', description: 'Slow-cooked lamb shanks served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(31, 12) },
      { name: 'Boneless Chicken', slug: 'main-boneless-chicken', description: 'Charcoal boneless chicken served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(26, 14) },
      { name: 'Grilled Vegetables', slug: 'main-grilled-vegetables', description: 'Charcoal-grilled seasonal vegetables served with Turkish rice (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(24, 12) },
      { name: 'Borsa Kebab', slug: 'main-borsa-kebab', description: 'Sliced meat with spicy tomato sauce, Greek yoghurt, rice and vegetables.', tags: ['halal', 'spicy'], spicyLevel: 1, isMultiVariant: false, variants: single(24, 12) },
      { name: 'Spiced Meatballs (5)', slug: 'main-spiced-meatballs', description: '5 Turkish spiced meatballs served with rice and vegetables.', tags: ['halal'], isMultiVariant: false, variants: single(24, 12) },
    ],
  },
  {
    name: 'Lunch Boxes',
    slug: 'lunch-boxes',
    description: 'Hearty Turkish lunch boxes served with rice, fresh salad and your choice of sauce.',
    imageUrl: '/images/grill-plate.jpg',
    stationCode: 'grill',
    products: [
      { name: 'Chicken Lunch Box', slug: 'lunch-box-chicken', description: 'Served with rice, salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(22, 8), modifierGroupNames: ['Choice of Sauces (Max 3)'] },
      { name: 'Lamb / Beef Lunch Box', slug: 'lunch-box-lamb-beef', description: 'Served with rice, salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(22, 8), modifierGroupNames: ['Choice of Sauces (Max 3)'] },
      { name: 'Mixed Meats Lunch Box', slug: 'lunch-box-mixed-meats', description: 'Served with rice, salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(22, 8), modifierGroupNames: ['Choice of Sauces (Max 3)'] },
      { name: 'Zucchini Lunch Box', slug: 'lunch-box-zucchini', description: 'Vegetarian zucchini served with rice, salad and sauce.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(18, 8), modifierGroupNames: ['Choice of Sauces (Max 3)'] },
      { name: 'Falafel Lunch Box', slug: 'lunch-box-falafel', description: 'Crispy falafel served with rice, salad and sauce.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(18, 8), modifierGroupNames: ['Choice of Sauces (Max 3)'] },
    ],
  },
  {
    name: 'Burgers',
    slug: 'burgers',
    description: 'Served in freshly baked Turkish bun with choice of salad and sauce. Add chips & drink for $5.',
    imageUrl: '/images/kebab-wrap.jpg',
    stationCode: 'grill',
    products: [
      { name: 'Beef Burger', slug: 'burger-beef', description: 'Freshly baked Turkish bun with beef patty, choice of salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(16, 9), modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'] },
      { name: 'Grilled Chicken Burger', slug: 'burger-grilled-chicken', description: 'Freshly baked Turkish bun with grilled chicken, choice of salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(16, 9), modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'] },
      { name: 'Camel Burger', slug: 'burger-camel', description: 'Signature camel patty in freshly baked Turkish bun with choice of salad and sauce.', tags: ['halal'], isMultiVariant: false, variants: single(16, 10), modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'] },
      { name: 'Vege Burger', slug: 'burger-vege', description: 'Vegetarian patty in freshly baked Turkish bun with choice of salad and sauce.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(16, 9), modifierGroupNames: ['Choice of Salads', 'Choice of Sauces (Max 3)', 'Make It a Meal'] },
    ],
  },
  {
    name: 'Hot Entrees',
    slug: 'hot-entrees',
    description: 'Authentic Turkish hot entrees cooked fresh to order.',
    imageUrl: '/images/sides-chips.jpg',
    stationCode: 'fryer',
    products: [
      { name: 'Dolma / Vine Leaves (10 pcs)', slug: 'entree-dolma-vine-leaves', description: 'Stuffed vine leaves — 10 pieces (V, VE, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 7) },
      { name: 'Grated Zucchini Balls (6 pcs)', slug: 'entree-zucchini-balls', description: 'Crispy herb-seasoned zucchini balls — 6 pieces (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 8) },
      { name: 'Traditional Falafel (6 pcs)', slug: 'entree-traditional-falafel', description: 'House-made chickpea falafel — 6 pieces (V, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 8) },
      { name: 'Crumbed Parmesan Chicken (6 pcs)', slug: 'entree-parmesan-chicken', description: 'Golden crumbed parmesan chicken — 6 pieces.', tags: ['halal'], isMultiVariant: false, variants: single(15, 8) },
      { name: 'Potato Courgettes (6 pcs)', slug: 'entree-potato-courgettes', description: 'Crispy potato courgettes — 6 pieces (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 8) },
      { name: 'Vegetarian Spring Rolls (6 pcs)', slug: 'entree-veg-spring-rolls', description: 'Golden vegetarian spring rolls — 6 pieces (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 7) },
      { name: 'Minced Meat Spring Rolls (6 pcs)', slug: 'entree-meat-spring-rolls', description: 'Seasoned minced meat spring rolls — 6 pieces.', tags: ['halal'], isMultiVariant: false, variants: single(15, 7) },
    ],
  },
  {
    name: 'Homemade Dips',
    slug: 'homemade-dips',
    description: 'House-made traditional Turkish dips prepared fresh daily.',
    imageUrl: '/images/sides-chips.jpg',
    stationCode: 'counter',
    products: [
      { name: 'Cucumber Dip', slug: 'dip-cucumber', description: 'Finely chopped cucumber with yoghurt, garlic & fresh herbs (V, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Hummus Dip', slug: 'dip-hummus', description: 'Chickpeas mixed with tahini, lemon, garlic & Turkish herbs (V, VE, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Garlic Dip', slug: 'dip-garlic', description: 'Creamy house-made garlic dip (V, VG).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Eggplant Dip', slug: 'dip-eggplant', description: 'Roasted eggplant, olive oil, yoghurt, garlic & fresh herbs (V, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Beetroot Dip', slug: 'dip-beetroot', description: 'Cooked & grated beetroot, yoghurt, garlic, olive oil & fresh herbs (V, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Carrot Dip', slug: 'dip-carrot', description: 'Grated carrot with olive oil, yoghurt, garlic & fresh herbs (V, GF).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 3) },
      { name: 'Chilli Dip', slug: 'dip-chilli', description: 'Fresh red chilli & red capsicum blended with walnuts, olive oil, breadcrumbs & herbs (V, contains nuts).', tags: ['halal', 'veg', 'spicy'], spicyLevel: 2, isMultiVariant: false, variants: single(7, 3) },
    ],
  },
  {
    name: 'Banquets',
    slug: 'banquets',
    description: 'Generous Turkish feast banquets for couples, families, and groups.',
    imageUrl: '/images/grill-plate.jpg',
    stationCode: 'grill',
    products: [
      { name: 'Banquet 1 (For 2 People)', slug: 'banquet-1', description: '$35/person (min 2): 2x Chicken Skewers, 2x Lamb Skewers, Turkish Rice & Veg, 1x Turkish Pide, 2x Zucchini Balls, 1x Turkish Bread & 2x Dips.', tags: ['halal'], isMultiVariant: false, variants: single(70, 20) },
      { name: 'Banquet 2 (For 4 People)', slug: 'banquet-2', description: '$45/person (min 4): 4x Chicken Skewers, 4x Lamb Skewers, 2x Large Turkish Pides, Rice & Veg, 4x Parma Chicken, 4x Feta Rolls, 1x Bread & 4x Dips.', tags: ['halal'], isMultiVariant: false, variants: single(180, 25) },
      { name: 'Banquet 3 — Vegetarian (For 2 People)', slug: 'banquet-3-vegetarian', description: '$35/person (min 2): 1x Veg Pide, Turkish Rice & Mixed Veg, 2x Zucchini Balls, 2x Potato Courgettes, 2x Spring Rolls, 2x Falafel, 4x Vine Leaves, 1x Bread & 2x Dips.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(70, 20) },
      { name: 'Banquet 4 (For 2 People)', slug: 'banquet-4', description: '$35/person (min 2): Shaved Lamb & Shaved Chicken, Turkish Rice & Salad, 2x Parma Chicken, 2x Potato Courgettes, 2x Spring Rolls, 2x Falafel, 1x Bread & 2x Dips.', tags: ['halal'], isMultiVariant: false, variants: single(70, 18) },
      { name: 'Banquet 5 (For 6 People)', slug: 'banquet-5', description: '$25/person (min 6): 2x Large Turkish Pide, 2x Large Gourmet Pizza, 1x Garlic Pizza, 6x Parma Chicken, 6x Zucchini Balls, 1x Large Chips & 2x 1.25L Drinks.', tags: ['halal'], isMultiVariant: false, variants: single(150, 25) },
      { name: 'Banquet 6 — Pizza Lover (For 4 People)', slug: 'banquet-6-pizza-lover', description: '$25/person (min 4): 2x Large Gourmet Pizza, 2x Large Turkish Pide, 1x Large Chips & 1x 1.25L Drink.', tags: ['halal'], isMultiVariant: false, variants: single(100, 20) },
    ],
  },
  {
    name: 'Sides',
    slug: 'sides',
    description: 'Crispy chips, fresh salads, Turkish rice, mixed vegetables and potato scallops.',
    imageUrl: '/images/sides-chips.jpg',
    stationCode: 'fryer',
    products: [
      { name: 'Hot Chips', slug: 'side-chips', description: 'Choose chicken salt, plain salt or house seasoning.', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(6, 8, 5) },
      { name: 'Mediterranean Salad', slug: 'side-mediterranean-salad', description: 'Crisp garden Mediterranean salad (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(9, 18, 5) },
      { name: 'Turkish Rice', slug: 'side-turkish-rice', description: 'Fragrant traditional Turkish rice (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(7, 14, 5) },
      { name: 'Mixed Vegetables', slug: 'side-mixed-vegetables', description: 'Seasoned mixed vegetables (V).', tags: ['halal', 'veg'], isMultiVariant: true, variants: rl(9, 18, 6) },
      { name: 'Potato Scallop', slug: 'side-potato-scallop', description: 'Crispy golden potato scallop (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(2, 5) },
    ],
  },
  {
    name: 'Bread & Kids Menu',
    slug: 'bread-and-kids',
    description: 'Freshly baked Turkish breads and kids favourites.',
    imageUrl: '/images/turkish-pizza.jpg',
    stationCode: 'oven',
    products: [
      { name: 'Plain Turkish Bread', slug: 'bread-plain', description: 'Freshly baked plain Turkish bread (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(6, 5) },
      { name: 'Chilli Bread', slug: 'bread-chilli', description: 'Baked Turkish bread with spicy chilli glaze (V).', tags: ['halal', 'veg', 'spicy'], spicyLevel: 2, isMultiVariant: false, variants: single(7, 5) },
      { name: 'Garlic Herb Bread', slug: 'bread-garlic-herb', description: 'Baked Turkish bread with garlic and herbs (V, VG).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 5) },
      { name: 'Cheese Garlic Bread', slug: 'bread-cheese-garlic', description: 'Baked Turkish bread topped with melted cheese and garlic (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(15, 7) },
      { name: 'Kids Chicken Nuggets (8 pcs)', slug: 'kids-chicken-nuggets', description: '8 chicken nuggets served with chips and a Pop Top.', tags: ['halal'], isMultiVariant: false, variants: single(16, 7) },
    ],
  },
  {
    name: 'Beverages',
    slug: 'beverages',
    description: 'Ice-cold soft drinks, water, sparkling juices and energy drinks.',
    imageUrl: '/images/sides-chips.jpg',
    stationCode: 'counter',
    products: [
      { name: 'Can Drink (375ml)', slug: 'bev-can-375ml', description: 'Chilled 375ml soft drink can.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(3.5, 1) },
      { name: 'Water Bottle', slug: 'bev-water-bottle', description: 'Chilled spring water bottle.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(3.5, 1) },
      { name: 'Sparkling Juice', slug: 'bev-sparkling-juice', description: 'Refreshing sparkling fruit juice.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4.5, 1) },
      { name: 'Bottle Drink (250ml)', slug: 'bev-bottle-250ml', description: 'Chilled 250ml bottle.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(5, 1) },
      { name: 'Bottle Drink (600ml)', slug: 'bev-bottle-600ml', description: 'Chilled 600ml soft drink bottle.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(5, 1) },
      { name: 'Energy Drink', slug: 'bev-energy-drink', description: 'Chilled energy drink.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(5, 1) },
      { name: 'Bottle Drink (1.25L)', slug: 'bev-bottle-125l', description: '1.25L family bottle soft drink.', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(7, 1) },
    ],
  },
  {
    name: 'Desserts',
    slug: 'desserts',
    description: 'Traditional flaky Turkish baklava and sweet semolina cake.',
    imageUrl: '/images/sides-chips.jpg',
    stationCode: 'counter',
    products: [
      { name: 'Pistachio Baklava', slug: 'dessert-pistachio-baklava', description: 'Flaky filo pastry layered with roasted pistachios and honey syrup (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4, 2) },
      { name: 'Almond Baklava', slug: 'dessert-almond-baklava', description: 'Crisp filo pastry filled with sweet almonds (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4, 2) },
      { name: 'Walnut Baklava', slug: 'dessert-walnut-baklava', description: 'Traditional walnut baklava soaked in light syrup (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4, 2) },
      { name: 'Chocolate Walnut Baklava', slug: 'dessert-choc-walnut-baklava', description: 'Rich chocolate and walnut layered baklava (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4, 2) },
      { name: 'Semolina Cake', slug: 'dessert-semolina-cake', description: 'Traditional Turkish sweet semolina cake (V).', tags: ['halal', 'veg'], isMultiVariant: false, variants: single(4.5, 2) },
    ],
  },
];

async function ensureModifierGroup(
  storeId: string,
  name: string,
  minSelect: number,
  maxSelect: number,
  required: boolean,
  sortOrder: number,
  options: Array<{ name: string; priceDeltaCents: number; isDefault?: boolean }>
) {
  let group = await db.modifierGroup.findFirst({ where: { storeId, name } });
  if (!group) {
    group = await db.modifierGroup.create({
      data: { storeId, name, minSelect, maxSelect, required, sortOrder },
    });
  } else {
    group = await db.modifierGroup.update({
      where: { id: group.id },
      data: { minSelect, maxSelect, required, sortOrder },
    });
  }

  for (const [i, opt] of options.entries()) {
    const existing = await db.modifierOption.findFirst({
      where: { modifierGroupId: group.id, name: opt.name },
    });
    if (!existing) {
      await db.modifierOption.create({
        data: {
          modifierGroupId: group.id,
          name: opt.name,
          priceDeltaCents: opt.priceDeltaCents,
          isDefault: !!opt.isDefault,
          active: true,
          sortOrder: i,
        },
      });
    } else {
      await db.modifierOption.update({
        where: { id: existing.id },
        data: { priceDeltaCents: opt.priceDeltaCents, active: true, sortOrder: i },
      });
    }
  }
  return group;
}

async function main() {
  const store = await db.store.findUnique({ where: { slug: STORE_SLUG } });
  if (!store) throw new Error(`Store ${STORE_SLUG} not found`);

  // Load stations by lowercase code
  const stations = await db.station.findMany({ where: { storeId: store.id } });
  const stationByCode = new Map(stations.map((s) => [s.code.toLowerCase(), s.id]));
  const fallbackStationId = stations[0]?.id ?? null;

  // Ensure old-site modifier groups
  const saucesGroup = await ensureModifierGroup(
    store.id,
    'Choice of Sauces (Max 3)',
    0,
    3,
    false,
    1,
    [
      { name: 'Garlic', priceDeltaCents: 0, isDefault: true },
      { name: 'BBQ', priceDeltaCents: 0 },
      { name: 'Chilli', priceDeltaCents: 0 },
      { name: 'Aioli', priceDeltaCents: 0 },
      { name: 'Garlic Mayonnaise', priceDeltaCents: 0 },
      { name: 'Garlic Yoghurt', priceDeltaCents: 0 },
      { name: 'Sweet Chilli', priceDeltaCents: 0 },
      { name: 'Tomato', priceDeltaCents: 0 },
      { name: 'Tahini', priceDeltaCents: 0 },
      { name: 'Pesto', priceDeltaCents: 0 },
      { name: 'Peri Peri', priceDeltaCents: 0 },
    ]
  );

  const saladsGroup = await ensureModifierGroup(
    store.id,
    'Choice of Salads',
    0,
    5,
    false,
    0,
    [
      { name: 'Lettuce', priceDeltaCents: 0, isDefault: true },
      { name: 'Tomato', priceDeltaCents: 0, isDefault: true },
      { name: 'Onion', priceDeltaCents: 0, isDefault: true },
      { name: 'Tabouli', priceDeltaCents: 0 },
      { name: 'Extra Cheese', priceDeltaCents: 150 },
    ]
  );

  const mealGroup = await ensureModifierGroup(
    store.id,
    'Make It a Meal',
    0,
    1,
    false,
    2,
    [{ name: 'Add Chips & Can Drink', priceDeltaCents: 500 }]
  );

  const modGroupMap = new Map<string, string>([
    ['Choice of Sauces (Max 3)', saucesGroup.id],
    ['Choice of Salads', saladsGroup.id],
    ['Make It a Meal', mealGroup.id],
  ]);

  const keepCategorySlugs = new Set<string>();
  const keepProductSlugs = new Set<string>();

  for (const [cIdx, catSeed] of MENU_DATA.entries()) {
    keepCategorySlugs.add(catSeed.slug);
    const stationId = stationByCode.get(catSeed.stationCode) ?? fallbackStationId;

    const category = await db.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: catSeed.slug } },
      create: {
        storeId: store.id,
        name: catSeed.name,
        slug: catSeed.slug,
        description: catSeed.description,
        imageUrl: catSeed.imageUrl,
        sortOrder: cIdx,
        showInMenu: true,
        defaultStationId: stationId,
      },
      update: {
        name: catSeed.name,
        description: catSeed.description,
        imageUrl: catSeed.imageUrl,
        sortOrder: cIdx,
        showInMenu: true,
        defaultStationId: stationId,
      },
    });

    const syncOneProduct = async (pIdx: number, pSeed: ProductSeed) => {
      keepProductSlugs.add(pSeed.slug);

      const product = await db.product.upsert({
        where: { storeId_slug: { storeId: store.id, slug: pSeed.slug } },
        create: {
          storeId: store.id,
          categoryId: category.id,
          stationId,
          name: pSeed.name,
          slug: pSeed.slug,
          description: pSeed.description,
          imageUrl: pSeed.imageUrl ?? catSeed.imageUrl,
          tagsJson: pSeed.tags ?? ['halal'],
          spicyLevel: pSeed.spicyLevel ?? 0,
          taxCode: 'GST',
          visibility: 'BOTH',
          active: true,
          soldOut: false,
          isBestSeller: !!pSeed.isBestSeller,
          isMultiVariant: pSeed.isMultiVariant,
          sortOrder: pIdx,
        },
        update: {
          categoryId: category.id,
          stationId,
          name: pSeed.name,
          description: pSeed.description,
          imageUrl: pSeed.imageUrl ?? catSeed.imageUrl,
          tagsJson: pSeed.tags ?? ['halal'],
          spicyLevel: pSeed.spicyLevel ?? 0,
          active: true,
          soldOut: false,
          isBestSeller: !!pSeed.isBestSeller,
          isMultiVariant: pSeed.isMultiVariant,
          sortOrder: pIdx,
        },
      });

      const keepVariantNames = new Set<string>(pSeed.variants.map((v) => v.name));
      await Promise.all(
        pSeed.variants.map((vSeed, vIdx) => {
          const sku = `SK-${pSeed.slug.replace(/[^a-z0-9]/gi, '').slice(0, 10).toUpperCase()}-${vSeed.name.slice(0, 3).toUpperCase()}`;
          return db.variant.upsert({
            where: { productId_name: { productId: product.id, name: vSeed.name } },
            create: {
              productId: product.id,
              stationId,
              name: vSeed.name,
              sku,
              priceCents: vSeed.priceCents,
              prepMinutes: vSeed.prepMinutes ?? 8,
              active: true,
              soldOut: false,
              comingSoon: false,
              sortOrder: vIdx,
            },
            update: {
              priceCents: vSeed.priceCents,
              prepMinutes: vSeed.prepMinutes ?? 8,
              active: true,
              soldOut: false,
              comingSoon: false,
              sortOrder: vIdx,
            },
          });
        })
      );

      await db.variant.updateMany({
        where: { productId: product.id, name: { notIn: [...keepVariantNames] } },
        data: { active: false },
      });

      if (pSeed.modifierGroupNames && pSeed.modifierGroupNames.length > 0) {
        await Promise.all(
          pSeed.modifierGroupNames.map((mgName, mIdx) => {
            const mgId = modGroupMap.get(mgName);
            if (!mgId) return Promise.resolve();
            return db.productModifierGroup.upsert({
              where: { productId_modifierGroupId: { productId: product.id, modifierGroupId: mgId } },
              create: { productId: product.id, modifierGroupId: mgId, sortOrder: mIdx },
              update: { sortOrder: mIdx },
            });
          })
        );
      }
    };

    // Process products in parallel batches of 6 for fast TiDB sync
    const BATCH = 6;
    for (let start = 0; start < catSeed.products.length; start += BATCH) {
      const slice = catSeed.products.slice(start, start + BATCH);
      await Promise.all(slice.map((pSeed, offset) => syncOneProduct(start + offset, pSeed)));
    }
    console.log(`Synced category: ${catSeed.name} (${catSeed.products.length} items)`);
  }

  // Deactivate all old placeholder products and hide old placeholder categories so ONLY the new menu appears on the site
  const deactivatedProducts = await db.product.updateMany({
    where: { storeId: store.id, slug: { notIn: [...keepProductSlugs] } },
    data: { active: false, isBestSeller: false },
  });

  const hiddenCategories = await db.category.updateMany({
    where: { storeId: store.id, slug: { notIn: [...keepCategorySlugs] } },
    data: { showInMenu: false },
  });

  // Deactivate any deals whose items reference deactivated products
  const deals = await db.deal.findMany({
    where: { storeId: store.id, active: true },
    include: { items: { include: { variant: { include: { product: { select: { active: true } } } } } } },
  });
  for (const deal of deals) {
    const hasInactive = deal.items.some((di) => !di.variant.product.active);
    if (hasInactive) {
      await db.deal.update({ where: { id: deal.id }, data: { active: false } });
    }
  }

  const activeCatCount = await db.category.count({ where: { storeId: store.id, showInMenu: true } });
  const activeProdCount = await db.product.count({ where: { storeId: store.id, active: true } });
  const activeVarCount = await db.variant.count({ where: { product: { storeId: store.id, active: true }, active: true } });

  console.log(
    JSON.stringify({
      ok: true,
      activeCategories: activeCatCount,
      activeProducts: activeProdCount,
      activeVariants: activeVarCount,
      deactivatedOldProducts: deactivatedProducts.count,
      hiddenOldCategories: hiddenCategories.count,
    })
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
