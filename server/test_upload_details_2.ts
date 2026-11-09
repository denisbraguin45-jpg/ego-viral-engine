import { chromium } from 'playwright';
import { db } from './db.ts';

async function diagnoseWhyItFailed() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (url.includes('check') || url.includes('commit') || url.includes('publish') || url.includes('video/project')) {
        const text = await res.text();
        console.log(`[RESP] ${url.slice(0, 90)} -> ${res.status()}\n${text.slice(0, 300)}`);
      }
    } catch (e) {}
  });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7446519080795901189_clean.mp4';
  await fileInput?.setInputFiles(testVideo);

  await page.waitForTimeout(10000);

  await browser.close();
}

diagnoseWhyItFailed().catch(console.error);
