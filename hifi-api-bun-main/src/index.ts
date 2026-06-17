import { Elysia, status } from "elysia";
import cors from "@elysiajs/cors";
import openapi, { fromTypes } from "@elysiajs/openapi";
import serverTiming from "@elysiajs/server-timing";
import { apiV1 } from "./v1";
import { apiPY } from "./py";
import { apiAuth } from "./auth";
import { loadCredentials } from "./core/credentials";
import { TokenManager } from "./core/token-manager";
import { HifiFetch } from "./core/hifi-fetch";
import { HifiClient } from "./hifi/client";
import { createAuthDB } from "./auth/db";
import { AuthService } from "./auth/service";
import { config } from "./core/config";
import type { BaseServices, BaseSingleton, AuthServices, AuthSingleton } from "./core/app-types";

export const version = "1.0.0";
export const gitrepo = "git://github.com/---/---.git"

const credentials = await loadCredentials();
const tokenManager = new TokenManager(credentials);
const hifiFetch = new HifiFetch(tokenManager);
const hifiClient = new HifiClient(hifiFetch);

const baseServices: BaseServices = {
  hifiClient
}

function applyCommon<TSingleton extends BaseSingleton | AuthSingleton>(app: Elysia<"", TSingleton>) {
  app.use(cors());
  app.use(openapi({
    references: fromTypes(
      process.env.NODE_ENV === "production" ? "./dist/index.d.ts" : "./src/index.ts"
    ),
      documentation: {
        info: {
          title: "HiFi Tidal API",
          version: version
        }
      }
  }));
  app.use(serverTiming());

  app.get("/", () => {
    return {
      version: version,
      repo: gitrepo,
      auth: {
        required: config.authEnabled,
        endpoints: ["/"]
      },
      v1: {
        enabled: true,
        endpoints: ["/"]
      },
      py: {
        enabled: true,
        endpoints: ["/info", "/track", "/lyrics", "/manifests", "/widevine", "/recommendations", "/search", "/mix", "/album", "/artist/similar", "/album/similar", "/artist", "/cover", "/topvideos", "/video", "/artworks" ]
      },
      proxy: {
        enabled: false,
        endpoints: ["/proxy"] // TODO: IMPLEMENT
      }
    }
  });

  return app;
}

const app = config.authEnabled
  ? (() => {
      const authDb = createAuthDB();
      const authService = new AuthService(authDb);

      const services: AuthServices = {
        ...baseServices,
        authService
      };

      const authApp = applyCommon(new Elysia<"", AuthSingleton>());
      authApp.decorate("services", services);
      authApp.use(apiAuth);

      authApp.guard({
        beforeHandle: ({ services, request }) => {
          const auth = request.headers.get("authorization");
          if (!auth || !auth.startsWith("Bearer ")) {
            return status(401, { detail: "Missing or invalid authorization header" });
          }

          const token = auth.slice(7).trim();
          const session = services.authService.me(token);

          if (!session) {
            return status(401, { detail: "Invalid or expired token" });
          }
        }
      },
      (guarded) =>
        guarded
          .use(apiPY)
          .use(apiV1)
      );

      return authApp;
    })()
  : (() => {
      const publicApp = applyCommon(new Elysia<"", BaseSingleton>());
      publicApp.decorate("services", baseServices);
      publicApp.use(apiPY);
      publicApp.use(apiV1);
      
      return publicApp;
    })();

app.listen(3000);

console.log(
  `HiFi Tidal API is running at ${app.server?.hostname}:${app.server?.port}`
);
