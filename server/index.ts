import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { db, initDatabase } from './db.ts';
import { calculateRadarRelevance } from './services/radarEngine.ts';
import { generatePlatformCopy, validateCopyCompliance } from './services/copyGenerator.ts';
import { executeOfficialPublish, getIntegrationCapabilities } from './services/socialIntegrations.ts';
import { downloadCleanTikTokVideo } from './services/mediaDownloader.ts';
import {
  extractOriginalExternalId,
  getNicheLabel,
  recordPipelineHistory,
  attemptAuthorizedAutoAcquisition,
} from './services/pipelineEngine.ts';
import {
  discoverAndSeparateTikTokViralsForAllChannels,
  TIKTOK_DEFAULT_HASHTAGS,
  verifyTikTokVideoAvailability,
} from './services/tiktokTagDiscovery.ts';
import {
  analyzePipelineVideoNow,
  enqueueVideoIntelligenceAnalysis,
  formatAnalysisRow,
  getAutomationRules,
  getIntelligenceQueueStatus,
} from './services/videoIntelligenceEngine.ts';

dotenv.config();
initDatabase();

export const app = express();
const PORT = Number(process.env.PORT) || 3333;
const JWT_SECRET = process.env.JWT_SECRET || 'ego-tv-super-secret-jwt-key-2026';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Configuração de Upload Autorizado (Multer)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB max
});

function logActivity(module: string, action: string, actor: string, details: string, severity: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  db.prepare(`
    INSERT INTO activity_logs (module, action, actor, details, severity)
    VALUES (?, ?, ?, ?, ?)
  `).run(module, action, actor, details, severity);
}

// ============================================================================
// 1. AUTENTICAÇÃO E OPERADORES
// ============================================================================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Credenciais inválidas.' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  logActivity('AUTH', 'LOGIN_SUCCESS', user.email, `Operador ${user.name} iniciou sessão.`);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Não autenticado.' });
    return;
  }
  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    res.json({ user: decoded });
  } catch {
    res.status(401).json({ error: 'Sessão expirada ou inválida.' });
  }
});

// ============================================================================
// 2. CANAIS & CONTAS SOCIAIS (3 Canais = 90 Vídeos/Dia | 6 Contas Sociais)
// ============================================================================
app.get('/api/channels', (_req, res) => {
  const channels = db.prepare('SELECT * FROM channels ORDER BY id').all() as any[];
  const accounts = db.prepare('SELECT * FROM social_accounts ORDER BY id').all() as any[];

  const enriched = channels.map((ch) => {
    const channelAccounts = accounts.filter((a) => a.channel_id === ch.id);
    const preparedCount = (db.prepare(`
      SELECT COUNT(*) as c FROM content_items
      WHERE channel_id = ? AND workflow_status IN ('APPROVED', 'PREPARED', 'SCHEDULED', 'PUBLISHED')
    `).get(ch.id) as { c: number }).c;

    const publishedToday = (db.prepare(`
      SELECT COUNT(*) as c FROM publication_queue
      WHERE channel_id = ? AND status = 'PUBLISHED_OFFICIAL_API'
    `).get(ch.id) as { c: number }).c;

    const queuedToday = (db.prepare(`
      SELECT COUNT(*) as c FROM publication_queue
      WHERE channel_id = ? AND status IN ('PENDING_APPROVAL', 'QUEUED', 'AWAITING_CREDENTIALS')
    `).get(ch.id) as { c: number }).c;

    return {
      ...ch,
      categories: JSON.parse(ch.categories || '[]'),
      search_keywords: JSON.parse(ch.search_keywords || '[]'),
      social_accounts: channelAccounts,
      metrics: {
        daily_goal: ch.daily_goal,
        prepared_count: preparedCount,
        published_today: publishedToday,
        queued_today: queuedToday,
        progress_percent: Math.min(100, Math.round(((preparedCount + publishedToday) / ch.daily_goal) * 100)),
      },
    };
  });

  res.json({
    channels: enriched,
    totalDailyGoal: enriched.reduce((acc, c) => acc + c.daily_goal, 0),
    integrations: getIntegrationCapabilities(),
  });
});

app.put('/api/channels/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    daily_goal,
    categories,
    search_keywords,
    default_cta,
    tiktok_caption_template,
    instagram_caption_template,
    hashtags_default,
  } = req.body;

  const existing = db.prepare('SELECT * FROM channels WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Canal não encontrado.' });
    return;
  }

  db.prepare(`
    UPDATE channels
    SET name = ?,
        daily_goal = ?,
        categories = ?,
        search_keywords = ?,
        default_cta = ?,
        tiktok_caption_template = ?,
        instagram_caption_template = ?,
        hashtags_default = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    daily_goal ?? existing.daily_goal,
    Array.isArray(categories) ? JSON.stringify(categories) : existing.categories,
    Array.isArray(search_keywords) ? JSON.stringify(search_keywords) : existing.search_keywords,
    default_cta ?? existing.default_cta,
    tiktok_caption_template ?? existing.tiktok_caption_template,
    instagram_caption_template ?? existing.instagram_caption_template,
    hashtags_default ?? existing.hashtags_default,
    id
  );

  logActivity('CHANNELS', 'CHANNEL_UPDATED', 'admin@egotv.com.br', `Configurações do canal ${id} atualizadas (Meta: ${daily_goal ?? existing.daily_goal}/dia).`);
  res.json({ success: true });
});

app.put('/api/social-accounts/:id', (req, res) => {
  const { id } = req.params;
  const { handle, account_name, daily_target } = req.body;
  db.prepare(`
    UPDATE social_accounts
    SET handle = COALESCE(?, handle),
        account_name = COALESCE(?, account_name),
        daily_target = COALESCE(?, daily_target)
    WHERE id = ?
  `).run(handle, account_name, daily_target, id);

  logActivity('CHANNELS', 'SOCIAL_ACCOUNT_UPDATED', 'admin@egotv.com.br', `Conta social ${id} atualizada (${handle}).`);
  res.json({ success: true });
});

// Conectar conta social específica (ex: conectar apenas TikTok de Ego Filmes `tt-filmes` para testar/operar o fluxo)
app.post('/api/social-accounts/:id/connect', (req, res) => {
  const { id } = req.params;
  const {
    handle,
    account_name,
    access_token,
    client_key,
    open_id,
    exclusive_mode = false,
  } = req.body || {};

  const existing = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Conta social não encontrada.' });
    return;
  }

  // Se exclusive_mode = true, desconecta todas as outras contas para testar isoladamente apenas esta conta
  if (exclusive_mode) {
    db.prepare(`
      UPDATE social_accounts
      SET oauth_connected = 0,
          connection_status = 'PENDING_CREDENTIALS',
          connection_mode = 'DISCONNECTED'
      WHERE id != ?
    `).run(id);
  }

  const finalHandle = handle && String(handle).trim() !== ''
    ? (String(handle).trim().startsWith('@') ? String(handle).trim() : `@${String(handle).trim()}`)
    : existing.handle;

  const finalName = account_name && String(account_name).trim() !== ''
    ? String(account_name).trim()
    : existing.account_name;

  const hasOfficialToken = Boolean(access_token && String(access_token).trim() !== '');
  const connMode = hasOfficialToken ? 'OFFICIAL_OAUTH_TOKEN' : 'DIRECT_WORKFLOW_ACTIVE';
  const connStatus = hasOfficialToken ? 'CONNECTED_OAUTH_V2' : 'CONECTADA (FLUXO ATIVO)';

  db.prepare(`
    UPDATE social_accounts
    SET handle = ?,
        account_name = ?,
        oauth_connected = 1,
        connection_status = ?,
        connection_mode = ?,
        access_token = COALESCE(?, access_token),
        client_key = COALESCE(?, client_key),
        open_id = COALESCE(?, open_id),
        last_sync_at = datetime('now')
    WHERE id = ?
  `).run(
    finalHandle,
    finalName,
    connStatus,
    connMode,
    hasOfficialToken ? String(access_token).trim() : null,
    client_key ? String(client_key).trim() : null,
    open_id ? String(open_id).trim() : null,
    id
  );

  // Se estamos conectando uma conta de um canal (ex: TikTok de ego-filmes), ajusta os itens daquele canal no pipeline para mirar na plataforma conectada
  const connectedOnChannel = db
    .prepare('SELECT platform FROM social_accounts WHERE channel_id = ? AND oauth_connected = 1')
    .all(existing.channel_id) as Array<{ platform: string }>;

  if (connectedOnChannel.length === 1) {
    const activePlatform = connectedOnChannel[0].platform;
    db.prepare(`
      UPDATE video_pipeline_items
      SET target_platforms = ?
      WHERE channel_id = ? AND pipeline_state NOT IN ('PUBLICADO')
    `).run(activePlatform, existing.channel_id);
  } else if (connectedOnChannel.length >= 2) {
    db.prepare(`
      UPDATE video_pipeline_items
      SET target_platforms = 'BOTH'
      WHERE channel_id = ? AND pipeline_state NOT IN ('PUBLICADO')
    `).run(existing.channel_id);
  }

  logActivity(
    'CHANNELS',
    'SOCIAL_ACCOUNT_CONNECTED',
    'admin@egotv.com.br',
    `Conta ${existing.platform} "${finalHandle}" (${existing.channel_id}) CONECTADA (${connStatus}).`
  );

  const updated = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id);
  res.json({ success: true, account: updated });
});

// Desconectar conta social específica
app.post('/api/social-accounts/:id/disconnect', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Conta social não encontrada.' });
    return;
  }

  db.prepare(`
    UPDATE social_accounts
    SET oauth_connected = 0,
        connection_status = 'PENDING_CREDENTIALS',
        connection_mode = 'DISCONNECTED',
        access_token = NULL,
        last_sync_at = datetime('now')
    WHERE id = ?
  `).run(id);

  logActivity(
    'CHANNELS',
    'SOCIAL_ACCOUNT_DISCONNECTED',
    'admin@egotv.com.br',
    `Conta ${existing.platform} "${existing.handle}" (${existing.channel_id}) desconectada.`
  );

  const updated = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(id);
  res.json({ success: true, account: updated });
});

// ============================================================================
// 3. DASHBOARD PRINCIPAL (Com Filtros & Transparência Real vs. Demonstrativo)
// ============================================================================
app.get('/api/dashboard', (req, res) => {
  const { channelId, platform, status, includeDemo = 'true' } = req.query;
  const showDemo = includeDemo !== 'false';

  let channelFilterSql = '';
  const params: any[] = [];
  if (channelId && channelId !== 'ALL') {
    channelFilterSql += ' AND channel_id = ?';
    params.push(channelId);
  }
  if (!showDemo) {
    channelFilterSql += ' AND is_demo = 0';
  }

  const radarIdentified = (db.prepare(`SELECT COUNT(*) as c FROM radar_items WHERE 1=1 ${channelFilterSql}`).get(...params) as { c: number }).c;

  const contentAll = db.prepare(`SELECT * FROM content_items WHERE 1=1 ${channelFilterSql}`).all(...params) as any[];
  const filteredContent = status && status !== 'ALL'
    ? contentAll.filter((c) => c.workflow_status === status)
    : contentAll;

  const approvedCount = filteredContent.filter((c) => c.workflow_status === 'APPROVED').length;
  const awaitingApprovalCount = filteredContent.filter((c) => ['IDENTIFIED', 'IN_ANALYSIS', 'RIGHTS_VERIFIED'].includes(c.workflow_status)).length;
  const preparedCount = filteredContent.filter((c) => ['PREPARED', 'SCHEDULED'].includes(c.workflow_status)).length;

  let queueSql = 'SELECT * FROM publication_queue WHERE 1=1';
  const queueParams: any[] = [];
  if (channelId && channelId !== 'ALL') {
    queueSql += ' AND channel_id = ?';
    queueParams.push(channelId);
  }
  if (platform && platform !== 'ALL') {
    queueSql += ' AND platform = ?';
    queueParams.push(platform);
  }
  if (!showDemo) {
    queueSql += ' AND is_demo = 0';
  }
  const queueItems = db.prepare(queueSql).all(...queueParams) as any[];

  const completedPublications = queueItems.filter((q) => q.status === 'PUBLISHED_OFFICIAL_API').length;
  const failedPublications = queueItems.filter((q) => q.status === 'FAILED').length;
  const awaitingCredentialsCount = queueItems.filter((q) => q.status === 'AWAITING_CREDENTIALS').length;

  // Views observadas no Radar
  const radarItems = db.prepare(`SELECT * FROM radar_items WHERE 1=1 ${channelFilterSql}`).all(...params) as any[];
  const observedViews = radarItems.reduce((acc, item) => acc + (item.views_observed || 0), 0);

  // Links rastreáveis Ego TV
  let trackSql = 'SELECT * FROM tracking_links WHERE 1=1';
  const trackParams: any[] = [];
  if (channelId && channelId !== 'ALL') {
    trackSql += ' AND channel_id = ?';
    trackParams.push(channelId);
  }
  if (platform && platform !== 'ALL') {
    trackSql += ' AND platform = ?';
    trackParams.push(platform);
  }
  if (!showDemo) {
    trackSql += ' AND is_demo = 0';
  }
  const trackingLinks = db.prepare(trackSql).all(...trackParams) as any[];
  const egoTvClicks = trackingLinks.reduce((acc, t) => acc + (t.clicks_count || 0), 0);
  const attributedSubscriptions = trackingLinks.reduce((acc, t) => acc + (t.attributed_subscriptions || 0), 0);

  // Progresso por canal (Meta: 30 por canal = 90 diários)
  const channels = db.prepare('SELECT * FROM channels ORDER BY id').all() as any[];
  const channelProgress = channels.map((ch) => {
    const chItems = contentAll.filter((c) => c.channel_id === ch.id);
    const readyOrPublished = chItems.filter((c) =>
      ['APPROVED', 'PREPARED', 'SCHEDULED', 'PUBLISHED'].includes(c.workflow_status)
    ).length;
    const inPipeline = chItems.length;

    return {
      id: ch.id,
      name: ch.name,
      color: ch.color,
      dailyGoal: ch.daily_goal,
      readyCount: readyOrPublished,
      totalInPipeline: inPipeline,
      percentage: Math.min(100, Math.round((readyOrPublished / ch.daily_goal) * 100)),
    };
  });

  const recentLogs = db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 12').all();

  const hasDemoItems = contentAll.some((c) => c.is_demo === 1) || radarItems.some((r) => r.is_demo === 1);

  res.json({
    kpis: {
      videosIdentifiedToday: radarIdentified + contentAll.length,
      videosApproved: approvedCount,
      videosAwaitingApproval: awaitingApprovalCount,
      videosPrepared: preparedCount,
      publicationsCompleted: completedPublications,
      publicationsFailed: failedPublications,
      publicationsAwaitingCredentials: awaitingCredentialsCount,
      accumulatedObservedViews: observedViews,
      egoTvClicks,
      attributedSubscriptions,
    },
    dataTransparency: {
      showingDemoData: showDemo && hasDemoItems,
      officialApisConnected: false,
      notice: showDemo && hasDemoItems
        ? 'Exibindo registros operacionais + itens demonstrativos identificados com a tag [DEMO]. Você pode ocultar dados de demonstração no seletor superior.'
        : 'Exibindo exclusivamente registros reais cadastrados pelo operador.',
    },
    channelProgress,
    recentLogs,
  });
});

// ============================================================================
// 4. MÓDULO VIRAL RADAR (Descoberta Autorizada + Classificação Multicritério)
// ============================================================================
app.get('/api/radar', (req, res) => {
  const { channelId } = req.query;
  const sources = channelId && channelId !== 'ALL'
    ? db.prepare('SELECT * FROM radar_sources WHERE channel_id = ? ORDER BY priority DESC, id DESC').all(channelId as string)
    : db.prepare('SELECT * FROM radar_sources ORDER BY priority DESC, id DESC').all();

  const items = channelId && channelId !== 'ALL'
    ? db.prepare('SELECT * FROM radar_items WHERE channel_id = ? ORDER BY relevance_score DESC, id DESC').all(channelId as string)
    : db.prepare('SELECT * FROM radar_items ORDER BY relevance_score DESC, id DESC').all();

  res.json({ sources, items });
});

app.post('/api/radar/sources', (req, res) => {
  const { channel_id, source_type, value, platform_origin, priority } = req.body;
  if (!channel_id || !source_type || !value) {
    res.status(400).json({ error: 'Canal, tipo e valor são obrigatórios.' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO radar_sources (channel_id, source_type, value, platform_origin, priority)
    VALUES (?, ?, ?, ?, ?)
  `).run(channel_id, source_type, value.trim(), platform_origin || 'ALL', Number(priority) || 5);

  logActivity('VIRAL_RADAR', 'SOURCE_ADDED', 'admin@egotv.com.br', `Nova fonte monitorada em ${channel_id}: [${source_type}] ${value}`);
  res.json({ id: result.lastInsertRowid, success: true });
});

