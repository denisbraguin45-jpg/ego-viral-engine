import { db } from './db.ts';

// Atualiza ou insere as 3 contas do YouTube Shorts para os canais
const ytAccounts = [
  { id: 'yt-filmes', channel_id: 'ego-filmes', handle: '@egotv00', name: 'Ego TV Filmes (YouTube Shorts)' },
  { id: 'yt-anime', channel_id: 'ego-anime', handle: '@egotv00', name: 'Ego TV Anime (YouTube Shorts)' },
  { id: 'yt-series', channel_id: 'ego-series', handle: '@egotv00', name: 'Ego TV Séries (YouTube Shorts)' }
];

for (const acc of ytAccounts) {
  const existing = db.prepare('SELECT id FROM social_accounts WHERE id = ?').get(acc.id);
  if (!existing) {
    db.prepare(`
      INSERT INTO social_accounts (id, channel_id, platform, handle, account_name, connection_status, oauth_connected, daily_target, connection_mode)
      VALUES (?, ?, 'YOUTUBE', ?, ?, 'CONNECTED_ACTIVE', 1, 15, 'AUTOMATION_SYNC')
    `).run(acc.id, acc.channel_id, acc.handle, acc.name);
    console.log(`Created ${acc.id}`);
  } else {
    db.prepare("UPDATE social_accounts SET connection_status = 'CONNECTED_ACTIVE' WHERE id = ?").run(acc.id);
    console.log(`Updated ${acc.id}`);
  }
}
