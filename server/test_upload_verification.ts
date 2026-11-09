import { chromium } from 'playwright';
import { db } from './db.ts';

async function testUploadWithFullVerification() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  console.log('Acessando upload...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7662839404775410962_clean.mp4';
  await fileInput?.setInputFiles(testVideo);

  console.log('Aguardando upload e renderização da página de post...');
  await page.waitForTimeout(10000);

  // Verifica mensagens na tela, avisos ou botões
  const uploadState = await page.evaluate(() => {
    const postBtns = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim(),
      disabled: (b as HTMLButtonElement).disabled,
      className: b.className
    })).filter(b => b.text.toLowerCase().includes('post') || b.text.toLowerCase().includes('publicar'));

    const notices = Array.from(document.querySelectorAll('[class*="notice"], [class*="alert"], [class*="error"], [class*="toast"], [class*="tooltip"]')).map(e => (e as HTMLElement).innerText);

    return { postBtns, notices, url: window.location.href };
  });

  console.log('UPLOAD STATE:', JSON.stringify(uploadState, null, 2));
  await browser.close();
}

testUploadWithFullVerification().catch(console.error);
