import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

function buildImageUrl(slug: string, width: number, height: number) {
  const normalized = slug.trim();
  if (!normalized) return null;
  const path = normalized.replace(/-/g, "/");
  return `https://resources.tidal.com/images/${path}/${width}x${height}.jpg`;
}

export const tracksPY = new Elysia<"", BaseSingleton>().get(
  "/pytracks",
  async ({ query, services }) => {
    const q = query.q?.trim();
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;

    if (!q) {
      return { error: "Missing q" };
    }

    const { data } = await services.hifiClient.searchTracks(q, limit, offset);
    const items = Array.isArray((data as Record<string, unknown>)?.items)
      ? (data as Record<string, unknown> & { items: unknown[] }).items
      : [];

    const tracks = items.map((item) => {
      const track = item as Record<string, unknown>;
      const album = (track.album || {}) as Record<string, unknown>;
      const artists = Array.isArray(track.artists)
        ? (track.artists as Record<string, unknown>[])
        : track.artist
          ? [track.artist as Record<string, unknown>]
          : [];

      const coverSlug = (album.cover as string | undefined) ?? (track.cover as string | undefined);
      const artwork = coverSlug
        ? {
            "80": buildImageUrl(coverSlug, 80, 80) ?? undefined,
            "640": buildImageUrl(coverSlug, 640, 640),
            "1280": buildImageUrl(coverSlug, 1280, 1280),
            url: buildImageUrl(coverSlug, 640, 640) ?? undefined,
          }
        : null;

      return {
        id: track.id,
        title: track.title,
        artists: artists.map((a) => ({ id: a.id, name: a.name })),
        album: {
          id: album.id,
          title: album.title ?? album.name,
          cover: coverSlug,
          artwork,
        },
        duration: track.duration,
        trackNumber: track.trackNumber,
        explicit: track.explicit,
      };
    });

    return {
      version: config.apiVersion,
      query: q,
      limit,
      offset,
      total: (data as Record<string, unknown>)?.totalNumberOfItems ?? tracks.length,
      tracks,
    };
  },
  {
    query: t.Object({
      q: t.String(),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 })),
    }),
  }
);
