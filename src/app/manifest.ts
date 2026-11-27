import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Star Kebab House — Pizza & Grill',
    short_name: 'Star Kebab',
    description:
      '100% Halal charcoal kebabs, Halal Snack Packs (HSP), Turkish pide, gourmet pizzas, gozleme, skewers & baklava.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAF6EE',
    theme_color: '#181310',
    lang: 'en-AU',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
