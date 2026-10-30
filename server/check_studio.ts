import { chromium } from 'playwright';

async function checkStudio() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();
  await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('div, span, p'))
      .map(el => (el as HTMLElement).innerText?.trim())
      .filter(t => t && t.length > 20 && (t.includes('Mentalista') || t.includes('Breaking') || t.includes('Jane') || t.includes('Scofield') || t.includes('EgoTV')))
      .slice(0, 15);
  });

  console.log('Textos encontrados no Studio Content:', texts);
  await browser.close();
}

checkStudio();
