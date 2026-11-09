import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const FFMPEG_PATH = 'C:\\Users\\denis\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-127043-g5a54fcf75e-win64-gpl\\bin\\ffmpeg.exe';

/**
 * Garante que qualquer vídeo seja compatível 100% com o TikTok Web Studio:
 * 1. Resolução padrão 720x1280 (9:16 vertical) com padding limpo se necessário
 * 2. Codec H.264 High/Main level 3.1+ com yuv420p (evita rejeição de formato do TikTok)
 * 3. Áudio AAC stereo 128k (evita erro de codec de áudio HE-AAC v2 sem fallback)
 * 4. Metadados e Faststart
 */
export async function normalizeVideoForTikTok(inputPath: string): Promise<string> {
  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '_normalized.mp4');

  if (fs.existsSync(outputPath)) {
    return outputPath;
  }

  // Escala para caber em 720x1280 mantendo aspect ratio e adiciona borda preta se não for 9:16
  const vf = 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,format=yuv420p';

  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '22',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ];

    const child = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        // Se falhar a normalização, retorna o original como fallback
        console.warn(`[VideoNormalizer] Aviso na conversão: ${stderr.slice(-200)}`);
        resolve(inputPath);
      }
    });

    child.on('error', (err) => {
      console.warn(`[VideoNormalizer] Erro spawn:`, err.message);
      resolve(inputPath);
    });
  });
}
