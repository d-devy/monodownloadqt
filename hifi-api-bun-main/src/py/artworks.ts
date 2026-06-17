import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

function buildImageUrl(slug: string, width: number, height: number) {
  const normalized = slug.trim();
  if (!normalized) return null;
  const path = normalized.replace(/-/g, "/");
  return `https://resources.tidal.com/images/${path}/${width}x${height}.jpg`;
}

export const artworksPY = new Elysia<"", BaseSingleton>()
  .get(
    "/artworks",
    async ({ query }) => {
      const ids = query.id;
      const width = query.width ?? 640;
      const height = query.height ?? 640;

      const list = Array.isArray(ids) ? ids : typeof ids === "string" ? [ids] : [];
      const artworks = list
        .map((id) => ({ id, url: buildImageUrl(id, width, height) }))
        .filter((entry) => entry.url !== null);

      return {
        version: config.apiVersion,
        artworks,
      };
    },
    {
      query: t.Object({
        id: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        width: t.Optional(t.Number({ minimum: 1 })),
        height: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  )
  .get(
    "/artworks/:id",
    async ({ params, query }) => {
      const width = query.width ?? 640;
      const height = query.height ?? 640;
      const url = buildImageUrl(params.id, width, height);

      if (!url) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(url, {
        headers: { "content-type": "application/json" },
      });
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        width: t.Optional(t.Number({ minimum: 1 })),
        height: t.Optional(t.Number({ minimum: 1 })),
      }),
    }
  );
