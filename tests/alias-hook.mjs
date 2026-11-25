export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let rel = specifier.slice(2);
    if (!rel.endsWith(".ts") && !rel.endsWith(".js") && !rel.endsWith(".mjs")) rel += ".ts";
    const url = new URL(`../src/${rel}`, import.meta.url);
    return nextResolve(url.href, context);
  }
  if (specifier.startsWith("@cursor/")) {
    let rel = specifier.slice("@cursor/".length);
    if (!rel.endsWith(".ts") && !rel.endsWith(".js") && !rel.endsWith(".mjs")) rel += ".ts";
    const url = new URL(`../cursor/${rel}`, import.meta.url);
    return nextResolve(url.href, context);
  }
  return nextResolve(specifier, context);
}
