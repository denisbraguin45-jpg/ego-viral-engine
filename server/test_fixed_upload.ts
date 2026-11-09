import { chromium } from 'playwright';
import { db } from './db.ts';

async function testFixedVideoUpload() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7446519080795901189_fixed.mp4';
  console.log('Testando vídeo corrigido 9:16:', testVideo);
  await fileInput?.setInputFiles(testVideo);

  await page.waitForTimeout(16000);

  const res = await page.evaluate(() => {
    return {
      hasSomethingWrong: document.body.innerText.includes('Something went wrong'),
      bodySnippet: document.body.innerText.slice(0, 1000),
      buttons: Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText.trim(),
        disabled: (b as HTMLButtonElement).disabled
      })).filter(b => b.text.length > 0)
    };
  });

  console.log('RESULTADO VÍDEO CORRIGIDO:\n', JSON.stringify(res, null, 2));
  await browser.close();
}

testFixedVideoUpload().catch(console.error);
