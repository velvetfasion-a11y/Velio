/** Prefix public asset paths when NEXT_PUBLIC_BASE_PATH is set. The default is the site root. */
export function asset(path: string): string {
  if (!path || path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const envBase = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
  if (envBase) return `${envBase}${normalized}`;

  if (typeof window !== "undefined") {
    const baseTag = document.querySelector("base")?.getAttribute("href")?.replace(/\/$/, "") ?? "";
    if (baseTag && baseTag !== "/" && baseTag.startsWith("/")) return `${baseTag}${normalized}`;
  }
  return normalized;
}
