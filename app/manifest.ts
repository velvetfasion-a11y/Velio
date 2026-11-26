import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  return {
    name: "VELIO",
    short_name: "VELIO",
    description: "VELIO — boka elektriker, städning och andra tjänster nära dig.",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#FAF8F5",
    lang: "sv",
    icons: [{ src: `${basePath}/favicon.svg`, sizes: "any", type: "image/svg+xml" }],
  };
}
