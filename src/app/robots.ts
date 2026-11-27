import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const disallowed = [
    '/admin',
    '/admin/',
    '/staff',
    '/staff/',
    '/staff-login',
    '/till',
    '/station',
    '/station/',
    '/api/',
    '/checkout',
    '/order/',
    '/account',
    '/account/',
    '/login',
  ];

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: disallowed },
      { userAgent: 'Googlebot', allow: '/', disallow: disallowed },
      { userAgent: 'Google-Extended', allow: '/', disallow: disallowed },
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: disallowed },
      { userAgent: 'GPTBot', allow: '/', disallow: disallowed },
      { userAgent: 'PerplexityBot', allow: '/', disallow: disallowed },
      { userAgent: 'ClaudeBot', allow: '/', disallow: disallowed },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: disallowed },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
