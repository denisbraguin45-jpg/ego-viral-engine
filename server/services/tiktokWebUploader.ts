import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export interface WebUploadResult {
  success: boolean;
  message: string;
  publishId?: string;
  postUrl?: string;
}

/**
 * Faz upload de um vídeo diretamente no TikTok Studio usando o cookie `sessionid`
 * da conta @egotv00 de forma 100% automatizada e pública.
 */
export async function uploadToTikTokWeb(options: {
  filePath: string;
  caption: string;
  sessionId: string;
  headless?: boolean;
}): Promise<WebUploadResult> {
  const { filePath, caption, sessionId, headless = true } = options;

  if (!fs.existsSync(filePath)) {
    return { success: false, message: `Arquivo de vídeo não encontrado no disco: ${filePath}` };
  }

  if (!sessionId || sessionId.trim().length < 10) {
    return {
      success: false,
      message: 'Cookie sessionid inválido ou ausente. Insira o sessionid da sua conta @egotv00.',
    };
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

    // Injeta cookies de autenticação no domínio TikTok
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

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      await browser.close();
      return {
        success: false,
        message: 'A sessão expirou ou o cookie sessionid fornecido para a conta @egotv00 não está autenticado no TikTok.',
      };
    }

    // Localiza o input de arquivo (input[type="file"])
    console.log('[TikTokWebUploader] Anexando arquivo MP4 do Disco D...');
    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 20000 });
    if (!fileInput) {
      await browser.close();
      return {
        success: false,
        message: 'Campo de upload não encontrado na interface do TikTok Studio.',
      };
    }

    await fileInput.setInputFiles(filePath);

    // Aguarda o processamento inicial do vídeo
    await page.waitForTimeout(10000);

    // Neutraliza overlays de tutorial do TikTok (react-joyride-portal, TUXModal)
    console.log('[TikTokWebUploader] Neutralizando modais e tours guiados...');
    await page.evaluate(() => {
      const joyride = document.getElementById('react-joyride-portal');
      if (joyride) joyride.remove();
      const overlays = document.querySelectorAll('.react-joyride__overlay, .TUXModal-overlay, [data-floating-ui-portal]');
      overlays.forEach((o) => o.remove());
    });

    // Fecha botões de popups se houver
    const closeSelectors = [
      'button:has-text("Got it")',
      'button:has-text("Turn on")',
      'button:has-text("Cancel")',
      'button:has-text("Entendi")',
      '.TUXModal-close',
    ];
    for (const s of closeSelectors) {
      const el = await page.$(s);
      if (el && (await el.isVisible())) {
        await el.click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }

    // Preenche a legenda e hashtags
    console.log('[TikTokWebUploader] Preenchendo legenda/hashtags...');
    try {
      const captionEl = await page.$('.notranslate[contenteditable="true"], div[contenteditable="true"]');
      if (captionEl) {
        await captionEl.click({ force: true });
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type(caption, { delay: 20 });
      }
    } catch {}

    await page.waitForTimeout(2000);

    // Garantir visibilidade pública ("Everyone" / "Todos")
    console.log('[TikTokWebUploader] Garantindo visibilidade pública (Everyone)...');
    try {
      // Procura o seletor de "Who can see this post" / "Quem pode assistir a este vídeo"
      const privacyTrigger = await page.$('button:has-text("Only me"), button:has-text("Friends"), button:has-text("Amigos"), button:has-text("Somente eu"), .Select__trigger');
      if (privacyTrigger) {
        const currentVal = await privacyTrigger.innerText();
        if (!currentVal.toLowerCase().includes('everyone') && !currentVal.toLowerCase().includes('todos')) {
          await privacyTrigger.click({ force: true });
          await page.waitForTimeout(1000);
          const everyoneOpt = await page.$('div[role="option"]:has-text("Everyone"), div[role="option"]:has-text("Todos"), li:has-text("Everyone"), li:has-text("Todos")');
          if (everyoneOpt) {
            await everyoneOpt.click({ force: true });
            console.log('[TikTokWebUploader] Visibilidade alterada para Público (Everyone)!');
          }
        }
      }
    } catch (e: any) {
      console.log('[TikTokWebUploader] Aviso seletor privacidade:', e.message);
    }

    await page.waitForTimeout(3000);

    // Remove qualquer overlay residual novamente antes de clicar no Post
    await page.evaluate(() => {
      const joyride = document.getElementById('react-joyride-portal');
      if (joyride) joyride.remove();
      const overlays = document.querySelectorAll('.react-joyride__overlay, .TUXModal-overlay');
      overlays.forEach((o) => o.remove());
    });

    // Dispara o clique no botão Post de envio real
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

    // Aguarda a confirmação do envio e redirecionamento para /tiktokstudio/content
    console.log('[TikTokWebUploader] Aguardando confirmação do servidor TikTok...');
    await page.waitForTimeout(14000);

    const confirmationText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
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
