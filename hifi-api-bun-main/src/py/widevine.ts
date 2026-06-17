import Elysia from "elysia";
import type { BaseSingleton } from "../core/app-types";

export const widevinePY = new Elysia<"", BaseSingleton>().get(
  "/widevine",
  async ({ request, services }) => {
    const upstream = await services.hifiClient.proxyWidevine(
      "GET",
      undefined,
      request.headers.get("content-type") ?? "application/octet-stream"
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json"
      }
    });
  }).post(
  "/widevine",
  async ({ request, services }) => {
    const body = await request.arrayBuffer();

    const upstream = await services.hifiClient.proxyWidevine(
      "POST",
      body,
      request.headers.get("content-type") ?? "application/octet-stream"
    );

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/json"
      }
    });
  }
);
