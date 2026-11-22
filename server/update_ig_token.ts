import { db } from './db.ts';

const token = '41226265311%3AROKz45ZPrCFlrZ%3A13%3AAYlpRKPQuUjEtr7PIeSdZvmaSIjyKEfOllLIcykLPg';
db.prepare("UPDATE social_accounts SET access_token = ?, connection_status = 'CONNECTED_SESSION_COOKIE' WHERE platform = 'INSTAGRAM'").run(token);
console.log('Instagram accounts successfully updated!');

const rows = db.prepare("SELECT id, platform, handle, connection_status, access_token FROM social_accounts WHERE platform = 'INSTAGRAM'").all();
console.log('Updated rows:', rows);
