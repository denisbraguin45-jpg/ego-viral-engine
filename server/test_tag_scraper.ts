import { chromium } from 'playwright';

async function scrapeTag(tag: string) {
  console.log(`[Scraper] Iniciando busca na tag: #${tag}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();
  const url = `https://www.tiktok.com/tag/${tag}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 35000 }).catch(e => console.log('Timeout aguardando networkidle:', e.message));

  // Tira print ou inspeciona o conteúdo
  const pageTitle = await page.title();
  console.log(`[Scraper] Título da página: ${pageTitle}`);

  const links = await page.evaluate(() => {
    const results: { url: string; title: string }[] = [];
    const elements = document.querySelectorAll('a[href*="/video/"]');
    elements.forEach(el => {
      const href = (el as HTMLAnchorElement).href;
      const img = el.querySelector('img');
      const text = (el as HTMLElement).innerText || (img ? img.alt : '');
      if (href && !results.some(r => r.url === href)) {
        results.push({ url: href, title: text.replace(/\n/g, ' ').trim() });
      }
    });
    return results;
  });

  console.log(`[Scraper] Encontrados ${links.length} vídeos para #${tag}:`);
  links.slice(0, 10).forEach(l => console.log(` - [${l.title.slice(0, 40)}] -> ${l.url}`));

  await browser.close();
  return links;
}

scrapeTag('thementalist');
