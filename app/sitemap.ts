import type { MetadataRoute } from "next";

const paths = ["/", "/krediter/", "/admin/", "/checkout/", "/samtal/"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://velio.nu").replace(/\/$/, "");
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  return paths.map((path) => ({
    url: `${origin}${basePath}${path}`,
    lastModified: new Date("2026-11-26"),
  }));
}
