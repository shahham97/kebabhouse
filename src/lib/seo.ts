import type { PublicMenuCategory } from '@/modules/storefront/queries';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
    ? process.env.NEXT_PUBLIC_APP_URL
    : 'https://starkebabhouse.com.au'
).replace(/\/$/, '');

export interface FaqEntry {
  question: string;
  answer: string;
}

export const STAR_KEBAB_FAQS: FaqEntry[] = [
  {
    question: 'Is Star Kebab 100% Halal certified?',
    answer:
      'Yes. All lamb, chicken, sucuk, and grill skewers at Star Kebab (148 King Street, Newtown NSW) are 100% Halal certified and cooked over live Australian ironbark charcoal.',
  },
  {
    question: 'What are Star Kebab’s opening hours, including late nights?',
    answer:
      'Star Kebab is open 7 days a week from 11:00 am — until 11:00 pm Sunday to Wednesday, 11:30 pm Thursday, and open late until 2:00 am every Friday and Saturday night.',
  },
  {
    question: 'What comes in the Holy Trinity Halal Snack Pack (HSP)?',
    answer:
      'Our signature Holy Trinity HSP layers double-cooked golden seasoned chips with freshly carved charcoal lamb, marinated chicken, or mixed meat, melted cheese, and our trio of house garlic toum, smoky BBQ, and house chilli sauces.',
  },
  {
    question: 'Which Sydney suburbs does Star Kebab deliver to?',
    answer:
      'We deliver fast across Newtown (2042), Erskineville (2043), St Peters (2044), Stanmore (2048), Camperdown (2050), Sydney CBD (2000), Ultimo (2007), Chippendale (2008), Surry Hills (2010), Alexandria (2015), and Redfern (2016), plus instant pickup in-store.',
  },
  {
    question: 'Can I pre-order kebabs, HSP, or Turkish pide for later?',
    answer:
      'Yes! You can order ASAP or schedule a Pickup or Delivery pre-order up to 7 days in advance. Every order includes a live order tracker link so you can watch it move from the charcoal grill to ready or out for delivery.',
  },
  {
    question: 'How do Star Rewards loyalty points work?',
    answer:
      'Create a free Star Rewards customer account to earn 1 point for every $1 spent online. Once you reach 100 points, you unlock $5 off your next charcoal kebab, HSP, or wood-fired pide order.',
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
    name: store.name || 'Star Kebab',
    alternateName: 'Star Kebab House',
    url: SITE_URL,
    logo: `${SITE_URL}/images/logo.webp`,
    image: [
      `${SITE_URL}${store.heroImageUrl || '/images/hero-grill.jpg'}`,
      `${SITE_URL}/images/kebab-wrap.jpg`,
      `${SITE_URL}/images/hsp-box.jpg`,
      `${SITE_URL}/images/turkish-pizza.jpg`,
    ],
    description:
      'Authentic 100% Halal charcoal-grilled kebabs, loaded Holy Trinity Halal Snack Packs (HSP), wood-fired Turkish pide, and mixed charcoal grill plates in Newtown, Sydney. Open late Friday & Saturday until 2am.',
    telephone: store.phone || '+61 2 9876 5432',
    email: store.email || 'hello@starkebab.com.au',
    priceRange: '$$',
    currenciesAccepted: 'AUD',
    paymentAccepted: 'Cash, Credit Card, Debit Card, EFTPOS',
    servesCuisine: [
      'Middle Eastern',
      'Turkish',
      'Halal',
      'Kebab',
      'Halal Snack Pack',
      'Wood-Fired Pizza & Pide',
      'Charcoal Grill',
    ],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '148 King Street',
      addressLocality: 'Newtown',
      addressRegion: 'NSW',
      postalCode: '2042',
      addressCountry: 'AU',
    },
    areaServed: [
      'Newtown NSW',
      'Erskineville NSW',
      'Stanmore NSW',
      'Camperdown NSW',
      'Sydney CBD NSW',
      'Inner West Sydney',
    ],
    hasMenu: `${SITE_URL}/menu`,
    acceptsReservations: false,
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
    name: 'Star Kebab Full Menu',
    url: `${SITE_URL}/menu`,
    hasMenuSection: categories.map((cat) => ({
      '@type': 'MenuSection',
      name: cat.name,
      description: cat.description,
      hasMenuItem: cat.products.map((prod) => {
        const orderable = prod.variants.filter((v) => v.isOrderable);
        const minCents =
          orderable.length > 0
            ? Math.min(...orderable.map((v) => v.priceCents))
            : prod.variants[0]?.priceCents ?? 0;
        return {
          '@type': 'MenuItem',
          name: prod.name,
          description: prod.description,
          image: prod.imageUrl ? `${SITE_URL}${prod.imageUrl}` : undefined,
          suitableForDiet: prod.tags.includes('halal')
            ? 'https://schema.org/HalalDiet'
            : undefined,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'AUD',
            price: (minCents / 100).toFixed(2),
            availability:
              orderable.length > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          },
        };
      }),
    })),
  };
}