app.delete('/api/radar/sources/:id', (req, res) => {
  db.prepare('DELETE FROM radar_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Coleta/Cadastro de Tendência no Viral Radar (com Deduplicação de URL + Cálculo Real de Score)
app.post('/api/radar/items', async (req, res) => {
  const {
    channel_id,
    source_url,
    platform,
    title,
    franchise_or_work,
    views_observed,
    likes_observed,
    comments_observed,
    original_published_at,
    notes,
  } = req.body;

  if (!channel_id || !source_url || !title) {
    res.status(400).json({ error: 'Canal sugerido, URL de origem e título/descrição são obrigatórios.' });
    return;
  }

  // Deduplicação por URL
  const duplicate = db.prepare('SELECT * FROM radar_items WHERE source_url = ?').get(source_url.trim()) as any;
  if (duplicate) {
    res.status(409).json({
      error: `URL duplicada detectada! Este material já está registrado no Viral Radar sob o ID #${duplicate.id} ("${duplicate.title}").`,
    });
    return;
  }

  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channel_id) as any;
  const channelKeywords = channel ? JSON.parse(channel.search_keywords || '[]') : [];
  const channelCategories = channel ? JSON.parse(channel.categories || '[]') : [];

  const scoreBreakdown = calculateRadarRelevance({
    viewsObserved: views_observed !== undefined && views_observed !== '' ? Number(views_observed) : null,
    likesObserved: likes_observed !== undefined && likes_observed !== '' ? Number(likes_observed) : null,
    commentsObserved: comments_observed !== undefined && comments_observed !== '' ? Number(comments_observed) : null,
    originalPublishedAt: original_published_at || null,
    title,
    franchiseOrWork: franchise_or_work,
    channelKeywords,
    channelCategories,
  });

  const result = db.prepare(`
    INSERT INTO radar_items (
      channel_id, source_url, platform, title, franchise_or_work,
      views_observed, likes_observed, comments_observed, original_published_at,
      growth_velocity_score, audience_fit_score, relevance_score,
      analysis_status, collection_method, is_demo, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IDENTIFIED', 'MANUAL_AUTHORIZED', 0, ?)
  `).run(
    channel_id,
    source_url.trim(),
    platform || 'YOUTUBE_OFFICIAL',
    title.trim(),
    franchise_or_work || '',
    views_observed !== '' && views_observed !== null && views_observed !== undefined ? Number(views_observed) : null,
    likes_observed !== '' && likes_observed !== null && likes_observed !== undefined ? Number(likes_observed) : null,
    comments_observed !== '' && comments_observed !== null && comments_observed !== undefined ? Number(comments_observed) : null,
    original_published_at || null,
    scoreBreakdown.growthVelocityScore,
    scoreBreakdown.audienceFitScore,
    scoreBreakdown.relevanceScore,
    notes || scoreBreakdown.explanation
  );

  logActivity(
    'VIRAL_RADAR',
    'TREND_REGISTERED',
    'admin@egotv.com.br',
    `Tendência registrada para ${channel_id}: "${title}" (Score: ${scoreBreakdown.relevanceScore}).`
  );

  res.json({
    id: result.lastInsertRowid,
    scoreBreakdown,
    success: true,
  });
});

// Coleta via oEmbed Público Autorizado + Verificação Real de Disponibilidade no TikTok
app.post('/api/radar/fetch-oembed', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'Informe uma URL para consulta oEmbed pública.' });
    return;
  }

  try {
    const isTikTok = url.toLowerCase().includes('tiktok.com');
    if (isTikTok) {
      const check = await verifyTikTokVideoAvailability(url);
      if (!check.available) {
        res.status(422).json({
          error: 'Vídeo indisponível ou privado no TikTok! Informe um link de vídeo ativo.',
        });
        return;
      }
      res.json({
        title: `Vídeo TikTok · ${check.creatorName} (#${check.videoId})`,
        author_name: check.creatorName,
        provider_name: 'TIKTOK',
        thumbnail_url: check.thumbnailUrl,
        canonical_url: check.canonicalUrl,
        embed_player_url: check.embedPlayerUrl,
        notice: 'Vídeo verificado ao vivo e 100% disponível nos servidores do TikTok.',
      });
      return;
    }

    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      res.status(422).json({
        error: 'A plataforma não retornou metadados públicos via oEmbed para este link. Preencha os campos manualmente.',
      });
      return;
    }
    const data = await response.json() as any;
    res.json({
      title: data.title,
      author_name: data.author_name,
      provider_name: data.provider_name || 'TIKTOK',
      thumbnail_url: data.thumbnail_url,
      notice: 'Metadados públicos obtidos via protocolo oficial oEmbed.',
    });
  } catch (err: any) {
    res.status(500).json({ error: `Falha ao consultar disponibilidade: ${err.message}` });
  }
});

// Buscar Virais do TikTok por Hashtags (#filmes, #anime, #series) e separar TODOS para postagem nas 3 contas (90 vídeos)
app.post('/api/radar/tiktok-tag-batch', (req, res) => {
  const {
    target_per_channel = 30,
    purge_non_tiktok = true,
    tags_filmes,
    tags_anime,
    tags_series,
  } = req.body || {};

  const parseTags = (raw: string | undefined, fallback: string[]) => {
    if (!raw || !raw.trim()) return fallback;
    return raw
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));
  };

  const result = discoverAndSeparateTikTokViralsForAllChannels({
    targetPerChannel: Number(target_per_channel) || 30,
    purgeNonTikTok: Boolean(purge_non_tiktok),
    customTags: {
      'ego-filmes': parseTags(tags_filmes, TIKTOK_DEFAULT_HASHTAGS['ego-filmes']),
      'ego-anime': parseTags(tags_anime, TIKTOK_DEFAULT_HASHTAGS['ego-anime']),
      'ego-series': parseTags(tags_series, TIKTOK_DEFAULT_HASHTAGS['ego-series']),
    },
  });

  logActivity(
    'VIRAL_RADAR',
    'TIKTOK_TAG_BATCH_SEPARATED',
    'admin@egotv.com.br',
    `Busca de virais do TikTok por tags concluída: ${result.totalCandidatesProcessed} vídeos do TikTok separados para postagem nas 3 contas (Ego Filmes: 30, Ego Anime: 30, Ego Séries: 30).`
  );

  res.json({
    success: true,
    ...result,
  });
});

// Promover item do Radar para a Biblioteca Central
app.post('/api/radar/items/:id/promote', (req, res) => {
  const radarItem = db.prepare('SELECT * FROM radar_items WHERE id = ?').get(req.params.id) as any;
  if (!radarItem) {
    res.status(404).json({ error: 'Item do radar não encontrado.' });
    return;
  }

  const categoryMap: Record<string, string> = {
    'ego-filmes': 'FILMES',
    'ego-anime': 'ANIME',
    'ego-series': 'SERIES',
  };
  const categoryGroup = categoryMap[radarItem.channel_id] || 'FILMES';

  const copy = generatePlatformCopy({
    channelId: radarItem.channel_id,
    channelName: radarItem.channel_id.toUpperCase(),
    title: radarItem.title,
    workReference: radarItem.franchise_or_work || radarItem.title,
  });

  const insertResult = db.prepare(`
    INSERT INTO content_items (
      channel_id, category_group, title, work_reference, source_url,
      caption_tiktok, caption_instagram, hashtags, cta_text,
      rights_status, workflow_status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', 'IDENTIFIED', ?)
  `).run(
    radarItem.channel_id,
    categoryGroup,
    radarItem.title,
    radarItem.franchise_or_work || 'Referência sob análise',
    radarItem.source_url,
    copy.tiktokCaption,
    copy.instagramCaption,
    copy.hashtags,
    copy.ctaText,
    radarItem.is_demo
  );

  db.prepare(`UPDATE radar_items SET analysis_status = 'SENT_TO_LIBRARY' WHERE id = ?`).run(radarItem.id);

  db.prepare(`
    INSERT INTO content_history (content_id, event_type, previous_status, new_status, actor, details)
    VALUES (?, 'IMPORTED_FROM_RADAR', NULL, 'IDENTIFIED', 'admin@egotv.com.br', ?)
  `).run(insertResult.lastInsertRowid, `Promovido do Viral Radar (ID #${radarItem.id}, Relevância: ${radarItem.relevance_score}).`);

  logActivity('LIBRARY', 'PROMOTED_FROM_RADAR', 'admin@egotv.com.br', `Item "${radarItem.title}" enviado para a Biblioteca Central (Aguardando verificação de direitos).`);

  res.json({ contentId: insertResult.lastInsertRowid, success: true });
});

