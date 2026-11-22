import { db } from './db.ts';

// SQLite não suporta alterar check constraint diretamente sem recriar a tabela
db.exec(`
  PRAGMA foreign_keys = OFF;

  CREATE TABLE IF NOT EXISTS social_accounts_new (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM', 'YOUTUBE')),
    handle TEXT NOT NULL,
    account_name TEXT NOT NULL,
    connection_status TEXT NOT NULL DEFAULT 'PENDING_CREDENTIALS',
    oauth_connected INTEGER NOT NULL DEFAULT 0,
    daily_target INTEGER NOT NULL DEFAULT 15,
    followers_count INTEGER DEFAULT 0,
    last_sync_at TEXT,
    access_token TEXT,
    refresh_token TEXT,
    client_key TEXT,
    open_id TEXT,
    connection_mode TEXT DEFAULT 'DISCONNECTED',
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  INSERT OR IGNORE INTO social_accounts_new SELECT * FROM social_accounts;

  DROP TABLE social_accounts;

  ALTER TABLE social_accounts_new RENAME TO social_accounts;

  PRAGMA foreign_keys = ON;
`);

console.log('social_accounts table schema updated to allow YOUTUBE!');
