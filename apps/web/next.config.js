/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@purchasing/constants', '@purchasing/shared-types'],
  output: 'standalone'
};

module.exports = nextConfig;

