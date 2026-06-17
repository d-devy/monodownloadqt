import { sleep } from "./sleep";
import type { Credential } from "./credentials";
import { TokenManager } from "./token-manager";

const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY = 1000;
const RATE_LIMIT_MAX_DELAY = 10000;

export class HifiFetch {
  constructor(private readonly tokenManager: TokenManager) {}

  async getJson<T>(url: string, params?: Record<string, string | string[] | number | boolean | undefined>, credential?: Credential): Promise<{ data: T; credential: Credential }> {
    const first = await this.tokenManager.getToken(false, credential);

    const requestUrl = new URL(url);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        
        if (Array.isArray(value)) {
          for (const item of value) {
            requestUrl.searchParams.append(key, String(item));
          }
        } else {
          requestUrl.searchParams.set(key, String(value));
        }
      }
    }

    let token = first.token;
    let cred = first.credential;

    for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
      let response = await fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.status === 401) {
        const refreshed = await this.tokenManager.getToken(true, cred);
        token = refreshed.token;
        cred = refreshed.credential;

        response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      if (response.status === 429 && attempt < RATE_LIMIT_MAX_RETRIES) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "");
        const backoff = Math.min(RATE_LIMIT_BASE_DELAY * 2 ** attempt, RATE_LIMIT_MAX_DELAY);
        const delay = Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, RATE_LIMIT_MAX_DELAY) : backoff;

        await sleep(delay);
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upstream request failed: ${response.status} ${response.statusText} - ${text}`);
      }

      return {
        data: await response.json() as T,
        credential: cred
      }
    }

    throw new Error("Too many retries, giving up :(")
  }

  async request(method: string, url: string, options?: { body?: BodyInit, headers?: Record<string, string>, credential?: Credential }): Promise<Response> {
    const first = await this.tokenManager.getToken(false, options?.credential);

    let token = first.token;
    let cred = first.credential;

    const makeHeaders = () => ({
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token}`
    })

    let response = await fetch(url, {
      method,
      body: options?.body,
      headers: makeHeaders()
    });

    if (response.status === 401) {
      const refreshed = await this.tokenManager.getToken(true, cred);
      token = refreshed.token;
      cred = refreshed.credential;
      
      response = await fetch(url, {
        method,
        body: options?.body,
        headers: makeHeaders()
      });
    }

    return response;
  }
}