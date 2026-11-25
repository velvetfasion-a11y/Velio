import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
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
