import { Database } from "bun:sqlite";
import { config } from "../core/config";

function sha256(value: string) {
  const hasher = new Bun.CryptoHasher("sha256");

  return hasher.update(value).digest("hex"); 
}

export function createAuthDB() {
  const db = new Database(config.authDbPath);

  // roles: user, admin
  db.run(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      login_key_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invite_hash TEXT NOT NULL UNIQUE,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      expires_at TEXT,
      used_at TEXT,
      used_by_user_id INTEGER,
      disabled INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id),
      FOREIGN KEY (used_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      last_seen_at TEXT,
      ip_address TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `)

  if (config.authBootstrapInvite) {
    db.query(`
        INSERT OR IGNORE INTO invites (
          invite_hash, created_by_user_id, created_at, expires_at, used_at, used_by_user_id, disabled, note
        ) VALUES (?, NULL, ?, NULL, NULL, NULL, 0, 'Bootstrap invite from config')
      `).run(sha256(config.authBootstrapInvite), new Date().toISOString());
  }

  return db;
}