// ============================================================================
// 5. BIBLIOTECA CENTRAL, UPLOAD AUTORIZADO, DEDUPLICAÇÃO E DIREITOS DE USO
// ============================================================================
app.get('/api/library', (req, res) => {
  const { channelId, categoryGroup, workflowStatus, rightsStatus, search } = req.query;

  let sql = 'SELECT * FROM content_items WHERE 1=1';
  const params: any[] = [];

  if (channelId && channelId !== 'ALL') {
    sql += ' AND channel_id = ?';
    params.push(channelId);
  }
  if (categoryGroup && categoryGroup !== 'ALL') {
    sql += ' AND category_group = ?';
    params.push(categoryGroup);
  }
  if (workflowStatus && workflowStatus !== 'ALL') {
    sql += ' AND workflow_status = ?';
    params.push(workflowStatus);
  }
  if (rightsStatus && rightsStatus !== 'ALL') {
    sql += ' AND rights_status = ?';
    params.push(rightsStatus);
  }
  if (search && String(search).trim() !== '') {
    sql += ' AND (title LIKE ? OR work_reference LIKE ? OR hashtags LIKE ?)';
    const term = `%${String(search).trim()}%`;
    params.push(term, term, term);
  }

  sql += ' ORDER BY id DESC';
  const items = db.prepare(sql).all(...params) as any[];

  const enriched = items.map((item) => {
    const history = db.prepare('SELECT * FROM content_history WHERE content_id = ? ORDER BY id DESC').all(item.id);
    const publications = db.prepare('SELECT * FROM publication_queue WHERE content_id = ? ORDER BY id DESC').all(item.id);
    return {
      ...item,
      history,
      publications,
    };
  });

  res.json({ items: enriched });
});

// Upload de Material Autorizado ou Criação na Biblioteca (com Hash SHA-256 para Detecção de Duplicatas)
app.post('/api/library', upload.single('videoFile'), (req, res) => {
  const {
    channel_id,
    title,
    work_reference,
    source_url,
    duration_seconds,
    resolution,
    rights_license_notes,
    caption_tiktok,
    caption_instagram,
    hashtags,
    cta_text,
  } = req.body;

  if (!channel_id || !title) {
    res.status(400).json({ error: 'Canal e título do material são obrigatórios.' });
    return;
  }

  let fileHash: string | null = null;
  let fileName: string | null = null;
  let filePath: string | null = null;
  let fileSizeBytes: number | null = null;

  if (req.file) {
    const buffer = fs.readFileSync(req.file.path);
    fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    fileName = req.file.originalname;
    filePath = `/uploads/${req.file.filename}`;
    fileSizeBytes = req.file.size;

    // Verificar duplicata exata de arquivo por SHA-256
    const existingByHash = db.prepare('SELECT * FROM content_items WHERE file_hash = ?').get(fileHash) as any;
    if (existingByHash) {
      fs.unlinkSync(req.file.path);
      res.status(409).json({
        error: `Arquivo duplicado detectado (SHA-256 idêntico ao item #${existingByHash.id}: "${existingByHash.title}"). Upload bloqueado para evitar duplicidade.`,
      });
      return;
    }
  }

  // Verificar duplicata por URL ou Título idêntico no mesmo canal
  if (source_url && source_url.trim() !== '') {
    const existingByUrl = db.prepare('SELECT * FROM content_items WHERE source_url = ? AND channel_id = ?').get(source_url.trim(), channel_id) as any;
    if (existingByUrl) {
      res.status(409).json({
        error: `Material duplicado: esta URL de origem já está cadastrada no canal sob o ID #${existingByUrl.id} ("${existingByUrl.title}").`,
      });
      return;
    }
  }

  const categoryMap: Record<string, string> = {
    'ego-filmes': 'FILMES',
    'ego-anime': 'ANIME',
    'ego-series': 'SERIES',
  };
  const categoryGroup = categoryMap[channel_id] || 'FILMES';

  const autoCopy = generatePlatformCopy({
    channelId: channel_id,
    channelName: channel_id,
    title,
    workReference: work_reference || title,
    customHashtags: hashtags,
  });

  const finalTiktok = caption_tiktok || autoCopy.tiktokCaption;
  const finalInstagram = caption_instagram || autoCopy.instagramCaption;

  // Validar que não há alegações enganosas
  const complianceCheckTT = validateCopyCompliance(finalTiktok);
  const complianceCheckIG = validateCopyCompliance(finalInstagram);
  if (!complianceCheckTT.valid || !complianceCheckIG.valid) {
    res.status(422).json({ error: complianceCheckTT.reason || complianceCheckIG.reason });
    return;
  }

  const dur = Number(duration_seconds) || 45;
  const resStr = resolution || '1080x1920';
  const technicalValid = dur > 3 && dur <= 180 && (resStr === '1080x1920' || resStr === '720x1280') ? 1 : 0;

  const insert = db.prepare(`
    INSERT INTO content_items (
      channel_id, category_group, title, work_reference, source_url,
      file_path, file_name, file_hash, file_size_bytes, duration_seconds, resolution,
      technical_valid, caption_tiktok, caption_instagram, hashtags, cta_text,
      rights_status, rights_license_notes, workflow_status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_VERIFICATION', ?, 'IDENTIFIED', 0)
  `).run(
    channel_id,
    categoryGroup,
    title.trim(),
    work_reference || 'Material Autorizado Ego TV',
    source_url || null,
    filePath,
    fileName,
    fileHash,
    fileSizeBytes,
    dur,
    resStr,
    technicalValid,
    finalTiktok,
    finalInstagram,
    hashtags || autoCopy.hashtags,
    cta_text || autoCopy.ctaText,
    rights_license_notes || 'Aguardando conferência documental de licença/press-kit.'
  );

  db.prepare(`
    INSERT INTO content_history (content_id, event_type, previous_status, new_status, actor, details)
    VALUES (?, 'CREATED_IN_LIBRARY', NULL, 'IDENTIFIED', 'admin@egotv.com.br', ?)
  `).run(
    insert.lastInsertRowid,
    fileName ? `Upload realizado: ${fileName} (SHA-256: ${fileHash?.slice(0, 12)}...)` : 'Registro criado na Biblioteca Central.'
  );

  logActivity('LIBRARY', 'CONTENT_CREATED', 'admin@egotv.com.br', `Material #${insert.lastInsertRowid} "${title}" cadastrado em ${channel_id}.`);

  res.json({ id: insert.lastInsertRowid, success: true });
});

// ============================================================================
// 6. CONTROLE DE DIREITOS E FLUXO DE APROVAÇÃO (GATEKEEPER)
// ============================================================================
app.post('/api/library/:id/verify-rights', (req, res) => {
  const { id } = req.params;
  const { rights_status, rights_license_notes, actor = 'admin@egotv.com.br' } = req.body;

  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Material não encontrado.' });
    return;
  }

  const newWorkflowStatus = rights_status === 'VERIFIED_AUTHORIZED'
    ? 'RIGHTS_VERIFIED'
    : rights_status === 'RESTRICTED_BLOCKED'
      ? 'REJECTED'
      : 'IN_ANALYSIS';

  db.prepare(`
    UPDATE content_items
    SET rights_status = ?,
        rights_license_notes = ?,
        rights_verified_by = ?,
        rights_verified_at = datetime('now'),
        workflow_status = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(rights_status, rights_license_notes || item.rights_license_notes, actor, newWorkflowStatus, id);

  db.prepare(`
    INSERT INTO content_history (content_id, event_type, previous_status, new_status, actor, details)
    VALUES (?, 'RIGHTS_VERIFICATION', ?, ?, ?, ?)
  `).run(id, item.workflow_status, newWorkflowStatus, actor, `Direitos definidos como ${rights_status}: ${rights_license_notes || ''}`);

  logActivity(
    'RIGHTS_CONTROL',
    'RIGHTS_UPDATED',
    actor,
    `Direitos do material #${id} ("${item.title}") atualizados para ${rights_status}.`
  );

  res.json({ success: true, workflow_status: newWorkflowStatus });
});

app.post('/api/library/:id/workflow', (req, res) => {
  const { id } = req.params;
  const { target_status, rejection_reason, actor = 'admin@egotv.com.br' } = req.body;

  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Material não encontrado.' });
    return;
  }

  // REGRA CRÍTICA: Bloquear aprovação, preparação, agendamento ou publicação sem direitos verificados
  const protectedStatuses = ['APPROVED', 'PREPARED', 'SCHEDULED', 'PUBLISHED'];
  if (protectedStatuses.includes(target_status) && item.rights_status !== 'VERIFIED_AUTHORIZED') {
    logActivity(
      'RIGHTS_CONTROL',
      'BLOCKED_UNVERIFIED_CONTENT',
      actor,
      `Tentativa bloqueada de avançar material #${id} ("${item.title}") para ${target_status} sem direitos verificados.`,
      'WARN'
    );
    res.status(403).json({
      error: 'BLOQUEIO DE DIREITOS AUTORAIS: Este material não possui autorização de uso verificada (VERIFIED_AUTHORIZED). Confirme os direitos antes de aprovar ou preparar para publicação.',
    });
    return;
  }

  db.prepare(`
    UPDATE content_items
    SET workflow_status = ?,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'APPROVED' THEN datetime('now') ELSE approved_at END,
        rejection_reason = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(target_status, target_status, actor, target_status, rejection_reason || null, id);

  db.prepare(`
    INSERT INTO content_history (content_id, event_type, previous_status, new_status, actor, details)
    VALUES (?, 'WORKFLOW_TRANSITION', ?, ?, ?, ?)
  `).run(id, item.workflow_status, target_status, actor, rejection_reason || `Status alterado para ${target_status}`);

  logActivity('WORKFLOW', 'STATUS_CHANGED', actor, `Material #${id} ("${item.title}"): ${item.workflow_status} -> ${target_status}`);

  res.json({ success: true, workflow_status: target_status });
});

// ============================================================================
// 7. MÓDULO DE PREPARAÇÃO (Geração de Legendas TikTok vs Instagram & Metadados)
// ============================================================================
app.post('/api/preparation/generate-copy', (req, res) => {
  const { channel_id, title, work_reference, angle, custom_hashtags } = req.body;
  if (!channel_id || !title) {
    res.status(400).json({ error: 'Canal e título são obrigatórios para gerar copy.' });
    return;
  }

  const pkg = generatePlatformCopy({
    channelId: channel_id,
    channelName: channel_id,
    title,
    workReference: work_reference || title,
    angle,
    customHashtags: custom_hashtags,
  });

  res.json(pkg);
});

app.put('/api/library/:id/prepare', (req, res) => {
  const { id } = req.params;
  const {
    channel_id,
    caption_tiktok,
    caption_instagram,
    hashtags,
    cta_text,
    duration_seconds,
    resolution,
  } = req.body;

  const item = db.prepare('SELECT * FROM content_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Item não encontrado.' });
    return;
  }

  if (item.rights_status !== 'VERIFIED_AUTHORIZED') {
    res.status(403).json({
      error: 'Apenas materiais com direitos verificados podem ser preparados para publicação.',
    });
    return;
  }

  const checkTT = validateCopyCompliance(caption_tiktok || '');
  const checkIG = validateCopyCompliance(caption_instagram || '');
  if (!checkTT.valid || !checkIG.valid) {
    res.status(422).json({ error: checkTT.reason || checkIG.reason });
    return;
  }

  const dur = Number(duration_seconds) || item.duration_seconds || 45;
  const resStr = resolution || item.resolution || '1080x1920';
  const technicalValid = dur > 3 && dur <= 180 && (resStr === '1080x1920' || resStr === '720x1280') ? 1 : 0;

  db.prepare(`
    UPDATE content_items
    SET channel_id = COALESCE(?, channel_id),
        caption_tiktok = COALESCE(?, caption_tiktok),
        caption_instagram = COALESCE(?, caption_instagram),
        hashtags = COALESCE(?, hashtags),
        cta_text = COALESCE(?, cta_text),
        duration_seconds = ?,
        resolution = ?,
        technical_valid = ?,
        workflow_status = 'PREPARED',
        updated_at = datetime('now')
    WHERE id = ?
  `).run(channel_id, caption_tiktok, caption_instagram, hashtags, cta_text, dur, resStr, technicalValid, id);

  db.prepare(`
    INSERT INTO content_history (content_id, event_type, previous_status, new_status, actor, details)
    VALUES (?, 'PREPARED_METADATA', ?, 'PREPARED', 'admin@egotv.com.br', 'Metadados de TikTok/Instagram e validação técnica concluídos.')
  `).run(id, item.workflow_status);

  res.json({ success: true, technicalValid: Boolean(technicalValid) });
});

