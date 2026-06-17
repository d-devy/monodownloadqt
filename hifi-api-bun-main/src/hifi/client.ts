import { config } from "../core/config";
import { HifiFetch } from "../core/hifi-fetch";

export class HifiClient {
  constructor(private readonly fetcher: HifiFetch) {}

  getTrack(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/tracks/${id}`, { countryCode: config.countryCode });
  }

  getTrackLyrics(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/tracks/${id}/lyrics`, { countryCode: config.countryCode, locale: "en_US", deviceType: "BROWSER" });
  }

  // LOW, LOSSLESS, HI_RES_LOSSLESS
  getTrackPlaybackInfo(id: number | string, quality = "LOSSLESS", immersiveAudio = false) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/tracks/${id}/playbackinfo`, { audioquality: quality, playbackmode: "STREAM", assetpresentation: "FULL", immersiveaudio: immersiveAudio });
  }

  // formats: HEAACV1, AACLC, FLAC, FLAC_HIRES, EAC3_JOC
  getTrackManifests(id: number | string, formats: string[] = ["HEAACV1", "AACLC", "FLAC", "FLAC_HIRES", "EAC3_JOC"], adaptive = true, manifestType = "MPEG_DASH", uriScheme = "HTTPS", usage = "PLAYBACK") {
    return this.fetcher.getJson(`https://openapi.tidal.com/v2/trackManifests/${id}`, {
      adaptive,
      manifestType,
      uriScheme,
      usage,
      formats
    });
  }

  getTrackRecommendations(id: number | string, limit = 20) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/tracks/${id}/recommendations`, { limit, countryCode: config.countryCode });
  }

  proxyWidevine(method: string, body?: BodyInit, contentType?: string) {
    return this.fetcher.request(method, "https://api.tidal.com/v2/widevine", {
      body,
      headers: {
        "Content-Type": contentType ?? "application/octet-stream"
      }
    });
  }

  searchByIsrc(isrc: string | number, limit = 25, offset = 0) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/tracks`, { isrc, limit, offset, countryCode: config.countryCode });
  }

  searchTracks(query: string, limit = 25, offset = 0) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/search/tracks`, { query, limit, offset, countryCode: config.countryCode });
  }

  searchTopHits(query: string, types: string, limit = 25, offset = 0) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/search/top-hits`, { query, types, limit, offset, countryCode: config.countryCode });
  }

  getAlbum(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/albums/${id}`, { countryCode: config.countryCode });
  }

  getAlbumItems(id: number | string, limit = 100, offset = 0) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/albums/${id}/items`, { limit, offset, countryCode: config.countryCode });
  }

  getMix(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/pages/mix`, { mixId: id, countryCode: config.countryCode, deviceType: "BROWSER" });
  }

  getSimilarArtists(id: number | string, cursor?: string | number) {
    return this.fetcher.getJson(`https://openapi.tidal.com/v2/artists/${id}/relationships/similarArtists`, {
      "page[cursor]": cursor,
      countryCode: config.countryCode,
      include: "similarArtists,similarArtists.profileArt"
    })
  }

  getSimilarAlbums(id: number | string, cursor?: string | number) {
    return this.fetcher.getJson(`https://openapi.tidal.com/v2/albums/${id}/relationships/similarAlbums`, {
      "page[cursor]": cursor,
      countryCode: config.countryCode,
      include: "similarAlbums,similarAlbums.coverArt,similarAlbums.artists"
    })
  }

  getArtist(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/artists/${id}`, { countryCode: config.countryCode });
  }

  getArtistAlbums(id: number | string, filter?: string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/artists/${id}/albums`, { countryCode: config.countryCode, limit: 100, filter });
  }

  getArtistTopTracks(id: number | string) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/artists/${id}/toptracks`, { countryCode: config.countryCode, limit: 15 });
  }

  getAlbumPage(albumId: number) {
    return this.fetcher.getJson(`https://api.tidal.com/v1/pages/album`, { albumId, countryCode: config.countryCode, deviceType: "BROWSER" });
  }

  getTopVideosPage(countryCode: string, locale = "en_US", deviceType = "BROWSER") {
    return this.fetcher.getJson(`https://api.tidal.com/v1/pages/mymusic_recommended_videos`, { countryCode, locale, deviceType });
  }

  // videoquality: LOW, MEDIUM, HIGH
  // playbackmode: STREAM, OFFLINE
  // assetpresentation: FULL, PREVIEW
  getVideo(id: number | string, videoquality = "HIGH", playbackmode = "STREAM", assetpresentation = "FULL") {
    return this.fetcher.getJson(`https://api.tidal.com/v1/videos/${id}/playbackinfo`, { videoquality, playbackmode, assetpresentation });
  }
}
