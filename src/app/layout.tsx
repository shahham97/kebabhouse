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
    default: 'Star Kebab House — Best 100% Halal Charcoal Kebabs, HSP & Wood-Fired Pide in Sydney',
    template: '%s | Star Kebab House',
  },
  description:
    'Order Sydney’s favourite 100% Halal charcoal-grilled lamb & chicken kebabs, loaded Holy Trinity Halal Snack Packs (HSP), stone-baked Turkish pide, and mixed grill plates from Star Kebab House Newtown. Fast pickup, local delivery & open late Fri–Sat till 2am.',
  keywords: [
    'Star Kebab',
    'Star Kebab House',
    'best kebab Sydney',
    'halal kebab Newtown',
    'Halal Snack Pack Sydney',
    'HSP near me',
    'late night kebab Sydney',
    'Turkish pide Newtown',
    'charcoal kebab delivery Inner West',
    '100% halal takeaway Sydney',
  ],
  alternates: {
    canonical: '/',
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
    title: 'Star Kebab House — 100% Halal Charcoal Kebabs, HSP & Wood-Fired Pide',
    description:
      'Carved fresh off live Australian ironbark charcoal. Order kebabs, Holy Trinity HSP & Turkish pide online for pickup or delivery across Newtown & Inner West Sydney.',
    images: [
      {
        url: '/images/hero-grill.jpg',
        width: 1200,
        height: 630,
        alt: 'Star Kebab House charcoal lamb and chicken kebab feast',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Star Kebab House — Charcoal Kebabs, HSP & Pide (Newtown, Sydney)',
    description:
      '100% Halal ironbark charcoal kebabs, loaded HSP & wood-fired pide. Open late Fri–Sat till 2am.',
    images: ['/images/hero-grill.jpg'],
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
