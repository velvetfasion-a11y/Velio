import type { NextConfig } from "next";

/** Empty by default so velio.nu is served from the site root. Set NEXT_PUBLIC_BASE_PATH for a subpath such as /Velio. */
function configuredBasePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/$/, "");
}

const basePath = configuredBasePath();
const pages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://velio.nu",
  },
  ...(pages
    ? {
        output: "export" as const,
        ...(basePath ? { basePath, assetPrefix: `${basePath}/` } : {}),
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
