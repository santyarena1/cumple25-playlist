const { tokenRequest, redirectUri } = require("./_spotify");

// Paso único de configuración: muestra el refresh token para cargarlo en Vercel.
module.exports = async (req, res) => {
  const code = new URL(req.url, "http://x").searchParams.get("code");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (!code) return res.end("<p>Falta el código de Spotify.</p>");
  try {
    const d = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(req) });
    res.end(`<body style="font-family:system-ui;background:#232a3f;color:#f4ead8;padding:40px">
      <h1>Spotify conectado ✔</h1>
      <p>Refresh token:</p><pre id="rt" style="white-space:pre-wrap;word-break:break-all">${d.refresh_token}</pre></body>`);
  } catch (e) {
    res.statusCode = 500;
    res.end(`<p>Error: ${String(e.message).replace(/</g, "&lt;")}</p>`);
  }
};
