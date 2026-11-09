import { chromium } from 'playwright';
import { db } from './db.ts';

async function diagnose() {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = 'tt-filmes'").get() as any;
  if (!account || !account.access_token) {
    console.error('Sem conta cadastrada.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  await context.addCookies([
    { name: 'sessionid', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sessionid_ss', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' },
    { name: 'sid_tt', value: account.access_token.trim(), domain: '.tiktok.com', path: '/' }
  ]);

  const page = await context.newPage();
  
  console.log('1. Verificando TikTok Studio Content...');
  await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const studioStats = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr, div[role="row"]')).map(r => (r as HTMLElement).innerText).filter(t => t.includes('Nov') || t.includes('Everyone') || t.includes('Oct'));
    return {
      postCountText: document.querySelector('.header-title, [class*="post-count"], h1, h2')?.textContent || '',
      rowsCount: rows.length,
      sampleRows: rows.slice(0, 15),
      bodyText: document.body.innerText.slice(0, 2000)
    };
  });

  console.log('=== STUDIO STATS ===');
  console.log('Rows count detectadas:', studioStats.rowsCount);
  console.log('Body Text Snippet:\n', studioStats.bodyText.slice(0, 800));

  console.log('\n2. Verificando Perfil Público @egotv00...');
  await page.goto('https://www.tiktok.com/@egotv00', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const profileStats = await page.evaluate(() => {
    const videoCards = document.querySelectorAll('div[data-e2e="user-post-item"], div[class*="DivItemContainer"]');
    return {
      videoCardsCount: videoCards.length,
      bodyText: document.body.innerText.slice(0, 1000)
    };
  });

  console.log('=== PROFILE STATS ===');
  console.log('Video Cards no Perfil Público:', profileStats.videoCardsCount);
  console.log('Profile Body Snippet:\n', profileStats.bodyText.slice(0, 500));

  await browser.close();
}

diagnose().catch(console.error);
