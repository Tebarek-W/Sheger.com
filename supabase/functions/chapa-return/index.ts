import { handleCors, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sheger</title>
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 20px;color:#1a1a1a;">
  <h1 style="font-size:20px;margin-bottom:12px;">Payment complete</h1>
  <p>Close this browser window and return to the Sheger app.</p>
  <p style="font-size:14px;color:#666;">Then tap <strong>Confirm payment</strong> if you are not redirected automatically.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
