import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'pg'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
