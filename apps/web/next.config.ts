import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    "@codeshift/analyzer",
    "@codeshift/migrator",
    "@codeshift/shared",
  ],
};

export default nextConfig;
