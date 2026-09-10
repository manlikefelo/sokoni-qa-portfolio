import type { NextConfig } from 'next';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Content-Security-Policy. Next.js injects inline bootstrap scripts, and in
 * development the dev overlay additionally needs eval, so 'unsafe-inline' and
 * (development only) 'unsafe-eval' are present for scripts. Styles need
 * 'unsafe-inline' because Tailwind's generated style element is injected inline.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  // Pin the trace root to this project. Without it Next.js walks up to the home
  // directory, finds an unrelated lockfile there and warns on every build.
  outputFileTracingRoot: import.meta.dirname,
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  serverExternalPackages: ['@node-rs/argon2'],
  experimental: {
    // Caps the accepted server action payload. Without this the default is 1MB;
    // nothing this application posts comes close.
    serverActions: { bodySizeLimit: '256kb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
