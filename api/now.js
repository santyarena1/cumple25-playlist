const { api, track } = require("./_spotify");

const PLAYLIST_ID = "4gT57f4C9MS4cixTIBVxY1";
const OWNER_ID = "th0z6eu32jllk99qbn4tpectg";
const OWNER_NAME = "Santy";
const RECENT_TTL = 10_000;
const RECENT_COUNT = 6;
let recentCache = { at: 0, items: [], total: 0 };
const names = new Map([[OWNER_ID, OWNER_NAME]]);

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

// La API ya no deja leer perfiles ajenos (403), así que el nombre sale de la página pública del usuario.
async function userName(id) {
  if (!id) return null;
  if (names.has(id)) return names.get(id);
  try {
    const r = await fetch(`https://open.spotify.com/user/${id}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const m = (await r.text()).match(/<meta property="og:title" content="([^"]*)"/);
    const name = m ? decode(m[1]).trim() : null;
    if (name) names.set(id, name);
    return name;
  } catch (e) {
    console.error("[user]", id, e.message);
    return null;
  }
}

// Últimas canciones que sumaron a la playlist, con quién las agregó.
async function recentAdds() {
  if (Date.now() - recentCache.at < RECENT_TTL) return recentCache;
  const first = await api(`/playlists/${PLAYLIST_ID}/items?limit=1`);
  const total = first?.total || 0;
  const offset = Math.max(0, total - RECENT_COUNT);
  const page = await api(`/playlists/${PLAYLIST_ID}/items?limit=${RECENT_COUNT}&offset=${offset}`);
  const raw = (page?.items || []).filter((i) => i.item || i.track).reverse();
  const items = await Promise.all(
    raw.map(async (i) => ({
      ...track(i.item || i.track),
      addedAt: i.added_at,
      addedBy: await userName(i.added_by?.id),
    })),
  );
  recentCache = { at: Date.now(), items, total };
  return recentCache;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.SPOTIFY_REFRESH_TOKEN) return res.status(200).json({ configured: false });

  const [now, queue, recent] = await Promise.allSettled([
    api("/me/player/currently-playing"),
    api("/me/player/queue"),
    recentAdds(),
  ]);

  const cur = now.status === "fulfilled" ? now.value : null;
  if (now.status === "rejected") console.error("[now]", now.reason?.message);
  if (recent.status === "rejected") console.error("[recent]", recent.reason?.message);

  res.status(200).json({
    configured: true,
    playing: Boolean(cur?.is_playing),
    progress: cur?.progress_ms || 0,
    track: cur?.item?.type === "track" ? track(cur.item) : null,
    next: queue.status === "fulfilled" ? (queue.value?.queue || []).slice(0, 3).map(track) : [],
    recent: recent.status === "fulfilled" ? recent.value.items : [],
    total: recent.status === "fulfilled" ? recent.value.total : null,
  });
};
