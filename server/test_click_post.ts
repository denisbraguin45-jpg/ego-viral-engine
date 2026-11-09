import { chromium } from 'playwright';
import { db } from './db.ts';

async function testClickAndConfirm() {
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
      const u = res.url();
      if (u.includes('commit') || u.includes('publish') || u.includes('project/post') || u.includes('create')) {
        console.log(`[POST_EVENT] ${u} -> Status: ${res.status()}`);
        const text = await res.text();
        console.log('RESPONSE_BODY:', text.slice(0, 300));
      }
    } catch (e) {}
  });

  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
  const testVideo = 'D:\\denis.com\\ego_viral_videos\\tt_7446519080795901189_clean.mp4';
  await fileInput?.setInputFiles(testVideo);

  // Aguarda 22 segundos para que o upload seja 100% finalizado (aparecer 'Uploaded')
  console.log('Aguardando upload completar...');
  await page.waitForTimeout(22000);

  // Limpa popups / joyrides
  await page.evaluate(() => {
    const overlays = document.querySelectorAll('.react-joyride__overlay, .TUXModal-overlay, [data-floating-ui-portal]');
    overlays.forEach(o => o.remove());
    const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Got it') || b.innerText.includes('Entendi'));
    btns.forEach(b => (b as HTMLButtonElement).click());
  });

  console.log('Clicando no botão Post...');
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const postBtn = btns.find(b => (b.innerText.trim() === 'Post' || b.innerText.trim() === 'Publicar') && !b.disabled);
    if (postBtn) {
      postBtn.click();
      return true;
    }
    return false;
  });

  console.log('Botão clicado:', clicked);

  // Aguarda 15 segundos para ver se aparece modal de confirmação ("Post anyway") ou sucesso
  await page.waitForTimeout(10000);

  const modalState = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
    return {
      buttons: btns,
      bodySnippet: document.body.innerText.slice(0, 800)
    };
  });

  console.log('ESTADO DO MODAL:\n', JSON.stringify(modalState, null, 2));

  await browser.close();
}

testClickAndConfirm().catch(console.error);
