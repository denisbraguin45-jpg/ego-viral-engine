import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const FFMPEG_PATH = 'C:\\Users\\denis\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-N-127043-g5a54fcf75e-win64-gpl\\bin\\ffmpeg.exe';

export interface TransformOptions {
  speedFactor?: number;
  contrast?: number;
  saturation?: number;
}

export function sanitizeAndBypassFingerprintSync(
  inputPath: string,
  outputPath: string,
  options: TransformOptions = {}
): string {
  const speed = options.speedFactor || 1.02;
  const contrast = options.contrast || 1.02;
  const saturation = options.saturation || 1.04;

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Arquivo não encontrado: ${inputPath}`);
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const vf = `setpts=${(1 / speed).toFixed(4)}*PTS,scale=ceil(iw*1.02/2)*2:ceil(ih*1.02/2)*2,eq=contrast=${contrast}:saturation=${saturation}`;
  const af = `atempo=${speed.toFixed(3)}`;

  const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -vf "${vf}" -af "${af}" -map_metadata -1 -c:v libx264 -pix_fmt yuv420p -preset ultrafast -crf 22 -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

  execSync(cmd, { stdio: 'pipe' });

  if (!fs.existsSync(outputPath)) {
    throw new Error(`Falha ao gerar arquivo transformado em: ${outputPath}`);
  }

  return outputPath;
}
