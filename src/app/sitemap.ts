import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { getPublicMenu } from '@/modules/storefront/queries';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const baseEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/menu`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE_URL}/deals`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${SITE_URL}/track`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    const categories = await getPublicMenu();
    const categoryEntries: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${SITE_URL}/menu?category=${encodeURIComponent(cat.slug)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    }));
    return [...baseEntries, ...categoryEntries];
  } catch {
    return baseEntries;
  }
}
