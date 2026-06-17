# Monochrome Playlist Downloader

Standalone CLI project for downloading tracks from:

- Spotify-style CSV exports
- Plain text files with one supported link per line
- Generated Monochrome collection JSON files
- Monochrome playlist links
- Monochrome album links
- Monochrome track links
- Monochrome artist links

It keeps the working resolver behavior from the fork:

- tries configured instances conservatively, one at a time
- rejects obvious preview-only results before accepting them
- relies on `trackManifests` for playback resolution
- detects instance capabilities from `/` and uses `/py/*` when the compatibility layer is enabled
- supports legacy Basic auth and newer session-based auth, reusing saved credentials
- writes metadata, lyrics, collection artifacts, and optional ZIP output

## Requirements

- bun
- `ffmpeg` and `ffprobe` available on `PATH`
- `aubio` (optional, for live BPM detection when TBPM metadata is not present)

## Usage

From this folder:

```powershell
bun run download -- --input "C:\Users\v\Downloads\liked.csv" --output "C:\Users\v\Music"
```

Or directly:

```powershell
bun .\index.mjs --input "C:\Users\v\Downloads\liked.csv" --output "C:\Users\v\Music"
```

## Options

```text
--input <value>          CSV/TXT/JSON path or Monochrome album/track/artist/playlist link
--output <dir>           Output directory root. Default: ./downloads
--api-url <url>          Override the primary API base URL
--quality <token>        Default: HI_RES_LOSSLESS
--auth-username <value>  Username for auth-enabled instances
--auth-login-key <value> Login key for auth-enabled instances
--auth-password <value>  Password for legacy Basic-auth instances
--no-lyrics              Skip .lrc lyric downloads
--lyrics-provider <name>   Lyrics provider (lrclib or genius). Default: lrclib
--lyrics-synced-only       Only fetch synced (LRC) lyrics, skip plain text
--lyrics-no-artist        Don't include artist name in lyrics search
--no-genres              Skip genre fetching from MusicBrainz/Last.fm/Discogs APIs
--genre-providers <list>  Comma-separated list of genre providers (musicbrainz,lastfm,discogs). Default: musicbrainz,lastfm
--no-bpm-detect          Skip BPM detection. If no TBPM metadata found, uses aubio for live analysis
--no-zip                 Skip ZIP archive creation
--artist-folders         Use {artist}/{album}/tracks layout instead of the default
                         {source}/{album-artist}/tracks layout. Only applies to
                         album, track, and artist sources. Ignored for playlists
                         and CSV exports.
--plain                  Force line-by-line logs instead of the TTY dashboard
--verbose                Show raw request/resolver logs instead of the TTY dashboard
--i-know-it-doesnt-work-but-ill-use-it-anyway
                         Skip the startup playback preflight
--help, -h, help         Show help
```

## Notes

- Cache is written to `.cache/monochrome-playlist-downloader-cache.json`
- Instance auth is stored in `.cache/monochrome-instance-auth.json`
- You can preseed new-session auth with `--auth-username` and `--auth-login-key` or `MONOCHROME_AUTH_USERNAME` and `MONOCHROME_AUTH_LOGIN_KEY`
- You can preseed legacy Basic auth with `--auth-username` and `--auth-password` or `MONOCHROME_AUTH_USERNAME` and `MONOCHROME_AUTH_PASSWORD`
- In an interactive terminal, the CLI inspects `/` on the target instance and prompts for either legacy Basic auth or the newer login/redeem flow
- `.txt` inputs may contain one supported link per line; blank lines and lines starting with `#` are ignored
- Output artifacts are written into the playlist folder, including `_run-state.json`
- A live TTY dashboard is used by default for interactive terminals; use `--plain` or `--verbose` to fall back to line-by-line logs
- Passing a generated `.json` collection file expands each playlist track to its full album and downloads only the album tracks that were not already in the playlist, so the result can be merged back in later
