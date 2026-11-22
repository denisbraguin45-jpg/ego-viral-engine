import { db } from './db.ts';

export function initEgoTVOperationsTables() {
  db.exec(`
    -- 1. Radar Viral: Tendências e conteúdos descobertos
    CREATE TABLE IF NOT EXISTS egotv_trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_url TEXT NOT NULL,
      platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS', 'OTHER')),
      category TEXT NOT NULL CHECK(category IN ('Humor', 'Entretenimento', 'Curiosidades', 'Podcasts', 'Dinheiro e lifestyle', 'Notícias', 'Animais', 'Outros')),
      discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
      views_observed INTEGER,
      likes_observed INTEGER,
      comments_observed INTEGER,
      shares_observed INTEGER,
      description TEXT,
      viral_reason TEXT,
      viral_score INTEGER NOT NULL DEFAULT 50 CHECK(viral_score BETWEEN 0 AND 100),
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED')),
      notes TEXT,
      created_by_agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 2. Curadoria e Produção: Tarefas Kanban (10 Etapas)
    CREATE TABLE IF NOT EXISTS egotv_kanban_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trend_id INTEGER,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'Descoberto' CHECK(stage IN (
        'Descoberto',
        'Em análise',
        'Selecionado',
        'Aguardando produção',
        'Em edição',
        'Aprovado',
        'Agendado',
        'Publicado',
        'Analisado',
        'Descartado'
      )),
      category TEXT NOT NULL DEFAULT 'Outros',
      source_platform TEXT NOT NULL DEFAULT 'TIKTOK',
      original_url TEXT,
      responsible TEXT DEFAULT 'Operador EgoTV',
      attached_file_path TEXT,
      attached_file_name TEXT,
      caption TEXT,
      hook TEXT,
      hashtags TEXT,
      cta TEXT,
      usage_rights_status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(usage_rights_status IN ('PENDENTE', 'AUTORIZADO', 'DOMINIO_PUBLICO', 'FAIR_USE_EDUCACIONAL', 'REJEITADO')),
      usage_rights_notes TEXT,
      scheduled_for TEXT,
      priority TEXT NOT NULL DEFAULT 'MEDIA' CHECK(priority IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
      created_by_agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (trend_id) REFERENCES egotv_trends(id) ON DELETE SET NULL
    );

    -- 3. Módulo de Publicações (Integrado com os canais e distribuído até 15 por dia entre TT, Reels, Shorts)
    CREATE TABLE IF NOT EXISTS egotv_publications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      channel_id TEXT NOT NULL DEFAULT 'ego-filmes',
      platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM_REELS', 'YOUTUBE_SHORTS')),
      title TEXT NOT NULL,
      caption TEXT,
      hook TEXT,
      hashtags TEXT,
      cta TEXT,
      media_url TEXT,
      status TEXT NOT NULL DEFAULT 'Rascunho' CHECK(status IN ('Rascunho', 'Aguardando aprovação', 'Agendado', 'Publicando', 'Publicado', 'Falhou')),
      scheduled_at TEXT,
      published_at TEXT,
      post_url TEXT,
      external_post_id TEXT,
      error_message TEXT,
      operator_approved INTEGER NOT NULL DEFAULT 1,
      target_daily_slot INTEGER DEFAULT 1,
      created_by_agent_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES egotv_kanban_tasks(id) ON DELETE SET NULL
    );

    -- 4. Analytics Individual e Métricas Reais
    CREATE TABLE IF NOT EXISTS egotv_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      publication_id INTEGER,
      title TEXT,
      platform TEXT NOT NULL,
      category TEXT DEFAULT 'Entretenimento',
      views INTEGER DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      avg_watch_time_seconds REAL,
      completion_rate REAL,
      retention_rate REAL,
      followers_gained INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      is_manual_entry INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (publication_id) REFERENCES egotv_publications(id) ON DELETE CASCADE
    );

    -- 5. Monetização e Oportunidades Comerciais
    CREATE TABLE IF NOT EXISTS egotv_monetization (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PROGRAMA_PLATAFORMA', 'CAMPANHA', 'PATROCINIO', 'AFILIADO', 'OPORTUNIDADE_COMERCIAL')),
      platform TEXT NOT NULL CHECK(platform IN ('TIKTOK', 'INSTAGRAM', 'YOUTUBE', 'TODAS', 'DIRETO')),
      advertiser_name TEXT,
      contact_info TEXT,
      negotiation_status TEXT NOT NULL DEFAULT 'EM_NEGOCIACAO' CHECK(negotiation_status IN ('PROSPECTANDO', 'EM_NEGOCIACAO', 'PROPOSTA_ENVIADA', 'CONTRATO_ASSINADO', 'ATIVO', 'CONCLUIDO', 'CANCELADO')),
      projected_revenue REAL DEFAULT 0,
      actual_revenue REAL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(payment_status IN ('PENDENTE', 'RECEBIDO', 'ATRASADO', 'PARCIAL')),
      campaign_start_date TEXT,
      campaign_end_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 6. Arquitetura Multiagente: Agentes de IA Credenciados
    CREATE TABLE IF NOT EXISTS egotv_agents (
      id TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      permissions TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PAUSED', 'REVOKED')),
      last_activity TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 7. Logs de Auditoria de Ações dos Agentes
    CREATE TABLE IF NOT EXISTS egotv_agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      agent_name TEXT,
      action TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      affected_record_id TEXT,
      result_status TEXT NOT NULL CHECK(result_status IN ('SUCCESS', 'ERROR', 'WARN')),
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES egotv_agents(id) ON DELETE CASCADE
    );
  `);

  // Semeia agente inicial caso não exista
  const existingMasterAgent = db.prepare("SELECT id FROM egotv_agents WHERE id = 'agent-egotv-master'").get();
  if (!existingMasterAgent) {
    db.prepare(`
      INSERT INTO egotv_agents (id, agent_name, agent_type, api_key, permissions, status, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      'agent-egotv-master',
      'EgoTV Master Intelligence Agent',
      'ORCHESTRATOR',
      'egotv_sec_live_' + Buffer.from('agent-egotv-master-live-token').toString('base64'),
      JSON.stringify(['Leitura', 'Pesquisa', 'Cadastro', 'Edição', 'Analytics', 'Publicação', 'Administração']),
      'ACTIVE'
    );

    db.prepare(`
      INSERT INTO egotv_agents (id, agent_name, agent_type, api_key, permissions, status, last_activity)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      'agent-curator-01',
      'Viral Radar Scraper & Classifier',
      'CURATOR',
      'egotv_sec_live_' + Buffer.from('agent-curator-01-live-token').toString('base64'),
      JSON.stringify(['Leitura', 'Pesquisa', 'Cadastro', 'Edição']),
      'ACTIVE'
    );
  }
}
