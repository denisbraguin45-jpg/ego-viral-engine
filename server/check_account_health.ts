import { chromium } from 'playwright';

async function checkAccountHealth() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();

  // Verifica página de análise / status do TikTok Studio
  await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Procura por alertas, avisos de moderação ou shadowban/violações
  const alerts = await page.evaluate(() => {
    const banners = Array.from(document.querySelectorAll('[role="alert"], .alert, .notification, [class*="Notice"], [class*="Banner"], [class*="Warning"]'));
    return banners.map(b => (b as HTMLElement).innerText).filter(Boolean);
  });
  console.log('Alertas visíveis no Studio:', alerts);

  // Clica no primeiro post para ver o status detalhado / URL do post
  const firstPostLink = await page.evaluate(() => {
    const link = document.querySelector('a[href*="/video/"]');
    return link ? (link as HTMLAnchorElement).href : null;
  });
  console.log('Link do primeiro post no Studio:', firstPostLink);

  await browser.close();
}

checkAccountHealth();
