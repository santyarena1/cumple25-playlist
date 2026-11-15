// Link corto del QR: redirige a la playlist (se puede cambiar el destino sin regenerar el QR).
const DEFAULT_LINK = "https://open.spotify.com/playlist/4gT57f4C9MS4cixTIBVxY1?si=8cLaS9saTvi-82g36xRVGA&pt=caf3bc0f73b6ac9900afc46f287e61e5&pi=kFuRbbjMTMex-";

module.exports = (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.writeHead(302, { Location: process.env.PLAYLIST_LINK || DEFAULT_LINK });
  res.end();
};
