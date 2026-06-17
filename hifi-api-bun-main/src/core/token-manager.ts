import { type Credential, pickCredential } from "./credentials";

export class TokenManager {
  private refreshLocks = new Map<string, Promise<string>>();

  constructor(private readonly credentials: Credential[]) {}
  
  async getToken(forced = false, credential?: Credential) {
    const cred = credential ?? pickCredential(this.credentials);

    if (!forced && cred.accessToken && Date.now() < cred.expiresAt) {
      return { token: cred.accessToken, credential: cred };
    }

    const token = await this.refreshToken(cred);
    return { token, credential: cred };
  }

  private async refreshToken(cred: Credential): Promise<string> {
    const key = `${cred.clientId}:${cred.refreshToken}`; // oauth format hooray
    const existing = this.refreshLocks.get(key);

    if (existing) return existing;

    const refreshPromise = this.performRefresh(cred).finally(() => {
      this.refreshLocks.delete(key);
    });

    this.refreshLocks.set(key, refreshPromise);
    return refreshPromise;
  }

  private async performRefresh(cred: Credential): Promise<string> {
    if (cred.accessToken && Date.now() < cred.expiresAt) {
      return cred.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cred.refreshToken,
      client_id: cred.clientId,
      scope: "r_usr+w_usr+w_sub"
    });

    const auth = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString("base64");

    const response = await fetch("https://auth.tidal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to refresh token: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = await response.json() as {
      access_token: string
      expires_in?: number
    };

    cred.accessToken = data.access_token;
    cred.expiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;

    return cred.accessToken;
  }
}