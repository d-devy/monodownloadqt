import Elysia, { status, t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

function buildImageUrl(slug: string, width: number, height: number) {
  const normalized = typeof slug === "string" ? slug.trim() : "";
  if (!normalized) return null;
  const path = normalized.replace(/-/g, "/");
  return `https://resources.tidal.com/images/${path}/${width}x${height}.jpg`;
}

function addCoverArt(data: Record<string, unknown>) {
  if (!data || typeof data !== "object") return data;
  const album = (data.album || {}) as Record<string, unknown>;
  const slug = (album.cover as string | undefined) ?? (data.cover as string | undefined);
  return {
    ...data,
    artwork: slug ? {
      "640": buildImageUrl(slug, 640, 640),
      url: buildImageUrl(slug, 640, 640) ?? undefined,
    } : null,
  };
}

function addArtistPicture(data: Record<string, unknown>) {
  if (!data || typeof data !== "object") return data;
  const slug = (data.picture as string | undefined) ?? (data.selectedAlbumCoverFallback as string | undefined);
  return {
    ...data,
    pictureUrl: slug ? {
      "640": buildImageUrl(slug, 750, 750),
      url: buildImageUrl(slug, 750, 750) ?? undefined,
    } : null,
  };
}

export const searchPY = new Elysia<"", BaseSingleton>().get(
  "/search",
  async ({ query, services }) => {
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;
    const isrc = query.i?.trim();

    if (isrc) {
      const { data } = await services.hifiClient.searchByIsrc(isrc, limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => addCoverArt(item as Record<string, unknown>))
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    if (query.s) {
      const { data } = await services.hifiClient.searchTracks(query.s, limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => addCoverArt(item as Record<string, unknown>))
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    if (query.a) {
      const { data } = await services.hifiClient.searchTopHits(query.a, "ARTISTS,TRACKS", limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => {
            if ((item as Record<string, unknown>).artist) {
              return addArtistPicture(item as Record<string, unknown>);
            }
            return addCoverArt(item as Record<string, unknown>);
          })
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    if (query.al) {
      const { data } = await services.hifiClient.searchTopHits(query.al, "ALBUMS", limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => addCoverArt(item as Record<string, unknown>))
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    if (query.v) {
      const { data } = await services.hifiClient.searchTopHits(query.v, "VIDEOS", limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => addCoverArt(item as Record<string, unknown>))
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    if (query.p) {
      const { data } = await services.hifiClient.searchTopHits(query.p, "PLAYLISTS", limit, offset);
      const items = Array.isArray((data as Record<string, unknown>)?.items)
        ? (data as Record<string, unknown> & { items: unknown[] }).items.map((item) => addCoverArt(item as Record<string, unknown>))
        : [];
      return {
        version: config.apiVersion,
        data: {
          ...data,
          items,
        },
      };
    }

    return status(400, "Provide one of s, a, al, v, p, or i");
  },
  {
    query: t.Object({
      s: t.Optional(t.String()),
      a: t.Optional(t.String()),
      al: t.Optional(t.String()),
      v: t.Optional(t.String()),
      p: t.Optional(t.String()),
      i: t.Optional(t.String()),
      offset: t.Optional(t.Number({ minimum: 0 })),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 500 }))
    })
  }
)
