const { api, track } = require("./_spotify");

const PLAYLIST_ID = "4gT57f4C9MS4cixTIBVxY1";
const OWNER_ID = "th0z6eu32jllk99qbn4tpectg";
const OWNER_NAME = "Santy";
const RECENT_COUNT = 6;
const RECENT_TTL = 15_000;
const ADDERS_TTL = 60_000;
const QUEUE_TTL = 10_000;
const UA = { "User-Agent": "Mozilla/5.0" };

const names = new Map([[OWNER_ID, OWNER_NAME]]);
const covers = new Map();
const cache = { recent: null, recentAt: 0, adders: new Map(), addersAt: 0, queue: [], queueAt: 0 };
const blockedUntil = new Map(); // endpoint -> timestamp (respeta el Retry-After de Spotify)

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// Llama a la API salvo que Spotify nos haya pedido esperar; si devuelve 429, guarda hasta cuándo.
async function guarded(key, path) {
  if ((blockedUntil.get(key) || 0) > Date.now()) return undefined;
  try {
    return await api(path);
  } catch (e) {
    if (e.status === 429) blockedUntil.set(key, Date.now() + (e.retryAfter || 60) * 1000);
    console.error(`[${key}]`, e.message);
    return undefined;
  }
}

// La API ya no deja leer perfiles ajenos (403), así que el nombre sale de la página pública del usuario.
async function userName(id) {
  if (!id) return null;
  if (names.has(id)) return names.get(id);
  try {
    const r = await fetch(`https://open.spotify.com/user/${id}`, { headers: UA });
    const m = (await r.text()).match(/<meta property="og:title" content="([^"]*)"/);
    const name = m ? decode(m[1]).trim() : null;
    if (name) names.set(id, name);
    return name;
  } catch (e) {
    console.error("[user]", id, e.message);
    return null;
  }
}

async function cover(id) {
  if (covers.has(id)) return covers.get(id);
  try {
    const r = await fetch(`https://open.spotify.com/oembed?url=spotify:track:${id}`, { headers: UA });
    const url = r.ok ? (await r.json()).thumbnail_url || null : null;
    covers.set(id, url);
    return url;
  } catch {
    return null;
  }
}

// Lista completa desde el reproductor embebido público (no gasta cuota de la API).
async function embedTracks() {
  const r = await fetch(`https://open.spotify.com/embed/playlist/${PLAYLIST_ID}`, { headers: UA });
  const m = (await r.text()).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`embed sin datos (${r.status})`);
  const list = JSON.parse(m[1])?.props?.pageProps?.state?.data?.entity?.trackList || [];
  return list.map((t) => ({ id: t.uri.split(":").pop(), uid: t.uid, title: t.title, artist: t.subtitle, duration: t.duration }));
}

// Quién agregó cada tema: solo lo da la API; si está bloqueada, seguimos sin nombres.
async function adders(total) {
  if (Date.now() - cache.addersAt < ADDERS_TTL) return cache.adders;
  cache.addersAt = Date.now();
  const offset = Math.max(0, total - RECENT_COUNT);
  const page = await guarded("items", `/playlists/${PLAYLIST_ID}/items?limit=${RECENT_COUNT}&offset=${offset}`);
  if (!page) return cache.adders;
  const map = new Map();
  for (const i of page.items || []) {
    const t = i.item || i.track;
    if (t?.id) map.set(t.id, { addedAt: i.added_at, addedBy: await userName(i.added_by?.id) });
  }
  cache.adders = map;
  return map;
}

async function recentAdds() {
  if (cache.recent && Date.now() - cache.recentAt < RECENT_TTL) return cache.recent;
  const all = await embedTracks();
  const by = await adders(all.length);
  const last = all.slice(-RECENT_COUNT).reverse();
  const items = await Promise.all(
    last.map(async (t) => ({ ...t, image: await cover(t.id), ...(by.get(t.id) || {}) })),
  );
  cache.recent = { items, total: all.length };
  cache.recentAt = Date.now();
  return cache.recent;
}

async function upNext() {
  if (Date.now() - cache.queueAt < QUEUE_TTL) return cache.queue;
  cache.queueAt = Date.now();
  const q = await guarded("queue", "/me/player/queue");
  if (q) cache.queue = (q.queue || []).slice(0, 3).map(track);
  return cache.queue;
}

module.exports = async (req, res) => {
  // La CDN de Vercel comparte una respuesta entre todas las pantallas abiertas.
  res.setHeader("Cache-Control", "public, s-maxage=3, stale-while-revalidate=10");
  if (!process.env.SPOTIFY_REFRESH_TOKEN) return res.status(200).json({ configured: false });

  const [cur, next, recent] = await Promise.all([
    guarded("now", "/me/player/currently-playing"),
    upNext(),
    recentAdds().catch((e) => {
      console.error("[recent]", e.message);
      return cache.recent;
    }),
  ]);

  res.status(200).json({
    configured: true,
    playing: Boolean(cur?.is_playing),
    progress: cur?.progress_ms || 0,
    track: cur?.item?.type === "track" ? track(cur.item) : null,
    next,
    recent: recent?.items || [],
    total: recent?.total ?? null,
  });
};
