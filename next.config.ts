import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  basePath: process.env.DASHBOARD_BASE_PATH || '/news',
};
export default nextConfig;
