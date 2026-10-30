export interface RadarScoreInput {
  viewsObserved?: number | null;
  likesObserved?: number | null;
  commentsObserved?: number | null;
  originalPublishedAt?: string | null;
  title: string;
  franchiseOrWork?: string | null;
  channelKeywords: string[];
  channelCategories: string[];
}

export interface RadarScoreBreakdown {
  growthVelocityScore: number;
  audienceFitScore: number;
  engagementQualityScore: number;
  relevanceScore: number;
  explanation: string;
}

/**
 * Calcula a classificação de relevância (0 a 100) sem presumir que apenas
 * o volume bruto de visualizações determina o potencial viral.
 * Pondera:
 * - Taxa de engajamento qualificado (Likes + Comentários ponderados sobre Views)
 * - Velocidade de crescimento (Desempenho por hora desde a publicação original, quando disponível)
 * - Aderência ao público-alvo do canal (Keywords e Franquias do canal)
 */
export function calculateRadarRelevance(input: RadarScoreInput): RadarScoreBreakdown {
  const views = input.viewsObserved && input.viewsObserved > 0 ? input.viewsObserved : 0;
  const likes = input.likesObserved && input.likesObserved > 0 ? input.likesObserved : 0;
  const comments = input.commentsObserved && input.commentsObserved > 0 ? input.commentsObserved : 0;

  // 1. Qualidade de Engajamento (0 a 100)
  // Comentários têm peso 4x maior por indicarem discussão ativa
  let engagementQualityScore = 50; // Base neutra quando métricas não estão disponíveis
  if (views > 0) {
    const engagementRate = ((likes + comments * 4) / views) * 100;
    // Uma taxa ponderada de 12%+ é excelente em vídeos curtos
    engagementQualityScore = Math.min(100, Math.round((engagementRate / 12) * 100 * 10) / 10);
  }

  // 2. Velocidade de Crescimento (0 a 100)
  let growthVelocityScore = 50;
  if (views > 0 && input.originalPublishedAt) {
    const pubDate = new Date(input.originalPublishedAt).getTime();
    const now = Date.now();
    const hoursElapsed = Math.max(1, (now - pubDate) / (1000 * 3600));
    const viewsPerHour = views / hoursElapsed;
    // 5.000 views/hora nos primeiros dias = alta tração
    growthVelocityScore = Math.min(100, Math.round(Math.log10(viewsPerHour + 10) * 25 * 10) / 10);
  } else if (views > 0) {
    growthVelocityScore = Math.min(85, Math.round(Math.log10(views + 10) * 15 * 10) / 10);
  }

  // 3. Aderência ao Público-Alvo do Canal (0 a 100)
  const fullText = `${input.title} ${input.franchiseOrWork || ''}`.toLowerCase();
  let matchCount = 0;
  for (const kw of input.channelKeywords) {
    const tokens = kw.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    if (tokens.some(t => fullText.includes(t))) {
      matchCount++;
    }
  }
  for (const cat of input.channelCategories) {
    const tokens = cat.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    if (tokens.some(t => fullText.includes(t))) {
      matchCount++;
    }
  }

  const audienceFitScore = Math.min(100, 65 + matchCount * 12);

  // Combinação ponderada:
  // 40% Aderência ao Canal + 35% Qualidade de Engajamento + 25% Velocidade de Crescimento
  const relevanceScore = Math.round(
    (audienceFitScore * 0.40 + engagementQualityScore * 0.35 + growthVelocityScore * 0.25) * 10
  ) / 10;

  const explanation = views > 0
    ? `Score composto: Aderência (${audienceFitScore}%), Qualidade Engajamento (${engagementQualityScore}%), Velocidade (${growthVelocityScore}%).`
    : `Métricas de visualização não informadas na fonte; score baseado na aderência temática ao canal (${audienceFitScore}%).`;

  return {
    growthVelocityScore,
    audienceFitScore,
    engagementQualityScore,
    relevanceScore,
    explanation,
  };
}
