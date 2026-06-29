'use client';
/**
 * components/AssetSelector.tsx
 *
 * Reusable toggle/dropdown for picking the payment currency (USDC or PPHP)
 * wherever a user funds or quotes a shipment in a specific asset. Pulls its
 * options from ASSET_LIST in lib/stellar/assets.ts — adding a third asset
 * there automatically shows up here.
 *
 * Usage:
 *   const [assetCode, setAssetCode] = useState<AssetCode>('USDC');
 *   <AssetSelector value={assetCode} onChange={setAssetCode} />
 */

import React from 'react';
import { ASSET_LIST, AssetCode } from '@/lib/stellar/assets';

interface AssetSelectorProps {
  value: AssetCode;
  onChange: (code: AssetCode) => void;
  /** Disable specific assets (e.g. while on-chain escrow only supports USDC). */
  disabledCodes?: AssetCode[];
  className?: string;
}

export default function AssetSelector({ value, onChange, disabledCodes = [], className = '' }: AssetSelectorProps) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {ASSET_LIST.map(asset => {
        const selected = value === asset.code;
        const disabled = disabledCodes.includes(asset.code);
        return (
          <button
            key={asset.code}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(asset.code)}
            title={disabled ? `${asset.name} is not yet supported here` : asset.name}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black border-2 transition-all
              ${disabled
                ? 'border-sand-200 text-gray-300 cursor-not-allowed opacity-60'
                : selected
                  ? `border-ocean-400 bg-ocean-50 text-ocean-600 cursor-pointer`
                  : 'border-sand-200 text-gray-500 hover:border-maritime-200 cursor-pointer'}`}
          >
            <span>{asset.symbol}</span>
            <span>{asset.code}</span>
          </button>
        );
      })}
    </div>
  );
}
