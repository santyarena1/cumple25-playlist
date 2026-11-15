const { api, track } = require("./_spotify");

const PLAYLIST_ID = "4gT57f4C9MS4cixTIBVxY1";
const RECENT_TTL = 30_000;
let recentCache = { at: 0, items: [], total: 0 };

// Últimas canciones que sumaron a la playlist (para mostrar quién viene agregando).
async function recentAdds() {
  if (Date.now() - recentCache.at < RECENT_TTL) return recentCache;
  const first = await api(`/playlists/${PLAYLIST_ID}/tracks?limit=1&fields=total`);
  const total = first?.total || 0;
  const offset = Math.max(0, total - 4);
  const page = await api(`/playlists/${PLAYLIST_ID}/tracks?limit=4&offset=${offset}`);
  const items = (page?.items || []).map((i) => track(i.track)).filter(Boolean).reverse();
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
