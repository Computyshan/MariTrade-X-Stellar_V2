'use client';

import React from 'react';
import { getUsdToPhpRate } from '@/lib/stellar/fx';

// Async PHP equivalent using the live FX rate. Extracted from the shipment
// detail page so the Escrow Ledger panel can reuse it independently.
export default function PhpEquivLabel({ usdcAmount }: { usdcAmount: number }) {
  const [label, setLabel] = React.useState<string | null>(null);
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    getUsdToPhpRate().then(({ rate, isLive }) => {
      setLabel((usdcAmount * rate).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
      setLive(isLive);
    });
  }, [usdcAmount]);
  if (!label) return null;
  return (
    <span className="text-[10px] text-steel block italic font-medium">
      ₱{label} PHP{!live && ' (est.)'}
    </span>
  );
}
