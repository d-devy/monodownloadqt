import Elysia, { t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

export const albumPY = new Elysia<"", BaseSingleton>().get(
  "/album",
  async ({ query, services }) => {
    const limit = query.limit ?? 100;
    const offset = query.offset ?? 0;
    const maxChunk = 100;

    const tasks: Promise<unknown>[] = [
      services.hifiClient.getAlbum(query.id)
    ];

    let currentOffset = offset;
    let remainingLimit = limit;

    while (remainingLimit > 0) {
      const chunkSize = Math.min(maxChunk, remainingLimit);

      tasks.push(services.hifiClient.getAlbumItems(query.id, chunkSize, currentOffset));

      currentOffset += chunkSize;
      remainingLimit -= chunkSize;
    }

    const results = await Promise.all(tasks);

    const albumResult = results[0] as { data: Record<string, unknown> };
    const itemsResults = results.slice(1) as Array<{ data: unknown }>;

    const allItems: unknown[] = [];

    for (const page of itemsResults) {
      const payload = page.data;

      const pageItems = payload && typeof payload === "object" && "items" in payload ? (payload as { items?: unknown[] }).items : payload;

      if (Array.isArray(pageItems)) {
        allItems.push(...pageItems);
      }
    }

    return {
      version: config.apiVersion,
      data: {
        ...albumResult.data,
        items: allItems
      }
    }
  },
  {
    query: t.Object({
      id: t.String(),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 500})),
      offset: t.Optional(t.Number({ minimum: 0 }))
    })
  }
)
