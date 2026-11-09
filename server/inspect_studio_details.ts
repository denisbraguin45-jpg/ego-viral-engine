import { chromium } from 'playwright';
import { db } from './db.ts';

async function inspectAllPosts() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(6000);

  const postsInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    // Captura blocos com Nov 8 ou datas
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    return {
      totalPostsListed: lines.find(l => l.startsWith('Posts ')),
      lines: lines.slice(0, 100)
    };
  });

  console.log('TOTAL:', postsInfo.totalPostsListed);
  console.log('LINES:\n', postsInfo.lines.join('\n'));

  await browser.close();
}

inspectAllPosts().catch(console.error);
