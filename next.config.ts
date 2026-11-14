import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep local development URLs simple; production uses the Traefik path prefix.
  basePath:
    process.env.NODE_ENV === 'production' ? process.env.DASHBOARD_BASE_PATH || '/news' : '',
};
export default nextConfig;
