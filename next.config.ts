import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;
    if (!pbUrl) return [];
    return [
      {
        source: "/pb/:path*",
        destination: `${pbUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
