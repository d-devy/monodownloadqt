import Elysia, { status, t } from "elysia";
import { AuthSingleton } from "../core/app-types";

function getBearerToken(headers: Headers) {
  const auth = headers.get("authorization");

  if (!auth || !auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice(7).trim();
}

export const apiAuth = new Elysia<"/auth", AuthSingleton>({ prefix: "/auth" })
  .post("/redeem", async ({ body, services, request }) => {
    try {
      return await services.authService.redeemInvite(
        body.inviteCode,
        body.username,
        request.headers.get("x-forwarded-for") ?? undefined,
        request.headers.get("user-agent") ?? undefined
      );
    } catch (error) {
      return status(400, { detail: error instanceof Error ? error.message : "Unknown error" });
    }
  }, {
    body: t.Object({
      inviteCode: t.String({ minLength: 1 }),
      username: t.String({ minLength: 3, maxLength: 32, pattern: "^[a-zA-Z0-9_]+$" })
    })
  })

  .post("/login", async ({ body, services, request }) => {
    try {
      return await services.authService.login(
        body.username,
        body.loginKey,
        request.headers.get("x-forwarded-for") ?? undefined,
        request.headers.get("user-agent") ?? undefined
      );
    } catch (error) {
      return status(401, { detail: "Invalid credentials" });
    }
  }, {
    body: t.Object({
      username: t.String({ minLength: 3, maxLength: 32, pattern: "^[a-zA-Z0-9_]+$" }),
      loginKey: t.String({ minLength: 1 })
    })
  })

  .post("/logout", async ({ services, request }) => {
    const token = getBearerToken(request.headers);
    if (!token) {
      return status(401, { detail: "Missing token" });
    }

    services.authService.logout(token);
    return { success: true };
  })

  .get("/me", async ({ services, request }) => {
    const token = getBearerToken(request.headers);
    if (!token) {
      return status(401, { detail: "Missing token" });
    }

    const session = services.authService.me(token);
    if (!session) {
      return status(401, { detail: "Invalid token" });
    }

    return {
      user: {
        id: session.userId,
        username: session.username,
        role: session.role,
        status: session.status
      },
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      }
    };
  })

  .post("/invites", async ({ body, services, request }) => {
    const token = getBearerToken(request.headers);
    if (!token) {
      return status(401, { detail: "Missing token" });
    }

    try {
      return services.authService.createInvite(token, body.expiresInDays ?? 7, body.note)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "Unauthorized") {
        return status(401, { detail: message });
      }

      if (message === "Forbidden") {
        return status(403, { detail: message });
      }

      return status(400, { detail: message });
    }
  }, {
    body: t.Object({
      expiresInDays: t.Optional(t.Number({ minimum: 1, maximum: 365 })),
      note: t.Optional(t.String())
    })
  })

  .get("/invites", async ({ services, request }) => {
    const token = getBearerToken(request.headers);
    if (!token) {
      return status(401, { detail: "Missing token" });
    }

    try {
      return services.authService.listInvites(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "Unauthorized") {
        return status(401, { detail: message });
      }
      return status(403, { detail: message });
    }
  });