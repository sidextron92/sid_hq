import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
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
  images: {
    remotePatterns: [],
  },
  experimental: {
    optimizePackageImports: ["gsap", "@tiptap/react", "@tiptap/starter-kit"],
  },
};

export default nextConfig;
