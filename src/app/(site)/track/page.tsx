import React from 'react';
import { TrackOrderClient } from '@/components/storefront/TrackOrderClient';

export const metadata = {
  title: 'Track Your Order Live',
  description:
    'Enter your Star Kebab House order number to track live preparation on our charcoal grill, packing, pickup readiness, or delivery status.',
  alternates: { canonical: '/track' },
};

export default function TrackOrderPage() {
  return <TrackOrderClient />;
}
