import type {NextConfig} from 'next';
import { PERMISSIONS_POLICY } from './lib/security/browser-policy';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1'],
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ['motion'],
  outputFileTracingIncludes: {
    '/api/official-documents': [
      './assets/fonts/NotoSans-Regular.ttf',
      './assets/fonts/NotoSans-Bold.ttf',
      './public/brand/monalyz/monalyz-wordmark-reversed-white.png',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: PERMISSIONS_POLICY,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
