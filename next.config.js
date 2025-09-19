/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        port: '',
        pathname: '/combiner/i/**',
      },
      {
        protocol: 'https',
        hostname: 'a1.espncdn.com',
        port: '',
        pathname: '/combiner/i/**',
      },
      {
        protocol: 'https',
        hostname: 'a1.espncdn.com',
        port: '',
        pathname: '/i/teamlogos/ncaa/**',
      },
    ],
  },
};

module.exports = nextConfig;


