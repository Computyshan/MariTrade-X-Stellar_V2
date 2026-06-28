/** import type {NextConfig} from 'next';*/

const nextConfig = {
  turbopack: {},
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prevent webpack from bundling these packages into the client bundle.
  // They contain pnpm virtual-store paths (.pnpm/...) that only resolve
  // correctly when loaded natively by Node — not when bundled by webpack.
  serverExternalPackages: ['@stellar/stellar-sdk', 'escrow-bindings'],
  // CLEANUP: picsum.photos is used for demo/placeholder avatars only.
  // Before going to production, migrate to real CDN / Supabase Storage and remove this entry.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