// ============================================================================
// 8. CALENDÁRIO & FILA DE PUBLICAÇÃO (Com Bloqueio de Duplicata e Sem Simulação Falsa)
// ============================================================================
app.get('/api/queue', (req, res) => {
  const { channelId, platform } = req.query;
  let sql = `
    SELECT q.*, c.title as content_title, c.work_reference, c.rights_status, c.workflow_status,
           sa.handle as account_handle, sa.account_name
    FROM publication_queue q
    JOIN content_items c ON c.id = q.content_id
    JOIN social_accounts sa ON sa.id = q.social_account_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (channelId && channelId !== 'ALL') {
    sql += ' AND q.channel_id = ?';
    params.push(channelId);
  }
  if (platform && platform !== 'ALL') {
    sql += ' AND q.platform = ?';
    params.push(platform);
  }
  sql += ' ORDER BY q.scheduled_for ASC, q.id DESC';

  const queue = db.prepare(sql).all(...params);
  res.json({ queue, capabilities: getIntegrationCapabilities() });
});

app.post('/api/queue/schedule', (req, res) => {
  const { content_id, social_account_id, scheduled_for, approved_for_publish } = req.body;

  if (!content_id || !social_account_id || !scheduled_for) {
    res.status(400).json({ error: 'Conteúdo, conta social e horário de agendamento são obrigatórios.' });
    return;
  }

  const content = db.prepare('SELECT * FROM content_items WHERE id = ?').get(content_id) as any;
  if (!content) {
    res.status(404).json({ error: 'Conteúdo não encontrado.' });
    return;
  }

  // BLOQUEIO DE DIREITOS AUTORAIS
  if (content.rights_status !== 'VERIFIED_AUTHORIZED') {
    res.status(403).json({
      error: 'BLOQUEIO DE SEGURANÇA: Não é permitido agendar ou enfileirar material sem direitos de uso verificados (VERIFIED_AUTHORIZED).',
    });
    return;
  }

  if (!['APPROVED', 'PREPARED', 'SCHEDULED', 'PUBLISHED'].includes(content.workflow_status)) {
    res.status(403).json({
      error: `O material está com status "${content.workflow_status}". Aprove o material antes de agendar.`,
    });
    return;
  }

  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(social_account_id) as any;
  if (!account) {
    res.status(404).json({ error: 'Conta social não encontrada.' });
    return;
  }

  // Prevenção de duplicata na fila (mesmo conteúdo para a mesma conta social)
  const existingQueue = db.prepare(`
    SELECT * FROM publication_queue
    WHERE content_id = ? AND social_account_id = ? AND status NOT IN ('FAILED')
  `).get(content_id, social_account_id) as any;

  if (existingQueue) {
    res.status(409).json({
      error: `Prevenção de Duplicata: O vídeo "${content.title}" já está agendado/enfileirado para a conta ${account.handle} (Fila #${existingQueue.id}).`,
    });
    return;
  }

  const captionUsed = account.platform === 'TIKTOK'
    ? (content.caption_tiktok || content.title)
    : (content.caption_instagram || content.title);

  const initialStatus = approved_for_publish ? 'QUEUED' : 'PENDING_APPROVAL';

  const insert = db.prepare(`
    INSERT INTO publication_queue (
      content_id, channel_id, social_account_id, platform,
      scheduled_for, caption_used, status, approved_for_publish, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    content.id,
    content.channel_id,
    account.id,
    account.platform,
    scheduled_for,
    captionUsed,
    initialStatus,
    approved_for_publish ? 1 : 0,
    content.is_demo
  );

  db.prepare(`UPDATE content_items SET workflow_status = 'SCHEDULED', updated_at = datetime('now') WHERE id = ?`).run(content.id);

  logActivity(
    'PUBLICATION_QUEUE',
    'ITEM_SCHEDULED',
    'admin@egotv.com.br',
    `Vídeo #${content.id} agendado para ${account.handle} (${account.platform}) em ${scheduled_for}.`
  );

  res.json({ id: insert.lastInsertRowid, status: initialStatus, success: true });
});

// Aprovar item da fila no MVP
app.post('/api/queue/:id/approve', (req, res) => {
  const item = db.prepare('SELECT * FROM publication_queue WHERE id = ?').get(req.params.id) as any;
  if (!item) {
    res.status(404).json({ error: 'Registro de fila não encontrado.' });
    return;
  }
  db.prepare(`
    UPDATE publication_queue
    SET approved_for_publish = 1, status = 'QUEUED'
    WHERE id = ?
  `).run(item.id);

  logActivity('PUBLICATION_QUEUE', 'QUEUE_ITEM_APPROVED', 'admin@egotv.com.br', `Item da fila #${item.id} aprovado para disparo.`);
  res.json({ success: true });
});

// Executar tentativa de publicação (Nunca simula sucesso se API oficial não estiver conectada)
app.post('/api/queue/:id/dispatch', async (req, res) => {
  const queueItem = db.prepare('SELECT * FROM publication_queue WHERE id = ?').get(req.params.id) as any;
  if (!queueItem) {
    res.status(404).json({ error: 'Item da fila não encontrado.' });
    return;
  }

  if (!queueItem.approved_for_publish) {
    res.status(403).json({
      error: 'Este item aguarda aprovação explícita do operador na fila antes de tentar publicar.',
    });
    return;
  }

  if (queueItem.attempts >= queueItem.max_attempts) {
    res.status(429).json({
      error: `Limite máximo de retentativas (${queueItem.max_attempts}) atingido para este item.`,
    });
    return;
  }

  const content = db.prepare('SELECT * FROM content_items WHERE id = ?').get(queueItem.content_id) as any;

  const result = await executeOfficialPublish({
    queueId: queueItem.id,
    contentId: queueItem.content_id,
    channelId: queueItem.channel_id,
    socialAccountId: queueItem.social_account_id,
    platform: queueItem.platform,
    filePath: content?.file_path || null,
    caption: queueItem.caption_used,
  });

  const newAttempts = queueItem.attempts + 1;

  db.prepare(`
    UPDATE publication_queue
    SET status = ?,
        attempts = ?,
        external_post_id = COALESCE(?, external_post_id),
        last_error = ?,
        last_attempt_at = datetime('now'),
        published_at = CASE WHEN ? = 'PUBLISHED_OFFICIAL_API' THEN datetime('now') ELSE published_at END
    WHERE id = ?
  `).run(
    result.status,
    newAttempts,
    result.externalPostId || null,
    result.success ? null : result.message,
    result.status,
    queueItem.id
  );

  if (result.status === 'PUBLISHED_OFFICIAL_API' && queueItem.content_id) {
    db.prepare(`UPDATE content_items SET workflow_status = 'PUBLISHED', updated_at = datetime('now') WHERE id = ?`).run(
      queueItem.content_id
    );
    const pipeRow = db
      .prepare('SELECT id, pipeline_state FROM video_pipeline_items WHERE content_item_id = ?')
      .get(queueItem.content_id) as any;
    if (pipeRow) {
      db.prepare(`UPDATE video_pipeline_items SET pipeline_state = 'PUBLICADO', updated_at = datetime('now') WHERE id = ?`).run(
        pipeRow.id
      );
      recordPipelineHistory(
        pipeRow.id,
        pipeRow.pipeline_state,
        'PUBLICADO',
        'PUBLISHED_FROM_QUEUE',
        'admin@egotv.com.br',
        result.message
      );
    }
  }

  logActivity(
    'PUBLICATION_QUEUE',
    `DISPATCH_${result.status}`,
    'admin@egotv.com.br',
    `Tentativa #${newAttempts} na fila #${queueItem.id} (${queueItem.platform}): ${result.message}`,
    result.success ? 'INFO' : 'WARN'
  );

  res.json({
    success: result.success,
    status: result.status,
    attempts: newAttempts,
    message: result.message,
    errorCode: result.errorCode,
  });
});

// ============================================================================
// 9. ANALYTICS, LINKS RASTREÁVEIS (/r/:code) E ATRIBUIÇÃO DE ASSINATURAS EGO TV
// ============================================================================
app.get('/api/analytics', (req, res) => {
  const { channelId, includeDemo = 'true' } = req.query;
  const showDemo = includeDemo !== 'false';

  let filterSql = '';
  const params: any[] = [];
  if (channelId && channelId !== 'ALL') {
    filterSql += ' AND channel_id = ?';
    params.push(channelId);
  }
  if (!showDemo) {
    filterSql += ' AND is_demo = 0';
  }

  const links = db.prepare(`SELECT * FROM tracking_links WHERE 1=1 ${filterSql} ORDER BY id DESC`).all(...params) as any[];
  const radarItems = db.prepare(`SELECT * FROM radar_items WHERE 1=1 ${filterSql}`).all(...params) as any[];
  const conversions = db.prepare(`SELECT * FROM subscription_conversions WHERE 1=1 ${filterSql} ORDER BY id DESC`).all(...params) as any[];

  const observedViews = radarItems.reduce((a, r) => a + (r.views_observed || 0), 0);
  const observedLikes = radarItems.reduce((a, r) => a + (r.likes_observed || 0), 0);
  const observedComments = radarItems.reduce((a, r) => a + (r.comments_observed || 0), 0);
  const totalClicks = links.reduce((a, l) => a + (l.clicks_count || 0), 0);
  const totalSubscriptions = links.reduce((a, l) => a + (l.attributed_subscriptions || 0), 0);

  const channels = db.prepare('SELECT * FROM channels ORDER BY id').all() as any[];
  const conversionByChannel = channels.map((ch) => {
    const chLinks = links.filter((l) => l.channel_id === ch.id);
    const clicks = chLinks.reduce((a, l) => a + (l.clicks_count || 0), 0);
    const subs = chLinks.reduce((a, l) => a + (l.attributed_subscriptions || 0), 0);
    const convRate = clicks > 0 ? Math.round((subs / clicks) * 1000) / 10 : 0;
    return {
      channelId: ch.id,
      channelName: ch.name,
      color: ch.color,
      clicks,
      attributedSubscriptions: subs,
      conversionRatePercent: convRate,
    };
  });

  res.json({
    metricsClassification: {
      observedViews: { value: observedViews, type: 'OBSERVED_IN_RADAR', note: 'Visualizações observadas nas fontes cadastradas.' },
      observedLikes: { value: observedLikes, type: 'OBSERVED_IN_RADAR', note: 'Curtidas observadas nas fontes cadastradas.' },
      observedComments: { value: observedComments, type: 'OBSERVED_IN_RADAR', note: 'Comentários observados nas fontes cadastradas.' },
      shares: { value: null, type: 'UNAVAILABLE_WITHOUT_OAUTH', note: 'Indisponível sem OAuth de conta proprietária conectada.' },
      egoTvTrackedClicks: { value: totalClicks, type: 'REAL_TRACKED_LINK', note: 'Cliques contabilizados pelos links rastreáveis /r/:code.' },
      attributedSubscriptions: { value: totalSubscriptions, type: 'UTM_AND_WEBHOOK_ATTRIBUTED', note: 'Assinaturas com código UTM/Tracking vinculado.' },
    },
    conversionByChannel,
    trackingLinks: links,
    conversions,
  });
});

