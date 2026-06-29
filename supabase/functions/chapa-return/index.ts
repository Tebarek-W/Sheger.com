import { appDeepLinkReturnUrl } from "../_shared/chapa.ts";
import { handleCors, jsonResponse } from "../_shared/supabase.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestUrl = new URL(req.url);
  const txRef =
    requestUrl.searchParams.get("tx_ref")?.trim() ??
    requestUrl.searchParams.get("trx_ref")?.trim() ??
    "";
  const appUrl = appDeepLinkReturnUrl(txRef);
  const safeAppUrl = escapeHtml(appUrl);

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appUrl,
        "Cache-Control": "no-store",
      },
    });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${safeAppUrl}" />
  <title>Returning to Sheger</title>
  <style>
    body { font-family: system-ui, sans-serif; text-align: center; padding: 48px 20px; color: #1a1a1a; }
    a { color: #0d4d0d; font-weight: 600; }
  </style>
</head>
<body>
  <p>Payment complete. Returning to the Sheger app…</p>
  <p><a href="${safeAppUrl}">Open Sheger</a> if you are not redirected automatically.</p>
  <script>window.location.replace(${JSON.stringify(appUrl)});</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
});
