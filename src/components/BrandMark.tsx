import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * Bespoke geometric 8-point culinary emblem for Star Kebab.
 * Clean hospitality vector mark — zero emoji or generic AI sparkle iconography.
 */
export function BrandMark({ className = 'h-5 w-5' }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 2L14.35 8.2L20.66 5.34L17.8 11.65L24 14L17.8 16.35L20.66 22.66L14.35 19.8L12 24L9.65 19.8L3.34 22.66L6.2 16.35L0 14L6.2 11.65L3.34 5.34L9.65 8.2L12 2Z"
        transform="translate(0 -1) scale(0.92)"
        fill="currentColor"
      />
      <circle cx="11.04" cy="11.88" r="2.2" fill="var(--ember, #C8401E)" />
    </svg>
  );
}
