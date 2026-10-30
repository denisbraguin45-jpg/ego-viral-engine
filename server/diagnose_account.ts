import { chromium } from 'playwright';

async function diagnoseAccount() {
  console.log('--- DIAGNÓSTICO PROFUNDO DA CONTA TIKTOK ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  await context.addCookies([
    { name: 'sessionid', value: '5d2b274a0c564ed042a346dd20477138', domain: '.tiktok.com', path: '/' }
  ]);
  const page = await context.newPage();

  // 1. Quem é o usuário logado com essa sessão?
  await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const currentUrl = page.url();
  console.log('URL atual no Studio:', currentUrl);

  // Extrai nome de usuário ou avatar
  const userInfo = await page.evaluate(() => {
    const userEl = document.querySelector('[data-e2e="user-info"], .user-info, .profile-name, [class*="User"]');
    const avatar = document.querySelector('img[class*="Avatar"], img[alt*="avatar"]');
    return {
      text: userEl ? (userEl as HTMLElement).innerText : '',
      avatarAlt: avatar ? (avatar as HTMLImageElement).alt : '',
      avatarSrc: avatar ? (avatar as HTMLImageElement).src : ''
    };
  });
  console.log('User info detectado no Studio:', userInfo);

  // 2. Extrai tabela de posts no TikTok Studio Content com status e contadores
  const postsDetails = await page.evaluate(() => {
    // Procura linhas da tabela de gerenciamento de posts
    const rows = Array.from(document.querySelectorAll('tr, [role="row"], div[class*="post-item"], div[class*="PostItem"]'));
    return rows.map(r => (r as HTMLElement).innerText).filter(t => t && t.length > 30).slice(0, 10);
  });
  console.log('Linhas de posts detalhadas no Studio:', postsDetails);

  // 3. Verifica a aba "Drafts" (Rascunhos)
  const draftsTab = await page.$('div:has-text("Drafts"), button:has-text("Drafts"), span:has-text("Rascunhos")');
  if (draftsTab) {
    const draftsText = await draftsTab.innerText();
    console.log('Status da aba Drafts:', draftsText);
  }

  // 4. Vai para a página do perfil público https://www.tiktok.com/@egotv00
  console.log('\n--- VERIFICANDO PERFIL PÚBLICO @egotv00 ---');
  await page.goto('https://www.tiktok.com/@egotv00', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  const profileData = await page.evaluate(() => {
    const header = document.querySelector('h1, h2, [data-e2e="user-title"]')?.textContent;
    const bio = document.querySelector('[data-e2e="user-bio"]')?.textContent;
    const videoCards = Array.from(document.querySelectorAll('[data-e2e="user-post-item"], a[href*="/video/"]'));
    return {
      header,
      bio,
      videoCardsCount: videoCards.length,
      firstVideos: videoCards.slice(0, 5).map(v => (v as HTMLAnchorElement).href || (v as HTMLElement).innerText)
    };
  });

  console.log('Dados do perfil público @egotv00:', profileData);

  await browser.close();
}

diagnoseAccount();
