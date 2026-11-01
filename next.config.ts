import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**/*': ['./public/data/tournament-*.json', './public/logos/teams/*.png'],
  },
  images: {
    qualities: [25, 50, 75, 95, 100],
    formats: ['image/webp', 'image/avif'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/combiner/i/**',
      },
    ],
  },
  async redirects() {
    return [
      { source: "/admin/vintage-homepage", destination: "/vintage/admin", permanent: true },
      { source: "/admin/vintage-homepage/preview", destination: "/vintage/admin/preview", permanent: true },
      { source: "/admin/vintage-picks", destination: "/vintage/admin/picks", permanent: true },
      { source: "/admin/vintage-info", destination: "/vintage/admin/info", permanent: true },
      { source: "/admin/vintage-info/preview", destination: "/vintage/admin/info/preview", permanent: true },
      { source: "/admin/vintage-hof", destination: "/vintage/admin/hof", permanent: true },
      { source: "/admin/vintage-hof/preview", destination: "/vintage/admin/hof/preview", permanent: true },
      { source: "/admin/vintage-standings", destination: "/vintage/admin/standings", permanent: true },
    ];
  },
};

export default nextConfig;