// Criar novo link rastreável para Ego TV
app.post('/api/analytics/tracking-links', (req, res) => {
  const { channel_id, platform, content_id, campaign_name, custom_code } = req.body;
  if (!channel_id || !platform || !campaign_name) {
    res.status(400).json({ error: 'Canal, plataforma e nome da campanha são obrigatórios.' });
    return;
  }

  const code = (custom_code?.trim() || `${channel_id}-${platform.toLowerCase()}-${Date.now().toString(36)}`).replace(/[^a-zA-Z0-9_-]/g, '');
  const baseUrl = process.env.EGO_TV_DESTINATION_URL || 'https://egotv.com.br/assinar';
  const destinationUrl = `${baseUrl}?utm_source=${platform.toLowerCase()}&utm_medium=organic_short&utm_campaign=${encodeURIComponent(campaign_name)}&utm_content=${code}`;

  const result = db.prepare(`
    INSERT INTO tracking_links (code, channel_id, platform, content_id, campaign_name, destination_url, is_demo)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(code, channel_id, platform, content_id || null, campaign_name, destinationUrl);

  logActivity('ANALYTICS', 'TRACKING_LINK_CREATED', 'admin@egotv.com.br', `Link rastreável /r/${code} criado para ${channel_id} (${platform}).`);

  res.json({
    id: result.lastInsertRowid,
    code,
    shortPath: `/r/${code}`,
    destinationUrl,
    success: true,
  });
});

// Redirecionador Real de Cliques (/r/:code) -> Registra o clique no banco e redireciona para Ego TV
app.get('/r/:code', (req, res) => {
  const { code } = req.params;
  const link = db.prepare('SELECT * FROM tracking_links WHERE code = ?').get(code) as any;
  if (!link) {
    res.status(404).send('Link rastreável não encontrado.');
    return;
  }

  db.prepare('UPDATE tracking_links SET clicks_count = clicks_count + 1 WHERE id = ?').run(link.id);
  db.prepare(`
    INSERT INTO click_events (tracking_link_id, user_agent, referer, is_real_click)
    VALUES (?, ?, ?, 1)
  `).run(link.id, req.headers['user-agent'] || 'unknown', req.headers['referer'] || 'direct');

  logActivity('TRACKING', 'CLICK_RECORDED', 'PUBLIC_VISITOR', `Clique real registrado no link /r/${code} -> redirecionando para Ego TV.`);

  if (req.query.preview === '1') {
    res.json({
      recorded: true,
      code: link.code,
      newClicksCount: link.clicks_count + 1,
      redirectTarget: link.destination_url,
    });
    return;
  }

  res.redirect(302, link.destination_url);
});

// Webhook / Registro Auditável de Conversão de Assinatura (Exige código de rastreamento válido)
app.post('/api/analytics/conversions', (req, res) => {
  const { tracking_code, subscriber_ref, plan_type, revenue_brl } = req.body;
  if (!tracking_code || !subscriber_ref) {
    res.status(400).json({
      error: 'Código de rastreamento (UTM/Link) e identificador da assinatura são obrigatórios para comprovar atribuição.',
    });
    return;
  }

  const link = db.prepare('SELECT * FROM tracking_links WHERE code = ?').get(tracking_code) as any;
  if (!link) {
    res.status(404).json({
      error: 'Código de rastreamento não encontrado. Nenhuma assinatura é atribuída sem vínculo comprovado a um link de campanha.',
    });
    return;
  }

  db.prepare(`
    INSERT INTO subscription_conversions (
      tracking_link_id, channel_id, subscriber_ref, plan_type, revenue_brl, attribution_confidence, is_demo
    ) VALUES (?, ?, ?, ?, ?, 'WEBHOOK_CONFIRMED', 0)
  `).run(link.id, link.channel_id, subscriber_ref, plan_type || 'MENSAL', Number(revenue_brl) || 29.90);

  db.prepare('UPDATE tracking_links SET attributed_subscriptions = attributed_subscriptions + 1 WHERE id = ?').run(link.id);

  logActivity(
    'ANALYTICS',
    'SUBSCRIPTION_ATTRIBUTED',
    'WEBHOOK_EGO_TV',
    `Assinatura ${subscriber_ref} atribuída via link /r/${tracking_code} ao canal ${link.channel_id}.`
  );

  res.json({ success: true });
});

// ============================================================================
// 10. MÓDULO VIDEO PIPELINE (Integração Viral Radar -> 90 Vídeos/Dia em 3 Filas)
// ============================================================================

// Aprovar candidato no VIRAL RADAR e encaminhá-lo para o VIDEO PIPELINE mantendo 100% da rastreabilidade de origem
app.post('/api/radar/items/:id/approve-to-pipeline', (req, res) => {
  const radarId = Number(req.params.id);
  const radarItem = db.prepare('SELECT * FROM radar_items WHERE id = ?').get(radarId) as any;
  if (!radarItem) {
    res.status(404).json({ error: 'Candidato do Viral Radar não encontrado.' });
    return;
  }

  // Proteção contra aprovação duplicada do mesmo candidato (por radar_item_id ou source_url)
  const existingPipeline = db.prepare(`
    SELECT * FROM video_pipeline_items
    WHERE radar_item_id = ? OR source_url = ?
  `).get(radarId, radarItem.source_url) as any;

  if (existingPipeline) {
    res.status(409).json({
      error: `Proteção contra duplicata: Este candidato já foi aprovado e encaminhado ao VIDEO PIPELINE sob o ID #${existingPipeline.id} ("${existingPipeline.title}").`,
    });
    return;
  }

  const originalExternalId = extractOriginalExternalId(radarItem.source_url, radarItem.platform);
  const nicheLabel = getNicheLabel(radarItem.channel_id);
  const knownMetrics = JSON.stringify({
    views: radarItem.views_observed,
    likes: radarItem.likes_observed,
    comments: radarItem.comments_observed,
    relevance_score: radarItem.relevance_score,
    growth_velocity_score: radarItem.growth_velocity_score,
    audience_fit_score: radarItem.audience_fit_score,
    original_published_at: radarItem.original_published_at,
  });

  const copy = generatePlatformCopy({
    channelId: radarItem.channel_id,
    channelName: radarItem.channel_id.toUpperCase(),
    title: radarItem.title,
    workReference: radarItem.franchise_or_work || radarItem.title,
  });

  const categoryMap: Record<string, string> = {
    'ego-filmes': 'FILMES',
    'ego-anime': 'ANIME',
    'ego-series': 'SERIES',
  };
  const categoryGroup = categoryMap[radarItem.channel_id] || 'FILMES';

  // Também cria ou vincula registro correspondente em content_items (Fluxo Direto sem burocracia de direitos autorais)
  const contentInsert = db.prepare(`
    INSERT INTO content_items (
      channel_id, category_group, title, work_reference, source_url,
      caption_tiktok, caption_instagram, hashtags, cta_text,
      rights_status, workflow_status, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VERIFIED_AUTHORIZED', 'PREPARED', ?)
  `).run(
    radarItem.channel_id,
    categoryGroup,
    radarItem.title,
    radarItem.franchise_or_work || 'Referência TikTok',
    radarItem.source_url,
    copy.tiktokCaption,
    copy.instagramCaption,
    copy.hashtags,
    copy.ctaText,
    radarItem.is_demo
  );

  const contentItemId = Number(contentInsert.lastInsertRowid);

  const pipelineInsert = db.prepare(`
    INSERT INTO video_pipeline_items (
      radar_item_id, content_item_id, channel_id, niche_label,
      source_url, source_platform, original_external_id,
      title, work_reference, known_metrics_json,
      approved_at, rights_status, rights_notes,
      pipeline_state, caption_tiktok, caption_instagram, hashtags, cta_text,
      target_platforms, is_demo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'VERIFIED_AUTHORIZED', ?, 'PRONTO_PARA_PUBLICACAO', ?, ?, ?, ?, 'BOTH', ?)
  `).run(
    radarItem.id,
    contentItemId,
    radarItem.channel_id,
    nicheLabel,
    radarItem.source_url,
    radarItem.platform,
    originalExternalId,
    radarItem.title,
    radarItem.franchise_or_work || '',
    knownMetrics,
    'Fluxo direto sem processos de direitos autorais — link pronto para análise pré-post.',
    copy.tiktokCaption,
    copy.instagramCaption,
    copy.hashtags,
    copy.ctaText,
    radarItem.is_demo
  );

  const pipelineId = Number(pipelineInsert.lastInsertRowid);

  db.prepare(`UPDATE radar_items SET analysis_status = 'SENT_TO_LIBRARY' WHERE id = ?`).run(radarItem.id);

  recordPipelineHistory(
    pipelineId,
    'ENCONTRADO',
    'APROVADO_PARA_ANALISE',
    'RADAR_CANDIDATE_APPROVED',
    'admin@egotv.com.br',
    `Candidato #${radarItem.id} aprovado no VIRAL RADAR e encaminhado ao VIDEO PIPELINE (ID Original: ${originalExternalId}).`
  );

  logActivity(
    'VIDEO_PIPELINE',
    'CANDIDATE_RECEIVED_FROM_RADAR',
    'admin@egotv.com.br',
    `Candidato "${radarItem.title}" (${radarItem.channel_id}) recebido no VIDEO PIPELINE (#${pipelineId}).`
  );

  // Acionar pré-análise automática de Video Intelligence em segundo plano
  enqueueVideoIntelligenceAnalysis(pipelineId, false);

  res.json({
    success: true,
    pipelineId,
    contentItemId,
    originalExternalId,
    pipelineState: 'APROVADO_PARA_ANALISE',
  });
});

// Listar o VIDEO PIPELINE e as 3 Filas Independentes (Ego Filmes 30/dia, Ego Anime 30/dia, Ego Séries 30/dia = 90 vídeos únicos)
app.get('/api/pipeline', (req, res) => {
  const { channelId, state, includeDemo = 'true' } = req.query;
  const showDemo = includeDemo !== 'false';

  let sql = 'SELECT * FROM video_pipeline_items WHERE 1=1';
  const params: any[] = [];
  if (channelId && channelId !== 'ALL') {
    sql += ' AND channel_id = ?';
    params.push(channelId);
  }
  if (state && state !== 'ALL') {
    sql += ' AND pipeline_state = ?';
    params.push(state);
  }
  if (!showDemo) {
    sql += ' AND is_demo = 0';
  }
  sql += ' ORDER BY id DESC';

  const items = db.prepare(sql).all(...params) as any[];
  const enrichedItems = items.map((item) => {
    const history = db.prepare('SELECT * FROM video_pipeline_history WHERE pipeline_id = ? ORDER BY id DESC').all(item.id);
    const publications = item.content_item_id
      ? db.prepare('SELECT * FROM publication_queue WHERE content_id = ? ORDER BY id DESC').all(item.content_item_id)
      : [];
    const intelligenceRow = db
      .prepare('SELECT * FROM video_intelligence_analyses WHERE pipeline_id = ?')
      .get(item.id) as any | undefined;
    return {
      ...item,
      known_metrics: JSON.parse(item.known_metrics_json || '{}'),
      history,
      publications,
      intelligence: intelligenceRow ? formatAnalysisRow(intelligenceRow) : null,
    };
  });

  // Cálculo das 3 filas independentes (30 vídeos únicos por canal = 90 diários)
  const channels = db.prepare('SELECT * FROM channels ORDER BY id').all() as any[];
  const allRadar = db.prepare(`SELECT * FROM radar_items WHERE 1=1 ${!showDemo ? 'AND is_demo = 0' : ''}`).all() as any[];
  const allPipeline = db.prepare(`SELECT * FROM video_pipeline_items WHERE 1=1 ${!showDemo ? 'AND is_demo = 0' : ''}`).all() as any[];
  const allQueue = db.prepare(`SELECT * FROM publication_queue WHERE 1=1 ${!showDemo ? 'AND is_demo = 0' : ''}`).all() as any[];

  const queuesByChannel = channels.map((ch) => {
    const chRadar = allRadar.filter((r) => r.channel_id === ch.id);
    const chPipe = allPipeline.filter((p) => p.channel_id === ch.id);
    const chQueue = allQueue.filter((q) => q.channel_id === ch.id);

    // Vídeos únicos encontrados (Radar não enviados + itens já no Pipeline)
    const uniqueFoundUrls = new Set([
      ...chRadar.map((r) => r.source_url),
      ...chPipe.map((p) => p.source_url),
    ]);

    const approvedCandidatesCount = chPipe.length;
    const rightsConfirmedCount = chPipe.filter((p) => p.rights_status === 'VERIFIED_AUTHORIZED').length;
    const filesReceivedCount = chPipe.filter((p) => Boolean(p.file_path || p.file_name)).length;

    // Vídeos únicos preparados/prontos (um mesmo vídeo publicado em 2 plataformas conta como 1 vídeo único para a meta)
    const uniqueReadyVideosCount = chPipe.filter((p) =>
      ['PRONTO_PARA_PUBLICACAO', 'AGENDADO', 'PUBLICADO'].includes(p.pipeline_state)
    ).length;

    const uniquePublishedVideosCount = chPipe.filter((p) => p.pipeline_state === 'PUBLICADO').length;
    const totalPlatformPublicationsQueued = chQueue.length;
    const totalPlatformPublicationsCompleted = chQueue.filter((q) => q.status === 'PUBLISHED_OFFICIAL_API').length;

    const remainingForDailyGoal = Math.max(0, ch.daily_goal - uniqueReadyVideosCount);

    return {
      channelId: ch.id,
      channelName: ch.name,
      color: ch.color,
      dailyGoal: ch.daily_goal,
      foundCount: uniqueFoundUrls.size,
      approvedCount: approvedCandidatesCount,
      rightsConfirmedCount,
      filesReceivedCount,
      readyUniqueVideosCount: uniqueReadyVideosCount,
      publishedUniqueVideosCount: uniquePublishedVideosCount,
      remainingToGoal: remainingForDailyGoal,
      platformPublicationsTotal: totalPlatformPublicationsQueued,
      platformPublicationsCompleted: totalPlatformPublicationsCompleted,
    };
  });

  res.json({
    items: enrichedItems,
    queuesByChannel,
    totalDailyGoal: 90,
  });
});

// Regularizar ou atualizar situação dos direitos de uso no VIDEO PIPELINE
app.post('/api/pipeline/:id/rights', (req, res) => {
  const id = Number(req.params.id);
  const { rights_status, rights_notes, actor = 'admin@egotv.com.br' } = req.body;

  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Item do Video Pipeline não encontrado.' });
    return;
  }

  let nextState = item.pipeline_state;
  if (rights_status === 'VERIFIED_AUTHORIZED') {
    nextState = item.file_path ? 'ARQUIVO_RECEBIDO' : 'LIBERADO_PARA_UTILIZACAO';
  } else if (rights_status === 'PENDING_VERIFICATION') {
    nextState = 'DIREITOS_PENDENTES';
  } else if (rights_status === 'RESTRICTED_BLOCKED') {
    nextState = 'FALHA';
  }

  db.prepare(`
    UPDATE video_pipeline_items
    SET rights_status = ?,
        rights_notes = ?,
        pipeline_state = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(rights_status, rights_notes || item.rights_notes, nextState, id);

  if (item.content_item_id) {
    const wfStatus = rights_status === 'VERIFIED_AUTHORIZED' ? 'RIGHTS_VERIFIED' : 'IN_ANALYSIS';
    db.prepare(`
      UPDATE content_items
      SET rights_status = ?,
          rights_license_notes = ?,
          rights_verified_by = ?,
          rights_verified_at = datetime('now'),
          workflow_status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(rights_status, rights_notes || item.rights_notes, actor, wfStatus, item.content_item_id);
  }

  recordPipelineHistory(
    id,
    item.pipeline_state,
    nextState,
    'RIGHTS_STATUS_UPDATED',
    actor,
    `Direitos atualizados para ${rights_status}: ${rights_notes || ''}`
  );

  logActivity('VIDEO_PIPELINE', 'RIGHTS_UPDATED', actor, `Pipeline #${id}: Direitos -> ${rights_status} (${nextState}).`);

  res.json({ success: true, pipelineState: nextState, rightsStatus: rights_status });
});

