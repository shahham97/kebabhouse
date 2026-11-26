import { revalidateTag as nextRevalidateTag } from 'next/cache';

export const CACHE_TAGS = {
  menu: 'menu',
  deals: 'deals',
  cms: 'cms',
  settings: 'settings',
  stations: 'stations',
} as const;

export function safeRevalidateTag(tag: string): void {
  try {
    nextRevalidateTag(tag);
  } catch {
    // No-op when invoked outside Next.js request context (e.g. Vitest integration tests)
  }
}
