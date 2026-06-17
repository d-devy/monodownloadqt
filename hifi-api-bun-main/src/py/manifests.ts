import Elysia, { t } from "elysia";
import { config } from "../core/config";
import type { BaseSingleton } from "../core/app-types";

export const manifestsPY = new Elysia<"", BaseSingleton>().get(
  "/trackManifests",
  async ({ query, services, request }) => {
    const response = await services.hifiClient.getTrackManifests(query.id, query.formats, query.adaptive, query.manifestType, query.uriScheme, query.usage);
    const data: any = response.data;

    try {
      const drmData = data?.data?.attributes?.drmData;
      if (drmData) {
        const base = new URL(request.url);
        const proxyUrl = `${base.origin}/py/widevine`;

        drmData.licenseUrl = proxyUrl;
        drmData.certificateUrl = proxyUrl;
      }
    } catch {
      // empty in hifi api too
    }

    return {
      version: config.apiVersion,
      data
    }
  },
  {
    query: t.Object({
      id: t.String(),
      formats: t.Optional(t.Array(t.String())),
      adaptive: t.Optional(t.Boolean()),
      manifestType: t.Optional(t.String()),
      uriScheme: t.Optional(t.String()),
      usage: t.Optional(t.String())
    })
  }
)