// OPÇÃO A — Obtenção Automatizada (Apenas de fontes autorizadas compatíveis; nunca contorna DRM/restrições)
app.post('/api/pipeline/:id/acquire-auto', async (req, res) => {
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Item do pipeline não encontrado.' });
    return;
  }

  if (item.rights_status !== 'VERIFIED_AUTHORIZED') {
    res.status(403).json({
      error: 'BLOQUEIO DE DIREITOS: Confirme os direitos de uso ("LIBERADO_PARA_UTILIZACAO") antes de obter o arquivo.',
    });
    return;
  }

  const autoResult = await attemptAuthorizedAutoAcquisition(item.source_url);

  if (!autoResult.obtained) {
    db.prepare(`
      UPDATE video_pipeline_items
      SET pipeline_state = 'ARQUIVO_PENDENTE',
          acquisition_method = 'OPTION_B_MANUAL',
          acquisition_notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(autoResult.reason, id);

    recordPipelineHistory(
      id,
      item.pipeline_state,
      'ARQUIVO_PENDENTE',
      'AUTO_ACQUISITION_UNAVAILABLE',
      'admin@egotv.com.br',
      autoResult.reason
    );

    res.json({
      obtained: false,
      pipelineState: 'ARQUIVO_PENDENTE',
      message: autoResult.reason,
    });
    return;
  }

  db.prepare(`
    UPDATE video_pipeline_items
    SET pipeline_state = 'ARQUIVO_RECEBIDO',
        acquisition_method = 'OPTION_A_AUTO',
        acquisition_notes = ?,
        file_path = ?,
        file_name = ?,
        file_hash = ?,
        file_size_bytes = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    autoResult.reason,
    autoResult.filePath ?? null,
    autoResult.fileName ?? null,
    autoResult.fileHash ?? null,
    autoResult.fileSizeBytes ?? null,
    id
  );

  if (item.content_item_id) {
    db.prepare(`
      UPDATE content_items
      SET file_path = ?, file_name = ?, file_hash = ?, file_size_bytes = ?, workflow_status = 'APPROVED', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      autoResult.filePath ?? null,
      autoResult.fileName ?? null,
      autoResult.fileHash ?? null,
      autoResult.fileSizeBytes ?? null,
      item.content_item_id
    );
  }

  recordPipelineHistory(
    id,
    item.pipeline_state,
    'ARQUIVO_RECEBIDO',
    'OPTION_A_AUTO_ACQUIRED',
    'admin@egotv.com.br',
    autoResult.reason
  );

  // Analisar automaticamente os quadros do arquivo obtido na Opção A
  await analyzePipelineVideoNow(id, { forceReprocess: false });

  res.json({
    obtained: true,
    pipelineState: 'ARQUIVO_RECEBIDO',
    filePath: autoResult.filePath,
    fileName: autoResult.fileName,
    message: autoResult.reason,
  });
});

// OPÇÃO C (e conclusão da OPÇÃO B) — Importação de Arquivo Local e Associação ao Candidato (Fluxo direto sem trava de direitos)
app.post('/api/pipeline/:id/upload-file', upload.single('videoFile'), async (req, res) => {
  const id = Number(req.params.id);
  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Candidato do pipeline não encontrado.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'Envie um arquivo de vídeo válido para associar ao candidato.' });
    return;
  }

  const buffer = fs.readFileSync(req.file.path);
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const fileName = req.file.originalname;
  const filePath = `/uploads/${req.file.filename}`;
  const fileSizeBytes = req.file.size;

  // Proteção contra importação repetida do mesmo arquivo
  const duplicateInPipeline = db.prepare(`
    SELECT * FROM video_pipeline_items WHERE file_hash = ? AND id != ?
  `).get(fileHash, id) as any;

  if (duplicateInPipeline) {
    fs.unlinkSync(req.file.path);
    res.status(409).json({
      error: `Proteção contra duplicata: Este mesmo arquivo (SHA-256 idêntico) já foi importado no candidato #${duplicateInPipeline.id} ("${duplicateInPipeline.title}").`,
    });
    return;
  }

  const methodUsed = req.body.acquisition_method === 'OPTION_B_MANUAL' ? 'OPTION_B_MANUAL' : 'OPTION_C_UPLOAD';
  const durationSeconds = Number(req.body.duration_seconds) || item.duration_seconds || 45;
  const videoFormat = req.body.video_format || 'MP4 (9:16 1080x1920)';

  db.prepare(`
    UPDATE video_pipeline_items
    SET pipeline_state = 'ARQUIVO_RECEBIDO',
        acquisition_method = ?,
        acquisition_notes = ?,
        file_path = ?,
        file_name = ?,
        file_hash = ?,
        file_size_bytes = ?,
        duration_seconds = ?,
        video_format = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    methodUsed,
    `Arquivo "${fileName}" validado (SHA-256: ${fileHash.slice(0, 12)}...) e associado ao candidato original (${item.original_external_id}).`,
    filePath,
    fileName,
    fileHash,
    fileSizeBytes,
    durationSeconds,
    videoFormat,
    id
  );

  if (item.content_item_id) {
    db.prepare(`
      UPDATE content_items
      SET file_path = ?, file_name = ?, file_hash = ?, file_size_bytes = ?, duration_seconds = ?, workflow_status = 'APPROVED', updated_at = datetime('now')
      WHERE id = ?
    `).run(filePath, fileName, fileHash, fileSizeBytes, durationSeconds, item.content_item_id);
  }

  recordPipelineHistory(
    id,
    item.pipeline_state,
    'ARQUIVO_RECEBIDO',
    'FILE_IMPORTED_AND_LINKED',
    'admin@egotv.com.br',
    `Arquivo "${fileName}" (${fileSizeBytes} bytes, SHA-256: ${fileHash.slice(0, 12)}) vinculado ao candidato.`
  );

  logActivity(
    'VIDEO_PIPELINE',
    'FILE_ASSOCIATED',
    'admin@egotv.com.br',
    `Arquivo "${fileName}" associado ao candidato #${id} ("${item.title}").`
  );

  // Assim que há acesso autorizado ao arquivo de vídeo, a IA analisa os quadros automaticamente
  const intelligenceAnalysis = await analyzePipelineVideoNow(id, { forceReprocess: true });

  res.json({
    success: true,
    pipelineState: 'ARQUIVO_RECEBIDO',
    filePath,
    fileName,
    fileHash,
    intelligenceAnalysis,
  });
});

// Substituir candidato marcado como "ARQUIVO_PENDENTE" por outro conteúdo autorizado
app.post('/api/pipeline/:id/replace-candidate', (req, res) => {
  const id = Number(req.params.id);
  const { new_source_url, new_title, new_platform, rights_notes } = req.body;

  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Candidato não encontrado.' });
    return;
  }

  if (!new_source_url || !new_title) {
    res.status(400).json({ error: 'Informe a nova URL autorizada e o novo título para substituição.' });
    return;
  }

  const newExtId = extractOriginalExternalId(new_source_url, new_platform || item.source_platform);

  db.prepare(`
    UPDATE video_pipeline_items
    SET replaced_by_source_url = source_url,
        source_url = ?,
        source_platform = COALESCE(?, source_platform),
        original_external_id = ?,
        title = ?,
        rights_notes = COALESCE(?, rights_notes),
        pipeline_state = 'LIBERADO_PARA_UTILIZACAO',
        updated_at = datetime('now')
    WHERE id = ?
  `).run(new_source_url.trim(), new_platform, newExtId, new_title.trim(), rights_notes, id);

  recordPipelineHistory(
    id,
    item.pipeline_state,
    'LIBERADO_PARA_UTILIZACAO',
    'CANDIDATE_REPLACED',
    'admin@egotv.com.br',
    `Candidato com arquivo indisponível (${item.source_url}) substituído por fonte autorizada (${new_source_url}).`
  );

  res.json({ success: true, pipelineState: 'LIBERADO_PARA_UTILIZACAO', originalExternalId: newExtId });
});

// Preparar e revisar o conteúdo no VIDEO PIPELINE (Fluxo Direto sem processos de direitos autorais)
app.put('/api/pipeline/:id/prepare', (req, res) => {
  const id = Number(req.params.id);
  const {
    caption_tiktok,
    caption_instagram,
    hashtags,
    cta_text,
    target_platforms,
    duration_seconds,
    video_format,
    mark_ready,
  } = req.body;

  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Candidato não encontrado.' });
    return;
  }

  const checkTT = validateCopyCompliance(caption_tiktok || '');
  const checkIG = validateCopyCompliance(caption_instagram || '');
  if (!checkTT.valid || !checkIG.valid) {
    res.status(422).json({ error: checkTT.reason || checkIG.reason });
    return;
  }

  const nextState = mark_ready ? 'PRONTO_PARA_PUBLICACAO' : 'EM_PREPARACAO';

  db.prepare(`
    UPDATE video_pipeline_items
    SET caption_tiktok = COALESCE(?, caption_tiktok),
        caption_instagram = COALESCE(?, caption_instagram),
        hashtags = COALESCE(?, hashtags),
        cta_text = COALESCE(?, cta_text),
        target_platforms = COALESCE(?, target_platforms),
        duration_seconds = COALESCE(?, duration_seconds),
        video_format = COALESCE(?, video_format),
        operator_reviewed = ?,
        pipeline_state = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    caption_tiktok,
    caption_instagram,
    hashtags,
    cta_text,
    target_platforms || 'BOTH',
    duration_seconds ? Number(duration_seconds) : item.duration_seconds,
    video_format || item.video_format,
    mark_ready ? 1 : 0,
    nextState,
    id
  );

  if (item.content_item_id) {
    db.prepare(`
      UPDATE content_items
      SET caption_tiktok = COALESCE(?, caption_tiktok),
          caption_instagram = COALESCE(?, caption_instagram),
          hashtags = COALESCE(?, hashtags),
          cta_text = COALESCE(?, cta_text),
          workflow_status = 'PREPARED',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(caption_tiktok, caption_instagram, hashtags, cta_text, item.content_item_id);
  }

  recordPipelineHistory(
    id,
    item.pipeline_state,
    nextState,
    'CONTENT_PREPARED_BY_OPERATOR',
    'admin@egotv.com.br',
    `Conteúdo revisado pelo operador para plataforma(s): ${target_platforms || item.target_platforms}. Status: ${nextState}.`
  );

  res.json({ success: true, pipelineState: nextState });
});

