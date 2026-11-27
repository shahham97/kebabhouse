import type { PublicMenuCategory } from '@/modules/storefront/queries';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'https://www.starkebabhouse.com.au'
).replace(/\/$/, '');

export interface FaqEntry {
  question: string;
  answer: string;
}

export const STAR_KEBAB_FAQS: FaqEntry[] = [
  {
    question: 'Is Star Kebab House 100% Halal certified?',
    answer:
      'Yes. All meats at Star Kebab House — including charcoal lamb, marinated chicken, beef skewers, Turkish salami, burgers, and Halal Snack Packs — are 100% Halal certified, with zero pork or alcohol on premises.',
  },
  {
    question: 'What is on the Star Kebab House menu?',
    answer:
      'Our full Turkish & charcoal grill menu spans 15 categories: Kebab Rolls, Halal Snack Packs (Regular & Large), stone-baked Turkish Pides, 30+ Gourmet Pizzas, handmade Gozleme, Charcoal Mains & Skewers, Lunch Boxes, Turkish Burgers (including Camel Burger), Hot Entrees, Homemade Dips, Group Banquets, Sides, Turkish Bread, Kids Menu, Beverages, and Pistachio/Walnut Baklava.',
  },
  {
    question: 'What comes in a Star Kebab House Halal Snack Pack (HSP)?',
    answer:
      'Our Regular ($18) and Large ($22) Halal Snack Packs layer hot golden seasoned chips with freshly carved charcoal chicken, lamb, or mixed meat, melted cheese, and up to 3 sauces of your choice — including garlic, BBQ, chilli, aioli, garlic yoghurt, sweet chilli, peri peri, and tahini.',
  },
  {
    question: 'Do you offer vegetarian, vegan, and gluten-free options?',
    answer:
      'Yes. We offer Falafel and Zucchini Kebab Rolls & Lunch Boxes, Spinach & Feta and Potato Gozleme, Vegetarian Pides & Gourmet Pizzas, Halloumi Pizza, Zaatar Pizzas, Grilled Vegetables, Homemade Dips (Hummus, Eggplant, Cucumber, Beetroot, Carrot), Dolma Vine Leaves, and a dedicated Vegetarian Banquet.',
  },
  {
    question: 'Can I order online for pickup, delivery, or scheduled pre-orders?',
    answer:
      'Yes! You can order directly on starkebabhouse.com.au for fast pickup or local delivery, either ASAP or scheduled up to 7 days in advance. Every order includes a live order tracking link so you can follow it from our charcoal grill to ready or out for delivery.',
  },
  {
    question: 'Do you cater for groups and families with Turkish banquets?',
    answer:
      'Yes. We offer 6 value Turkish Banquets starting from $25 per person — including Mixed Skewer Banquets, Vegetarian Banquets, Shaved Meat Banquets, and Pizza & Pide Lover Feasts for groups of 2 to 6+ people.',
  },
];

const SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'Star Kebab House',
    alternateName: ['Star Kebab', 'Star Kebab House Pizza & Grill'],
    url: SITE_URL,
    inLanguage: 'en-AU',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/menu?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function buildRestaurantJsonLd(
  store: {
    name: string;
    phone: string;
    email: string;
    address: string;
    heroImageUrl?: string | null;
  },
  openingHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': ['Restaurant', 'FastFoodRestaurant'],
    '@id': `${SITE_URL}/#restaurant`,
    name: store.name || 'Star Kebab House',
    alternateName: 'Star Kebab House — Pizza & Grill',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo-transparent.png`,
    image: [
      `${SITE_URL}/images/hero-kebab-steak-bg.jpg`,
      `${SITE_URL}${store.heroImageUrl || '/images/hero-grill.jpg'}`,
      `${SITE_URL}/images/kebab-wrap.jpg`,
      `${SITE_URL}/images/hsp-box.jpg`,
      `${SITE_URL}/images/turkish-pizza.jpg`,
      `${SITE_URL}/images/grill-plate.jpg`,
    ],
    description:
      'Authentic 100% Halal Turkish charcoal-grilled kebabs, Halal Snack Packs (HSP), stone-baked Turkish pide, gourmet pizzas, handmade gozleme, charcoal skewers, banquets, and baklava. Order online for fast pickup or delivery.',
    telephone: store.phone || '+61 2 9876 5432',
    email: store.email || 'hello@starkebab.com.au',
    priceRange: '$$',
    currenciesAccepted: 'AUD',
    paymentAccepted: 'Cash, Credit Card, Debit Card, EFTPOS',
    servesCuisine: [
      'Turkish',
      'Middle Eastern',
      'Halal',
      'Kebab',
      'Halal Snack Pack',
      'Turkish Pide',
      'Gourmet Pizza',
      'Gozleme',
      'Charcoal Grill',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address || '148 King Street, Newtown NSW 2042',
      addressCountry: 'AU',
    },
    hasMenu: `${SITE_URL}/menu`,
    acceptsReservations: false,
    potentialAction: {
      '@type': 'OrderAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/menu`,
        inLanguage: 'en-AU',
        actionPlatform: [
          'http://schema.org/DesktopWebPlatform',
          'http://schema.org/MobileWebPlatform',
        ],
      },
      deliveryMethod: [
        'http://purl.org/goodrelations/v1#DeliveryModePickUp',
        'http://purl.org/goodrelations/v1#DeliveryModeOwnFleet',
      ],
    },
    openingHoursSpecification: openingHours
      .filter((h) => !h.isClosed)
      .map((h) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: SCHEMA_DAYS[h.dayOfWeek] ?? 'Monday',
        opens: h.openTime,
        closes: h.closeTime,
      })),
  };
}

export function buildFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: STAR_KEBAB_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}

export function buildMenuJsonLd(categories: PublicMenuCategory[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${SITE_URL}/menu#menu`,
    name: 'Star Kebab House Full Menu',
    description:
      '100% Halal Turkish kebabs, Halal Snack Packs (HSP), Turkish pides, gourmet pizzas, gozleme, charcoal skewers, burgers, banquets, dips, and baklava.',
    url: `${SITE_URL}/menu`,
    inLanguage: 'en-AU',
    hasMenuSection: categories.map((cat) => ({
      '@type': 'MenuSection',
      name: cat.name,
      description: cat.description,
      hasMenuItem: cat.products.map((prod) => {
        const orderable = prod.variants.filter((v) => v.isOrderable);
        const diets: string[] = [];
        if (prod.tags.includes('halal')) diets.push('https://schema.org/HalalDiet');
        if (prod.tags.includes('veg')) diets.push('https://schema.org/VegetarianDiet');

        const offers = prod.variants.map((v) => ({
          '@type': 'Offer',
          name: prod.variants.length > 1 ? `${prod.name} (${v.name})` : prod.name,
          priceCurrency: 'AUD',
          price: (v.priceCents / 100).toFixed(2),
          availability: v.isOrderable
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        }));

        return {
          '@type': 'MenuItem',
          name: prod.name,
          description: prod.description,
          image: prod.imageUrl ? `${SITE_URL}${prod.imageUrl}` : undefined,
          suitableForDiet: diets.length === 1 ? diets[0] : diets.length > 1 ? diets : undefined,
          offers: offers.length === 1 ? offers[0] : offers,
          ...(orderable.length === 0 ? { availability: 'https://schema.org/OutOfStock' } : {}),
        };
      }),
    })),
  };
}
