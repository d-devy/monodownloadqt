import Elysia, { t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

export const mixPY = new Elysia<"", BaseSingleton>().get(
  "/mix",
  async ({ query, services }) => {
    const response = await services.hifiClient.getMix(query.id);
    const data: any = response.data;

    let header: Record<string, unknown> = {};
    let items: unknown[] = [];

    const rows = Array.isArray(data?.rows) ? data.rows : [];

    for (const row of rows) {
      const modules = Array.isArray(row?.modules) ? row.modules : [];

      for (const module of modules) {
        if (module?.type === "MIX_HEADER") {
          header = module.mix && typeof module.mix === "object" ? module.mix : {};
        } else if (module?.type === "TRACK_LIST") {
          const pagedList = module.pagedList && typeof module.pagedList === "object" ? module.pagedList : {};

          items = Array.isArray((pagedList as { items?: unknown[] }).items) ? (pagedList as { items: unknown[] }).items : [];
        }
      }
    }

    return {
      version: config.apiVersion,
      mix: header,
      items: items.map((item) => {
        if (item && typeof item === "object" && "item" in item) {
          return (item as { item?: unknown }).item ?? item;
        }

        return item;
      })
    }
  },
  {
    query: t.Object({
      id: t.String()
    })
  })
