import Elysia, { t } from "elysia";
import { config } from "../core/config";
import { BaseSingleton } from "../core/app-types";

export const infoPY = new Elysia<"", BaseSingleton>().get(
  "/info",
  async ({ query, services }) => {
    const { data } = await services.hifiClient.getTrack(query.id);

    return {
      version: config.apiVersion,
      data
    }
  },
  {
    query: t.Object({
      id: t.String()
    })
  }
)
