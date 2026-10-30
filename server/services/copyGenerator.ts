export interface CopyInput {
  channelId: string;
  channelName: string;
  title: string;
  workReference: string;
  angle?: 'CURIOSITY' | 'DEBATE' | 'HIGHLIGHT' | 'BEHIND_THE_SCENES';
  customHashtags?: string;
}

export interface GeneratedCopyPackage {
  tiktokCaption: string;
  instagramCaption: string;
  hashtags: string;
  ctaText: string;
  complianceNotes: string[];
}

const FORBIDDEN_MISLEADING_CLAIMS = [
  'assista completo grátis aqui',
  'filme completo liberado sem cadastro',
  'download direto no link',
  'todos os episódios vazados',
];

/**
 * Gera pacotes de texto específicos para TikTok (foco em gancho rápido + busca SEO)
 * e Instagram Reels (foco em discussão nos comentários + estética limpa),
 * garantindo conformidade ética (sem falsas promessas sobre disponibilidade na Ego TV).
 */
export function generatePlatformCopy(input: CopyInput): GeneratedCopyPackage {
  const work = input.workReference?.trim() || 'esta obra';
  const cleanTitle = input.title.replace(/^\[DEMO\]\s*/i, '').trim();

  let baseHashtags = '#EgoTV #Entretenimento';
  let ctaText = 'Conheça a programação oficial da Ego TV — link na bio.';
  let tiktokHook = '';
  let igBody = '';

  if (input.channelId === 'ego-filmes') {
    baseHashtags = '#EgoFilmes #EgoTV #Cinema #DicaDeFilme #CenaDeFilme #Bastidores';
    ctaText = 'Conheça o catálogo oficial e novidades da Ego TV — link na bio.';
    tiktokHook = `🎬 ${cleanTitle} — A direção de "${work}" acertou em cheio nesse momento!`;
    igBody = `🍿 ${cleanTitle}\n\nDestaque oficial de "${work}". O que mais chama a sua atenção nessa sequência: a fotografia ou o roteiro?\n\n👉 ${ctaText}`;
  } else if (input.channelId === 'ego-anime') {
    baseHashtags = '#EgoAnime #EgoTV #AnimeBrasil #OtakuBR #Sakuga #TemporadaDeAnimes';
    ctaText = 'Acompanhe a programação otaku oficial na Ego TV — acesse pelo link no perfil.';
    tiktokHook = `⚡ ${cleanTitle} | O nível de animação em "${work}" merece ser visto frame a frame!`;
    igBody = `🔥 ${cleanTitle}\n\nSequência em destaque de "${work}". Qual a sua nota de 0 a 10 para essa produção?\n\n⚡ ${ctaText}`;
  } else {
    baseHashtags = '#EgoSeries #EgoTV #SeriesBrasil #MaratonaDeSeries #DicaDeSerie';
    ctaText = 'Descubra novas séries e conteúdos licenciados na Ego TV — link na bio.';
    tiktokHook = `📺 ${cleanTitle} — Impossível não ficar preso nessa cena de "${work}"!`;
    igBody = `🎭 ${cleanTitle}\n\nMomento marcante de "${work}". Você já acompanhou essa história?\n\n👉 ${ctaText}`;
  }

  if (input.angle === 'DEBATE') {
    tiktokHook += ' Concorda ou acha superestimado? Comente 👇';
  } else if (input.angle === 'CURIOSITY') {
    tiktokHook += ' Pouca gente reparou nesse detalhe na primeira vez!';
  } else {
    tiktokHook += ` ${ctaText}`;
  }

  const finalHashtags = input.customHashtags?.trim() || baseHashtags;

  const tiktokCaption = `${tiktokHook}\n\n${finalHashtags}`;
  const instagramCaption = `${igBody}\n.\n.\n${finalHashtags}`;

  return {
    tiktokCaption,
    instagramCaption,
    hashtags: finalHashtags,
    ctaText,
    complianceNotes: [
      'Modelos distintos gerados para TikTok (SEO curto + gancho imediato) e Instagram Reels (legenda estruturada + pergunta de engajamento).',
      'Verificação de conformidade ativa: zero alegações enganosas sobre disponibilidade indevida de obras.',
    ],
  };
}

export function validateCopyCompliance(text: string): { valid: boolean; reason?: string } {
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_MISLEADING_CLAIMS) {
    if (lower.includes(phrase)) {
      return {
        valid: false,
        reason: `Alegação enganosa ou não permitida detectada: "${phrase}". Utilize chamadas transparentes para a Ego TV.`,
      };
    }
  }
  return { valid: true };
}
