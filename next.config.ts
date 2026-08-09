import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // IMDb ratings/watchlist exports can exceed the 1MB default cap.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
