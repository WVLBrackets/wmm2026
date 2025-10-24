/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg', 'postgres'],
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
}

module.exports = nextConfig