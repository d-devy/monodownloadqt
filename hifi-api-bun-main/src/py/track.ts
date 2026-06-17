import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

export const trackPY = new Elysia<"", BaseSingleton>().get(
  "/track",
  async({ query, services }) => {
    const { data } = await services.hifiClient.getTrackPlaybackInfo(query.id, query.quality, query.immersiveAudio);

    return {
      version: config.apiVersion,
      data
    }
  },
  { 
    query: t.Object({
      id: t.String(),
      quality: t.Optional(
        t.Enum({
          LOW: "LOW",
          LOSSLESS: "LOSSLESS",
          HI_RES_LOSSLESS: "HI_RES_LOSSLESS"
        })
      ),
      immersiveAudio: t.Optional(t.Boolean())
    })
  }
)
