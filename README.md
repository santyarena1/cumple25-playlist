# Cumplimos 25 · La playlist

Pantalla para el cumple: QR para sumar temas a la playlist colaborativa de Spotify y reproductor que muestra lo que suena de verdad.

- `public/index.html`: la pantalla.
- `api/now.js`: lee lo que suena, la cola y las últimas canciones sumadas.
- `api/login.js` + `api/callback.js`: conexión única con Spotify.

Variables en Vercel: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`.
