import Elysia, { t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

function extractUuidFromTidalUrl(href?: string | null): string | null {
  const parts = href ? href.split("/") : [];
  return parts.length >= 9 ? parts.slice(4, 9).join("-") : null;
}

function normalizeNumericId(value: unknown) {
  return /^\d+$/.test(String(value)) ? Number(value) : value;
}

export const similarAlbumsPY = new Elysia<"", BaseSingleton>().get(
  "/album/similar",
  async ({ query, services }) => {
    const response = await services.hifiClient.getSimilarAlbums(query.id, query.cursor);
    const payload: any = response.data;

    const included: any[] = Array.isArray(payload?.included) ? payload.included : [];

    const albumsMap = new Map<any, any>(
      included
        .filter((item: any) => item?.type === "albums" && item?.id != null)
        .map((item: any) => [item.id, item])
    )

    const artworksMap = new Map<any, any>(
      included
        .filter((item: any) => item?.type === "artworks" && item?.id != null)
        .map((item: any) => [item.id, item])
    )

    const artistsMap = new Map<any, any>(
      included
        .filter((item: any) => item?.type === "artists" && item?.id != null)
        .map((item: any) => [item.id, item])
    )

    const resolveAlbum = (entry: any) => {
      const aid = entry?.id;
      const inc = albumsMap.get(aid) ?? {};
      const attr = inc?.attributes ?? {};

      let coverId: string | null = null;

      const coverArtData = inc?.relationships?.coverArt?.data;

      if (Array.isArray(coverArtData) && coverArtData.length > 0) {
        const artwork = artworksMap.get(coverArtData[0]?.id);
        const files = artwork?.attributes?.files;

        if (Array.isArray(files) && files.length > 0) {
          coverId = extractUuidFromTidalUrl(files[0]?.href);
        }
      }

      const artistList: Array<{ id: string | number; name: string }> = [];

      const relatedArtists = inc?.relationships?.artists?.data;

      if (Array.isArray(relatedArtists)) {
        for (const artistEntry of relatedArtists) {
          const artistObj = artistsMap.get(artistEntry?.id);
          if (!artistObj) continue;

          const artistId = artistObj.id;
          const artistName = artistObj?.attributes?.name;

          if (typeof artistName === "string") {
            artistList.push({
              id: normalizeNumericId(artistId) ?? artistId,
              name: artistName
            });
          }
        }
      }

      return {
        ...attr,
        id: normalizeNumericId(aid),
        cover: coverId,
        artists: artistList,
        url: `http://www.tidal.com/album/${aid}`
      }
    }

    return {
      version: config.apiVersion,
      albums: Array.isArray(payload?.data) ? payload.data.map(resolveAlbum) : [],
    }
  }, {
    query: t.Object({
      id: t.String(),
      cursor: t.Optional(t.Union([t.String(), t.Numeric()]))
    })
  })
