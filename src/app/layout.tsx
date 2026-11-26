import type { Metadata } from 'next';
import { Barlow_Condensed, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
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
  title: {
    default: 'Star Kebab — Charcoal Kebabs, HSP & Wood-Fired Pide',
    template: '%s | Star Kebab',
  },
  description:
    '100% Halal charcoal-grilled kebabs, loaded Halal Snack Packs (HSP), stone-baked Turkish pide & mixed grill plates. Order online for pickup or delivery in Sydney.',
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