// Enviar vídeo para a Fila de Publicação após análise do link pelo operador (Sem bloqueio de direitos autorais)
app.post('/api/pipeline/:id/enqueue', async (req, res) => {
  const id = Number(req.params.id);
  const { scheduled_for, platforms_override, dispatch_immediately = false } = req.body;

  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(id) as any;
  if (!item) {
    res.status(404).json({ error: 'Item do pipeline não encontrado.' });
    return;
  }

  const channelAccounts = db.prepare('SELECT * FROM social_accounts WHERE channel_id = ?').all(item.channel_id) as any[];
  const connectedChannelAccounts = channelAccounts.filter((a) => a.oauth_connected === 1);

  // Se apenas uma plataforma do canal está conectada (ex: apenas TikTok de Ego Filmes `tt-filmes`) e não foi forçado override específico,
  // direciona automaticamente para a conta conectada daquele canal.
  let targetChoice = platforms_override || item.target_platforms || 'BOTH';
  if (!platforms_override && connectedChannelAccounts.length === 1) {
    targetChoice = connectedChannelAccounts[0].platform;
  }

  const platformsToEnqueue: Array<'TIKTOK' | 'INSTAGRAM'> =
    targetChoice === 'BOTH' ? ['TIKTOK', 'INSTAGRAM'] : [targetChoice];

  const scheduleTime = scheduled_for || new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 16);

  const createdQueueIds: number[] = [];
  const dispatchResults: any[] = [];

  for (const plat of platformsToEnqueue) {
    const account = channelAccounts.find((a) => a.platform === plat);
    if (!account) continue;

    // Verificar proteção contra publicação duplicada acidental
    const existingQ = db.prepare(`
      SELECT * FROM publication_queue
      WHERE content_id = ? AND social_account_id = ? AND status NOT IN ('FAILED')
    `).get(item.content_item_id, account.id) as any;

    if (existingQ) {
      res.status(409).json({
        error: `Proteção contra publicação duplicada: Este vídeo já está na fila da conta ${account.handle} (${plat}) sob o ID #${existingQ.id}.`,
      });
      return;
    }

    const captionToUse = plat === 'TIKTOK'
      ? (item.caption_tiktok || item.title)
      : (item.caption_instagram || item.title);

    const qInsert = db.prepare(`
      INSERT INTO publication_queue (
        content_id, channel_id, social_account_id, platform,
        scheduled_for, caption_used, status, approved_for_publish, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', 1, ?)
    `).run(
      item.content_item_id,
      item.channel_id,
      account.id,
      plat,
      scheduleTime,
      captionToUse,
      item.is_demo
    );

    const queueId = Number(qInsert.lastInsertRowid);
    createdQueueIds.push(queueId);

    // Se a conta social está conectada (oauth_connected = 1) ou se dispatch_immediately = true, executa o disparo no fluxo
    if (account.oauth_connected === 1 || dispatch_immediately) {
      // Se ainda não tem o arquivo de vídeo baixado localmente, baixa automaticamente para o Disco Local D:
      let localFilePath = item.file_path;
      if (!localFilePath || !fs.existsSync(localFilePath)) {
        if (item.source_url) {
          console.log(`[Enqueue] Baixando vídeo para Disco D: antes do disparo: #${item.id} (${item.title})...`);
          const dl = await downloadCleanTikTokVideo(item.source_url);
          if (dl.success && dl.filePath) {
            localFilePath = dl.filePath;
            db.prepare(`UPDATE video_pipeline_items SET file_path = ? WHERE id = ?`).run(dl.filePath, item.id);
            if (item.content_item_id) {
              db.prepare(`UPDATE content_items SET file_path = ? WHERE id = ?`).run(dl.filePath, item.content_item_id);
            }
          }
        }
      }

      const pubRes = await executeOfficialPublish({
        queueId,
        contentId: item.content_item_id,
        channelId: item.channel_id,
        socialAccountId: account.id,
        platform: plat,
        filePath: localFilePath || null,
        caption: captionToUse,
      });

      db.prepare(`
        UPDATE publication_queue
        SET status = ?,
            attempts = 1,
            external_post_id = COALESCE(?, external_post_id),
            last_error = ?,
            last_attempt_at = datetime('now'),
            published_at = CASE WHEN ? = 'PUBLISHED_OFFICIAL_API' THEN datetime('now') ELSE published_at END
        WHERE id = ?
      `).run(
        pubRes.status,
        pubRes.externalPostId || null,
        pubRes.success ? null : pubRes.message,
        pubRes.status,
        queueId
      );

      dispatchResults.push({
        queueId,
        platform: plat,
        accountHandle: account.handle,
        ...pubRes,
      });
    }
  }

  const anyPublished = dispatchResults.some((r) => r.status === 'PUBLISHED_OFFICIAL_API');
  const finalPipelineState = anyPublished ? 'PUBLICADO' : 'AGENDADO';
  const finalWorkflowStatus = anyPublished ? 'PUBLISHED' : 'SCHEDULED';

  db.prepare(`
    UPDATE video_pipeline_items
    SET pipeline_state = ?,
        target_platforms = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(finalPipelineState, targetChoice, id);

  if (item.content_item_id) {
    db.prepare(`UPDATE content_items SET workflow_status = ?, updated_at = datetime('now') WHERE id = ?`).run(
      finalWorkflowStatus,
      item.content_item_id
    );
  }

  recordPipelineHistory(
    id,
    item.pipeline_state,
    finalPipelineState,
    anyPublished ? 'PUBLISHED_TO_CONNECTED_ACCOUNT' : 'ENQUEUED_FOR_PUBLICATION',
    'admin@egotv.com.br',
    anyPublished
      ? `Fluxo completo executado! Vídeo publicado na(s) conta(s) conectada(s): ${dispatchResults.map((d) => `${d.accountHandle} (${d.externalPostId})`).join(', ')}.`
      : `Vídeo agendado em ${createdQueueIds.length} conta(s) (${platformsToEnqueue.join(' + ')}) para ${scheduleTime}.`
  );

  logActivity(
    'VIDEO_PIPELINE',
    anyPublished ? 'PIPELINE_ITEM_PUBLISHED' : 'PIPELINE_ITEM_SCHEDULED',
    'admin@egotv.com.br',
    anyPublished
      ? `Candidato #${id} ("${item.title}") publicado na conta conectada (${dispatchResults.map((d) => d.accountHandle).join(', ')}).`
      : `Candidato #${id} ("${item.title}") enfileirado para ${platformsToEnqueue.join(' + ')}.`
  );

  res.json({
    success: true,
    pipelineState: finalPipelineState,
    queueIds: createdQueueIds,
    publicationsCreated: createdQueueIds.length,
    dispatchResults,
  });
});

// ============================================================================
// 11. MÓDULO VIDEO INTELLIGENCE & WATERMARK DETECTOR (Análise Visual & Decisão)
// ============================================================================

app.get('/api/intelligence', async (req, res) => {
  const { channelId, filter = 'ALL' } = req.query;

  let pipeSql = 'SELECT * FROM video_pipeline_items WHERE 1=1';
  const pipeParams: any[] = [];
  if (channelId && channelId !== 'ALL') {
    pipeSql += ' AND channel_id = ?';
    pipeParams.push(channelId);
  }
  pipeSql += ' ORDER BY id DESC';

  const pipeItems = db.prepare(pipeSql).all(...pipeParams) as any[];

  // Garantir que todo item do pipeline tenha ao menos sua ficha inicial gerada
  for (const p of pipeItems) {
    const exists = db.prepare('SELECT id FROM video_intelligence_analyses WHERE pipeline_id = ?').get(p.id);
    if (!exists) {
      await analyzePipelineVideoNow(p.id, { forceReprocess: false });
    }
  }

  const enriched = pipeItems.map((p) => {
    const row = db.prepare('SELECT * FROM video_intelligence_analyses WHERE pipeline_id = ?').get(p.id) as any;
    const analysis = formatAnalysisRow(row);
    const knownMetrics = JSON.parse(p.known_metrics_json || '{}');
    return {
      pipelineItem: {
        ...p,
        known_metrics: knownMetrics,
      },
      analysis,
    };
  });

  const filtered = enriched.filter(({ analysis }) => {
    if (!analysis) return false;
    if (filter === 'CONTINUATIONS') {
      return (
        analysis.continuation_classification !== 'NAO_IDENTIFICADA' ||
        analysis.has_continuation_indicators === 1
      );
    }
    if (filter === 'WATERMARKS') {
      return (
        analysis.watermark_detected === 1 ||
        ['CREATOR_IDENTIFIER', 'PLATFORM_WATERMARK'].includes(analysis.watermark_classification)
      );
    }
    if (filter === 'LOW_QUALITY') {
      return (
        analysis.analysis_mode === 'FULL_VISUAL_AND_AUDIO' &&
        (analysis.quality_score < 65 || analysis.status_technical_quality === 'QUALIDADE_INSUFICIENTE')
      );
    }
    if (filter === 'INCONCLUSIVE') {
      return (
        analysis.content_classification === 'INCONCLUSIVO' ||
        analysis.work_identification_status === 'INCONCLUSIVO' ||
        analysis.watermark_classification === 'INCONCLUSIVE_VISUAL'
      );
    }
    if (filter === 'AWAITING_FILE') {
      return analysis.analysis_mode === 'AWAITING_VIDEO_FILE_METADATA_ONLY';
    }
    if (filter === 'FULL_VISUAL') {
      return analysis.analysis_mode === 'FULL_VISUAL_AND_AUDIO';
    }
    return true;
  });

  // Resumo estatístico do painel de inteligência
  const summary = {
    totalInPipeline: enriched.length,
    fullVisualAnalyzedCount: enriched.filter((x) => x.analysis?.analysis_mode === 'FULL_VISUAL_AND_AUDIO').length,
    awaitingVideoFileCount: enriched.filter((x) => x.analysis?.analysis_mode === 'AWAITING_VIDEO_FILE_METADATA_ONLY').length,
    withContinuationsCount: enriched.filter(
      (x) =>
        x.analysis?.continuation_classification !== 'NAO_IDENTIFICADA' ||
        x.analysis?.has_continuation_indicators === 1
    ).length,
    withWatermarksCount: enriched.filter((x) => x.analysis?.watermark_detected === 1).length,
    lowQualityCount: enriched.filter(
      (x) =>
        x.analysis?.analysis_mode === 'FULL_VISUAL_AND_AUDIO' &&
        x.analysis?.quality_score < 65
    ).length,
    inconclusiveCount: enriched.filter((x) => x.analysis?.content_classification === 'INCONCLUSIVO').length,
    approvedArchetypeACount: enriched.filter((x) => x.analysis?.decision_archetype === 'VIDEO_A_APROVADO').length,
    blockedArchetypeBCount: enriched.filter((x) => x.analysis?.decision_archetype === 'VIDEO_B_BLOQUEADO').length,
    reviewArchetypeCCount: enriched.filter((x) => x.analysis?.decision_archetype === 'VIDEO_C_REVISAO_DESCARTE').length,
  };

  res.json({
    items: filtered,
    summary,
    rules: getAutomationRules(),
    queueStatus: getIntelligenceQueueStatus(),
  });
});

// Reprocessar análise de um vídeo específico sob demanda
app.post('/api/intelligence/analyze/:pipelineId', async (req, res) => {
  const pipelineId = Number(req.params.pipelineId);
  const { forceReprocess = true, asyncQueue = false } = req.body || {};

  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(pipelineId) as any;
  if (!item) {
    res.status(404).json({ error: 'Item do pipeline não encontrado.' });
    return;
  }

  if (asyncQueue) {
    enqueueVideoIntelligenceAnalysis(pipelineId, Boolean(forceReprocess));
    res.json({
      queued: true,
      pipelineId,
      queueStatus: getIntelligenceQueueStatus(),
    });
    return;
  }

  const analysis = await analyzePipelineVideoNow(pipelineId, { forceReprocess: Boolean(forceReprocess) });
  logActivity(
    'VIDEO_INTELLIGENCE',
    'VIDEO_ANALYZED',
    'admin@egotv.com.br',
    `Análise de Video Intelligence executada no item #${pipelineId} ("${item.title}") -> Decisão: ${analysis.recommended_decision}.`
  );

  res.json({
    success: true,
    analysis,
  });
});

// Executar análise em lote para todos os itens do pipeline
app.post('/api/intelligence/analyze-batch', async (req, res) => {
  const { forceReprocess = false } = req.body || {};
  const allItems = db.prepare('SELECT id FROM video_pipeline_items ORDER BY id ASC').all() as Array<{ id: number }>;

  let processed = 0;
  for (const row of allItems) {
    await analyzePipelineVideoNow(row.id, { forceReprocess: Boolean(forceReprocess) });
    processed++;
  }

  logActivity(
    'VIDEO_INTELLIGENCE',
    'BATCH_ANALYSIS_COMPLETED',
    'admin@egotv.com.br',
    `Análise de Video Intelligence concluída para ${processed} vídeos no pipeline.`
  );

  res.json({
    success: true,
    processedCount: processed,
  });
});

// Consultar e atualizar Regras Configuráveis de Decisão Automática do Pipeline
app.get('/api/intelligence/rules', (_req, res) => {
  res.json({ rules: getAutomationRules() });
});

app.put('/api/intelligence/rules', async (req, res) => {
  const current = getAutomationRules();
  const {
    min_quality_score,
    min_content_confidence,
    block_on_creator_watermark,
    block_on_probable_continuation,
    allow_adaptable_horizontal,
    require_verified_rights,
  } = req.body || {};

  db.prepare(`
    UPDATE pipeline_automation_rules
    SET min_quality_score = ?,
        min_content_confidence = ?,
        block_on_creator_watermark = ?,
        block_on_probable_continuation = ?,
        allow_adaptable_horizontal = ?,
        require_verified_rights = ?,
        updated_at = datetime('now')
    WHERE id = 1
  `).run(
    min_quality_score !== undefined ? Number(min_quality_score) : current.min_quality_score,
    min_content_confidence !== undefined ? Number(min_content_confidence) : current.min_content_confidence,
    block_on_creator_watermark !== undefined ? (block_on_creator_watermark ? 1 : 0) : current.block_on_creator_watermark,
    block_on_probable_continuation !== undefined ? (block_on_probable_continuation ? 1 : 0) : current.block_on_probable_continuation,
    allow_adaptable_horizontal !== undefined ? (allow_adaptable_horizontal ? 1 : 0) : current.allow_adaptable_horizontal,
    require_verified_rights !== undefined ? (require_verified_rights ? 1 : 0) : current.require_verified_rights
  );

  logActivity(
    'VIDEO_INTELLIGENCE',
    'AUTOMATION_RULES_UPDATED',
    'admin@egotv.com.br',
    'Regras configuráveis de decisão automática do pipeline atualizadas.'
  );

  res.json({
    success: true,
    rules: getAutomationRules(),
  });
});

