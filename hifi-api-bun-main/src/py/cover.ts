import Elysia, { status, t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

function buildCoverEntry(
  coverSlug: string,
  name?: string | null,
  trackId?: number | null
) {
  const slug = coverSlug.replace(/-/g, "/");

  return {
    id: trackId ?? null,
    name: name ?? null,
    "1280": `https://resources.tidal.com/images/${slug}/1280x1280.jpg`,
    "640": `https://resources.tidal.com/images/${slug}/640x640.jpg`,
    "80": `https://resources.tidal.com/images/${slug}/80x80.jpg`
  };
}

export const coverPY = new Elysia<"", BaseSingleton>().get(
  "/cover",
  async ({ query, services }) => {
    const { id, q } = query;

    if (id === undefined && q === undefined) {
      return status(400, "Provide id or q query parameter");
    }

    if (id !== undefined) {
      const { data } = await services.hifiClient.getTrack(id);
      const track: any = data;

      const album = 
        track?.album && typeof track.album === "object"
          ? track.album
          : {};

      const coverSlug = album?.cover;
      if (!coverSlug || typeof coverSlug !== "string") {
        return status(404, "Cover not found");
      }

      const entry = buildCoverEntry(
        coverSlug,
        typeof album?.title === "string" ? album.title : typeof track?.title === "string" ? track.title : null,
        typeof album?.id === "number" ? album.id : typeof id === "string" && /^\d+$/.test(id) ? Number(id) : null
      );

      return {
        version: config.apiVersion,
        covers: [entry]
      };
    }

    const { data } = await services.hifiClient.searchTracks(q!, 10, 0);
    const search: any = data;

    const items = Array.isArray(search?.items) ? search.items.slice(0, 10) : [];
    if (items.length === 0) {
      return status(404, "Cover not found");
    }

    const covers = [];

    for (const track of items) {
      const album = 
        track?.album && typeof track.album === "object"
          ? track.album
          : {};

      const coverSlug = album?.cover;
      if (!coverSlug || typeof coverSlug !== "string") {
        continue;
      }

      covers.push(
        buildCoverEntry(coverSlug, typeof track?.title === "string" ? track.title : null, typeof track?.id === "number" ? track.id : null)
      );
    }

    if (covers.length === 0) {
      return status(404, "Cover not found");
    }

    return {
      version: config.apiVersion,
      covers
    };
  },
  {
    query: t.Object({
      id: t.Optional(t.String()),
      q: t.Optional(t.String())
    })
  }
)
