import type { Metadata } from 'next';
import { Barlow_Condensed, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { SITE_URL } from '@/lib/seo';
import './globals.css';

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Star Kebab House — 100% Halal Charcoal Kebabs, HSP, Turkish Pide & Gourmet Pizza',
    template: '%s | Star Kebab House',
  },
  description:
    'Order authentic 100% Halal charcoal-grilled kebabs, Halal Snack Packs (HSP), stone-baked Turkish pide, gourmet pizzas, handmade gozleme, charcoal skewers, banquets & baklava from Star Kebab House. Fast pickup & delivery online.',
  keywords: [
    'Star Kebab House',
    'Star Kebab',
    '100% halal kebab',
    'best charcoal kebab Australia',
    'Halal Snack Pack',
    'HSP near me',
    'Turkish pide',
    'gourmet halal pizza',
    'handmade gozleme',
    'charcoal lamb skewers',
    'Turkish restaurant takeaway',
    'halal pizza and grill',
    'Turkish banquet catering',
    'fresh baklava',
    'late night kebab delivery',
  ],
  authors: [{ name: 'Star Kebab House', url: SITE_URL }],
  creator: 'Star Kebab House',
  publisher: 'Star Kebab House',
  category: 'food',
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  alternates: {
    canonical: '/',
    languages: {
      'en-AU': '/',
    },
  },
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.png', type: 'image/png', sizes: '64x64' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.png'],
  },
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: SITE_URL,
    siteName: 'Star Kebab House',
    title: 'Star Kebab House — 100% Halal Charcoal Kebabs, HSP, Turkish Pide & Gourmet Pizza',
    description:
      'Authentic Turkish charcoal kebabs, loaded Halal Snack Packs, stone-baked pide, gourmet pizzas, gozleme & baklava. Order online for fast pickup or delivery.',
    images: [
      {
        url: '/images/hero-kebab-steak-bg.jpg',
        width: 1200,
        height: 675,
        alt: 'Star Kebab House charcoal kebab skewers and seared steak grill',
      },
      {
        url: '/images/hero-grill.jpg',
        width: 1200,
        height: 630,
        alt: 'Star Kebab House signature charcoal kebab and grill feast',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Star Kebab House — 100% Halal Kebabs, HSP, Turkish Pide & Pizza',
    description:
      'Charcoal-grilled lamb & chicken kebabs, Halal Snack Packs, wood-fired pide, gourmet pizzas & gozleme. Order online.',
    images: ['/images/hero-kebab-steak-bg.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${barlow.variable} ${jakarta.variable} ${jetbrains.variable}`}>
      <body className="min-h-screen overflow-x-clip bg-cream text-char antialiased selection:bg-saffron/40 selection:text-char">
        {children}
      </body>
    </html>
  );
}
