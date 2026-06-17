import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

function extractUuidFromTidalUrl(href?: string | null): string | null {
  const parts = href ? href.split("/") : [];
  return parts.length >= 9 ? parts.slice(4, 9).join("-") : null;
}

export const similarArtistsPY = new Elysia<"", BaseSingleton>().get(
  "/artist/similar",
  async ({ query, services }) => {
    const response = await services.hifiClient.getSimilarArtists(query.id, query.cursor);
    const payload: any = response.data;

    const included: any[] = Array.isArray(payload?.included) ? payload.included : [];

    const artistsMap = new Map<any, any>(
      included
        .filter((item: any) => item?.type === "artists" && item?.id != null)
        .map((item: any) => [item.id, item])
    )

    const artworksMap = new Map<any, any>(
      included
        .filter((item: any) => item?.type === "artworks" && item?.id != null)
        .map((item: any) => [item.id, item])
    )

    const resolveArtist = (entry: any) => {
      const aid = entry?.id;
      const inc = artistsMap.get(aid) ?? {};
      const attr = inc?.attributes ?? {};

      let picId: string | null = null;

      const artData = inc?.relationships?.profileArt?.data;

      if (Array.isArray(artData) && artData.length > 0) {
        const artwork = artworksMap.get(artData[0]?.id);
        const files = artwork?.attributes?.files;

        if (Array.isArray(files) && files.length > 0) {
          picId = extractUuidFromTidalUrl(files[0]?.href);
        }
      }

      return {
        ...attr,
        id: /^\d+$/.test(String(aid)) ? Number(aid) : aid, // WHAT THE FUCK
        picture: picId || attr?.selectedAlbumCoverFallback,
        url: `http://www.tidal.com/artist/${aid}`,
        relationType: "SIMILAR_ARTIST"
      }
    }

    return {
      version: config.apiVersion,
      artists: Array.isArray(payload?.data) ? payload.data.map(resolveArtist) : [],
    }
  },
  {
    query: t.Object({
      id: t.String(),
      cursor: t.Optional(t.Union([t.String(), t.Numeric()]))
    })
  })
