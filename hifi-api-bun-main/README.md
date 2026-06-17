# HiFi Tidal API

Tidal API gateway built with Bun and Elysia. It exposes two interface layers on top of the Tidal catalog and playback APIs: a `/v1` search surface with predictable response shapes, and a `/py` compatibility layer.

Default port: `http://localhost:3000`

## Run

```bash
bun run src/index.ts
```

Environment:

- `COUNTRY_CODE` — two-letter market code, default `US`
- `AUTH_ENABLED` — enable Bearer auth, default `true`
- `AUTH_DB_PATH` — SQLite path, default `./auth.sqlite`
- `AUTH_SESSION_TTL` — seconds, default `2592000`

When auth is enabled, authenticated requests require:

```
Authorization: Bearer <token>
```

Unauthenticated requests are rejected with `401`.

## Root response

```json
{
  "version": "1.0.0",
  "auth": { "required": true, "endpoints": ["/"] },
  "v1": { "enabled": true, "endpoints": ["/"] },
  "py": {
    "enabled": true,
    "endpoints": [
      "/info",
      "/track",
      "/lyrics",
      "/manifests",
      "/widevine",
      "/recommendations",
      "/search",
      "/mix",
      "/album",
      "/artist/similar",
      "/album/similar",
      "/artist",
      "/cover",
      "/topvideos",
      "/video"
    ]
  },
  "proxy": { "enabled": false, "endpoints": ["/proxy"] }
}
```

## Endpoints

- `/v1/search` — search by track, artist, album, video, playlist, or ISRC. Response items include `artwork` and `pictureUrl` with CDN URLs.
- `/py/search` — search compatible with the original hifi-api query shape. Response items include `artwork` and `pictureUrl` with CDN URLs.
- `/py/artworks` — resolve raw artwork URLs from Tidal slugs.
- `/py/info` — `/tracks/{id}` metadata.
- `/py/album` — album metadata plus items with pagination.
- `/py/artist` — artist metadata, albums, EPSANDSINGLES, and optional top tracks.
- `/py/artist/similar` — mapped similar artists response.
- `/py/album/similar` — mapped similar albums response.
- `/py/track` — playback info for a track.
- `/py/lyrics` — track lyrics.
- `/py/trackManifests` — DASH manifests, with Widevine license URLs rewritten to the local proxy.
- `/py/widevine` — GET/POST Widevine license proxy.
- `/py/recommendations` — track recommendations.
- `/py/mix` — mix data with header and items extracted from Tidal pages.
- `/py/cover` — album/track cover URLs or cover search.
- `/py/topvideos` — recommended videos.
- `/py/video` — playback info for a video.

### Artwork examples

```text
GET /py/artworks/abcdef12-3456-7890-abcd-ef1234567890?width=320&height=320
```

```json
{
  "version": "1.0.0",
  "artworks": [
    {
      "id": "abcdef12-3456-7890-abcd-ef1234567890",
      "url": "https://resources.tidal.com/images/abcdef12/3456/7890/abcd/ef1234567890/320x320.jpg"
    }
  ]
}
```

Rate limiting:

- `429` responses are retried with exponential backoff up to 3 times.
- `401` responses trigger a single token refresh before retry.

Archive notes:

- `src/package.json`, `src/bun.lock`, `src/elysiajs/`, and `src/docs/` are intentionally excluded from this repository. They are not required for building the API.
- Legacy `src/package.json` and `src/bun.lock` are kept only as ARD/ABR compatibility bindings; runtime should be provided externally.