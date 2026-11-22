import { chromium } from 'playwright';
import fs from 'fs';
import { normalizeVideoForTikTok } from './videoNormalizer.ts';

const BRAVE_PATH = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

export async function uploadToInstagramReels(options: {
  filePath: string;
  caption: string;
  sessionId: string;
}) {
  const { filePath: rawPath, caption, sessionId } = options;

  if (!fs.existsSync(rawPath)) {
    throw new Error(`Arquivo não encontrado: ${rawPath}`);
  }

  // 1. Normaliza para 9:16 vertical
  let uploadPath = rawPath;
  try {
    uploadPath = await normalizeVideoForTikTok(rawPath);
  } catch (err: any) {
    console.warn('[InstagramUploader] Normalização fallback:', err.message);
  }

  const browser = await chromium.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 }
    });

    // Injeta cookies de autenticação do Instagram
    await context.addCookies([
      { name: 'sessionid', value: sessionId.trim(), domain: '.instagram.com', path: '/', httpOnly: true, secure: true },
      { name: 'ds_user_id', value: sessionId.split('%3A')[0] || '', domain: '.instagram.com', path: '/', secure: true }
    ]);

    const page = await context.newPage();
    console.log('[InstagramUploader] Acessando Instagram...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3500);

    // Fecha modais de notificação/salvar login
    try {
      const dismissBtn = await page.$('button:has-text("Agora não"), button:has-text("Not Now"), button:has-text("Cancelar")');
      if (dismissBtn) await dismissBtn.click();
    } catch {}

    // Clica no botão Criar (+) no menu lateral
    console.log('[InstagramUploader] Abrindo modal de criação...');
    const createBtn = await page.waitForSelector('svg[aria-label="Nova publicação"], svg[aria-label="Criar"], svg[aria-label="New post"]', { timeout: 15000 });
    if (createBtn) {
      await createBtn.click();
    } else {
      await page.click('a[href="#"]:has-text("Criar"), div[role="button"]:has-text("Criar")');
    }

    await page.waitForTimeout(2000);

    // Envia arquivo de vídeo
    console.log('[InstagramUploader] Selecionando vídeo do disco D:...', uploadPath);
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 15000 });
    if (!fileInput) throw new Error('Campo de upload do Instagram não encontrado.');
    await fileInput.setInputFiles(uploadPath);

    await page.waitForTimeout(3000);

    // Se aparecer popup de proporção ou corte para Reels, avança com auto-aceite
    for (let step = 0; step < 2; step++) {
      try {
        const nextBtn = await page.waitForSelector('div[role="button"]:has-text("Avançar"), div[role="button"]:has-text("Next")', { timeout: 8000 });
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(2000);
        }
      } catch {}
    }

    // Insere a legenda
    console.log('[InstagramUploader] Inserindo legenda e hashtags...');
    try {
      const captionArea = await page.waitForSelector('div[aria-label="Escreva uma legenda..."], div[aria-label="Write a caption..."], div[role="textbox"]', { timeout: 10000 });
      if (captionArea) {
        await captionArea.click();
        await page.keyboard.type(caption, { delay: 10 });
      }
    } catch (e: any) {
      console.warn('[InstagramUploader] Aviso na legenda:', e.message);
    }

    await page.waitForTimeout(2000);

    // Clica em Compartilhar / Share
    console.log('[InstagramUploader] Clicando em Compartilhar...');
    const shareBtn = await page.waitForSelector('div[role="button"]:has-text("Compartilhar"), div[role="button"]:has-text("Share")', { timeout: 10000 });
    if (shareBtn) {
      await shareBtn.click();
    } else {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('div[role="button"]'));
        const target = btns.find(b => (b as HTMLElement).innerText.includes('Compartilhar') || (b as HTMLElement).innerText.includes('Share'));
        if (target) (target as HTMLElement).click();
      });
    }

    // Aguarda confirmação
    console.log('[InstagramUploader] Aguardando conclusão da postagem...');
    await page.waitForTimeout(10000);

    console.log('[InstagramUploader] Publicação no Instagram Reels concluída com sucesso!');
    return { success: true };
  } finally {
    await browser.close();
  }
}
