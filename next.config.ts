import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "1";
const basePath = isGhPages ? "/Velio" : "";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  env: {
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH || basePath,
  },
  ...(isGhPages
    ? {
        output: "export" as const,
        basePath: "/Velio",
        assetPrefix: "/Velio/",
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
