import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.ts';

export const egotvRouter = Router();

// Middleware de Autenticação e Auditoria Multiagente
export function authenticateEgoTVAgent(requiredPermission?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const agentKeyHeader = req.headers['x-agent-key'];
    const apiKey = (agentKeyHeader as string) || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    // Se for chamada interna do frontend humano (sem chave), prossegue como Operador Humano
    if (!apiKey) {
      (req as any).agent = {
        id: 'operator-human',
        agent_name: 'Operador EgoTV (Web UI)',
        agent_type: 'HUMAN_OPERATOR',
        permissions: ['Leitura', 'Pesquisa', 'Cadastro', 'Edição', 'Analytics', 'Publicação', 'Administração'],
      };
      return next();
    }

    // Validação de Chave de Agente
    const agent = db.prepare(`
      SELECT id, agent_name, agent_type, permissions, status FROM egotv_agents WHERE api_key = ?
    `).get(apiKey) as any;

    if (!agent) {
      res.status(401).json({ error: 'Chave de agente de IA inválida ou não autorizada.' });
      return;
    }

    if (agent.status !== 'ACTIVE') {
      res.status(403).json({ error: `Agente de IA está com status "${agent.status}". Acesso suspenso.` });
      return;
    }

    const permissions: string[] = JSON.parse(agent.permissions || '[]');
    if (requiredPermission && !permissions.includes(requiredPermission) && !permissions.includes('Administração')) {
      res.status(403).json({
        error: `Agente não possui a permissão requerida: "${requiredPermission}". Permissões ativas: ${permissions.join(', ')}`
      });
      return;
    }

    // Atualiza last_activity do agente
    db.prepare("UPDATE egotv_agents SET last_activity = datetime('now') WHERE id = ?").run(agent.id);

    (req as any).agent = {
      ...agent,
      permissions,
    };
    next();
  };
}

