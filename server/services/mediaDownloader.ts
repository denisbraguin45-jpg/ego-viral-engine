import fs from 'fs';
import path from 'path';

export interface DownloadedMedia {
  success: boolean;
  filePath?: string;
  sourceUrl: string;
  title?: string;
  error?: string;
}

// Pasta permanente no Disco Local D:
export const STORAGE_DIR_D = fs.existsSync('D:\\denis.com')
  ? 'D:\\denis.com\\ego_viral_videos'
  : fs.existsSync('D:\\tools')
    ? 'D:\\tools\\ego_viral_videos'
    : 'D:\\ego_viral_videos';

/**
 * Garante que o diretório de destino no Disco Local D: existe
 */
export function ensureDStorageDir(): string {
  if (!fs.existsSync(STORAGE_DIR_D)) {
    try {
      fs.mkdirSync(STORAGE_DIR_D, { recursive: true });
    } catch {
      // Fallback seguro se D:\ exigir permissão restrita
      const fallback = path.resolve(process.cwd(), 'uploads');
      if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
      return fallback;
    }
  }
  return STORAGE_DIR_D;
}

/**
 * Faz download do arquivo MP4 sem marca d'água de uma URL do TikTok
 * salvando diretamente na pasta do Disco Local D:.
 */
export async function downloadCleanTikTokVideo(
  videoUrl: string,
  targetDir: string = STORAGE_DIR_D
): Promise<DownloadedMedia> {
  try {
    const finalDir = ensureDStorageDir();

    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`;
    const res = await fetch(apiUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      return { success: false, sourceUrl: videoUrl, error: `Falha na requisição gateway: ${res.statusText}` };
    }

    const data = (await res.json()) as any;
    if (data?.code !== 0 || !data?.data?.play) {
      return { success: false, sourceUrl: videoUrl, error: data?.msg || 'Vídeo não encontrado ou indisponível' };
    }

    const playUrl = data.data.play;
    const videoId = data.data.id || Date.now().toString();
    const title = data.data.title || 'Filme Viral';
    const fileName = `tt_${videoId}_clean.mp4`;
    const destPath = path.resolve(finalDir, fileName);

    // Se já foi baixado anteriormente no Disco Local D:
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100000) {
      return { success: true, filePath: destPath, sourceUrl: videoUrl, title };
    }

    const videoStreamRes = await fetch(playUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.tiktok.com/',
      },
    });

    if (!videoStreamRes.ok) {
      return { success: false, sourceUrl: videoUrl, error: 'Falha ao baixar fluxo binário do vídeo' };
    }

    const arrayBuffer = await videoStreamRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(destPath, buffer);
    console.log(`[MediaDownloader] Vídeo salvo com sucesso no Disco Local D: ${destPath} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);

    return {
      success: true,
      filePath: destPath,
      sourceUrl: videoUrl,
      title,
    };
  } catch (err: any) {
    return {
      success: false,
      sourceUrl: videoUrl,
      error: err?.message || 'Erro inesperado no download do vídeo',
    };
  }
}

/**
 * Remove com segurança o arquivo após publicação caso solicitado
 */
export function cleanupVideoFile(filePath: string): boolean {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[MediaDownloader] Arquivo temporário removido após publicação: ${filePath}`);
      return true;
    }
  } catch (err: any) {
    console.error(`[MediaDownloader] Falha ao remover arquivo: ${err?.message}`);
  }
  return false;
}
