import type { Database } from "bun:sqlite";
import { config } from "../core/config";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "disabled";

type SessionView = {
  id: number
  userId: number
  username: string
  role: UserRole
  status: UserStatus
  expiresAt: string
  revokedAt: string | null
}

function sha256(value: string) {
  const hasher = new Bun.CryptoHasher("sha256");

  return hasher.update(value).digest("hex"); 
}

function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  return crypto.getRandomValues(buffer).toHex();
}

function futureIso(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export class AuthService {
  private sessionCache = new Map<string, SessionView>();
  private lastSeenWriteAt = new Map<string, number>();

  constructor(private readonly db: Database) {}

  async redeemInvite(inviteCode: string, username: string, ip?: string, userAgent?: string) {
    const inviteHash = sha256(inviteCode);
    const loginKey = randomToken(24);
    const sessionToken = randomToken(32);
    const loginKeyHash = await Bun.password.hash(loginKey);
    const sessionHash = sha256(sessionToken);

    const result = this.db.transaction(() => {
      const invite = this.db.query(`
        SELECT id
        FROM invites
        WHERE invite_hash = ?
          AND disabled = 0
          AND used_at IS NULL
          AND (expires_at IS NULL OR expires_at > ?)
      `).get(inviteHash, new Date().toISOString()) as { id: number } | null;

      if (!invite) {
        throw new Error("Invalid or expired invite code");
      }

      const existing = this.db.query(`SELECT id FROM users WHERE username = ?`).get(username);

      if (existing) {
        throw new Error("Username already exists");
      }

      const count = this.db.query(`SELECT COUNT(*) as count FROM users`).get() as { count: number };
      const role: UserRole = count.count === 0 ? "admin" : "user";

      const createdAt = new Date().toISOString();
      const expiresAt = futureIso(config.authSessionTTL);

      const userInsert = this.db.query(`
        INSERT INTO users (username, login_key_hash, role, status, created_at, last_login_at) 
        VALUES (?, ?, ?, 'active', ?, ?) 
      `).run(username, loginKeyHash, role, createdAt, createdAt);

      const userId = Number(userInsert.lastInsertRowid);

      this.db.query(`
        UPDATE invites
        SET used_at = ?, used_by_user_id = ?
        WHERE id = ?  
      `).run(createdAt, userId, invite.id);

      const sessionInsert = this.db.query(`
        INSERT INTO sessions (
          user_id, token_hash, created_at, expires_at, revoked_at, last_seen_at, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
       `).run(userId, sessionHash, createdAt, expiresAt, createdAt, ip ?? null, userAgent ?? null);

      return {
        userId,
        sessionId: Number(sessionInsert.lastInsertRowid),
        username,
        role,
        expiresAt
      };
    })();

    this.sessionCache.set(sessionHash, {
      id: result.sessionId,
      userId: result.userId,
      username: result.username,
      role: result.role,
      status: "active",
      expiresAt: result.expiresAt,
      revokedAt: null
    });

    return {
      user: {
        id: result.userId,
        username: result.username,
        role: result.role
      },
      loginKey,
      sessionToken,
      expiresAt: result.expiresAt
    };
  }

  async login(username: string, loginKey: string, ip?: string, userAgent?: string) {
    const user = this.db.query(`
      SELECT id, username, role, status, login_key_hash
      FROM users
      WHERE username = ?  
    `).get(username) as {
      id: number,
      username: string,
      role: UserRole,
      status: UserStatus,
      login_key_hash: string
    } | null;

    if (!user || user.status !== "active") {
      throw new Error("Invalid credentials");
    }

    const valid = await Bun.password.verify(loginKey, user.login_key_hash);
    
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const sessionToken = randomToken(32);
    const sessionHash = sha256(sessionToken);
    const createdAt = new Date().toISOString();
    const expiresAt = futureIso(config.authSessionTTL);

    const sessionInsert = this.db.query(`
      INSERT INTO sessions (
        user_id, token_hash, created_at, expires_at, revoked_at, last_seen_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
     `).run(user.id, sessionHash, createdAt, expiresAt, createdAt, ip ?? null, userAgent ?? null);

    this.db.query(`UPDATE users SET last_login_at = ? WHERE id = ?`).run(createdAt, user.id);

    this.sessionCache.set(sessionHash, {
      id: Number(sessionInsert.lastInsertRowid),
      userId: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      expiresAt,
      revokedAt: null
    });

    return {
      sessionToken,
      expiresAt
    };
  }

  resolveSession(token: string) {
    const tokenHash = sha256(token);
    const cached = this.sessionCache.get(tokenHash);

    if (cached && !cached.revokedAt && new Date(cached.expiresAt).getTime() > Date.now()) {
      this.touchLastSeen(cached.id, tokenHash);
      return cached;
    }

    const row = this.db.query(`
      SELECT
        s.id as id,
        s.user_id as userId,
        u.username as username,
        u.role as role,
        u.status as status,
        s.expires_at as expiresAt,
        s.revoked_at as revokedAt
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ?  
      LIMIT 1
    `).get(tokenHash) as SessionView | null;

    if (!row) {
      return null;
    }

    if (row.revokedAt) {
      return null;
    }

    if (row.status !== "active") {
      return null;
    }

    if (new Date(row.expiresAt).getTime() < Date.now()) {
      return null;
    }

    this.sessionCache.set(tokenHash, row);
    this.touchLastSeen(row.id, tokenHash);
    return row;
  }

  me(rawToken: string) {
    return this.resolveSession(rawToken);
  }

  logout(rawToken: string) {
    const tokenHash = sha256(rawToken);
    this.db.query(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`).run(new Date().toISOString(), tokenHash);
    this.sessionCache.delete(tokenHash);
  }

  createInvite(rawToken: string, expiresInDays = 7, note?: string) {
    const admin = this.resolveSession(rawToken);
    if (!admin) {
      throw new Error("Unauthorized");
    }

    if (admin.role !== "admin") {
      throw new Error("Forbidden");
    }

    const inviteCode = randomToken(18);
    const inviteHash = sha256(inviteCode);
    const expiresAt = futureIso(expiresInDays * 24 * 3600);

    this.db.query(`
      INSERT INTO invites (
        invite_hash, created_by_user_id, created_at, expires_at, used_at, used_by_user_id, disabled, note
      ) VALUES (?, ?, ?, ?, NULL, NULL, 0, ?)
    `).run(inviteHash, admin.userId, new Date().toISOString(), expiresAt, note ?? null);

    return {
      inviteCode,
      expiresAt
    }
  }

  listInvites(rawToken: string) {
    const admin = this.resolveSession(rawToken);
    if (!admin) {
      throw new Error("Unauthorized");
    }

    if (admin.role !== "admin") {
      throw new Error("Forbidden");
    }
    
    return this.db.query(`
      SELECT 
        id,
        created_by_user_id as createdByUserId,
        created_at as createdAt,
        expires_at as expiresAt,
        used_at as usedAt,
        used_by_user_id as usedByUserId,
        disabled,
        note
      FROM invites
      ORDER BY created_at DESC  
    `).all();
  }

  private touchLastSeen(sessionId: number, cacheKey: string) {
    const now = Date.now();
    const last = this.lastSeenWriteAt.get(cacheKey) ?? 0;
    if (now - last < 60000) return;

    this.lastSeenWriteAt.set(cacheKey, now);
    queueMicrotask(() => {
      this.db.query(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`).run(new Date().toISOString(), sessionId);
    })
  }
}