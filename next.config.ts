import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "1";
const basePath = isGhPages ? "/Velio" : "";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "openid-client"],
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