// Helper para registrar log de auditoria multiagente
function logAgentAction(agentId: string, agentName: string, action: string, endpoint: string, recordId: string | number | null, resultStatus: 'SUCCESS' | 'ERROR' | 'WARN', details?: string) {
  try {
    db.prepare(`
      INSERT INTO egotv_agent_logs (agent_id, agent_name, action, endpoint, affected_record_id, result_status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(agentId, agentName, action, endpoint, recordId ? String(recordId) : null, resultStatus, details || null);
  } catch (err) {
    console.error('Falha ao registrar log de auditoria do agente:', err);
  }
}

// -------------------------------------------------------------
// 1. GET /api/egotv/dashboard - KPIs e Visão Operacional Consolidada
// -------------------------------------------------------------
egotvRouter.get('/dashboard', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '7D'; // 24H, 7D, 30D, ALL
    const platform = (req.query.platform as string) || 'ALL';
    const category = (req.query.category as string) || 'ALL';
    const status = (req.query.status as string) || 'ALL';

    // Total de tendências encontradas hoje
    const trendsToday = db.prepare(`
      SELECT count(*) as total FROM egotv_trends 
      WHERE date(discovered_at) = date('now')
    `).get() as any;

    // Vídeos selecionados no pipeline
    const selectedVideos = db.prepare(`
      SELECT count(*) as total FROM egotv_kanban_tasks
      WHERE stage IN ('Selecionado', 'Aguardando produção')
    `).get() as any;

    // Vídeos em produção
    const inProduction = db.prepare(`
      SELECT count(*) as total FROM egotv_kanban_tasks
      WHERE stage IN ('Em edição', 'Aguardando produção')
    `).get() as any;

    // Publicações agendadas
    const scheduledPubs = db.prepare(`
      SELECT count(*) as total FROM egotv_publications
      WHERE status = 'Agendado'
    `).get() as any;

    // Publicações realizadas
    const completedPubs = db.prepare(`
      SELECT count(*) as total FROM egotv_publications
      WHERE status = 'Publicado'
    `).get() as any;

    // Métricas reais agregadas de analytics
    const metrics = db.prepare(`
      SELECT 
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(likes), 0) as total_likes,
        COALESCE(SUM(comments), 0) as total_comments,
        COALESCE(SUM(shares), 0) as total_shares,
        COALESCE(SUM(saves), 0) as total_saves,
        COALESCE(AVG(retention_rate), 0) as avg_retention_rate,
        COALESCE(AVG(avg_watch_time_seconds), 0) as avg_watch_time,
        COALESCE(SUM(followers_gained), 0) as total_followers,
        COALESCE(SUM(revenue), 0) as total_revenue
      FROM egotv_analytics
    `).get() as any;

    // Receita de monetização comercial confirmada
    const monetizationRevenue = db.prepare(`
      SELECT COALESCE(SUM(actual_revenue), 0) as actual_revenue,
             COALESCE(SUM(projected_revenue), 0) as projected_revenue
      FROM egotv_monetization
      WHERE payment_status = 'RECEBIDO'
    `).get() as any;

    // Top 5 tarefas recentes do Kanban
    const recentTasks = db.prepare(`
      SELECT id, title, stage, category, source_platform, responsible, scheduled_for, updated_at
      FROM egotv_kanban_tasks
      ORDER BY updated_at DESC LIMIT 5
    `).all();

    // Top 5 agentes ativos
    const activeAgents = db.prepare(`
      SELECT id, agent_name, agent_type, status, last_activity
      FROM egotv_agents
      ORDER BY last_activity DESC LIMIT 5
    `).all();

    res.json({
      kpis: {
        videosFoundToday: trendsToday.total,
        videosSelected: selectedVideos.total,
        videosInProduction: inProduction.total,
        publicationsScheduled: scheduledPubs.total,
        publicationsCompleted: completedPubs.total,
        totalViews: metrics.total_views,
        totalFollowersGained: metrics.total_followers,
        totalShares: metrics.total_shares,
        averageRetentionRate: Number((metrics.avg_retention_rate || 0).toFixed(1)),
        averageWatchTimeSeconds: Number((metrics.avg_watch_time || 0).toFixed(1)),
        totalRevenue: Number((metrics.total_revenue + monetizationRevenue.actual_revenue).toFixed(2)),
        projectedRevenue: Number(monetizationRevenue.projected_revenue.toFixed(2))
      },
      filters: { period, platform, category, status },
      recentTasks,
      activeAgents,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao carregar Dashboard da EgoTV: ' + err.message });
  }
});

// -------------------------------------------------------------
// 2. MÓDULO DE RADAR VIRAL: GET & POST /api/egotv/trends
// -------------------------------------------------------------
egotvRouter.get('/trends', authenticateEgoTVAgent('Pesquisa'), (req: Request, res: Response) => {
  try {
    const { category, platform, status, search } = req.query;
    let query = "SELECT * FROM egotv_trends WHERE 1=1";
    const params: any[] = [];

    if (category && category !== 'ALL') {
      query += " AND category = ?";
      params.push(category);
    }
    if (platform && platform !== 'ALL') {
      query += " AND platform = ?";
      params.push(platform);
    }
    if (status && status !== 'ALL') {
      query += " AND status = ?";
      params.push(status);
    }
    if (search) {
      query += " AND (title LIKE ? OR description LIKE ? OR viral_reason LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += " ORDER BY viral_score DESC, discovered_at DESC";
    const trends = db.prepare(query).all(...params);
    res.json({ trends, count: trends.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao listar tendências virais: ' + err.message });
  }
});

egotvRouter.post('/trends', authenticateEgoTVAgent('Cadastro'), (req: Request, res: Response) => {
  try {
    const {
      title,
      source_url,
      platform = 'TIKTOK',
      category = 'Outros',
      views_observed = null,
      likes_observed = null,
      comments_observed = null,
      shares_observed = null,
      description = '',
      viral_reason = '',
      viral_score = 50,
      notes = ''
    } = req.body;

    if (!title || !source_url) {
      res.status(400).json({ error: 'Título e URL original são obrigatórios.' });
      return;
    }

    const agent = (req as any).agent;
    const insert = db.prepare(`
      INSERT INTO egotv_trends (
        title, source_url, platform, category, views_observed, likes_observed,
        comments_observed, shares_observed, description, viral_reason, viral_score,
        status, notes, created_by_agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(
      title,
      source_url,
      platform,
      category,
      views_observed,
      likes_observed,
      comments_observed,
      shares_observed,
      description,
      viral_reason,
      Math.min(100, Math.max(0, Number(viral_score) || 50)),
      notes,
      agent?.id || null
    );

    const trendId = insert.lastInsertRowid;
    logAgentAction(agent.id, agent.agent_name, 'REGISTER_TREND', '/api/egotv/trends', trendId, 'SUCCESS', `Tendência cadastrada: ${title}`);

    res.status(201).json({
      success: true,
      trendId,
      message: 'Tendência viral registrada com sucesso!'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao cadastrar tendência viral: ' + err.message });
  }
});

// -------------------------------------------------------------
// 3. CURADORIA & KANBAN (10 Etapas): GET, POST, PATCH /api/egotv/content & /api/egotv/tasks
// -------------------------------------------------------------
egotvRouter.get('/content', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    const { stage, category, platform } = req.query;
    let query = "SELECT * FROM egotv_kanban_tasks WHERE 1=1";
    const params: any[] = [];

    if (stage && stage !== 'ALL') {
      query += " AND stage = ?";
      params.push(stage);
    }
    if (category && category !== 'ALL') {
      query += " AND category = ?";
      params.push(category);
    }
    if (platform && platform !== 'ALL') {
      query += " AND source_platform = ?";
      params.push(platform);
    }

    query += " ORDER BY updated_at DESC";
    const tasks = db.prepare(query).all(...params);
    res.json({ content: tasks, count: tasks.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao consultar conteúdos/tarefas: ' + err.message });
  }
});

egotvRouter.get('/tasks', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  // Alias de /content para conformidade estrita com o item 11 da especificação
  try {
    const tasks = db.prepare("SELECT * FROM egotv_kanban_tasks ORDER BY updated_at DESC").all();
    res.json({ tasks, count: tasks.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao listar tarefas: ' + err.message });
  }
});

egotvRouter.post('/content', authenticateEgoTVAgent('Cadastro'), (req: Request, res: Response) => {
  try {
    const {
      trend_id = null,
      title,
      stage = 'Descoberto',
      category = 'Outros',
      source_platform = 'TIKTOK',
      original_url = '',
      responsible = 'Operador EgoTV',
      attached_file_path = null,
      attached_file_name = null,
      caption = '',
      hook = '',
      hashtags = '',
      cta = '',
      usage_rights_status = 'PENDENTE',
      usage_rights_notes = '',
      scheduled_for = null,
      priority = 'MEDIA'
    } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Título do conteúdo é obrigatório.' });
      return;
    }

    const agent = (req as any).agent;
    const insert = db.prepare(`
      INSERT INTO egotv_kanban_tasks (
        trend_id, title, stage, category, source_platform, original_url, responsible,
        attached_file_path, attached_file_name, caption, hook, hashtags, cta,
        usage_rights_status, usage_rights_notes, scheduled_for, priority, created_by_agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      trend_id,
      title,
      stage,
      category,
      source_platform,
      original_url,
      responsible,
      attached_file_path,
      attached_file_name,
      caption,
      hook,
      hashtags,
      cta,
      usage_rights_status,
      usage_rights_notes,
      scheduled_for,
      priority,
      agent?.id || null
    );

    const taskId = insert.lastInsertRowid;
    logAgentAction(agent.id, agent.agent_name, 'CREATE_CONTENT_TASK', '/api/egotv/content', taskId, 'SUCCESS', `Conteúdo #${taskId} criado na etapa ${stage}`);

    res.status(201).json({
      success: true,
      taskId,
      message: 'Tarefa de produção cadastrada no quadro Kanban!'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar conteúdo: ' + err.message });
  }
});

egotvRouter.post('/tasks', authenticateEgoTVAgent('Cadastro'), (req: Request, res: Response) => {
  // Alias direto de POST /content
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Título da tarefa é obrigatório.' });
    return;
  }
  return egotvRouter.handle(req, res, () => {});
});

egotvRouter.patch('/content/:id', authenticateEgoTVAgent('Edição'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const task = db.prepare("SELECT * FROM egotv_kanban_tasks WHERE id = ?").get(id) as any;
    if (!task) {
      res.status(404).json({ error: 'Conteúdo não encontrado.' });
      return;
    }

    const allowedFields = [
      'stage', 'title', 'category', 'responsible', 'attached_file_path',
      'attached_file_name', 'caption', 'hook', 'hashtags', 'cta',
      'usage_rights_status', 'usage_rights_notes', 'scheduled_for', 'priority'
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
      return;
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE egotv_kanban_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const agent = (req as any).agent;
    logAgentAction(agent.id, agent.agent_name, 'UPDATE_CONTENT_TASK', `/api/egotv/content/${id}`, id, 'SUCCESS', `Atualizado: ${updates.join(', ')}`);

    const updatedTask = db.prepare("SELECT * FROM egotv_kanban_tasks WHERE id = ?").get(id);
    res.json({ success: true, task: updatedTask, message: 'Conteúdo atualizado com sucesso!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar conteúdo: ' + err.message });
  }
});

// -------------------------------------------------------------
// 4. MÓDULO DE PUBLICAÇÕES: GET & POST /api/egotv/publications
// -------------------------------------------------------------
egotvRouter.get('/publications', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    const { platform, status, date } = req.query;
    let query = "SELECT * FROM egotv_publications WHERE 1=1";
    const params: any[] = [];

    if (platform && platform !== 'ALL') {
      query += " AND platform = ?";
      params.push(platform);
    }
    if (status && status !== 'ALL') {
      query += " AND status = ?";
      params.push(status);
    }
    if (date) {
      query += " AND date(scheduled_at) = date(?)";
      params.push(date);
    }

    query += " ORDER BY scheduled_at ASC, id DESC";
    const publications = db.prepare(query).all(...params);
    res.json({ publications, count: publications.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao consultar publicações: ' + err.message });
  }
});

egotvRouter.post('/publications', authenticateEgoTVAgent('Publicação'), (req: Request, res: Response) => {
  try {
    const {
      task_id = null,
      channel_id = 'ego-filmes',
      platform,
      title,
      caption = '',
      hook = '',
      hashtags = '',
      cta = '',
      media_url = '',
      scheduled_at = null,
      status = 'Agendado',
      target_daily_slot = 1
    } = req.body;

    if (!platform || !title) {
      res.status(400).json({ error: 'Plataforma e título são obrigatórios para a publicação.' });
      return;
    }

    // Regra: até 15 conteúdos por dia por plataforma
    const targetDate = scheduled_at ? scheduled_at.split('T')[0] : new Date().toISOString().split('T')[0];
    const dailyCount = db.prepare(`
      SELECT count(*) as total FROM egotv_publications
      WHERE platform = ? AND date(scheduled_at) = date(?)
    `).get(platform, targetDate) as any;

    if (dailyCount.total >= 15) {
      res.status(400).json({
        error: `Limite de 15 publicações diárias atingido para a plataforma ${platform} em ${targetDate}.`
      });
      return;
    }

    const agent = (req as any).agent;
    const insert = db.prepare(`
      INSERT INTO egotv_publications (
        task_id, channel_id, platform, title, caption, hook, hashtags, cta,
        media_url, status, scheduled_at, target_daily_slot, created_by_agent_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task_id,
      channel_id,
      platform,
      title,
      caption,
      hook,
      hashtags,
      cta,
      media_url,
      status,
      scheduled_at || new Date().toISOString(),
      target_daily_slot,
      agent?.id || null
    );

    const pubId = insert.lastInsertRowid;
    logAgentAction(agent.id, agent.agent_name, 'SCHEDULE_PUBLICATION', '/api/egotv/publications', pubId, 'SUCCESS', `Publicação #${pubId} agendada para ${platform}`);

    res.status(201).json({
      success: true,
      publicationId: pubId,
      message: `Publicação programada com sucesso na plataforma ${platform}!`
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar publicação: ' + err.message });
  }
});

egotvRouter.patch('/publications/:id', authenticateEgoTVAgent('Publicação'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, scheduled_at, post_url, error_message, operator_approved } = req.body;

    const pub = db.prepare("SELECT * FROM egotv_publications WHERE id = ?").get(id);
    if (!pub) {
      res.status(404).json({ error: 'Publicação não encontrada.' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) {
      updates.push("status = ?");
      values.push(status);
      if (status === 'Publicado') {
        updates.push("published_at = datetime('now')");
      }
    }
    if (scheduled_at !== undefined) {
      updates.push("scheduled_at = ?");
      values.push(scheduled_at);
    }
    if (post_url !== undefined) {
      updates.push("post_url = ?");
      values.push(post_url);
    }
    if (error_message !== undefined) {
      updates.push("error_message = ?");
      values.push(error_message);
    }
    if (operator_approved !== undefined) {
      updates.push("operator_approved = ?");
      values.push(operator_approved ? 1 : 0);
    }

    updates.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(`UPDATE egotv_publications SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const agent = (req as any).agent;
    logAgentAction(agent.id, agent.agent_name, 'UPDATE_PUBLICATION', `/api/egotv/publications/${id}`, id, 'SUCCESS', `Status: ${status}`);

    res.json({ success: true, message: 'Publicação atualizada!' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atualizar publicação: ' + err.message });
  }
});

// -------------------------------------------------------------
// 5. MÓDULO DE ANALYTICS: GET & POST /api/egotv/analytics
// -------------------------------------------------------------
egotvRouter.get('/analytics', authenticateEgoTVAgent('Analytics'), (req: Request, res: Response) => {
  try {
    const records = db.prepare(`
      SELECT a.*, p.post_url, p.channel_id
      FROM egotv_analytics a
      LEFT JOIN egotv_publications p ON a.publication_id = p.id
      ORDER BY a.recorded_at DESC
    `).all();

    // Top 10 Conteúdos por Visualizações Reais
    const top10 = db.prepare(`
      SELECT id, title, platform, views, likes, comments, shares, retention_rate, revenue
      FROM egotv_analytics
      WHERE views > 0
      ORDER BY views DESC
      LIMIT 10
    `).all();

    // Desempenho Agregado por Plataforma
    const platformBreakdown = db.prepare(`
      SELECT platform, 
             count(*) as posts_tracked,
             SUM(views) as total_views,
             SUM(likes) as total_likes,
             SUM(shares) as total_shares,
             AVG(retention_rate) as avg_retention
      FROM egotv_analytics
      GROUP BY platform
    `).all();

    res.json({
      records,
      top10,
      platformBreakdown,
      count: records.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao consultar analytics: ' + err.message });
  }
});

egotvRouter.post('/analytics', authenticateEgoTVAgent('Analytics'), (req: Request, res: Response) => {
  try {
    const {
      publication_id = null,
      title,
      platform,
      category = 'Entretenimento',
      views = 0,
      likes = 0,
      comments = 0,
      shares = 0,
      saves = 0,
      avg_watch_time_seconds = null,
      completion_rate = null,
      retention_rate = null,
      followers_gained = 0,
      revenue = 0,
      is_manual_entry = 1,
      notes = ''
    } = req.body;

    if (!title || !platform) {
      res.status(400).json({ error: 'Título e plataforma são obrigatórios.' });
      return;
    }

    const insert = db.prepare(`
      INSERT INTO egotv_analytics (
        publication_id, title, platform, category, views, likes, comments,
        shares, saves, avg_watch_time_seconds, completion_rate, retention_rate,
        followers_gained, revenue, is_manual_entry, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      publication_id,
      title,
      platform,
      category,
      views,
      likes,
      comments,
      shares,
      saves,
      avg_watch_time_seconds,
      completion_rate,
      retention_rate,
      followers_gained,
      revenue,
      is_manual_entry ? 1 : 0,
      notes
    );

    const agent = (req as any).agent;
    logAgentAction(agent.id, agent.agent_name, 'RECORD_ANALYTICS', '/api/egotv/analytics', insert.lastInsertRowid, 'SUCCESS', `Métricas registradas para "${title}"`);

    res.status(201).json({
      success: true,
      analyticsId: insert.lastInsertRowid,
      message: 'Métricas de desempenho registradas com sucesso!'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao registrar analytics: ' + err.message });
  }
});

// -------------------------------------------------------------
// 6. SISTEMA DE INTELIGÊNCIA: GET /api/egotv/intelligence
// -------------------------------------------------------------
egotvRouter.get('/intelligence', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    // Categorias com melhor engajamento e retenção média
    const categoryStats = db.prepare(`
      SELECT category,
             COUNT(*) as sample_size,
             AVG(retention_rate) as avg_retention,
             SUM(views) as total_views,
             SUM(shares) as total_shares
      FROM egotv_analytics
      WHERE retention_rate IS NOT NULL
      GROUP BY category
      ORDER BY avg_retention DESC
    `).all();

    // Identificação de ganchos vencedores (baseado em retention_rate e comentários)
    const winningHooks = db.prepare(`
      SELECT t.hook, t.category, a.retention_rate, a.views, a.shares
      FROM egotv_kanban_tasks t
      JOIN egotv_analytics a ON a.publication_id = t.id OR a.title = t.title
      WHERE t.hook IS NOT NULL AND t.hook != '' AND a.retention_rate >= 60
      ORDER BY a.retention_rate DESC
      LIMIT 5
    `).all();

    // Recomendações baseadas em dados reais armazenados
    const recommendations: string[] = [];
    if (categoryStats.length > 0) {
      recommendations.push(`A categoria "${(categoryStats[0] as any).category}" apresenta a maior retenção média (${(categoryStats[0] as any).avg_retention}%). Priorize novos cortes nessa linha.`);
    } else {
      recommendations.push('Aguardando acúmulo de métricas analíticas para consolidar recomendações estatísticas por categoria.');
    }

    res.json({
      categoryGrowth: categoryStats,
      winningHooks,
      optimalDurationAnalysis: {
        shortVideoRange: '25-45 segundos',
        sweetSpotRetention: '38s com gancho nos primeiros 2.5s'
      },
      bestPostingHours: [
        { hour: '11:30 - 13:00', reason: 'Pico de almoço e engajamento no TikTok/Reels' },
        { hour: '18:00 - 20:30', reason: 'Maior taxa de compartilhamentos e retenção noturna' }
      ],
      recommendations
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro no módulo de inteligência: ' + err.message });
  }
});

// -------------------------------------------------------------
// 7. MÓDULO DE MONETIZAÇÃO: GET & POST /api/egotv/monetization
// -------------------------------------------------------------
egotvRouter.get('/monetization', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    const deals = db.prepare("SELECT * FROM egotv_monetization ORDER BY created_at DESC").all();
    
    const summary = db.prepare(`
      SELECT 
        COALESCE(SUM(actual_revenue), 0) as total_actual_revenue,
        COALESCE(SUM(projected_revenue), 0) as total_projected_revenue,
        COUNT(CASE WHEN negotiation_status = 'ATIVO' THEN 1 END) as active_deals,
        COUNT(CASE WHEN negotiation_status IN ('PROSPECTANDO', 'EM_NEGOCIACAO', 'PROPOSTA_ENVIADA') THEN 1 END) as open_opportunities
      FROM egotv_monetization
    `).get() as any;

    const byPlatform = db.prepare(`
      SELECT platform, COALESCE(SUM(actual_revenue), 0) as revenue
      FROM egotv_monetization
      WHERE payment_status = 'RECEBIDO'
      GROUP BY platform
    `).all();

    res.json({
      deals,
      summary,
      byPlatform
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao consultar monetização: ' + err.message });
  }
});

egotvRouter.post('/monetization', authenticateEgoTVAgent('Edição'), (req: Request, res: Response) => {
  try {
    const {
      title,
      type,
      platform = 'TODAS',
      advertiser_name = '',
      contact_info = '',
      negotiation_status = 'EM_NEGOCIACAO',
      projected_revenue = 0,
      actual_revenue = 0,
      payment_status = 'PENDENTE',
      notes = ''
    } = req.body;

    if (!title || !type) {
      res.status(400).json({ error: 'Título e tipo de monetização são obrigatórios.' });
      return;
    }

    const insert = db.prepare(`
      INSERT INTO egotv_monetization (
        title, type, platform, advertiser_name, contact_info, negotiation_status,
        projected_revenue, actual_revenue, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      type,
      platform,
      advertiser_name,
      contact_info,
      negotiation_status,
      Number(projected_revenue) || 0,
      Number(actual_revenue) || 0,
      payment_status,
      notes
    );

    const agent = (req as any).agent;
    logAgentAction(agent.id, agent.agent_name, 'CREATE_MONETIZATION', '/api/egotv/monetization', insert.lastInsertRowid, 'SUCCESS', `Negócio cadastrado: ${title}`);

    res.status(201).json({
      success: true,
      monetizationId: insert.lastInsertRowid,
      message: 'Oportunidade de monetização registrada!'
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao cadastrar oportunidade de monetização: ' + err.message });
  }
});

// -------------------------------------------------------------
// 8. ARQUITETURA MULTIAGENTE: GET & POST /api/egotv/agents & LOGS
// -------------------------------------------------------------
egotvRouter.get('/agents', authenticateEgoTVAgent('Administração'), (req: Request, res: Response) => {
  try {
    const agents = db.prepare(`
      SELECT id, agent_name, agent_type, permissions, status, last_activity, created_at
      FROM egotv_agents
      ORDER BY created_at DESC
    `).all();

    // Sanitiza para não expor a api_key privada completa
    const safeAgents = agents.map((a: any) => ({
      ...a,
      permissions: JSON.parse(a.permissions || '[]')
    }));

    res.json({ agents: safeAgents, count: safeAgents.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao listar agentes: ' + err.message });
  }
});

egotvRouter.post('/agents', authenticateEgoTVAgent('Administração'), (req: Request, res: Response) => {
  try {
    const { id, agent_name, agent_type = 'SPECIALIST', permissions = ['Leitura'] } = req.body;

    if (!id || !agent_name) {
      res.status(400).json({ error: 'ID e Nome do agente são obrigatórios.' });
      return;
    }

    const generatedApiKey = 'egotv_sec_' + Math.random().toString(36).slice(2) + Buffer.from(id + Date.now()).toString('base64').replace(/=/g, '');

    db.prepare(`
      INSERT INTO egotv_agents (id, agent_name, agent_type, api_key, permissions, status)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      id,
      agent_name,
      agent_type,
      generatedApiKey,
      JSON.stringify(permissions)
    );

    const callerAgent = (req as any).agent;
    logAgentAction(callerAgent.id, callerAgent.agent_name, 'REGISTER_AGENT', '/api/egotv/agents', id, 'SUCCESS', `Novo agente registrado: ${agent_name}`);

    res.status(201).json({
      success: true,
      agent: {
        id,
        agent_name,
        agent_type,
        permissions,
        apiKey: generatedApiKey,
        warning: 'Guarde esta chave com segurança. Ela não será exibida novamente por completo.'
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao credenciar agente de IA: ' + err.message });
  }
});

egotvRouter.get('/agent-logs', authenticateEgoTVAgent('Administração'), (req: Request, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM egotv_agent_logs
      ORDER BY created_at DESC
      LIMIT 100
    `).all();
    res.json({ logs, count: logs.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar logs de auditoria dos agentes: ' + err.message });
  }
});

// -------------------------------------------------------------
// 9. RELATÓRIOS: GET /api/egotv/reports
// -------------------------------------------------------------
egotvRouter.get('/reports', authenticateEgoTVAgent('Leitura'), (req: Request, res: Response) => {
  try {
    const { type = 'DAILY' } = req.query;

    const report = {
      generatedAt: new Date().toISOString(),
      reportType: type,
      productionSummary: {
        totalDiscovered: (db.prepare("SELECT count(*) as c FROM egotv_trends").get() as any).c,
        totalInKanban: (db.prepare("SELECT count(*) as c FROM egotv_kanban_tasks").get() as any).c,
        totalPublished: (db.prepare("SELECT count(*) as c FROM egotv_publications WHERE status = 'Publicado'").get() as any).c,
      },
      distributionByPlatform: db.prepare(`
        SELECT platform, count(*) as count FROM egotv_publications GROUP BY platform
      `).all(),
      financialSnapshot: db.prepare(`
        SELECT 
          COALESCE(SUM(actual_revenue), 0) as realized_revenue,
          COALESCE(SUM(projected_revenue), 0) as pipeline_revenue
        FROM egotv_monetization
      `).get(),
      topPerformingContent: db.prepare(`
        SELECT title, platform, views, likes, shares, retention_rate
        FROM egotv_analytics
        ORDER BY views DESC LIMIT 5
      `).all(),
      activeAIAgentsCount: (db.prepare("SELECT count(*) as c FROM egotv_agents WHERE status = 'ACTIVE'").get() as any).c
    };

    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao gerar relatório consolidado: ' + err.message });
  }
});
