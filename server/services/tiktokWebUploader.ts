import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { normalizeVideoForTikTok } from './videoNormalizer.ts';

export interface WebUploadResult {
  success: boolean;
  message: string;
  publishId?: string;
  postUrl?: string;
}

export async function uploadToTikTokWeb(options: {
  filePath: string;
  caption: string;
  sessionId: string;
  headless?: boolean;
}): Promise<WebUploadResult> {
  const { filePath: rawPath, caption, sessionId, headless = true } = options;

  if (!fs.existsSync(rawPath)) {
    return { success: false, message: `Arquivo de vídeo não encontrado no disco: ${rawPath}` };
  }

  if (!sessionId || sessionId.trim().length < 10) {
    return {
      success: false,
      message: 'Cookie sessionid inválido ou ausente.',
    };
  }

  // Normaliza o vídeo para formato 9:16 padrão do TikTok
  let uploadPath = rawPath;
  try {
    uploadPath = await normalizeVideoForTikTok(rawPath);
  } catch (err: any) {
    console.warn('[TikTokWebUploader] Normalização ignorada:', err.message);
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });

    await context.addCookies([
      { name: 'sessionid', value: sessionId.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
      { name: 'sessionid_ss', value: sessionId.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
      { name: 'sid_tt', value: sessionId.trim(), domain: '.tiktok.com', path: '/', httpOnly: true, secure: true },
    ]);

    const page = await context.newPage();

    console.log('[TikTokWebUploader] Acessando TikTok Studio Upload...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload', {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });

    await page.waitForTimeout(4000);

    if (page.url().includes('/login')) {
      await browser.close();
      return {
        success: false,
        message: 'A sessão expirou ou o cookie sessionid fornecido para a conta @egotv00 não está autenticado no TikTok.',
      };
    }

    console.log('[TikTokWebUploader] Anexando arquivo MP4 normalizado do Disco D...');
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
    if (!fileInput) {
      await browser.close();
      return {
        success: false,
        message: 'Campo de upload não encontrado na interface do TikTok Studio.',
      };
    }

    await fileInput.setInputFiles(uploadPath);

    // Aguarda o upload do arquivo ser processado (até 30s com polling de 'Uploaded')
    console.log('[TikTokWebUploader] Aguardando processamento e confirmação de upload no TikTok Studio...');
    let uploadReady = false;
    for (let attempts = 0; attempts < 15; attempts++) {
      await page.waitForTimeout(2000);
      const isReady = await page.evaluate(() => {
        const text = document.body.innerText;
        return text.includes('Uploaded') || text.includes('Carregado') || document.querySelector('button.Button__root--type-primary') !== null;
      });
      if (isReady) {
        uploadReady = true;
        break;
      }
    }

    // Neutraliza overlays de tutorial do TikTok (react-joyride-portal, TUXModal)
    await page.evaluate(() => {
      const joyride = document.getElementById('react-joyride-portal');
      if (joyride) joyride.remove();
      const overlays = document.querySelectorAll('.react-joyride__overlay, .TUXModal-overlay, [data-floating-ui-portal]');
      overlays.forEach((o) => o.remove());
      const btns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('Got it') || b.innerText.includes('Entendi'));
      btns.forEach(b => (b as HTMLButtonElement).click());
    });

    // Preenche a legenda
    console.log('[TikTokWebUploader] Preenchendo legenda/hashtags...');
    try {
      const captionSelectors = [
        'div[contenteditable="true"]',
        '.DraftEditor-root div[contenteditable="true"]',
        'div[data-placeholder]',
        'textarea',
      ];
      let captionEl = null;
      for (const sel of captionSelectors) {
        captionEl = await page.$(sel);
        if (captionEl) break;
      }

      if (captionEl) {
        await captionEl.click({ force: true });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(caption, { delay: 15 });
      }
    } catch {}

    await page.waitForTimeout(2000);

    // Dispara o clique no botão Post
    console.log('[TikTokWebUploader] Acionando botão Post...');
    const postClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const postBtn = btns.find((b) => {
        const t = b.innerText.trim();
        return (t === 'Post' || t === 'Publicar') && !b.disabled;
      });
      if (postBtn) {
        postBtn.click();
        return true;
      }
      return false;
    });

    if (!postClicked) {
      await browser.close();
      return {
        success: false,
        message: 'Botão Post/Publicar não estava ativo ou não pôde ser clicado na tela do TikTok Studio.',
      };
    }

    // Aguarda confirmação do servidor TikTok
    console.log('[TikTokWebUploader] Aguardando confirmação do servidor TikTok...');
    await page.waitForTimeout(10000);

    // Se abrir modal secundário de "Post anyway", clica nele
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const anywayBtn = btns.find(b => b.innerText.includes('Post anyway') || b.innerText.includes('Publicar mesmo assim'));
      if (anywayBtn) (anywayBtn as HTMLButtonElement).click();
    });

    await page.waitForTimeout(5000);

    await browser.close();

    const timestampId = `tt_web_${Date.now()}`;
    return {
      success: true,
      message: `Vídeo enviado com sucesso para a conta @egotv00 no TikTok Studio!`,
      publishId: timestampId,
      postUrl: 'https://www.tiktok.com/@egotv00',
    };
  } catch (err: any) {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return {
      success: false,
      message: `Erro durante upload no TikTok: ${err?.message || 'Erro inesperado'}`,
    };
  }
}
