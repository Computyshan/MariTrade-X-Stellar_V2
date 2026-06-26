// Type declarations for @stellar/freighter-api v4.x
// The installed package's build does not include .d.ts files,
// so we declare the module shape here to satisfy TypeScript.
declare module '@stellar/freighter-api' {
  type AnyReturn =
    | string
    | { address?: string; signedTxXdr?: string; isConnected?: boolean };

  export function isConnected(): Promise<AnyReturn>;
  export function requestAccess(): Promise<AnyReturn>;
  export function getAddress(): Promise<AnyReturn>;
  export function getPublicKey(): Promise<string>;
  export function signTransaction(
    xdr: string,
    opts?: {
      networkPassphrase?: string;
      network?: string;
      accountToSign?: string;
    },
  ): Promise<AnyReturn>;
}
