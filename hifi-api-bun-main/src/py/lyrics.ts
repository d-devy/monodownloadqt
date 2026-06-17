import Elysia, { status, t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

export const lyricsPY = new Elysia<"", BaseSingleton>().get(
  "/lyrics",
  async ({ query, services }) => {
    const { data } = await services.hifiClient.getTrackLyrics(query.id);

    if (!data) {
      return status(404, "Lyrics not found");
    }

    return {
      version: config.apiVersion,
      lyrics: data
    }
  },
  {
    query: t.Object({
      id: t.String()
    })
  }
)
