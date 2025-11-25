import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  // Exclude test files from production build
  // Test files are excluded via tsconfig.json exclude patterns
};

export default nextConfig;
