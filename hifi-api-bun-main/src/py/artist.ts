import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

function buildArtistCover(artist: unknown) {
  const picture = artist && typeof artist === "object" ? (artist as { picture?: string }).picture : undefined;
  if (!picture || typeof picture !== "string") return null;

  const slug = picture.replace(/-/g, "/");
  const id = artist && typeof artist === "object" ? (artist as { id?: number | string }).id : null;
  const name = artist && typeof artist === "object" ? (artist as { name?: string }).name : null;

  return {
    id,
    name,
    "750": `https://resources.tidal.com/images/${slug}/750x750.jpg`,
  };
}

function dedupeReleases(results: Array<{ data?: unknown } | Error>) {
  const uniqueReleases: unknown[] = [];
  const seenIds = new Set<string | number>();

  for (const result of results) {
    if (result instanceof Error) continue;

    const data = result.data;
    const items = Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data)
        ? data
        : [];

    for (const item of items) {
      const id = item && typeof item === "object" ? (item as { id?: string | number }).id : undefined;
      if (id === undefined || seenIds.has(id)) continue;

      uniqueReleases.push(item);
      seenIds.add(id);
    }
  }

  return uniqueReleases;
}

function normalizeNumericId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return /^\d+$/.test(String(value)) ? Number(String(value)) : null;
}

function extractAlbumPageTracks(albumPage: unknown) {
  const rows = Array.isArray((albumPage as Record<string, unknown>)?.rows)
    ? (albumPage as { rows: unknown[] }).rows
    : [];
  if (rows.length < 2) return [];

  const modules = Array.isArray((rows[1] as Record<string, unknown>)?.modules)
    ? (rows[1] as { modules: unknown[] }).modules
    : [];
  if (modules.length === 0) return [];

  const pagedList = (modules[0] as Record<string, unknown>)?.pagedList ?? {};
  const items = Array.isArray((pagedList as Record<string, unknown>)?.items)
    ? (pagedList as { items: unknown[] }).items
    : [];

  return items.map((item: unknown) => {
    if (item && typeof item === "object" && "item" in item) {
      return (item as { item?: unknown }).item ?? item;
    }
    return item;
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<Array<R | Error>> {
  const results: Array<R | Error> = new Array(items.length);
  let index = 0;

  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;

      try {
        results[current] = await mapper(items[current]);
      } catch (error) {
        results[current] = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export const artistPY = new Elysia<"", BaseSingleton>().get(
  "/artist",
  async ({ query, services, status }) => {
    const { id, f, skip_tracks } = query;

    if (id === undefined && f === undefined) {
      return status(400, "Provide id or f query param");
    }

    if (id !== undefined) {
      const { data } = await services.hifiClient.getArtist(id);
      const artist = data as Record<string, unknown>;

      const picture = artist?.picture;
      const fallback = artist?.selectedAlbumCoverFallback;

      if (!picture && fallback) {
        artist.picture = fallback;
      }

      return {
        version: config.apiVersion,
        artist,
        cover: buildArtistCover(artist),
      };
    }

    const releaseResults = await Promise.allSettled([
      services.hifiClient.getArtistAlbums(f!),
      services.hifiClient.getArtistAlbums(f!, "EPSANDSINGLES"),
      ...(skip_tracks ? [services.hifiClient.getArtistTopTracks(f!)] : []),
    ]);

    const settled = releaseResults.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : new Error("request failed")
    );

    const uniqueReleases = dedupeReleases(
      settled.slice(0, 2) as Array<{ data?: unknown } | Error>
    );

    const pageData = { items: uniqueReleases };

    if (skip_tracks) {
      let topTracks: unknown[] = [];

      if (settled.length > 2) {
        const result = settled[2];

        if (!(result instanceof Error)) {
          const data = (result as { data?: unknown }).data;
          topTracks = Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : [];
        }
      }

      return {
        version: config.apiVersion,
        albums: pageData,
        tracks: topTracks,
      };
    }

    const albumIds = uniqueReleases
      .map((item: unknown) => normalizeNumericId((item as Record<string, unknown>)?.id))
      .filter((value): value is number => value !== null);

    if (albumIds.length === 0) {
      return {
        version: config.apiVersion,
        albums: pageData,
        tracks: [],
      };
    }

    const albumTrackResults = await mapWithConcurrency(albumIds, 20, async (albumId) => {
      const { data } = await services.hifiClient.getAlbumPage(albumId);
      return extractAlbumPageTracks(data);
    });

    const tracks: unknown[] = [];

    for (const result of albumTrackResults) {
      if (result instanceof Error) continue;
      tracks.push(...result);
    }

    return {
      version: config.apiVersion,
      albums: pageData,
      tracks,
    };
  },
  {
    query: t.Object({
      id: t.Optional(t.Numeric()),
      f: t.Optional(t.Numeric()),
      skip_tracks: t.Optional(t.Boolean()),
    }),
  }
);

