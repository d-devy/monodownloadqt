import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

export const videoPY = new Elysia<"", BaseSingleton>().get(
  "/video",
  async ({ query, services }) => {
    const { data } = await services.hifiClient.getVideo(query.id, query.videoquality, query.playbackmode, query.assetpresentation);

    return {
      version: config.apiVersion,
      video: data
    }
  },
  {
    query: t.Object({
      id: t.String(),
      videoquality: t.Optional(t.String()),
      playbackmode: t.Optional(t.String()),
      assetpresentation: t.Optional(t.String())
    })
  })
