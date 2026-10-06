import { env } from "cloudflare:workers";
export function GET() {
  const vars = env as unknown as Record<string, string | undefined>;
  const url = vars.SUPABASE_URL ?? "";
  const key = vars.SUPABASE_PUBLISHABLE_KEY ?? "";
  // Only an explicitly public key can reach the browser.
  const configured =
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) &&
    key.startsWith("sb_publishable_");
  return Response.json(
    { url: configured ? url : "", key: configured ? key : "", configured },
    { headers: { "Cache-Control": "no-store" } },
  );
}
