import { chromium } from 'playwright';
import { db } from './db.ts';

async function checkAfterContentCheck() {
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
      if (url.includes('check') || url.includes('result') || url.includes('status')) {
        const text = await res.text();
        console.log(`[CHECK_POLL] ${url.slice(0, 90)} -> ${res.status()}\n${text.slice(0, 250)}`);
      }
    } catch (e) {}
  });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7446519080795901189_clean.mp4';
  await fileInput?.setInputFiles(testVideo);

  // Aguarda 25 segundos para o processamento do vídeo e do content check
  console.log('Aguardando 25s de processamento no TikTok...');
  await page.waitForTimeout(25000);

  const finalState = await page.evaluate(() => {
    const postBtn = document.querySelector('button.Button__root--type-primary') as HTMLButtonElement;
    return {
      postBtnDisabled: postBtn ? postBtn.disabled : null,
      postBtnText: postBtn ? postBtn.innerText : null,
      bodySnippet: document.body.innerText.slice(0, 800)
    };
  });

  console.log('ESTADO APÓS 25s:', JSON.stringify(finalState, null, 2));

  await browser.close();
}

checkAfterContentCheck().catch(console.error);
