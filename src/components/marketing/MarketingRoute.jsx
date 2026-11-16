import { lazy, Suspense } from 'react';

const MarketingAccess = lazy(() => import('./MarketingAccess.jsx'));

export default function MarketingRoute() {
  return <Suspense fallback={<p role="status">Loading Marketing Hub…</p>}><MarketingAccess /></Suspense>;
}
