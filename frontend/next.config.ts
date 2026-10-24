import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // La subida del PDF de la OC (hasta 5 MB) viaja en una Server Action.
    serverActions: { bodySizeLimit: '6mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            // img-src incluye blob: porque el export de gráficas a PNG
            // (lib/export/chart-export.ts) rasteriza el SVG cargándolo en un
            // <img src="blob:..."> — sin blob: aquí, el navegador bloquea esa
            // carga por CSP y el export de PNG falla siempre (img.onerror).
            value: `default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:;`,
          },
        ],
      },
    ]
  },
};

export default nextConfig;
