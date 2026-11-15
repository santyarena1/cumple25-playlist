// Helpers compartidos para hablar con Spotify (no es una ruta: el "_" lo excluye).
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";

let cached = { token: null, exp: 0 };

function basicAuth() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Faltan SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function tokenRequest(params) {
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`Spotify token ${r.status}: ${d.error_description || d.error}`);
  return d;
}

async function accessToken() {
  if (cached.token && Date.now() < cached.exp) return cached.token;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refresh) throw new Error("Falta SPOTIFY_REFRESH_TOKEN");
  const d = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  cached = { token: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
  return cached.token;
}

async function api(path) {
  const r = await fetch(API + path, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (r.status === 204) return null;
  if (!r.ok) {
    const err = new Error(`Spotify ${path} ${r.status}`);
    err.status = r.status;
    err.retryAfter = Number(r.headers.get("retry-after")) || 0;
    throw err;
  }
  return r.json();
}

function redirectUri(req) {
  return `https://${req.headers["x-forwarded-host"] || req.headers.host}/api/callback`;
}

function track(t) {
  if (!t) return null;
  const imgs = t.album?.images || [];
  return {
    id: t.id,
    title: t.name,
    artist: (t.artists || []).map((a) => a.name).join(", "),
    album: t.album?.name || "",
    image: imgs[0]?.url || null,
    duration: t.duration_ms || 0,
  };
}

module.exports = { tokenRequest, api, redirectUri, track };
