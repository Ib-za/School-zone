import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@elate/api", "@elate/shared"]
};

export default nextConfig;
