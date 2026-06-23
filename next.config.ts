import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tong.visitkorea.or.kr",
      },
      {
        protocol: "http",
        hostname: "tong.visitkorea.or.kr",
      },
    ],
  },
};

export default nextConfig;
