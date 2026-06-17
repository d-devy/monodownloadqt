import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

export const recommendationsPY = new Elysia<"", BaseSingleton>().get(
  "/recommendations",
  async ({ query, services }) => {
    const { data } = await services.hifiClient.getTrackRecommendations(query.id);

    return {
      version: config.apiVersion,
      data
    }
  },
  {
    query: t.Object({
      id: t.String(),
    })
  }
)
