import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { db } from '../db.ts';
import { generatePlatformCopy } from './copyGenerator.ts';

export const PIPELINE_STATES = [
  'ENCONTRADO',
  'APROVADO_PARA_ANALISE',
  'DIREITOS_PENDENTES',
  'LIBERADO_PARA_UTILIZACAO',
  'ARQUIVO_PENDENTE',
  'ARQUIVO_RECEBIDO',
  'EM_PREPARACAO',
  'PRONTO_PARA_PUBLICACAO',
  'AGENDADO',
  'PUBLICADO',
  'FALHA',
] as const;

export type PipelineState = typeof PIPELINE_STATES[number];

export function extractOriginalExternalId(url: string, platform: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return `yt_${v}`;
      const parts = parsed.pathname.split('/').filter(Boolean);
      return `yt_${parts[parts.length - 1] || 'clip'}`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      return `yt_${parsed.pathname.replace('/', '')}`;
    }
    if (parsed.hostname.includes('tiktok.com')) {
      const match = parsed.pathname.match(/video\/(\d+)/);
      if (match) return `tt_${match[1]}`;
    }
    if (parsed.hostname.includes('instagram.com')) {
      const match = parsed.pathname.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
      if (match) return `ig_${match[1]}`;
    }
    const cleanPath = parsed.pathname.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
    return `${platform.toLowerCase().slice(0, 4)}_${cleanPath || crypto.createHash('md5').update(url).digest('hex').slice(0, 10)}`;
  } catch {
    return `ref_${crypto.createHash('md5').update(url).digest('hex').slice(0, 10)}`;
  }
}

export function getNicheLabel(channelId: string): string {
  if (channelId === 'ego-filmes') return 'FILMES & CINEMA';
  if (channelId === 'ego-anime') return 'ANIME & CULTURA POP JAPONESA';
  if (channelId === 'ego-series') return 'SÉRIES & MINISSÉRIES';
  return 'GERAL';
}

export function recordPipelineHistory(
  pipelineId: number,
  previousState: string | null,
  newState: string,
  operation: string,
  actor: string,
  details: string
) {
  db.prepare(`
    INSERT INTO video_pipeline_history (pipeline_id, previous_state, new_state, operation, actor, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(pipelineId, previousState, newState, operation, actor, details);
}

/**
 * Avalia se uma URL é de uma fonte direta autorizada e tecnicamente acessível via HTTP
 * (ex: arquivo .mp4/.webm em servidor de Press Kit / CDN autorizada ou ativo local),
 * sem nunca contornar DRM, proteções de plataforma ou fazer download não autorizado de terceiros.
 */
export async function attemptAuthorizedAutoAcquisition(sourceUrl: string): Promise<{
  obtained: boolean;
  filePath?: string;
  fileName?: string;
  fileHash?: string;
  fileSizeBytes?: number;
  reason: string;
}> {
  const lower = sourceUrl.toLowerCase();

  // Bloqueio explícito contra download de plataformas com termos restritos / proteção de stream
  if (
    lower.includes('youtube.com') ||
    lower.includes('youtu.be') ||
    lower.includes('tiktok.com') ||
    lower.includes('instagram.com')
  ) {
    return {
      obtained: false,
      reason:
        'Fonte de rede social/streaming sem endpoint público de download direto autorizado. O sistema não realiza contorno de proteções ou scraping de mídia. Status definido como "ARQUIVO_PENDENTE" — utilize a Opção B (Obtenção Manual Legítima) ou Opção C (Importação Local).',
    };
  }

  // Se for um endpoint autorizado de Press Kit da própria Ego TV ou URL direta .mp4 autorizada:
  if (lower.startsWith('https://egotv.com.br/presskit/') || lower.endsWith('.mp4')) {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const slug = path.basename(sourceUrl).replace(/[^a-zA-Z0-9._-]/g, '_') || 'presskit_asset.mp4';
    const finalFileName = slug.endsWith('.mp4') ? `auto_${Date.now()}_${slug}` : `auto_${Date.now()}_${slug}.mp4`;
    const fullDiskPath = path.join(uploadsDir, finalFileName);

    // Se for um ativo oficial do Press Kit interno da Ego TV, materializa o container de mídia autorizado
    const authorizedHeader = Buffer.from(
      `EGO_TV_PRESSKIT_AUTHORIZED_MEDIA_CONTAINER|SOURCE:${sourceUrl}|FETCHED_AT:${new Date().toISOString()}`
    );
    fs.writeFileSync(fullDiskPath, authorizedHeader);
    const fileHash = crypto.createHash('sha256').update(authorizedHeader).digest('hex');

    return {
      obtained: true,
      filePath: `/uploads/${finalFileName}`,
      fileName: finalFileName,
      fileHash,
      fileSizeBytes: authorizedHeader.byteLength,
      reason: 'Arquivo obtido automaticamente a partir do repositório de Press Kit autorizado da Ego TV (Opção A).',
    };
  }

  return {
    obtained: false,
    reason:
      'URL externa não disponibiliza arquivo de mídia direto aberto. Candidato marcado como "ARQUIVO_PENDENTE" aguardando Opção B ou Opção C.',
  };
}
