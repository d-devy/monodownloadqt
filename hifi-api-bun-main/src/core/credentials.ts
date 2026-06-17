import { config } from "./config"

export type Credential = {
  clientId: string
  clientSecret: string
  refreshToken: string
  userId?: number
  accessToken: string | null
  expiresAt: number // timestamp + expiresIn - 60
}

// different look so ur eyes dont die
type TokenFileEntry = {
  client_ID?: string
  client_secret?: string
  refresh_token?: string
  userID?: number
}

export async function loadCredentials(): Promise<Credential[]> {
  const creds: Credential[] = [];

  const tokenFile = Bun.file(config.tokenFile);
  if (await tokenFile.exists()) {
    const parsed = await tokenFile.json();
    const entries = Array.isArray(parsed) ? parsed : [parsed];

    for (const entry of entries as TokenFileEntry[]) {
      const refreshToken = entry.refresh_token || config.refreshToken;
      if (!refreshToken) continue;

      creds.push({
        clientId: entry.client_ID || config.clientId,
        clientSecret: entry.client_secret || config.clientSecret,
        refreshToken,
        userId: entry.userID || Number(config.userId),
        accessToken: null,
        expiresAt: 0 // expires at 0 to refresh on load
      });
    }
  }

  if (config.refreshToken && !creds.some(c => c.refreshToken === config.refreshToken)) {
    creds.push({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      userId: Number(config.userId),
      accessToken: null,
      expiresAt: 0
    });
  }

  if (creds.length === 0) {
    throw new Error("No TIDAL credentials found, update your token.json");
  }

  return creds;
}

export function pickCredential(creds: Credential[]): Credential {
  return creds[Math.floor(Math.random() * creds.length)];
}