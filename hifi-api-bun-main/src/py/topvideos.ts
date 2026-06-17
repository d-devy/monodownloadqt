import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

function extractVideoModules(data: any) {
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const allVideos: any[] = [];

  for (const row of rows) {
    const modules = Array.isArray(row?.modules) ? row.modules : [];

    for (const module of modules) {
      const moduleType = 
        typeof module?.type === "string" ? module.type : undefined;
      
      if (moduleType === "VIDEO_PLAYLIST" || moduleType === "VIDEO_ROW" || moduleType === "PAGED_LIST") {
        const pagedList = module?.pagedList ?? {};
        const items = Array.isArray(pagedList?.items) ? pagedList.items : [];

        for (const item of items) {
          if (item && typeof item === "object" && "item" in item) {
            allVideos.push((item as { item?: unknown }).item ?? item);
          } else {
            allVideos.push(item);
          }
        }

        continue;
      }

      if (moduleType === "VIDEO" || (moduleType && moduleType.toLowerCase().includes("video"))) {
        const item =
          module && typeof module === "object" && "item" in module
            ? (module as { item?: unknown }).item ?? module
            : module;

        if (item && typeof item === "object") {
          allVideos.push(item);
        }
      }
    }
  }

  return allVideos;
}

export const topVideosPY = new Elysia<"", BaseSingleton>().get(
  "/topvideos",
  async ({ query, services }) => {
    const countryCode = query.countryCode ?? "US";
    const locale = query.locale ?? "en_US";
    const deviceType = query.deviceType ?? "BROWSER";
    const limit = query.limit ?? 25;
    const offset = query.offset ?? 0;

    const { data } = await services.hifiClient.getTopVideosPage(countryCode, locale, deviceType);

    const allVideos = extractVideoModules(data);
    const paginated = allVideos.slice(offset, offset + limit);

    return {
      version: config.apiVersion,
      videos: paginated,
      total: allVideos.length
    }
  }, 
  {
    query: t.Object({
      countryCode: t.Optional(t.String()),
      locale: t.Optional(t.String()),
      deviceType: t.Optional(t.String()),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100 })),
      offset: t.Optional(t.Number({ minimum: 0 }))
    })
  })