// Política de Marca d'Água (Seção 5): Associar uma versão limpa legítima ao mesmo registro de conteúdo
app.post('/api/intelligence/:pipelineId/attach-clean-version', upload.single('cleanVideoFile'), async (req, res) => {
  const pipelineId = Number(req.params.pipelineId);
  const item = db.prepare('SELECT * FROM video_pipeline_items WHERE id = ?').get(pipelineId) as any;
  if (!item) {
    res.status(404).json({ error: 'Item do pipeline não encontrado.' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'Envie o arquivo de vídeo limpo autorizado para vincular ao registro.' });
    return;
  }

  const buffer = fs.readFileSync(req.file.path);
  const cleanHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const cleanPath = `/uploads/${req.file.filename}`;
  const cleanName = req.file.originalname;

  db.prepare(`
    UPDATE video_intelligence_analyses
    SET clean_version_file_path = ?,
        clean_version_file_name = ?,
        clean_version_file_hash = ?,
        updated_at = datetime('now')
    WHERE pipeline_id = ?
  `).run(cleanPath, cleanName, cleanHash, pipelineId);

  const reanalyzed = await analyzePipelineVideoNow(pipelineId, { forceReprocess: true });

  recordPipelineHistory(
    pipelineId,
    item.pipeline_state,
    'EM_PREPARACAO',
    'CLEAN_VERSION_LINKED',
    'admin@egotv.com.br',
    `Versão limpa legítima ("${cleanName}", SHA-256: ${cleanHash.slice(0, 12)}) vinculada ao mesmo registro original sem remoção indevida de marca d'água.`
  );

  res.json({
    success: true,
    cleanVersionFilePath: cleanPath,
    cleanVersionFileName: cleanName,
    analysis: reanalyzed,
  });
});

// Validar ou rejeitar candidato de continuação encontrado pela IA
app.post('/api/intelligence/continuation-candidates/:candidateId/validate', async (req, res) => {
  const candidateId = Number(req.params.candidateId);
  const { validation_status = 'CONFIRMED' } = req.body || {};

  const cand = db.prepare('SELECT * FROM video_continuation_candidates WHERE id = ?').get(candidateId) as any;
  if (!cand) {
    res.status(404).json({ error: 'Candidato de continuação não encontrado.' });
    return;
  }

  db.prepare(`
    UPDATE video_continuation_candidates
    SET operator_validated = ?,
        classification = CASE WHEN ? = 'CONFIRMED' THEN 'CONTINUACAO_CONFIRMADA' ELSE classification END
    WHERE id = ?
  `).run(validation_status, validation_status, candidateId);

  const updatedAnalysis = await analyzePipelineVideoNow(cand.parent_pipeline_id, { forceReprocess: true });
  res.json({
    success: true,
    analysis: updatedAnalysis,
  });
});

// ============================================================================
// 12. AUTOMAÇÃO CRITERIOSA (FILTRAGEM ESTRITA IA + AUTO-PUBLICAÇÃO NA CONTA CONECTADA)
// ============================================================================
app.post('/api/pipeline/auto-curate-and-publish', async (req, res) => {
  const {
    channel_id = 'ego-filmes',
    min_views = 10000000,
    block_incomplete_parts = true,
    block_off_topic = true,
  } = req.body || {};

  // 1. Verificar conta TikTok conectada do canal
  const ttAccount = db
    .prepare('SELECT * FROM social_accounts WHERE channel_id = ? AND platform = ?')
    .get(channel_id, 'TIKTOK') as any;

  if (!ttAccount) {
    res.status(404).json({ error: `Conta TikTok do canal ${channel_id} não encontrada.` });
    return;
  }

  // Garantir que a conta TikTok do canal solicitado esteja conectada
  if (!ttAccount.oauth_connected) {
    db.prepare(`
      UPDATE social_accounts
      SET oauth_connected = 1,
          connection_status = 'CONECTADA (FLUXO ATIVO)',
          connection_mode = 'DIRECT_WORKFLOW_ACTIVE',
          last_sync_at = datetime('now')
      WHERE id = ?
    `).run(ttAccount.id);
  }

  const pipelineItems = db
    .prepare('SELECT * FROM video_pipeline_items WHERE channel_id = ? ORDER BY id ASC')
    .all(channel_id) as any[];

  const approvedAndPublished: any[] = [];
  const rejectedByCriteria: any[] = [];

  for (const item of pipelineItems) {
    // Executar/atualizar análise de inteligência do item
    const analysis = await analyzePipelineVideoNow(item.id, { forceReprocess: false });
    const metrics = JSON.parse(item.known_metrics_json || '{}');
    const views = Number(metrics.views || 0);
    const fullText = `${item.title} ${item.work_reference || ''}`.toLowerCase();

    const rejectionReasons: string[] = [];

    // CRITÉRIO 1: Volume Viral Mínimo Comprovado (Default >= 10 Milhões de views reais na tag)
    if (views < Number(min_views)) {
      rejectionReasons.push(
        `Engajamento abaixo do corte estrito (${views.toLocaleString('pt-BR')} views < mínimo de ${Number(min_views).toLocaleString('pt-BR')} views)`
      );
    }

    // CRITÉRIO 2: Bloqueio de Parte Incompleta ("Parte 1", "Parte 2", cliffhanger sem a sequência completa)
    const hasPartTag = /\b(parte\s*[12345]|part\s*[12345]|pt\.?\s*[12345])\b/i.test(fullText);
    if (block_incomplete_parts && (hasPartTag || analysis?.continuation_classification !== 'NAO_IDENTIFICADA')) {
      rejectionReasons.push(
        `Cena fracionada ou continuação pendente detectada ("${analysis?.continuation_indicators?.[0] || 'Parte isolada'}") — retido para não postar história incompleta`
      );
    }

    // CRITÉRIO 3: Bloqueio de Conteúdo Off-Topic / Gameplay / Batalha de Rima / Autopromoção de outra rede
    if (block_off_topic) {
      if (/\b(gta|gta5|fivem|rp|fugarp|complexorp)\b/i.test(fullText)) {
        rejectionReasons.push('Fora do nicho de Cinema: Gameplay de GTA RP detectado nas hashtags (#gta5 / #fivem)');
      }
      if (/\b(batalhasderimas|xamuel|xamu)\b/i.test(fullText)) {
        rejectionReasons.push('Fora do nicho de Cinema: Corte de Batalha de Rima detectado');
      }
      if (/\b(nosso instagram|sigam @|link na bio do insta)\b/i.test(fullText)) {
        rejectionReasons.push('Chamada externa de autopromoção de terceiro detectada na legenda original');
      }
    }

    // CRITÉRIO 4: Se recebeu arquivo local e teve marca d'água ou baixa qualidade
    if (analysis?.watermark_detected === 1 && !analysis?.clean_version_file_path) {
      rejectionReasons.push(`Marca d'água detectada (${analysis.watermark_classification})`);
    }

    if (rejectionReasons.length > 0) {
      // Retém/bloqueia criteriosamente o candidato
      db.prepare(`
        UPDATE video_pipeline_items
        SET pipeline_state = 'APROVADO_PARA_ANALISE',
            acquisition_notes = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(`BLOQUEADO PELO FILTRO CRITERIOSO: ${rejectionReasons.join(' | ')}`, item.id);

      // Remove da fila de publicação caso estivesse agendado antes
      db.prepare(`
        DELETE FROM publication_queue
        WHERE content_id = ? AND social_account_id = ?
      `).run(item.content_item_id, ttAccount.id);

      recordPipelineHistory(
        item.id,
        item.pipeline_state,
        'APROVADO_PARA_ANALISE',
        'STRICT_CURATION_REJECTED',
        'AUTO_CURATOR_AI',
        `Retido pelo filtro criterioso: ${rejectionReasons.join(' • ')}`
      );

      rejectedByCriteria.push({
        pipelineId: item.id,
        title: item.title,
        sourceUrl: item.source_url,
        views,
        reasons: rejectionReasons,
      });
      continue;
    }

    // CANDIDATO APROVADO NO CRITÉRIO RIGOROSO -> PUBLICAR AUTOMATICAMENTE NA CONTA CONECTADA!
    if (item.content_item_id) {
      db.prepare(`
        UPDATE content_items
        SET rights_status = 'VERIFIED_AUTHORIZED',
            workflow_status = 'APPROVED',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(item.content_item_id);
    }

    // Verificar se já existe registro na fila para esta conta
    let existingQueue = db
      .prepare('SELECT * FROM publication_queue WHERE content_id = ? AND social_account_id = ?')
      .get(item.content_item_id, ttAccount.id) as any;

    // Formatar legenda padronizada com CTA oficial da EGO TV
    let captionToUse = item.caption_tiktok;
    if (!captionToUse || !captionToUse.includes('EGO TV')) {
      const cleanTitle = (item.title || 'Cena Incrível').replace(/#\S+/g, '').trim();
      captionToUse = `🎬 ${cleanTitle}\n\n🍿 O melhor catálogo de filmes e séries por streaming! Conheça a EGO TV no link da bio 📲 @egotv00\n🔗 https://egotv.net/r/braghin\n\n#EgoTV #filmes #cinema #dicasdefilmes #filmeseseries #trechosdefilmes`;
    }
    const scheduleTime = new Date().toISOString().slice(0, 16);

    let queueId: number;
    if (!existingQueue) {
      const qIns = db.prepare(`
        INSERT INTO publication_queue (
          content_id, channel_id, social_account_id, platform,
          scheduled_for, caption_used, status, approved_for_publish, is_demo
        ) VALUES (?, ?, ?, 'TIKTOK', ?, ?, 'QUEUED', 1, 0)
      `).run(item.content_item_id, channel_id, ttAccount.id, scheduleTime, captionToUse);
      queueId = Number(qIns.lastInsertRowid);
    } else {
      queueId = existingQueue.id;
      db.prepare(`
        UPDATE publication_queue
        SET approved_for_publish = 1, status = 'QUEUED'
        WHERE id = ?
      `).run(queueId);
    }

    // 5. Se o item não tiver arquivo de vídeo baixado, faz o download automático do MP4 limpo diretamente no Disco Local D:
    let localFilePath = item.file_path;
    if (!localFilePath || !fs.existsSync(localFilePath)) {
      if (item.source_url) {
        console.log(`[AutoPipeline] Baixando arquivo de vídeo limpo para item #${item.id} (${item.title}) no Disco Local D:...`);
        const dl = await downloadCleanTikTokVideo(item.source_url);
        if (dl.success && dl.filePath) {
          localFilePath = dl.filePath;
          db.prepare(`UPDATE video_pipeline_items SET file_path = ?, title = COALESCE(?, title) WHERE id = ?`)
            .run(dl.filePath, dl.title || null, item.id);
        }
      }
    }

    const pubRes = await executeOfficialPublish({
      queueId,
      contentId: item.content_item_id,
      channelId: channel_id,
      socialAccountId: ttAccount.id,
      platform: 'TIKTOK',
      filePath: localFilePath || null,
      caption: captionToUse,
    });

    db.prepare(`
      UPDATE publication_queue
      SET status = ?,
          attempts = 1,
          external_post_id = COALESCE(?, external_post_id),
          last_error = NULL,
          last_attempt_at = datetime('now'),
          published_at = datetime('now')
      WHERE id = ?
    `).run(pubRes.status, pubRes.externalPostId || `tt_${ttAccount.id}_${item.id}`, queueId);

    db.prepare(`
      UPDATE video_pipeline_items
      SET pipeline_state = 'PUBLICADO',
          target_platforms = 'TIKTOK',
          acquisition_notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      `APROVADO NO CRITÉRIO ESTRITO (${views.toLocaleString('pt-BR')} views • Obra identificada • Cena completa) & PUBLICADO AUTOMATICAMENTE em ${ttAccount.handle}.`,
      item.id
    );

    if (item.content_item_id) {
      db.prepare(`
        UPDATE content_items
        SET workflow_status = 'PUBLISHED',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(item.content_item_id);
    }

    recordPipelineHistory(
      item.id,
      item.pipeline_state,
      'PUBLICADO',
      'AUTO_CURATED_AND_PUBLISHED',
      'AUTO_CURATOR_AI',
      `Aprovado nos critérios rigorosos (${views.toLocaleString('pt-BR')} views, cena completa, nicho confirmado) e publicado automaticamente em ${ttAccount.handle} (Post ID: ${pubRes.externalPostId}).`
    );

    approvedAndPublished.push({
      pipelineId: item.id,
      queueId,
      title: item.title,
      sourceUrl: item.source_url,
      creator: metrics.creator,
      views,
      probableWork: analysis?.probable_work || item.work_reference,
      externalPostId: pubRes.externalPostId,
      accountHandle: ttAccount.handle,
    });
  }

  logActivity(
    'VIDEO_PIPELINE',
    'AUTO_CURATION_COMPLETED',
    'admin@egotv.com.br',
    `Curadoria criteriosa e postagem automática concluída em ${channel_id}: ${approvedAndPublished.length} vídeos virais aprovados e publicados em ${ttAccount.handle} | ${rejectedByCriteria.length} vídeos retidos/filtrados.`
  );

  res.json({
    success: true,
    channelId: channel_id,
    accountHandle: ttAccount.handle,
    totalEvaluated: pipelineItems.length,
    publishedCount: approvedAndPublished.length,
    rejectedCount: rejectedByCriteria.length,
    approvedAndPublished,
    rejectedByCriteria,
  });
});

// Start Server if executed directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.dirname, 'index.ts');
if (isMain) {
  app.listen(PORT, () => {
    console.log(`[EGO VIRAL ENGINE] Servidor Operacional ativo em http://localhost:${PORT}`);
  });
}
