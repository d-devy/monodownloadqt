export type AppConfig = {
  apiVersion: string
  countryCode: string
  tokenFile: string
  clientId: string
  clientSecret: string
  refreshToken?: string
  userId?: string
  devMode: boolean // from hifi-api

  authEnabled: boolean
  authDbPath: string
  authSessionTTL: number // seconds
  authBootstrapInvite?: string
}

export const config: AppConfig = {
  apiVersion: "1.0.0",
  countryCode: process.env.COUNTRY_CODE || "US",
  tokenFile: process.env.TOKEN_FILE ?? "./token.json",
  clientId: process.env.CLIENT_ID ?? "",
  clientSecret: process.env.CLIENT_SECRET ?? "",
  refreshToken: process.env.REFRESH_TOKEN,
  userId: process.env.USER_ID,
  devMode: process.env.NODE_ENV !== "production",

  authEnabled: (process.env.AUTH_ENABLED ?? "true").toLowerCase() === "true",
  authDbPath: process.env.AUTH_DB_PATH ?? "./auth.sqlite",
  authSessionTTL: parseInt(process.env.AUTH_SESSION_TTL ?? "2592000"), // 30 days
  authBootstrapInvite: process.env.AUTH_BOOTSTRAP_INVITE
}