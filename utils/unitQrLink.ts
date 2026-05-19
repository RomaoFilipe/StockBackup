export function getConfiguredAppOrigin(fallback = "") {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    fallback;
  return String(configured || "").trim().replace(/\/+$/, "");
}

export function buildUnitLookupUrl(args: { origin?: string; code: string }) {
  const code = args.code.trim();
  const path = `/units/lookup?code=${encodeURIComponent(code)}`;
  const origin = getConfiguredAppOrigin(args.origin || "");
  return origin ? `${origin}${path}` : path;
}
