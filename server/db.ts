import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'ego_viral_engine.sqlite');
export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERATOR',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL,
      accent_bg TEXT NOT NULL,
      daily_goal INTEGER NOT NULL DEFAULT 30,
      categories TEXT NOT NULL,
      search_keywords TEXT NOT NULL,
      default_cta TEXT NOT NULL,
      tiktok_caption_template TEXT NOT NULL,
      instagram_caption_template TEXT NOT NULL,
      hashtags_default TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM')),
      handle TEXT NOT NULL,
      account_name TEXT NOT NULL,
      connection_status TEXT NOT NULL DEFAULT 'PENDING_CREDENTIALS',
      oauth_connected INTEGER NOT NULL DEFAULT 0,
      daily_target INTEGER NOT NULL DEFAULT 15,
      followers_count INTEGER DEFAULT 0,
      last_sync_at TEXT,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS radar_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('KEYWORD', 'FRANCHISE', 'TITLE', 'PUBLIC_PROFILE', 'THEME')),
      value TEXT NOT NULL,
      platform_origin TEXT NOT NULL DEFAULT 'ALL',
      priority INTEGER NOT NULL DEFAULT 5,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS radar_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      source_url TEXT UNIQUE NOT NULL,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      franchise_or_work TEXT,
      views_observed INTEGER,
      likes_observed INTEGER,
      comments_observed INTEGER,
      original_published_at TEXT,
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      growth_velocity_score REAL DEFAULT 0,
      audience_fit_score REAL DEFAULT 0,
      relevance_score REAL NOT NULL DEFAULT 0,
      analysis_status TEXT NOT NULL DEFAULT 'IDENTIFIED' CHECK(analysis_status IN ('IDENTIFIED', 'IN_ANALYSIS', 'SENT_TO_LIBRARY', 'DISCARDED')),
      collection_method TEXT NOT NULL DEFAULT 'MANUAL_AUTHORIZED',
      is_demo INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS content_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT NOT NULL,
      category_group TEXT NOT NULL CHECK(category_group IN ('FILMES', 'ANIME', 'SERIES')),
      title TEXT NOT NULL,
      work_reference TEXT,
      source_url TEXT,
      file_path TEXT,
      file_name TEXT,
      file_hash TEXT,
      file_size_bytes INTEGER,
      duration_seconds INTEGER,
      resolution TEXT DEFAULT '1080x1920',
      technical_valid INTEGER NOT NULL DEFAULT 1,
      caption_tiktok TEXT,
      caption_instagram TEXT,
      hashtags TEXT,
      cta_text TEXT,
      rights_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK(rights_status IN ('PENDING_VERIFICATION', 'VERIFIED_AUTHORIZED', 'RESTRICTED_BLOCKED')),
      rights_license_notes TEXT,
      rights_verified_by TEXT,
      rights_verified_at TEXT,
      workflow_status TEXT NOT NULL DEFAULT 'IDENTIFIED' CHECK(workflow_status IN (
        'IDENTIFIED',
        'IN_ANALYSIS',
        'RIGHTS_VERIFIED',
        'APPROVED',
        'REJECTED',
        'PREPARED',
        'SCHEDULED',
        'PUBLISHED',
        'FAILED'
      )),
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS content_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      previous_status TEXT,
      new_status TEXT,
      actor TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publication_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      social_account_id TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM')),
      scheduled_for TEXT NOT NULL,
      caption_used TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK(status IN (
        'PENDING_APPROVAL',
        'QUEUED',
        'PROCESSING',
        'PUBLISHED_OFFICIAL_API',
        'AWAITING_CREDENTIALS',
        'FAILED'
      )),
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      external_post_id TEXT,
      last_error TEXT,
      last_attempt_at TEXT,
      published_at TEXT,
      approved_for_publish INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (content_id) REFERENCES content_items(id) ON DELETE CASCADE,
      FOREIGN KEY (channel_id) REFERENCES channels(id),
      FOREIGN KEY (social_account_id) REFERENCES social_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS tracking_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      channel_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      content_id INTEGER,
      campaign_name TEXT NOT NULL,
      destination_url TEXT NOT NULL,
      clicks_count INTEGER NOT NULL DEFAULT 0,
      attributed_subscriptions INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS click_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_link_id INTEGER NOT NULL,
      user_agent TEXT,
      referer TEXT,
      is_real_click INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tracking_link_id) REFERENCES tracking_links(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscription_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_link_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      subscriber_ref TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'MENSAL',
      revenue_brl REAL NOT NULL DEFAULT 29.90,
      attribution_confidence TEXT NOT NULL DEFAULT 'UTM_VERIFIED' CHECK(attribution_confidence IN ('UTM_VERIFIED', 'WEBHOOK_CONFIRMED', 'DEMO_SAMPLE')),
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (tracking_link_id) REFERENCES tracking_links(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'INFO',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS video_pipeline_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      radar_item_id INTEGER UNIQUE,
      content_item_id INTEGER,
      channel_id TEXT NOT NULL,
      niche_label TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      original_external_id TEXT NOT NULL,
      title TEXT NOT NULL,
      work_reference TEXT,
      known_metrics_json TEXT NOT NULL DEFAULT '{}',
      approved_at TEXT NOT NULL DEFAULT (datetime('now')),
      rights_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK(rights_status IN (
        'PENDING_VERIFICATION',
        'VERIFIED_AUTHORIZED',
        'RESTRICTED_BLOCKED'
      )),
      rights_notes TEXT,
      pipeline_state TEXT NOT NULL DEFAULT 'APROVADO_PARA_ANALISE' CHECK(pipeline_state IN (
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
        'FALHA'
      )),
      acquisition_method TEXT DEFAULT 'NONE' CHECK(acquisition_method IN (
        'NONE',
        'OPTION_A_AUTO',
        'OPTION_B_MANUAL',
        'OPTION_C_UPLOAD'
      )),
      acquisition_notes TEXT,
      file_path TEXT,
      file_name TEXT,
      file_hash TEXT,
      file_size_bytes INTEGER,
      duration_seconds INTEGER DEFAULT 45,
      video_format TEXT DEFAULT 'MP4 (9:16 1080x1920)',
      caption_tiktok TEXT,
      caption_instagram TEXT,
      hashtags TEXT,
      cta_text TEXT,
      target_platforms TEXT NOT NULL DEFAULT 'BOTH' CHECK(target_platforms IN ('TIKTOK', 'INSTAGRAM', 'BOTH')),
      operator_reviewed INTEGER NOT NULL DEFAULT 0,
      replaced_by_source_url TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES channels(id)
    );

    CREATE TABLE IF NOT EXISTS video_pipeline_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_id INTEGER NOT NULL,
      previous_state TEXT,
      new_state TEXT NOT NULL,
      operation TEXT NOT NULL,
      actor TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pipeline_id) REFERENCES video_pipeline_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_intelligence_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pipeline_id INTEGER NOT NULL UNIQUE,
      content_id INTEGER,
      channel_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      thumbnail_url TEXT,
      file_path_analyzed TEXT,
      file_hash_sha256 TEXT,
      analysis_mode TEXT NOT NULL DEFAULT 'AWAITING_VIDEO_FILE_METADATA_ONLY' CHECK(analysis_mode IN (
        'FULL_VISUAL_AND_AUDIO',
        'AWAITING_VIDEO_FILE_METADATA_ONLY'
      )),
      frames_analyzed_count INTEGER NOT NULL DEFAULT 0,
      frame_interval_seconds REAL DEFAULT 2.0,
      processing_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK(processing_status IN (
        'QUEUED',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
      )),

      -- 1 & 2. Ficha de Conteúdo e Identificação Visual/Temporal
      scene_summary TEXT NOT NULL,
      main_subject TEXT NOT NULL,
      detected_category TEXT NOT NULL,
      detected_subcategory TEXT NOT NULL,
      probable_work TEXT NOT NULL,
      work_identification_status TEXT NOT NULL DEFAULT 'INCONCLUSIVO' CHECK(work_identification_status IN (
        'CONFIRMADO',
        'HIPOTESE_PROVAVEL',
        'INCONCLUSIVO'
      )),
      recognized_characters_json TEXT NOT NULL DEFAULT '[]',
      scene_description TEXT NOT NULL,
      initial_event TEXT NOT NULL,
      final_event TEXT NOT NULL,
      scene_changes_count INTEGER NOT NULL DEFAULT 0,
      scenes_breakdown_json TEXT NOT NULL DEFAULT '[]',
      has_dialogue INTEGER NOT NULL DEFAULT 0,
      has_narration INTEGER NOT NULL DEFAULT 0,
      has_subtitles INTEGER NOT NULL DEFAULT 0,
      ocr_texts_json TEXT NOT NULL DEFAULT '[]',
      audio_transcript_summary TEXT,
      keywords_json TEXT NOT NULL DEFAULT '[]',
      target_profile_fit INTEGER NOT NULL DEFAULT 1,
      target_profile_fit_reason TEXT,
      content_confidence INTEGER NOT NULL DEFAULT 0,
      content_classification TEXT NOT NULL DEFAULT 'INCONCLUSIVO' CHECK(content_classification IN (
        'CONFIRMADO',
        'PROVAVEL',
        'INCONCLUSIVO'
      )),

      -- 3. Detecção de Continuações e Agrupamento de Sequências
      appears_isolated_or_sequence TEXT NOT NULL DEFAULT 'ISOLADA' CHECK(appears_isolated_or_sequence IN (
        'ISOLADA',
        'PARTE_DE_SEQUENCIA',
        'INCONCLUSIVO'
      )),
      has_continuation_indicators INTEGER NOT NULL DEFAULT 0,
      continuation_indicators_json TEXT NOT NULL DEFAULT '[]',
      ends_in_suspense INTEGER NOT NULL DEFAULT 0,
      scene_interrupted INTEGER NOT NULL DEFAULT 0,
      continuation_classification TEXT NOT NULL DEFAULT 'NAO_IDENTIFICADA' CHECK(continuation_classification IN (
        'CONTINUACAO_CONFIRMADA',
        'CONTINUACAO_PROVAVEL',
        'NAO_IDENTIFICADA'
      )),
      continuation_confidence INTEGER NOT NULL DEFAULT 0,
      sequence_group_id TEXT,
      sequence_part_number INTEGER,
      sequence_total_parts INTEGER,
      continuation_search_notes TEXT,

      -- 4 & 5. Watermark Detector e Política de Tratamento
      watermark_detected INTEGER NOT NULL DEFAULT 0,
      watermark_classification TEXT NOT NULL DEFAULT 'NONE' CHECK(watermark_classification IN (
        'NONE',
        'PLATFORM_WATERMARK',
        'CREATOR_IDENTIFIER',
        'IN_SCENE_LOGO',
        'SUBTITLE',
        'EDITORIAL_TEXT',
        'INCONCLUSIVE_VISUAL'
      )),
      watermark_locations_json TEXT NOT NULL DEFAULT '[]',
      watermark_temporal_pattern TEXT NOT NULL DEFAULT 'NONE' CHECK(watermark_temporal_pattern IN (
        'NONE',
        'FIXED_PERSISTENT',
        'INTERMITTENT',
        'MOVING_DYNAMIC',
        'BOTTOM_SUBTITLE_BAND',
        'CENTER_EDITORIAL'
      )),
      watermark_detected_text TEXT,
      watermark_confidence INTEGER NOT NULL DEFAULT 0,
      watermark_policy_action TEXT NOT NULL DEFAULT 'PROCEED_NORMAL',
      watermark_policy_explanation TEXT,
      clean_version_file_path TEXT,
      clean_version_file_name TEXT,
      clean_version_file_hash TEXT,

      -- 6. Análise de Qualidade Técnica
      quality_score INTEGER NOT NULL DEFAULT 0,
      resolution_width INTEGER DEFAULT 1080,
      resolution_height INTEGER DEFAULT 1920,
      aspect_ratio TEXT DEFAULT '9:16',
      is_vertical INTEGER NOT NULL DEFAULT 1,
      adaptable_to_vertical INTEGER NOT NULL DEFAULT 1,
      blur_level TEXT DEFAULT 'SHARP',
      has_black_bars INTEGER NOT NULL DEFAULT 0,
      audio_quality_status TEXT DEFAULT 'ADEQUATE',
      abrupt_cuts_count INTEGER NOT NULL DEFAULT 0,
      duplicate_frames_ratio REAL DEFAULT 0,
      has_repeated_segments INTEGER NOT NULL DEFAULT 0,
      subtitles_legibility TEXT DEFAULT 'LEGIBLE',
      quality_factors_json TEXT NOT NULL DEFAULT '[]',

      -- 7. Os 7 Status Independentes + Decisão Automática do Pipeline
      status_content_analysis TEXT NOT NULL DEFAULT 'INCONCLUSIVO',
      status_continuation TEXT NOT NULL DEFAULT 'SEM_CONTINUACAO',
      status_watermark TEXT NOT NULL DEFAULT 'AGUARDANDO_INSPECAO_VISUAL',
      status_technical_quality TEXT NOT NULL DEFAULT 'AGUARDANDO_INSPECAO_VISUAL',
      status_rights TEXT NOT NULL DEFAULT 'VERIFIED_AUTHORIZED',
      status_preparation TEXT NOT NULL DEFAULT 'PENDENTE',
      status_publication TEXT NOT NULL DEFAULT 'NAO_AGENDADO',
      recommended_decision TEXT NOT NULL DEFAULT 'AGUARDANDO_ARQUIVO_ACESSIVEL' CHECK(recommended_decision IN (
        'AVANCAR_PARA_PREPARACAO',
        'MANTER_BLOQUEADO_PENDENCIAS',
        'ENCAMINHAR_REVISAO_OU_DESCARTAR',
        'AGUARDANDO_ARQUIVO_ACESSIVEL'
      )),
      decision_archetype TEXT NOT NULL DEFAULT 'PENDENTE_ARQUIVO',
      decision_explanation TEXT NOT NULL,
      processing_history_json TEXT NOT NULL DEFAULT '[]',
      analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pipeline_id) REFERENCES video_pipeline_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_continuation_candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_pipeline_id INTEGER NOT NULL,
      candidate_pipeline_id INTEGER,
      sequence_group_id TEXT,
      relationship_type TEXT NOT NULL CHECK(relationship_type IN ('PARTE_ANTERIOR', 'PARTE_POSTERIOR', 'MESMA_SEQUENCIA')),
      suggested_order_index INTEGER NOT NULL DEFAULT 2,
      candidate_url TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'TIKTOK',
      creator_handle TEXT NOT NULL,
      candidate_title TEXT NOT NULL,
      visual_similarity_score INTEGER NOT NULL DEFAULT 0,
      narrative_continuity_score INTEGER NOT NULL DEFAULT 0,
      confidence_score INTEGER NOT NULL DEFAULT 0,
      classification TEXT NOT NULL CHECK(classification IN ('CONTINUACAO_CONFIRMADA', 'CONTINUACAO_PROVAVEL', 'NAO_IDENTIFICADA')),
      evidence_json TEXT NOT NULL DEFAULT '[]',
      operator_validated TEXT NOT NULL DEFAULT 'PENDING' CHECK(operator_validated IN ('PENDING', 'CONFIRMED', 'REJECTED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_pipeline_id) REFERENCES video_pipeline_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      min_quality_score INTEGER NOT NULL DEFAULT 65,
      min_content_confidence INTEGER NOT NULL DEFAULT 65,
      block_on_creator_watermark INTEGER NOT NULL DEFAULT 1,
      block_on_probable_continuation INTEGER NOT NULL DEFAULT 1,
      allow_adaptable_horizontal INTEGER NOT NULL DEFAULT 1,
      require_verified_rights INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Garantir colunas de conexão OAuth / Token nas contas sociais (migração segura para bancos existentes)
  const accountCols = db.prepare(`PRAGMA table_info(social_accounts)`).all() as Array<{ name: string }>;
  const colNames = new Set(accountCols.map((c) => c.name));
  if (!colNames.has('access_token')) {
    db.exec(`ALTER TABLE social_accounts ADD COLUMN access_token TEXT`);
  }
  if (!colNames.has('refresh_token')) {
    db.exec(`ALTER TABLE social_accounts ADD COLUMN refresh_token TEXT`);
  }
  if (!colNames.has('client_key')) {
    db.exec(`ALTER TABLE social_accounts ADD COLUMN client_key TEXT`);
  }
  if (!colNames.has('open_id')) {
    db.exec(`ALTER TABLE social_accounts ADD COLUMN open_id TEXT`);
  }
  if (!colNames.has('connection_mode')) {
    db.exec(`ALTER TABLE social_accounts ADD COLUMN connection_mode TEXT DEFAULT 'DISCONNECTED'`);
  }

  seedInitialData();
}

function seedInitialData() {
  // 0. Seed Default Pipeline Automation Rules
  const rulesCount = db.prepare('SELECT COUNT(*) as count FROM pipeline_automation_rules').get() as { count: number };
  if (rulesCount.count === 0) {
    db.prepare(`
      INSERT INTO pipeline_automation_rules (
        id, min_quality_score, min_content_confidence,
        block_on_creator_watermark, block_on_probable_continuation,
        allow_adaptable_horizontal, require_verified_rights
      ) VALUES (1, 65, 65, 1, 1, 1, 0)
    `).run();
  }

  // 1. Seed default Admin Operator
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const hash = bcrypt.hashSync('egotv2026', 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Operador Chefe Ego TV', 'admin@egotv.com.br', hash, 'ADMIN');
  }

  // 2. Seed the 3 Channels (30 videos/day each = 90 daily videos)
  const channelCount = db.prepare('SELECT COUNT(*) as count FROM channels').get() as { count: number };
  if (channelCount.count === 0) {
    const insertChannel = db.prepare(`
      INSERT INTO channels (
        id, name, slug, color, accent_bg, daily_goal,
        categories, search_keywords, default_cta,
        tiktok_caption_template, instagram_caption_template, hashtags_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertChannel.run(
      'ego-filmes',
      'EGO FILMES',
      'ego-filmes',
      '#06b6d4',
      'rgba(6, 182, 212, 0.12)',
      30,
      JSON.stringify(['Sci-Fi & Thriller', 'Ação & Suspense', 'Bastidores & Curiosidades', 'Cenas Clássicas Autorizadas', 'Trailers Oficiais']),
      JSON.stringify(['cena de filme emocionante', 'plot twist cinema', 'filmes subestimados', 'bastidores cinema', 'trailer dublado oficial']),
      'Conheça o catálogo oficial da Ego TV — link na bio.',
      '🎬 {TITLE} | Você já reparou nesse detalhe em {WORK}? Assista conteúdos licenciados na Ego TV (link no perfil).\n\n{HASHTAGS}',
      '🍿 {TITLE}\n\nTrecho oficial de {WORK}. Qual sua nota para essa cena?\n👉 Confira nossa programação completa no link da bio da Ego TV.\n.\n{HASHTAGS}',
      '#EgoFilmes #EgoTV #Cinema #DicaDeFilme #CenaDeFilme #FilmesESeries'
    );

    insertChannel.run(
      'ego-anime',
      'EGO ANIME',
      'ego-anime',
      '#a855f7',
      'rgba(168, 85, 247, 0.12)',
      30,
      JSON.stringify(['Shounen & Batalhas', 'Seinen & Psicológico', 'Animações Japonesas', 'PVs & Trailers Oficiais', 'Análise de Arcos']),
      JSON.stringify(['anime sakuga', 'melhores lutas anime', 'anime temporada', 'trailer oficial anime', 'abertura anime']),
      'Acompanhe a programação otaku oficial na Ego TV — acesse pelo link no perfil.',
      '⚡ {TITLE} — A animação de {WORK} entregou tudo nessa sequência! Veja a programação completa na Ego TV (link na bio).\n\n{HASHTAGS}',
      '🔥 {TITLE}\n\nDestaque de {WORK}. Qual o seu personagem favorito desse arco?\n⚡ Acesse o link da bio para conhecer a Ego TV!\n.\n{HASHTAGS}',
      '#EgoAnime #EgoTV #AnimeBrasil #OtakuBR #Sakuga #DicaDeAnime'
    );

    insertChannel.run(
      'ego-series',
      'EGO SÉRIES',
      'ego-series',
      '#10b981',
      'rgba(16, 185, 129, 0.12)',
      30,
      JSON.stringify(['Dramas & Mistério', 'Séries de Crime', 'Minisséries', 'Teasers & Promos Oficiais', 'Diálogos Marcantes']),
      JSON.stringify(['melhores series', 'cena tensa serie', 'final explicado serie', 'teaser oficial serie', 'maratona fim de semana']),
      'Descubra novas séries e conteúdos na Ego TV — link na bio.',
      '📺 {TITLE} | Essa cena de {WORK} prende a atenção do começo ao fim! Conheça a Ego TV no link do perfil.\n\n{HASHTAGS}',
      '🎭 {TITLE}\n\nMomento decisivo em {WORK}. Já maratonou essa temporada?\n👉 Confira mais na Ego TV pelo link na bio.\n.\n{HASHTAGS}',
      '#EgoSeries #EgoTV #SeriesBrasil #MaratonaDeSeries #DicaDeSerie'
    );

    // 3. Seed 6 Social Accounts (3 TikTok + 3 Instagram)
    const insertAccount = db.prepare(`
      INSERT INTO social_accounts (
        id, channel_id, platform, handle, account_name, connection_status, oauth_connected, daily_target, followers_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAccount.run('tt-filmes', 'ego-filmes', 'TIKTOK', '@egofilmes.oficial', 'Ego Filmes TikTok', 'PENDING_CREDENTIALS', 0, 15, 0);
    insertAccount.run('ig-filmes', 'ego-filmes', 'INSTAGRAM', '@egofilmes.tv', 'Ego Filmes Instagram', 'PENDING_CREDENTIALS', 0, 15, 0);

    insertAccount.run('tt-anime', 'ego-anime', 'TIKTOK', '@egoanime.oficial', 'Ego Anime TikTok', 'PENDING_CREDENTIALS', 0, 15, 0);
    insertAccount.run('ig-anime', 'ego-anime', 'INSTAGRAM', '@egoanime.tv', 'Ego Anime Instagram', 'PENDING_CREDENTIALS', 0, 15, 0);

    insertAccount.run('tt-series', 'ego-series', 'TIKTOK', '@egoseries.oficial', 'Ego Séries TikTok', 'PENDING_CREDENTIALS', 0, 15, 0);
    insertAccount.run('ig-series', 'ego-series', 'INSTAGRAM', '@egoseries.tv', 'Ego Séries Instagram', 'PENDING_CREDENTIALS', 0, 15, 0);

    // 4. Seed Initial Radar Sources (Keywords, Franchises, Profiles)
    const insertSource = db.prepare(`
      INSERT INTO radar_sources (channel_id, source_type, value, platform_origin, priority)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertSource.run('ego-filmes', 'KEYWORD', 'Trailer Oficial Dublado 2026', 'YOUTUBE_OFFICIAL', 10);
    insertSource.run('ego-filmes', 'THEME', 'Ficção Científica Distópica', 'ALL', 9);
    insertSource.run('ego-filmes', 'PUBLIC_PROFILE', '@A24 / Canais de Estúdios Oficiais', 'YOUTUBE_OFFICIAL', 8);

    insertSource.run('ego-anime', 'FRANCHISE', 'Solo Leveling / Jujutsu / Demon Slayer PVs', 'YOUTUBE_OFFICIAL', 10);
    insertSource.run('ego-anime', 'KEYWORD', 'Anime Official PV Trailer Subtitled', 'YOUTUBE_OFFICIAL', 9);
    insertSource.run('ego-anime', 'PUBLIC_PROFILE', '@CrunchyrollBrasil / @Aniplex', 'YOUTUBE_OFFICIAL', 9);

    insertSource.run('ego-series', 'THEME', 'Suspense Psicológico & Investigação', 'ALL', 10);
    insertSource.run('ego-series', 'KEYWORD', 'Official Series Teaser HD', 'YOUTUBE_OFFICIAL', 9);
    insertSource.run('ego-series', 'TITLE', 'Séries em Domínio Público & Press Kits Licenciados', 'PRESS_KIT', 10);

    // 5. Seed Demonstrative Radar Items (clearly flagged with is_demo = 1)
    const insertRadar = db.prepare(`
      INSERT INTO radar_items (
        channel_id, source_url, platform, title, franchise_or_work,
        views_observed, likes_observed, comments_observed,
        original_published_at, growth_velocity_score, audience_fit_score,
        relevance_score, analysis_status, collection_method, is_demo, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRadar.run(
      'ego-filmes',
      'https://www.youtube.com/watch?v=demo-scifi-presskit-01',
      'YOUTUBE_OFFICIAL',
      '[DEMO] Bastidores do Efeito Prático em Gravidade Zero — Press Kit Oficial',
      'Horizonte de Eventos (Press Kit)',
      148500, 19400, 840,
      new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      92.5, 95.0, 93.8,
      'IDENTIFIED',
      'MANUAL_AUTHORIZED',
      1,
      'Registro demonstrativo inicial. Alta taxa de comentários por visualização nas primeiras 8h.'
    );

    insertRadar.run(
      'ego-anime',
      'https://www.youtube.com/watch?v=demo-anime-pv-02',
      'YOUTUBE_OFFICIAL',
      '[DEMO] PV Oficial Cour 2 — Sequência de Abertura Sem Créditos',
      'Crônicas de Aether (Estúdio Oficial)',
      312000, 44200, 3100,
      new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      96.8, 98.0, 97.4,
      'IN_ANALYSIS',
      'MANUAL_AUTHORIZED',
      1,
      'Registro demonstrativo inicial. Press kit promocional liberado para divulgação.'
    );

    insertRadar.run(
      'ego-series',
      'https://www.youtube.com/watch?v=demo-series-monologue-03',
      'PRESS_KIT',
      '[DEMO] Monólogo do Interrogatório Final — Episódio Piloto',
      'Protocolo Silêncio T01E01',
      89400, 11200, 620,
      new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      84.0, 91.0, 87.5,
      'IDENTIFIED',
      'MANUAL_AUTHORIZED',
      1,
      'Registro demonstrativo inicial. Corte vertical 9:16 disponível no pacote de imprensa.'
    );

    // 6. Seed Demonstrative Library Items across workflow statuses (clearly marked is_demo = 1)
    const insertContent = db.prepare(`
      INSERT INTO content_items (
        channel_id, category_group, title, work_reference, source_url,
        file_name, file_hash, file_size_bytes, duration_seconds, resolution,
        technical_valid, caption_tiktok, caption_instagram, hashtags, cta_text,
        rights_status, rights_license_notes, rights_verified_by, rights_verified_at,
        workflow_status, approved_by, approved_at, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const nowIso = new Date().toISOString();

    // Item 1: Ego Filmes - APPROVED & PREPARED
    insertContent.run(
      'ego-filmes', 'FILMES',
      '[DEMO] O Segredo do Relógio no Thriller "O Último Trem"',
      'O Último Trem (Licença Promocional Ego TV)',
      'https://egotv.com.br/presskit/ultimo-trem-clip1',
      'demo_ultimo_trem_vertical.mp4',
      'sha256_demo_filmes_001',
      14500200, 42, '1080x1920', 1,
      '🎬 O detalhe oculto no relógio em O Último Trem! Assista conteúdos licenciados na Ego TV (link no perfil).\n\n#EgoFilmes #EgoTV #Cinema #Suspense',
      '🍿 O Segredo do Relógio em O Último Trem.\n\nTrecho promocional autorizado. Você percebeu esse detalhe na primeira vez?\n👉 Confira nossa programação completa no link da bio da Ego TV.\n.\n#EgoFilmes #EgoTV #Cinema #DicaDeFilme',
      '#EgoFilmes #EgoTV #Cinema #Suspense #DicaDeFilme',
      'Conheça o catálogo oficial da Ego TV — link na bio.',
      'VERIFIED_AUTHORIZED',
      'Material promocional oficial cedido sob licença de distribuição #EGO-LIC-2026-01.',
      'admin@egotv.com.br', nowIso,
      'PREPARED',
      'admin@egotv.com.br', nowIso,
      1
    );

    // Item 2: Ego Anime - RIGHTS_VERIFIED (awaiting final approval)
    insertContent.run(
      'ego-anime', 'ANIME',
      '[DEMO] Coreografia de Espadas em 60fps — Trailer Oficial',
      'Lâmina Carmesim (PV Oficial)',
      'https://egotv.com.br/presskit/lamina-carmesim-pv',
      'demo_lamina_carmesim_sakuga.mp4',
      'sha256_demo_anime_002',
      18200400, 35, '1080x1920', 1,
      '⚡ A fluidez dessa animação em Lâmina Carmesim! Veja a programação completa na Ego TV (link na bio).\n\n#EgoAnime #EgoTV #AnimeBrasil #Sakuga',
      '🔥 Coreografia impecável em Lâmina Carmesim.\n\nQual sua nota para a direção de arte desse episódio?\n⚡ Acesse o link da bio para conhecer a Ego TV!\n.\n#EgoAnime #EgoTV #AnimeBrasil #OtakuBR',
      '#EgoAnime #EgoTV #AnimeBrasil #Sakuga #OtakuBR',
      'Acompanhe a programação otaku oficial na Ego TV — acesse pelo link no perfil.',
      'VERIFIED_AUTHORIZED',
      'Trailer promocional público autorizado pelo distribuidor para divulgação.',
      'admin@egotv.com.br', nowIso,
      'RIGHTS_VERIFIED',
      null, null,
      1
    );

    // Item 3: Ego Séries - IN_ANALYSIS (Rights Pending Verification - Blocked from publishing!)
    insertContent.run(
      'ego-series', 'SERIES',
      '[DEMO] Diálogo Sem Cortes: O Confronto no Tribunal',
      'Distrito 99 — 1ª Temporada',
      'https://egotv.com.br/presskit/distrito99-ep4',
      'demo_distrito99_tribunal.mp4',
      'sha256_demo_series_003',
      21000000, 58, '1080x1920', 1,
      '📺 Essa cena de Distrito 99 prende a atenção do começo ao fim! Conheça a Ego TV no link do perfil.\n\n#EgoSeries #EgoTV #SeriesBrasil',
      '🎭 O Confronto no Tribunal em Distrito 99.\n\n👉 Confira mais na Ego TV pelo link na bio.\n.\n#EgoSeries #EgoTV #SeriesBrasil',
      '#EgoSeries #EgoTV #SeriesBrasil #Drama',
      'Descubra novas séries e conteúdos na Ego TV — link na bio.',
      'PENDING_VERIFICATION',
      'Aguardando confirmação escrita do departamento jurídico sobre janela de exibição.',
      null, null,
      'IN_ANALYSIS',
      null, null,
      1
    );

    // 7. Seed Tracking Links
    const insertTrack = db.prepare(`
      INSERT INTO tracking_links (
        code, channel_id, platform, content_id, campaign_name, destination_url, clicks_count, attributed_subscriptions, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertTrack.run(
      'ego-filmes-tt-bio', 'ego-filmes', 'TIKTOK', 1,
      'campanha_filmes_out2026',
      'https://egotv.com.br/assinar?utm_source=tiktok&utm_medium=short_video&utm_campaign=ego_filmes',
      42, 3, 1
    );
    insertTrack.run(
      'ego-anime-tt-bio', 'ego-anime', 'TIKTOK', 2,
      'campanha_anime_out2026',
      'https://egotv.com.br/assinar?utm_source=tiktok&utm_medium=short_video&utm_campaign=ego_anime',
      68, 5, 1
    );
    insertTrack.run(
      'ego-series-ig-bio', 'ego-series', 'INSTAGRAM', 3,
      'campanha_series_out2026',
      'https://egotv.com.br/assinar?utm_source=instagram&utm_medium=reels&utm_campaign=ego_series',
      31, 2, 1
    );

    // 8. Seed Initial Activity Log
    db.prepare(`
      INSERT INTO activity_logs (module, action, actor, details, severity)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'SYSTEM',
      'ENGINE_INITIALIZED',
      'SYSTEM',
      'Ego Viral Engine inicializado com 3 canais (meta: 90 vídeos/dia) e 6 contas sociais configuradas.',
      'INFO'
    );
  }
}
