import { chromium } from 'playwright';
import { db } from './db.ts';

async function checkFailedVideos() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  
  // Monitora requisições de rede
  page.on('response', async (res) => {
    if (res.url().includes('commit') || res.url().includes('check') || res.url().includes('project/create') || res.url().includes('upload')) {
      try {
        const status = res.status();
        const json = await res.json().catch(() => null);
        console.log(`[NET] ${res.url().slice(0, 80)} -> Status: ${status}`, json ? JSON.stringify(json).slice(0, 200) : '');
      } catch (e) {}
    }
  });

  console.log('Acessando upload...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  // Testa um vídeo pequeno baixado recentemente
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7446519080795901189_clean.mp4';
  console.log('Anexando vídeo:', testVideo);
  await fileInput?.setInputFiles(testVideo);

  await page.waitForTimeout(8000);

  // Fecha overlays
  await page.evaluate(() => {
    const overlays = document.querySelectorAll('.TUXModal-overlay, [data-floating-ui-portal], .react-joyride__overlay');
    overlays.forEach(o => o.remove());
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Got it') || b.innerText.includes('Entendi'));
    btns.forEach(b => (b as HTMLButtonElement).click());
  });

  const uploadStatus = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasSomethingWrong: body.includes('Something went wrong'),
      hasUploadSuccess: body.includes('Uploaded') || body.includes('Carregado'),
      snippet: body.slice(0, 1000)
    };
  });

  console.log('STATUS DO ARQUIVO:\n', uploadStatus);
  await browser.close();
}

checkFailedVideos().catch(console.error);
