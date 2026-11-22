import React, { useState, useEffect } from 'react';
import {
  Activity,
  Radar,
  FolderKanban,
  Send,
  BarChart3,
  Lightbulb,
  DollarSign,
  Bot,
  FileCode2,
  Calendar,
  Filter,
  RefreshCw,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Share2,
  Eye,
  Users,
  Copy,
  Check,
  Search,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Video
} from 'lucide-react';

type SubTab =
  | 'DASHBOARD'
  | 'RADAR'
  | 'KANBAN'
  | 'PUBLICATIONS'
  | 'ANALYTICS'
  | 'INTELLIGENCE'
  | 'MONETIZATION'
  | 'AGENTS'
  | 'DOCS';

const KANBAN_STAGES = [
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
];

const CATEGORIES = [
  'Humor',
  'Entretenimento',
  'Curiosidades',
  'Podcasts',
  'Dinheiro e lifestyle',
  'Notícias',
  'Animais',
  'Outros'
];

export const EgoTVOperations: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('DASHBOARD');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Filtros Globais
  const [filterPeriod, setFilterPeriod] = useState('7D');
  const [filterPlatform, setFilterPlatform] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterAgent, setFilterAgent] = useState('ALL');

  // Dados do Dashboard
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Dados do Radar Viral
  const [trends, setTrends] = useState<any[]>([]);
  const [trendSearch, setTrendSearch] = useState('');
  const [showAddTrendModal, setShowAddTrendModal] = useState(false);
  const [newTrend, setNewTrend] = useState({
    title: '',
    source_url: '',
    platform: 'TIKTOK',
    category: 'Entretenimento',
    description: '',
    viral_reason: '',
    viral_score: 85,
    views_observed: '',
    likes_observed: '',
    comments_observed: '',
    shares_observed: ''
  });

  // Dados do Kanban
  const [kanbanTasks, setKanbanTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    stage: 'Descoberto',
    category: 'Entretenimento',
    source_platform: 'TIKTOK',
    original_url: '',
    responsible: 'Operador EgoTV',
    caption: '',
    hook: '',
    hashtags: '#EgoTV #Viral #Shorts',
    cta: 'Siga para mais vídeos e acesse Ego TV!',
    usage_rights_status: 'PENDENTE',
    scheduled_for: '',
    priority: 'MEDIA'
  });

  // Dados de Publicações
  const [publications, setPublications] = useState<any[]>([]);
  const [calendarView, setCalendarView] = useState<'daily' | 'weekly'>('daily');
  const [selectedPubDate, setSelectedPubDate] = useState(new Date().toISOString().split('T')[0]);

  // Analytics & Métricas
  const [analyticsRecords, setAnalyticsRecords] = useState<any[]>([]);
  const [top10, setTop10] = useState<any[]>([]);
  const [platformBreakdown, setPlatformBreakdown] = useState<any[]>([]);
  const [showAddMetricModal, setShowAddMetricModal] = useState(false);
  const [newMetric, setNewMetric] = useState({
    title: '',
    platform: 'TIKTOK',
    category: 'Entretenimento',
    views: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    avg_watch_time_seconds: '',
    completion_rate: '',
    retention_rate: '',
    followers_gained: '',
    revenue: ''
  });

  // Inteligência
  const [intelligenceData, setIntelligenceData] = useState<any>(null);

  // Monetização
  const [monetizationData, setMonetizationData] = useState<any>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDeal, setNewDeal] = useState({
    title: '',
    type: 'PROGRAMA_PLATAFORMA',
    platform: 'TIKTOK',
    advertiser_name: '',
    contact_info: '',
    negotiation_status: 'EM_NEGOCIACAO',
    projected_revenue: '',
    actual_revenue: '',
    payment_status: 'PENDENTE',
    notes: ''
  });

  // Agentes
  const [agents, setAgents] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgent, setNewAgent] = useState({
    id: '',
    agent_name: '',
    agent_type: 'SPECIALIST',
    permissions: ['Leitura', 'Pesquisa', 'Cadastro', 'Edição']
  });
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);

  const notify = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Carregamento de Dados da API
  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/egotv/dashboard?period=${filterPeriod}&platform=${filterPlatform}&category=${filterCategory}&status=${filterStatus}`);
      const data = await res.json();
      if (res.ok) setDashboardData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTrends = async () => {
    try {
      const q = new URLSearchParams({
        platform: filterPlatform,
        category: filterCategory,
        status: filterStatus,
        search: trendSearch
      });
      const res = await fetch(`/api/egotv/trends?${q.toString()}`);
      const data = await res.json();
      if (res.ok) setTrends(data.trends || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchContentAndTasks = async () => {
    try {
      const res = await fetch(`/api/egotv/content?stage=${filterStatus}&category=${filterCategory}&platform=${filterPlatform}`);
      const data = await res.json();
      if (res.ok) setKanbanTasks(data.content || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPublications = async () => {
    try {
      const res = await fetch(`/api/egotv/publications?platform=${filterPlatform}&status=${filterStatus}`);
      const data = await res.json();
      if (res.ok) setPublications(data.publications || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/egotv/analytics');
      const data = await res.json();
      if (res.ok) {
        setAnalyticsRecords(data.records || []);
        setTop10(data.top10 || []);
        setPlatformBreakdown(data.platformBreakdown || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchIntelligence = async () => {
    try {
      const res = await fetch('/api/egotv/intelligence');
      const data = await res.json();
      if (res.ok) setIntelligenceData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMonetization = async () => {
    try {
      const res = await fetch('/api/egotv/monetization');
      const data = await res.json();
      if (res.ok) setMonetizationData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgentsAndLogs = async () => {
    try {
      const [resAgents, resLogs] = await Promise.all([
        fetch('/api/egotv/agents'),
        fetch('/api/egotv/agent-logs')
      ]);
      const dataA = await resAgents.json();
      const dataL = await resLogs.json();
      if (resAgents.ok) setAgents(dataA.agents || []);
      if (resLogs.ok) setAgentLogs(dataL.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboard(),
      fetchTrends(),
      fetchContentAndTasks(),
      fetchPublications(),
      fetchAnalytics(),
      fetchIntelligence(),
      fetchMonetization(),
      fetchAgentsAndLogs()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [filterPeriod, filterPlatform, filterCategory, filterStatus]);

  // Handlers
  const handleCreateTrend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/egotv/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTrend,
          views_observed: newTrend.views_observed ? Number(newTrend.views_observed) : null,
          likes_observed: newTrend.likes_observed ? Number(newTrend.likes_observed) : null,
          comments_observed: newTrend.comments_observed ? Number(newTrend.comments_observed) : null,
          shares_observed: newTrend.shares_observed ? Number(newTrend.shares_observed) : null,
          viral_score: Number(newTrend.viral_score)
        })
      });
      const data = await res.json();
      if (res.ok) {
        notify('Tendência cadastrada no Radar Viral!');
        setShowAddTrendModal(false);
        setNewTrend({
          title: '',
          source_url: '',
          platform: 'TIKTOK',
          category: 'Entretenimento',
          description: '',
          viral_reason: '',
          viral_score: 85,
          views_observed: '',
          likes_observed: '',
          comments_observed: '',
          shares_observed: ''
        });
        fetchTrends();
        fetchDashboard();
      } else {
        notify(data.error || 'Erro ao cadastrar.', 'error');
      }
    } catch (e) {
      notify('Falha de conexão.', 'error');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/egotv/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask)
      });
      const data = await res.json();
      if (res.ok) {
        notify('Conteúdo adicionado ao fluxo de produção!');
        setShowTaskModal(false);
        fetchContentAndTasks();
        fetchDashboard();
      } else {
        notify(data.error || 'Erro ao adicionar tarefa.', 'error');
      }
    } catch (e) {
      notify('Falha de conexão.', 'error');
    }
  };

  const handleUpdateTaskStage = async (taskId: number, newStage: string) => {
    try {
      const res = await fetch(`/api/egotv/content/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });
      if (res.ok) {
        notify(`Conteúdo #${taskId} movido para "${newStage}"`);
        fetchContentAndTasks();
        fetchDashboard();
      }
    } catch (e) {
      notify('Erro ao atualizar etapa.', 'error');
    }
  };

  const handleCreateMetric = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/egotv/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMetric,
          views: Number(newMetric.views) || 0,
          likes: Number(newMetric.likes) || 0,
          comments: Number(newMetric.comments) || 0,
          shares: Number(newMetric.shares) || 0,
          saves: Number(newMetric.saves) || 0,
          avg_watch_time_seconds: newMetric.avg_watch_time_seconds ? Number(newMetric.avg_watch_time_seconds) : null,
          retention_rate: newMetric.retention_rate ? Number(newMetric.retention_rate) : null,
          followers_gained: Number(newMetric.followers_gained) || 0,
          revenue: Number(newMetric.revenue) || 0,
          is_manual_entry: 1
        })
      });
      const data = await res.json();
      if (res.ok) {
        notify('Métricas registradas com sucesso!');
        setShowAddMetricModal(false);
        fetchAnalytics();
        fetchDashboard();
      } else {
        notify(data.error || 'Erro ao registrar métricas.', 'error');
      }
    } catch (e) {
      notify('Erro de conexão.', 'error');
    }
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/egotv/monetization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDeal)
      });
      const data = await res.json();
      if (res.ok) {
        notify('Oportunidade cadastrada no painel financeiro!');
        setShowAddDealModal(false);
        fetchMonetization();
        fetchDashboard();
      } else {
        notify(data.error || 'Erro ao cadastrar oportunidade.', 'error');
      }
    } catch (e) {
      notify('Erro de conexão.', 'error');
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/egotv/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent)
      });
      const data = await res.json();
      if (res.ok) {
        setCreatedApiKey(data.agent?.apiKey);
        notify('Agente credenciado com sucesso!');
        fetchAgentsAndLogs();
      } else {
        notify(data.error || 'Erro ao credenciar agente.', 'error');
      }
    } catch (e) {
      notify('Erro de conexão.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* ALERTA FLUTUANTE */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* CABEÇALHO DO MÓDULO EGOTV OPERATIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-[#0b101b] to-slate-900/90 border border-cyan-500/30 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">EgoTV Operations</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PRODUÇÃO & MULTIAGENTE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Painel operacional unificado para Radar Viral, Kanban de Produção (10 etapas), Publicações Multiplataforma, Analytics Real e Integração com Agentes de IA.
            </p>
          </div>
        </div>

        {/* FILTROS GLOBAIS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Período */}
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
          >
            <option value="24H">Últimas 24h</option>
            <option value="7D">Últimos 7 dias</option>
            <option value="30D">Últimos 30 dias</option>
            <option value="ALL">Todo o período</option>
          </select>

          {/* Plataforma */}
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">Todas Plataformas</option>
            <option value="TIKTOK">TikTok</option>
            <option value="INSTAGRAM_REELS">Instagram Reels</option>
            <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
          </select>

          {/* Categoria */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:border-cyan-500 focus:outline-none"
          >
            <option value="ALL">Todas Categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={refreshAll}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
            title="Atualizar Dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* BARRA DE SUB-ABAS DE OPERAÇÃO */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
        {[
          { id: 'DASHBOARD', label: 'Dashboard Geral', icon: Activity },
          { id: 'RADAR', label: 'Radar Viral', icon: Radar, badge: trends.length },
          { id: 'KANBAN', label: 'Curadoria & Kanban (10)', icon: FolderKanban, badge: kanbanTasks.length },
          { id: 'PUBLICATIONS', label: 'Publicações & Calendário', icon: Send, badge: publications.length },
          { id: 'ANALYTICS', label: 'Analytics & Ranking', icon: BarChart3 },
          { id: 'INTELLIGENCE', label: 'Inteligência Estratégica', icon: Lightbulb },
          { id: 'MONETIZATION', label: 'Monetização & Contratos', icon: DollarSign },
          { id: 'AGENTS', label: 'Arquitetura Multiagente', icon: Bot, badge: agents.length },
          { id: 'DOCS', label: 'API & Documentação', icon: FileCode2 }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                active
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          SUB-ABA 1: DASHBOARD GERAL
         ========================================================================= */}
      {subTab === 'DASHBOARD' && dashboardData && (
        <div className="space-y-6">
          {/* CARDS DE KPIS EXIGIDOS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Vídeos Encontrados Hoje</span>
              <div className="mt-2 text-2xl font-bold font-mono text-white">
                {dashboardData.kpis.videosFoundToday}
              </div>
              <span className="text-[10px] text-cyan-400">Descobertos pelo Radar</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Vídeos Selecionados</span>
              <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
                {dashboardData.kpis.videosSelected}
              </div>
              <span className="text-[10px] text-slate-400">Na fila de curadoria</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Vídeos em Produção</span>
              <div className="mt-2 text-2xl font-bold font-mono text-indigo-400">
                {dashboardData.kpis.videosInProduction}
              </div>
              <span className="text-[10px] text-indigo-300">Em edição / formatação</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Publicações Agendadas</span>
              <div className="mt-2 text-2xl font-bold font-mono text-purple-400">
                {dashboardData.kpis.publicationsScheduled}
              </div>
              <span className="text-[10px] text-purple-300">Na grade de distribuição</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Publicações Realizadas</span>
              <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                {dashboardData.kpis.publicationsCompleted}
              </div>
              <span className="text-[10px] text-emerald-300">Veiculadas com sucesso</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Visualizações Totais</span>
              <div className="mt-2 text-2xl font-bold font-mono text-white">
                {dashboardData.kpis.totalViews.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10px] text-slate-400">Métricas reais consolidadas</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Seguidores Conquistados</span>
              <div className="mt-2 text-2xl font-bold font-mono text-teal-400">
                +{dashboardData.kpis.totalFollowersGained.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10px] text-slate-400">Crescimento orgânico</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Compartilhamentos</span>
              <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                {dashboardData.kpis.totalShares.toLocaleString('pt-BR')}
              </div>
              <span className="text-[10px] text-amber-300">Fator de viralidade</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Retenção Média</span>
              <div className="mt-2 text-2xl font-bold font-mono text-cyan-300">
                {dashboardData.kpis.averageRetentionRate}%
              </div>
              <span className="text-[10px] text-slate-400">Tempo médio: {dashboardData.kpis.averageWatchTimeSeconds}s</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Receita Gerada</span>
              <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                R$ {dashboardData.kpis.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">Projeção: R$ {dashboardData.kpis.projectedRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* VISÃO GERAL DE TAREFAS RECENTES E AGENTES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-cyan-400" />
                  Atividades Recentes no Funil Operacional
                </h3>
                <button
                  onClick={() => setSubTab('KANBAN')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Ver Kanban Completo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {dashboardData.recentTasks?.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">Nenhuma tarefa recente cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {dashboardData.recentTasks.map((t: any) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-200">{t.title}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{t.category}</span>
                          <span>{t.source_platform}</span>
                          <span>• Resp: {t.responsible}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        {t.stage}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-400" />
                  Agentes de IA Conectados
                </h3>
                <button
                  onClick={() => setSubTab('AGENTS')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  Gerenciar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2.5">
                {dashboardData.activeAgents?.map((a: any) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200">{a.agent_name}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-mono">{a.agent_type}</span>
                      <span>Atividade: {a.last_activity ? new Date(a.last_activity).toLocaleTimeString('pt-BR') : 'Agora'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 2: RADAR VIRAL
         ========================================================================= */}
      {subTab === 'RADAR' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar tendências por título, tema ou gatilho viral..."
                value={trendSearch}
                onChange={(e) => setTrendSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchTrends()}
                className="w-full bg-slate-900 border border-slate-800 pl-9 pr-3 py-2 text-xs rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={() => setShowAddTrendModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Nova Tendência
            </button>
          </div>

          {/* LISTAGEM DE TENDÊNCIAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trends.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
                Nenhuma tendência cadastrada ainda. Use o botão acima para adicionar referências virais.
              </div>
            ) : (
              trends.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-cyan-300">
                        {t.category}
                      </span>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
                        <TrendingUp className="w-3 h-3" />
                        <span>Score: {t.viral_score}/100</span>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-white line-clamp-2">{t.title}</h4>

                    {t.description && (
                      <p className="text-xs text-slate-300 line-clamp-2">{t.description}</p>
                    )}

                    {t.viral_reason && (
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-amber-200/90">
                        <span className="font-semibold text-amber-300">Potencial: </span>
                        {t.viral_reason}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="grid grid-cols-4 gap-1 text-center text-[10px] text-slate-400">
                      <div>
                        <span className="block font-mono text-slate-200">
                          {t.views_observed !== null ? t.views_observed.toLocaleString('pt-BR') : 'N/D'}
                        </span>
                        Views
                      </div>
                      <div>
                        <span className="block font-mono text-slate-200">
                          {t.likes_observed !== null ? t.likes_observed.toLocaleString('pt-BR') : 'N/D'}
                        </span>
                        Likes
                      </div>
                      <div>
                        <span className="block font-mono text-slate-200">
                          {t.comments_observed !== null ? t.comments_observed.toLocaleString('pt-BR') : 'N/D'}
                        </span>
                        Coment.
                      </div>
                      <div>
                        <span className="block font-mono text-slate-200">
                          {t.shares_observed !== null ? t.shares_observed.toLocaleString('pt-BR') : 'N/D'}
                        </span>
                        Shares
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Link Original
                      </a>
                      <button
                        onClick={async () => {
                          // Promove tendência para o Kanban de produção
                          const res = await fetch('/api/egotv/content', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              trend_id: t.id,
                              title: t.title,
                              stage: 'Selecionado',
                              category: t.category,
                              source_platform: t.platform,
                              original_url: t.source_url,
                              responsible: 'Operador EgoTV'
                            })
                          });
                          if (res.ok) {
                            notify('Tendência enviada diretamente para o Kanban de Produção!');
                            fetchContentAndTasks();
                            setSubTab('KANBAN');
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1"
                      >
                        Enviar p/ Produção <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 3: CURADORIA & KANBAN (10 ETAPAS EXIGIDAS)
         ========================================================================= */}
      {subTab === 'KANBAN' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Quadro Kanban de Produção Diária</h3>
              <p className="text-xs text-slate-400">
                10 etapas estruturadas da esteira EgoTV com observações, ganchos, direitos e publicação.
              </p>
            </div>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              Novo Conteúdo no Funil
            </button>
          </div>

          {/* COLUNAS KANBAN */}
          <div className="flex gap-3 overflow-x-auto pb-4">
            {KANBAN_STAGES.map((stage, idx) => {
              const stageTasks = kanbanTasks.filter((t) => t.stage === stage);
              return (
                <div
                  key={stage}
                  className="w-72 shrink-0 rounded-2xl bg-slate-900/60 border border-slate-800 p-3 flex flex-col space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-semibold text-slate-200">
                      {idx + 1}. {stage}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                      {stageTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px]">
                    {stageTasks.length === 0 ? (
                      <div className="py-8 text-center text-[11px] text-slate-600">Vazio</div>
                    ) : (
                      stageTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/40 transition space-y-2.5 text-xs shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-mono bg-slate-800 text-slate-300">
                              {task.category}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">#{task.id}</span>
                          </div>

                          <h5 className="font-semibold text-white line-clamp-2">{task.title}</h5>

                          {task.hook && (
                            <div className="p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[10px] text-amber-300">
                              <span className="font-bold">Gancho:</span> {task.hook}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                            <span>{task.source_platform}</span>
                            <span className="text-emerald-400 font-mono">{task.usage_rights_status}</span>
                          </div>

                          {/* AVANÇAR ETAPA RÁPIDO */}
                          <div className="flex items-center justify-between pt-1">
                            <select
                              value={task.stage}
                              onChange={(e) => handleUpdateTaskStage(task.id, e.target.value)}
                              className="bg-slate-900 border border-slate-800 text-[10px] text-slate-300 rounded px-1.5 py-1 focus:outline-none"
                            >
                              {KANBAN_STAGES.map((s) => (
                                <option key={s} value={s}>
                                  Mover para: {s}
                                </option>
                              ))}
                            </select>

                            {task.stage === 'Aprovado' && (
                              <button
                                onClick={async () => {
                                  // Agenda publicação direta
                                  const res = await fetch('/api/egotv/publications', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      task_id: task.id,
                                      platform: task.source_platform === 'INSTAGRAM_REELS' ? 'INSTAGRAM_REELS' : 'TIKTOK',
                                      title: task.title,
                                      caption: task.caption,
                                      hook: task.hook,
                                      hashtags: task.hashtags,
                                      cta: task.cta
                                    })
                                  });
                                  if (res.ok) {
                                    notify(`Conteúdo #${task.id} agendado para publicação!`);
                                    handleUpdateTaskStage(task.id, 'Agendado');
                                    fetchPublications();
                                  }
                                }}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold"
                              >
                                Agendar
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 4: PUBLICAÇÕES & CALENDÁRIO (TIKTOK, REELS, SHORTS)
         ========================================================================= */}
      {subTab === 'PUBLICATIONS' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Grade de Publicações e Distribuição</h3>
              <p className="text-xs text-slate-400">
                Até 15 conteúdos diários distribuídos entre TikTok, Instagram Reels e YouTube Shorts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedPubDate}
                onChange={(e) => setSelectedPubDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none"
              />
              <button
                onClick={() => setCalendarView(calendarView === 'daily' ? 'weekly' : 'daily')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 font-medium"
              >
                Visualização: {calendarView === 'daily' ? 'Diária' : 'Semanal'}
              </button>
            </div>
          </div>

          {/* TABELA DE PUBLICAÇÕES */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">ID / Título</th>
                  <th className="p-3">Plataforma</th>
                  <th className="p-3">Horário Agendado</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Aprovação do Operador</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {publications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Nenhuma publicação agendada ou realizada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  publications.map((pub) => (
                    <tr key={pub.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 space-y-1">
                        <span className="font-semibold text-white block">{pub.title}</span>
                        {pub.hook && <span className="text-[10px] text-amber-300 block">Gancho: {pub.hook}</span>}
                        {pub.post_url && (
                          <a
                            href={pub.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" /> Ver Post Oficial
                          </a>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-200">
                          {pub.platform}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">
                        {pub.scheduled_at ? new Date(pub.scheduled_at).toLocaleString('pt-BR') : 'Imediato'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            pub.status === 'Publicado'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : pub.status === 'Falhou'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-purple-500/20 text-purple-300'
                          }`}
                        >
                          {pub.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {pub.operator_approved ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1 text-[11px]">
                            <Clock className="w-3.5 h-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {pub.status !== 'Publicado' && (
                            <button
                              onClick={async () => {
                                const res = await fetch(`/api/egotv/publications/${pub.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'Publicado' })
                                });
                                if (res.ok) {
                                  notify(`Publicação #${pub.id} marcada como realizada!`);
                                  fetchPublications();
                                  fetchDashboard();
                                }
                              }}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold"
                            >
                              Publicar Agora
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/egotv/publications/${pub.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'Falhou', error_message: 'Cancelado pelo operador' })
                              });
                              if (res.ok) {
                                notify(`Publicação #${pub.id} cancelada.`);
                                fetchPublications();
                              }
                            }}
                            className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px]"
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 5: ANALYTICS & RANKING TOP 10
         ========================================================================= */}
      {subTab === 'ANALYTICS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Desempenho Individual de Publicações</h3>
              <p className="text-xs text-slate-400">
                Visualizações reais, retenção média, engajamento e ranking Top 10 oficial.
              </p>
            </div>
            <button
              onClick={() => setShowAddMetricModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              Lançar Métrica Manual
            </button>
          </div>

          {/* TOP 10 RANKING */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Top 10 Melhores Conteúdos (Alcance Real)
            </h4>

            <div className="space-y-2">
              {top10.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhum dado analítico registrado ainda.</p>
              ) : (
                top10.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold flex items-center justify-center text-xs">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-white">{item.title}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{item.platform}</span>
                          <span>• Retenção: {item.retention_rate}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[9px]">VIEWS</span>
                        <span className="text-white font-bold">{item.views.toLocaleString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">LIKES</span>
                        <span className="text-cyan-300">{item.likes.toLocaleString('pt-BR')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">SHARES</span>
                        <span className="text-amber-300">{item.shares.toLocaleString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 6: INTELIGÊNCIA ESTRATÉGICA
         ========================================================================= */}
      {subTab === 'INTELLIGENCE' && intelligenceData && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-white">Camada de Inteligência e Descoberta de Padrões</h3>
            <p className="text-xs text-slate-400">
              Análise estatística sobre categorias em alta, formatos vencedores e horários ótimos de postagem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Duração Ótima de Vídeo
              </h4>
              <p className="text-xs text-slate-300">
                Faixa recomendada: <span className="font-bold text-white">{intelligenceData.optimalDurationAnalysis?.shortVideoRange}</span>
              </p>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                {intelligenceData.optimalDurationAnalysis?.sweetSpotRetention}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Melhores Janelas de Publicação
              </h4>
              <div className="space-y-2">
                {intelligenceData.bestPostingHours?.map((slot: any) => (
                  <div
                    key={slot.hour}
                    className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs flex justify-between"
                  >
                    <span className="font-bold text-white font-mono">{slot.hour}</span>
                    <span className="text-slate-400">{slot.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              Recomendações Baseadas em Dados Reais
            </h4>
            <div className="space-y-2">
              {intelligenceData.recommendations?.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                  <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 7: MONETIZAÇÃO & CONTRATOS
         ========================================================================= */}
      {subTab === 'MONETIZATION' && monetizationData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Painel de Oportunidades Financeiras e Monetização</h3>
              <p className="text-xs text-slate-400">
                Receita por plataforma, campanhas patrocinadas, afiliados e contratos comerciais.
              </p>
            </div>
            <button
              onClick={() => setShowAddDealModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              Nova Oportunidade Comercial
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400">Receita Efetivamente Recebida</span>
              <div className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                R$ {monetizationData.summary.total_actual_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400">Pipeline Projetado</span>
              <div className="mt-2 text-2xl font-bold font-mono text-cyan-400">
                R$ {monetizationData.summary.total_projected_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400">Contratos Ativos</span>
              <div className="mt-2 text-2xl font-bold font-mono text-white">
                {monetizationData.summary.active_deals}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[11px] text-slate-400">Oportunidades em Aberto</span>
              <div className="mt-2 text-2xl font-bold font-mono text-amber-400">
                {monetizationData.summary.open_opportunities}
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Título / Tipo</th>
                  <th className="p-3">Plataforma</th>
                  <th className="p-3">Anunciante / Contato</th>
                  <th className="p-3">Status Negociação</th>
                  <th className="p-3">Valor Realizado</th>
                  <th className="p-3">Pagamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {monetizationData.deals?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      Nenhum contrato de monetização registrado ainda.
                    </td>
                  </tr>
                ) : (
                  monetizationData.deals.map((d: any) => (
                    <tr key={d.id} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-semibold text-white">
                        {d.title}
                        <span className="block text-[10px] text-slate-400 font-normal">{d.type}</span>
                      </td>
                      <td className="p-3 font-mono">{d.platform}</td>
                      <td className="p-3">{d.advertiser_name || 'Direto'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/20 text-cyan-300">
                          {d.negotiation_status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-400 font-bold">
                        R$ {Number(d.actual_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            d.payment_status === 'RECEBIDO'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {d.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 8: ARQUITETURA MULTIAGENTE & AUDITORIA
         ========================================================================= */}
      {subTab === 'AGENTS' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Agentes de Inteligência Conectados</h3>
              <p className="text-xs text-slate-400">
                Gestão de credenciais, chaves seguras, permissões granulares e logs de auditoria multiagente.
              </p>
            </div>
            <button
              onClick={() => {
                setCreatedApiKey(null);
                setShowAddAgentModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition"
            >
              <Plus className="w-4 h-4" />
              Credenciar Novo Agente de IA
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-bold text-white">{agent.agent_name}</h5>
                    <span className="font-mono text-[10px] text-cyan-400">{agent.id}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                    {agent.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-mono">Permissões Concedidas:</span>
                  <div className="flex flex-wrap gap-1">
                    {agent.permissions.map((p: string) => (
                      <span key={p} className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex justify-between">
                  <span>Tipo: {agent.agent_type}</span>
                  <span>Última Atividade: {agent.last_activity ? new Date(agent.last_activity).toLocaleString('pt-BR') : 'Sem registro'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* LOGS DE AUDITORIA DE AÇÕES DOS AGENTES */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
              Logs Recentes de Auditoria Multiagente
            </h4>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {agentLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhuma ação registrada ainda.</p>
              ) : (
                agentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-[11px] flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="font-mono text-cyan-300 font-semibold">{log.agent_name || log.agent_id}</span>
                      <span className="text-slate-400 block">{log.action} ({log.endpoint})</span>
                      {log.details && <span className="text-[10px] text-slate-300 block">{log.details}</span>}
                    </div>
                    <div className="text-right">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
                        {log.result_status}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SUB-ABA 9: DOCUMENTAÇÃO DA API PARA AGENTES
         ========================================================================= */}
      {subTab === 'DOCS' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-cyan-400" />
              Documentação Oficial dos Endpoints REST — EgoTV Operations
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Agentes externos de IA autenticam-se enviando o cabeçalho <code className="text-cyan-300">X-Agent-Key: &lt;API_KEY&gt;</code> ou <code className="text-cyan-300">Authorization: Bearer &lt;API_KEY&gt;</code>. Todas as chamadas registram telemetria e auditoria automática.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { method: 'GET', path: '/api/egotv/dashboard', desc: 'Retorna KPIs consolidados, filtros operacionais e estado geral.' },
              { method: 'GET', path: '/api/egotv/trends', desc: 'Consulta lista de tendências descobertas no Radar Viral.' },
              { method: 'POST', path: '/api/egotv/trends', desc: 'Cadastra nova tendência descoberta por um agente scraper.' },
              { method: 'GET', path: '/api/egotv/content', desc: 'Consulta os conteúdos em curadoria e produção no Kanban.' },
              { method: 'POST', path: '/api/egotv/content', desc: 'Cria nova tarefa de produção associada ou livre.' },
              { method: 'PATCH', path: '/api/egotv/content/:id', desc: 'Atualiza etapa (stage), gancho, legenda ou direitos do vídeo.' },
              { method: 'GET', path: '/api/egotv/tasks', desc: 'Alias para listagem completa de tarefas do Kanban.' },
              { method: 'POST', path: '/api/egotv/tasks', desc: 'Alias para criação de tarefa.' },
              { method: 'GET', path: '/api/egotv/publications', desc: 'Consulta publicações agendadas e grade diária.' },
              { method: 'POST', path: '/api/egotv/publications', desc: 'Agenda publicação respeitando a regra de 15/dia por plataforma.' },
              { method: 'GET', path: '/api/egotv/analytics', desc: 'Consulta métricas individuais e ranking Top 10.' },
              { method: 'POST', path: '/api/egotv/analytics', desc: 'Registra métricas reais ou manuais para uma publicação.' },
              { method: 'GET', path: '/api/egotv/agents', desc: 'Lista os agentes de IA autorizados e status.' },
              { method: 'POST', path: '/api/egotv/agents', desc: 'Credencia um novo agente de IA e gera API key segura.' },
              { method: 'GET', path: '/api/egotv/reports', desc: 'Gera relatórios executivos consolidados em JSON.' }
            ].map((ep) => (
              <div
                key={ep.path + ep.method}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                      ep.method === 'GET'
                        ? 'bg-blue-500/20 text-blue-300'
                        : ep.method === 'POST'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-white font-semibold">{ep.path}</span>
                </div>
                <span className="text-slate-400 text-[11px]">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAIS DE CRIAÇÃO
         ========================================================================= */}
      {/* Modal: Nova Tendência */}
      {showAddTrendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Cadastrar Tendência no Radar Viral</h3>
            <form onSubmit={handleCreateTrend} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título do Conteúdo</label>
                <input
                  type="text"
                  required
                  value={newTrend.title}
                  onChange={(e) => setNewTrend({ ...newTrend, title: e.target.value })}
                  placeholder="Ex: Cena Interstellar — Paradoxo Temporal"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">URL Original</label>
                <input
                  type="url"
                  required
                  value={newTrend.source_url}
                  onChange={(e) => setNewTrend({ ...newTrend, source_url: e.target.value })}
                  placeholder="https://www.tiktok.com/@..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Plataforma</label>
                  <select
                    value={newTrend.platform}
                    onChange={(e) => setNewTrend({ ...newTrend, platform: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM_REELS">Instagram Reels</option>
                    <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Categoria</label>
                  <select
                    value={newTrend.category}
                    onChange={(e) => setNewTrend({ ...newTrend, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Score Viral (0 a 100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newTrend.viral_score}
                    onChange={(e) => setNewTrend({ ...newTrend, viral_score: Number(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Visualizações Observadas</label>
                  <input
                    type="number"
                    value={newTrend.views_observed}
                    onChange={(e) => setNewTrend({ ...newTrend, views_observed: e.target.value })}
                    placeholder="Ex: 5000000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Motivo do Potencial Viral</label>
                <textarea
                  value={newTrend.viral_reason}
                  onChange={(e) => setNewTrend({ ...newTrend, viral_reason: e.target.value })}
                  placeholder="Por que esse vídeo viralizou ou vai engajar?"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white h-16"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTrendModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Salvar Tendência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Conteúdo no Kanban */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Adicionar Tarefa de Produção</h3>
            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Ex: Corte Viral: Cena Peaky Blinders"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Etapa Inicial</label>
                  <select
                    value={newTask.stage}
                    onChange={(e) => setNewTask({ ...newTask, stage: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    {KANBAN_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Categoria</label>
                  <select
                    value={newTask.category}
                    onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Gancho Inicial (Hook)</label>
                <input
                  type="text"
                  value={newTask.hook}
                  onChange={(e) => setNewTask({ ...newTask, hook: e.target.value })}
                  placeholder="Ex: Ninguém esperava o que ele fez depois disso..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Criar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lançar Métrica Manual */}
      {showAddMetricModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Lançar Métricas Reais de Desempenho</h3>
            <form onSubmit={handleCreateMetric} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título do Post</label>
                <input
                  type="text"
                  required
                  value={newMetric.title}
                  onChange={(e) => setNewMetric({ ...newMetric, title: e.target.value })}
                  placeholder="Ex: Edit Interstellar 4K"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Plataforma</label>
                  <select
                    value={newMetric.platform}
                    onChange={(e) => setNewMetric({ ...newMetric, platform: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM_REELS">Instagram Reels</option>
                    <option value="YOUTUBE_SHORTS">YouTube Shorts</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Visualizações</label>
                  <input
                    type="number"
                    required
                    value={newMetric.views}
                    onChange={(e) => setNewMetric({ ...newMetric, views: e.target.value })}
                    placeholder="Ex: 125000"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Likes</label>
                  <input
                    type="number"
                    value={newMetric.likes}
                    onChange={(e) => setNewMetric({ ...newMetric, likes: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Comentários</label>
                  <input
                    type="number"
                    value={newMetric.comments}
                    onChange={(e) => setNewMetric({ ...newMetric, comments: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Shares</label>
                  <input
                    type="number"
                    value={newMetric.shares}
                    onChange={(e) => setNewMetric({ ...newMetric, shares: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Taxa de Retenção (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newMetric.retention_rate}
                    onChange={(e) => setNewMetric({ ...newMetric, retention_rate: e.target.value })}
                    placeholder="Ex: 72.5"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Receita Gerada (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMetric.revenue}
                    onChange={(e) => setNewMetric({ ...newMetric, revenue: e.target.value })}
                    placeholder="Ex: 150.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMetricModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Salvar Métricas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar Oportunidade Comercial */}
      {showAddDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Nova Oportunidade Financeira</h3>
            <form onSubmit={handleCreateDeal} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Título da Negociação</label>
                <input
                  type="text"
                  required
                  value={newDeal.title}
                  onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  placeholder="Ex: Patrocínio Marca X — Campanha Outono"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Tipo de Monetização</label>
                  <select
                    value={newDeal.type}
                    onChange={(e) => setNewDeal({ ...newDeal, type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="PROGRAMA_PLATAFORMA">Programa de Plataforma (Creator Rewards)</option>
                    <option value="CAMPANHA">Campanha Publicitária</option>
                    <option value="PATROCINIO">Patrocínio</option>
                    <option value="AFILIADO">Afiliado</option>
                    <option value="OPORTUNIDADE_COMERCIAL">Oportunidade Comercial</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Plataforma</label>
                  <select
                    value={newDeal.platform}
                    onChange={(e) => setNewDeal({ ...newDeal, platform: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="TODAS">Todas</option>
                    <option value="DIRETO">Direto EgoTV</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-1">Receita Realizada (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeal.actual_revenue}
                    onChange={(e) => setNewDeal({ ...newDeal, actual_revenue: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Receita Projetada (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newDeal.projected_revenue}
                    onChange={(e) => setNewDeal({ ...newDeal, projected_revenue: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDealModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Salvar Oportunidade
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Credenciar Agente de IA */}
      {showAddAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-sm font-bold text-white">Credenciar Novo Agente de IA</h3>
            {createdApiKey ? (
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Agente Credenciado com Sucesso!
                  </div>
                  <p>Copie e armazene a API Key com segurança para uso do agente externo:</p>
                  <div className="p-2 rounded bg-black/50 font-mono text-[11px] text-cyan-300 break-all select-all border border-slate-700">
                    {createdApiKey}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddAgentModal(false)}
                  className="w-full py-2 rounded-lg bg-slate-800 text-slate-200 font-semibold"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateAgent} className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Identificador Único (agent_id)</label>
                  <input
                    type="text"
                    required
                    value={newAgent.id}
                    onChange={(e) => setNewAgent({ ...newAgent, id: e.target.value })}
                    placeholder="Ex: agent-radar-crawler-02"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Nome do Agente</label>
                  <input
                    type="text"
                    required
                    value={newAgent.agent_name}
                    onChange={(e) => setNewAgent({ ...newAgent, agent_name: e.target.value })}
                    placeholder="Ex: Radar Deep Crawler"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tipo de Agente</label>
                  <select
                    value={newAgent.agent_type}
                    onChange={(e) => setNewAgent({ ...newAgent, agent_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                  >
                    <option value="CURATOR">CURATOR (Curadoria e Pesquisa)</option>
                    <option value="CREATOR">CREATOR (Copy e Ganchos)</option>
                    <option value="DISTRIBUTOR">DISTRIBUTOR (Publicador)</option>
                    <option value="ANALYST">ANALYST (Analytics e Métricas)</option>
                    <option value="ORCHESTRATOR">ORCHESTRATOR (Orquestrador Pleno)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAgentModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                  >
                    Gerar Credencial
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
