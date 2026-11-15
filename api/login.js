const { redirectUri } = require("./_spotify");

const SCOPES = "user-read-currently-playing user-read-playback-state playlist-read-private playlist-read-collaborative";

module.exports = (req, res) => {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID || "",
    scope: SCOPES,
    redirect_uri: redirectUri(req),
  });
  res.writeHead(302, { Location: `https://accounts.spotify.com/authorize?${q}` });
  res.end();
};
