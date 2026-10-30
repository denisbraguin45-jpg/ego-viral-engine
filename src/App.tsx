import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Radar,
  FolderKanban,
  ShieldCheck,
  Wand2,
  CalendarClock,
  BarChart3,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Film,
  Sparkles,
  Tv,
  Upload,
  Plus,
  ExternalLink,
  Copy,
  Check,
  Search,
  Filter,
  Lock,
  Play,
  RefreshCw,
  LogOut,
  Eye,
  MousePointerClick,
  UserCheck,
  XCircle,
  FileCheck2,
  Link2
} from 'lucide-react';

type TabId = 'DASHBOARD' | 'RADAR' | 'PIPELINE' | 'INTELLIGENCE' | 'LIBRARY' | 'PREPARATION' | 'CALENDAR' | 'ANALYTICS' | 'CHANNELS';

const PIPELINE_STATE_LABELS: Record<string, { label: string; color: string }> = {
  ENCONTRADO: { label: '1. Encontrado', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  APROVADO_PARA_ANALISE: { label: '2. Aprovado p/ Análise', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  DIREITOS_PENDENTES: { label: '3. Direitos Pendentes', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  LIBERADO_PARA_UTILIZACAO: { label: '4. Liberado p/ Utilização', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  ARQUIVO_PENDENTE: { label: '5. Arquivo Pendente', color: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  ARQUIVO_RECEBIDO: { label: '6. Arquivo Recebido', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  EM_PREPARACAO: { label: '7. Em Preparação', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  PRONTO_PARA_PUBLICACAO: { label: '8. Pronto p/ Publicação', color: 'bg-teal-500/20 text-teal-200 border-teal-500/40' },
  AGENDADO: { label: '9. Agendado', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  PUBLICADO: { label: '10. Publicado', color: 'bg-emerald-500/25 text-emerald-200 border-emerald-500/50' },
  FALHA: { label: '11. Falha / Bloqueado', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
};

const WORKFLOW_LABELS: Record<string, { label: string; color: string }> = {
  IDENTIFIED: { label: 'Identificado', color: 'bg-slate-800 text-slate-300 border-slate-700' },
  IN_ANALYSIS: { label: 'Em Análise', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  RIGHTS_VERIFIED: { label: 'Direitos Verificados', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  APPROVED: { label: 'Aprovado', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  REJECTED: { label: 'Rejeitado', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  PREPARED: { label: 'Preparado', color: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  SCHEDULED: { label: 'Agendado', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  PUBLISHED: { label: 'Publicado', color: 'bg-teal-500/20 text-teal-200 border-teal-500/40' },
  FAILED: { label: 'Falha', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const RIGHTS_LABELS: Record<string, { label: string; badge: string }> = {
  PENDING_VERIFICATION: { label: 'Pendente de Verificação', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  VERIFIED_AUTHORIZED: { label: 'Direitos Autorizados', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  RESTRICTED_BLOCKED: { label: 'Restrito / Bloqueado', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
};

export default function App() {
  // Autenticação
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('ego_token'));
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('ego_user');
    return saved ? JSON.parse(saved) : { name: 'Operador Chefe Ego TV', email: 'admin@egotv.com.br', role: 'ADMIN' };
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('admin@egotv.com.br');
  const [loginPass, setLoginPass] = useState('egotv2026');
  const [loginError, setLoginError] = useState('');

  // Navegação e Filtros Globais
  const [activeTab, setActiveTab] = useState<TabId>('DASHBOARD');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [includeDemo, setIncludeDemo] = useState<boolean>(true);

  // Dados Principais
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [channelsData, setChannelsData] = useState<any>({ channels: [], totalDailyGoal: 90, integrations: null });
  const [radarData, setRadarData] = useState<{ sources: any[]; items: any[] }>({ sources: [], items: [] });
  const [pipelineData, setPipelineData] = useState<{ items: any[]; queuesByChannel: any[]; totalDailyGoal: number }>({
    items: [],
    queuesByChannel: [],
    totalDailyGoal: 90,
  });
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [queueData, setQueueData] = useState<{ queue: any[]; capabilities: any }>({ queue: [], capabilities: null });
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [intelligenceData, setIntelligenceData] = useState<{
    items: any[];
    summary: any;
    rules: any;
    queueStatus: any;
  }>({
    items: [],
    summary: null,
    rules: null,
    queueStatus: null,
  });
  const [intelligenceFilter, setIntelligenceFilter] = useState<string>('ALL');
  const [isAnalyzingBatch, setIsAnalyzingBatch] = useState<boolean>(false);
  const [cleanVersionUploadFiles, setCleanVersionUploadFiles] = useState<Record<number, File | null>>({});

  // Estados de operação do VIDEO PIPELINE
  const [pipelineQueueFilter, setPipelineQueueFilter] = useState<string>('ALL');
  const [pipelineStateFilter, setPipelineStateFilter] = useState<string>('ALL');
  const [activePipelineItem, setActivePipelineItem] = useState<any | null>(null);
  const [pipelineUploadFile, setPipelineUploadFile] = useState<File | null>(null);
  const [pipelineAcqMethod, setPipelineAcqMethod] = useState<'OPTION_B_MANUAL' | 'OPTION_C_UPLOAD'>('OPTION_C_UPLOAD');
  const [replaceForm, setReplaceForm] = useState({ new_source_url: '', new_title: '', rights_notes: '' });
  const [pipeScheduleTime, setPipeScheduleTime] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });

  // Feedback / Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const notify = (text: string, type: 'success' | 'error' | 'warn' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 5000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    notify(`${label} copiado para a área de transferência!`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Carregamento de dados da API
  const fetchAll = useCallback(async () => {
    try {
      const qsDash = new URLSearchParams({
        channelId: selectedChannel,
        platform: selectedPlatform,
        status: selectedStatus,
        includeDemo: String(includeDemo),
      });

      const [dashRes, chRes, radRes, pipeRes, libRes, qRes, anaRes, intRes] = await Promise.all([
        fetch(`/api/dashboard?${qsDash}`),
        fetch('/api/channels'),
        fetch(`/api/radar?channelId=${selectedChannel}`),
        fetch(`/api/pipeline?channelId=${selectedChannel}&includeDemo=${includeDemo}`),
        fetch(`/api/library?channelId=${selectedChannel}&workflowStatus=${selectedStatus}`),
        fetch(`/api/queue?channelId=${selectedChannel}&platform=${selectedPlatform}`),
        fetch(`/api/analytics?channelId=${selectedChannel}&includeDemo=${includeDemo}`),
        fetch(`/api/intelligence?channelId=${selectedChannel}&filter=${intelligenceFilter}`),
      ]);

      if (dashRes.ok) setDashboardData(await dashRes.json());
      if (chRes.ok) setChannelsData(await chRes.json());
      if (radRes.ok) setRadarData(await radRes.json());
      if (pipeRes.ok) setPipelineData(await pipeRes.json());
      if (libRes.ok) {
        const d = await libRes.json();
        setLibraryItems(d.items || []);
      }
      if (qRes.ok) setQueueData(await qRes.json());
      if (anaRes.ok) setAnalyticsData(await anaRes.json());
      if (intRes.ok) setIntelligenceData(await intRes.json());
    } catch (err: any) {
      console.error('Erro ao sincronizar dados:', err);
    }
  }, [selectedChannel, selectedPlatform, selectedStatus, includeDemo, intelligenceFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ============================================================================
  // ESTADOS DE FORMULÁRIOS DOS MÓDULOS
  // ============================================================================
  // Radar Form (Padrão: Apenas TikTok por Hashtags)
  const [newSourceType, setNewSourceType] = useState('KEYWORD');
  const [newSourceValue, setNewSourceValue] = useState('');
  const [newSourceChannel, setNewSourceChannel] = useState('ego-filmes');

  const [ttTagsFilmes, setTtTagsFilmes] = useState('#filmes, #dicadefilme, #cenadefilme, #cinema');
  const [ttTagsAnime, setTtTagsAnime] = useState('#anime, #animebrasil, #animes, #otakubr');
  const [ttTagsSeries, setTtTagsSeries] = useState('#series, #dicadeserie, #seriesbrasil, #maratonadeseries');
  const [isScanningTikTok, setIsScanningTikTok] = useState(false);

  const [radarForm, setRadarForm] = useState({
    channel_id: 'ego-filmes',
    source_url: '',
    platform: 'TIKTOK',
    title: '',
    franchise_or_work: '',
    views_observed: '',
    likes_observed: '',
    comments_observed: '',
    original_published_at: '',
    notes: '',
  });

  // Library / Upload Form
  const [libCategoryTab, setLibCategoryTab] = useState<string>('ALL');
  const [libSearch, setLibSearch] = useState<string>('');
  const [selectedContentModal, setSelectedContentModal] = useState<any | null>(null);
  const [uploadForm, setUploadForm] = useState({
    channel_id: 'ego-filmes',
    title: '',
    work_reference: '',
    source_url: '',
    duration_seconds: '45',
    resolution: '1080x1920',
    rights_license_notes: '',
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // Preparation Form
  const [prepContentId, setPrepContentId] = useState<number | ''>('');
  const [prepAngle, setPrepAngle] = useState<'HIGHLIGHT' | 'CURIOSITY' | 'DEBATE' | 'BEHIND_THE_SCENES'>('HIGHLIGHT');
  const [prepTiktok, setPrepTiktok] = useState('');
  const [prepInstagram, setPrepInstagram] = useState('');
  const [prepHashtags, setPrepHashtags] = useState('');
  const [prepCta, setPrepCta] = useState('');
  const [prepDuration, setPrepDuration] = useState('45');
  const [prepResolution, setPrepResolution] = useState('1080x1920');

  // Queue / Calendar Form
  const [calendarView, setCalendarView] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [schedContentId, setSchedContentId] = useState<number | ''>('');
  const [schedAccountId, setSchedAccountId] = useState<string>('tt-filmes');
  const [schedDateTime, setSchedDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [schedApproveNow, setSchedApproveNow] = useState<boolean>(true);

  // Analytics Form
  const [trackChannel, setTrackChannel] = useState('ego-filmes');
  const [trackPlatform, setTrackPlatform] = useState('TIKTOK');
  const [trackCampaign, setTrackCampaign] = useState('campanha_ego_out2026');
  const [trackCustomCode, setTrackCustomCode] = useState('');
  const [convCode, setConvCode] = useState('ego-filmes-tt-bio');
  const [convSubscriber, setConvSubscriber] = useState('');

  // Edição rápida de @handle e Token OAuth na conexão de contas sociais
  const [accountHandleInputs, setAccountHandleInputs] = useState<Record<string, string>>({});
  const [accountTokenInputs, setAccountTokenInputs] = useState<Record<string, string>>({});

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPass }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginError(data.error || 'Falha no login');
      return;
    }
    localStorage.setItem('ego_token', data.token);
    localStorage.setItem('ego_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setShowLoginModal(false);
    notify(`Bem-vindo, ${data.user.name}! Sessão operacional autenticada.`);
  };

  const handleAddRadarSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceValue.trim()) return;
    const res = await fetch('/api/radar/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: newSourceChannel,
        source_type: newSourceType,
        value: newSourceValue,
        platform_origin: 'YOUTUBE_OFFICIAL',
        priority: 9,
      }),
    });
    if (res.ok) {
      setNewSourceValue('');
      notify('Fonte/Palavra-chave cadastrada no Viral Radar!');
      fetchAll();
    }
  };

  const handleFetchOembed = async () => {
    if (!radarForm.source_url) {
      notify('Informe uma URL pública para buscar metadados oEmbed.', 'warn');
      return;
    }
    const res = await fetch('/api/radar/fetch-oembed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: radarForm.source_url }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Não foi possível buscar via oEmbed.', 'warn');
      return;
    }
    setRadarForm((prev) => ({
      ...prev,
      title: data.title || prev.title,
      franchise_or_work: data.author_name || prev.franchise_or_work,
    }));
    notify('Metadados carregados via oEmbed oficial!');
  };

  const handleCreateRadarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/radar/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(radarForm),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao registrar item no Radar.', 'error');
      return;
    }
    notify(`Tendência classificada! Score de Relevância: ${data.scoreBreakdown.relevanceScore}/100`);
    setRadarForm({
      channel_id: 'ego-filmes',
      source_url: '',
      platform: 'TIKTOK',
      title: '',
      franchise_or_work: '',
      views_observed: '',
      likes_observed: '',
      comments_observed: '',
      original_published_at: '',
      notes: '',
    });
    fetchAll();
  };

  const handleScanAndSeparateTikTokVirals = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsScanningTikTok(true);
    try {
      const res = await fetch('/api/radar/tiktok-tag-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_per_channel: 30,
          purge_non_tiktok: true,
          tags_filmes: ttTagsFilmes,
          tags_anime: ttTagsAnime,
          tags_series: ttTagsSeries,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Erro ao buscar virais do TikTok.', 'error');
        return;
      }
      notify(
        `90 Virais do TikTok buscados por tags (#filmes, #anime, #series) e separados para postagem nas 3 contas (30 em cada)!`
      );
      await fetchAll();
      setActiveTab('PIPELINE');
    } finally {
      setIsScanningTikTok(false);
    }
  };

  const handlePromoteRadarItem = async (id: number) => {
    const res = await fetch(`/api/radar/items/${id}/approve-to-pipeline`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      notify(
        `Candidato aprovado e encaminhado ao VIDEO PIPELINE (#${data.pipelineId} | Origem: ${data.originalExternalId})!`
      );
      await fetchAll();
      setActiveTab('PIPELINE');
    } else {
      notify(data.error || 'Erro ao aprovar candidato.', 'error');
    }
  };

  const handlePipelineRights = async (id: number, rights_status: string, rights_notes?: string) => {
    const res = await fetch(`/api/pipeline/${id}/rights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rights_status, rights_notes }),
    });
    const data = await res.json();
    if (res.ok) {
      notify(`Direitos atualizados! Estado do Pipeline: ${PIPELINE_STATE_LABELS[data.pipelineState]?.label || data.pipelineState}`);
      fetchAll();
    } else {
      notify(data.error || 'Erro ao atualizar direitos.', 'error');
    }
  };

  const handlePipelineAutoAcquire = async (id: number) => {
    const res = await fetch(`/api/pipeline/${id}/acquire-auto`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Bloqueio na obtenção automatizada.', 'error');
      return;
    }
    if (data.obtained) {
      notify(data.message, 'success');
    } else {
      notify(data.message, 'warn');
    }
    fetchAll();
  };

  const handlePipelineUploadFile = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!pipelineUploadFile) {
      notify('Selecione um arquivo de vídeo local (.mp4/.mov) para associar ao candidato.', 'warn');
      return;
    }
    const fd = new FormData();
    fd.append('videoFile', pipelineUploadFile);
    fd.append('acquisition_method', pipelineAcqMethod);

    const res = await fetch(`/api/pipeline/${id}/upload-file`, {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Falha ao importar arquivo.', 'error');
      return;
    }
    notify(`Arquivo "${data.fileName}" validado e associado ao candidato #${id}!`);
    setPipelineUploadFile(null);
    fetchAll();
  };

  const handlePipelineReplaceCandidate = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    const res = await fetch(`/api/pipeline/${id}/replace-candidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replaceForm),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Falha ao substituir candidato.', 'error');
      return;
    }
    notify(`Candidato substituído por nova fonte autorizada (${data.originalExternalId})!`);
    setReplaceForm({ new_source_url: '', new_title: '', rights_notes: '' });
    fetchAll();
  };

  const handlePipelinePrepare = async (item: any, mark_ready: boolean) => {
    const res = await fetch(`/api/pipeline/${item.id}/prepare`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption_tiktok: item.caption_tiktok,
        caption_instagram: item.caption_instagram,
        hashtags: item.hashtags,
        cta_text: item.cta_text,
        target_platforms: item.target_platforms,
        duration_seconds: item.duration_seconds,
        video_format: item.video_format,
        mark_ready,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao preparar vídeo.', 'error');
      return;
    }
    notify(
      mark_ready
        ? `Vídeo #${item.id} revisado e marcado como PRONTO PARA PUBLICAÇÃO!`
        : `Rascunho de preparação salvo!`
    );
    fetchAll();
  };

  const handlePipelineEnqueue = async (id: number, target_platforms?: string) => {
    const res = await fetch(`/api/pipeline/${id}/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_for: pipeScheduleTime,
        platforms_override: target_platforms,
        dispatch_immediately: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Bloqueio ao enviar para a fila.', 'error');
      return;
    }
    if (data.pipelineState === 'PUBLICADO') {
      const pubInfo = data.dispatchResults
        ?.map((d: any) => `${d.accountHandle} (${d.externalPostId || d.status})`)
        .join(', ');
      notify(`Fluxo concluído! Vídeo publicado na conta conectada: ${pubInfo}!`);
    } else {
      notify(
        `Sucesso! 1 vídeo preparado contabilizado na meta e ${data.publicationsCreated} publicação(ões) adicionada(s) à fila!`
      );
    }
    fetchAll();
  };

  const handleConnectSocialAccount = async (
    accountId: string,
    options?: { handle?: string; access_token?: string; connection_mode?: string; exclusive_mode?: boolean }
  ) => {
    const res = await fetch(`/api/social-accounts/${accountId}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao conectar conta social.', 'error');
      return;
    }
    notify(`Conta ${data.account?.platform} (${data.account?.handle}) CONECTADA e pronta para o fluxo!`);
    if (accountId === 'tt-filmes') {
      setSelectedChannel('ego-filmes');
      setPipelineQueueFilter('ego-filmes');
    }
    fetchAll();
  };

  const handleDisconnectSocialAccount = async (accountId: string) => {
    const res = await fetch(`/api/social-accounts/${accountId}/disconnect`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) {
      notify(`Conta ${data.account?.handle} desconectada.`);
      fetchAll();
    }
  };

  const handleAutoCurateAndPublish = async (channelId = 'ego-filmes') => {
    setIsAnalyzingBatch(true);
    try {
      const res = await fetch('/api/pipeline/auto-curate-and-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channelId,
          min_views: 10000000,
          block_incomplete_parts: true,
          block_off_topic: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error || 'Falha na curadoria e publicação automática.', 'error');
        return;
      }
      notify(
        `Automação Criteriosa concluída em ${data.accountHandle}: ${data.publishedCount} vídeos virais aprovados e PUBLICADOS automaticamente (${data.rejectedCount} vídeos barrados pelos critérios)!`
      );
      setSelectedChannel(channelId);
      setPipelineQueueFilter(channelId);
      fetchAll();
    } finally {
      setIsAnalyzingBatch(false);
    }
  };

  const handleUploadLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('channel_id', uploadForm.channel_id);
    fd.append('title', uploadForm.title);
    fd.append('work_reference', uploadForm.work_reference);
    fd.append('source_url', uploadForm.source_url);
    fd.append('duration_seconds', uploadForm.duration_seconds);
    fd.append('resolution', uploadForm.resolution);
    fd.append('rights_license_notes', uploadForm.rights_license_notes);
    if (uploadFile) {
      fd.append('videoFile', uploadFile);
    }

    const res = await fetch('/api/library', {
      method: 'POST',
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Falha ao cadastrar material.', 'error');
      return;
    }
    notify(`Material #${data.id} cadastrado na Biblioteca Central!`);
    setUploadForm({
      channel_id: 'ego-filmes',
      title: '',
      work_reference: '',
      source_url: '',
      duration_seconds: '45',
      resolution: '1080x1920',
      rights_license_notes: '',
    });
    setUploadFile(null);
    fetchAll();
  };

  const handleVerifyRights = async (id: number, rights_status: string, notes?: string) => {
    const res = await fetch(`/api/library/${id}/verify-rights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rights_status,
        rights_license_notes: notes || 'Direitos verificados pelo operador no painel de conformidade.',
        actor: user?.email || 'admin@egotv.com.br',
      }),
    });
    const data = await res.json();
    if (res.ok) {
      notify(`Situação de direitos atualizada para ${rights_status}!`);
      fetchAll();
      if (selectedContentModal?.id === id) {
        setSelectedContentModal((prev: any) => ({ ...prev, rights_status, workflow_status: data.workflow_status }));
      }
    } else {
      notify(data.error || 'Erro ao atualizar direitos.', 'error');
    }
  };

  const handleWorkflowTransition = async (id: number, target_status: string) => {
    const res = await fetch(`/api/library/${id}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_status,
        actor: user?.email || 'admin@egotv.com.br',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Transição bloqueada.', 'error');
      return;
    }
    notify(`Status atualizado para ${WORKFLOW_LABELS[target_status]?.label || target_status}!`);
    fetchAll();
    if (selectedContentModal?.id === id) {
      setSelectedContentModal((prev: any) => ({ ...prev, workflow_status: target_status }));
    }
  };

  const handleSelectPrepItem = (idStr: string) => {
    const id = Number(idStr);
    setPrepContentId(id || '');
    const found = libraryItems.find((i) => i.id === id);
    if (found) {
      setPrepTiktok(found.caption_tiktok || '');
      setPrepInstagram(found.caption_instagram || '');
      setPrepHashtags(found.hashtags || '');
      setPrepCta(found.cta_text || '');
      setPrepDuration(String(found.duration_seconds || 45));
      setPrepResolution(found.resolution || '1080x1920');
    }
  };

  const handleGenerateCopy = async () => {
    const found = libraryItems.find((i) => i.id === Number(prepContentId));
    if (!found) {
      notify('Selecione um material da biblioteca primeiro.', 'warn');
      return;
    }
    const res = await fetch('/api/preparation/generate-copy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: found.channel_id,
        title: found.title,
        work_reference: found.work_reference,
        angle: prepAngle,
        custom_hashtags: prepHashtags,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPrepTiktok(data.tiktokCaption);
      setPrepInstagram(data.instagramCaption);
      setPrepHashtags(data.hashtags);
      setPrepCta(data.ctaText);
      notify('Modelos de texto exclusivos para TikTok e Instagram gerados!');
    }
  };

  const handleSavePreparation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prepContentId) return;
    const res = await fetch(`/api/library/${prepContentId}/prepare`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption_tiktok: prepTiktok,
        caption_instagram: prepInstagram,
        hashtags: prepHashtags,
        cta_text: prepCta,
        duration_seconds: Number(prepDuration),
        resolution: prepResolution,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao salvar preparação.', 'error');
      return;
    }
    notify('Material preparado e validado tecnicamente para publicação!');
    fetchAll();
  };

  const handleSchedulePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedContentId) {
      notify('Selecione um vídeo autorizado para agendar.', 'warn');
      return;
    }
    const res = await fetch('/api/queue/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id: Number(schedContentId),
        social_account_id: schedAccountId,
        scheduled_for: schedDateTime,
        approved_for_publish: schedApproveNow,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Bloqueio ao agendar publicação.', 'error');
      return;
    }
    notify(`Agendamento registrado na fila (#${data.id})!`);
    fetchAll();
  };

  const handleDispatchQueueItem = async (id: number) => {
    const res = await fetch(`/api/queue/${id}/dispatch`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      notify(data.message, 'success');
    } else {
      notify(data.message || data.error, 'warn');
    }
    fetchAll();
  };

  const handleApproveQueueItem = async (id: number) => {
    const res = await fetch(`/api/queue/${id}/approve`, { method: 'POST' });
    if (res.ok) {
      notify('Item da fila aprovado pelo operador!');
      fetchAll();
    }
  };

  const handleCreateTrackingLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/analytics/tracking-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel_id: trackChannel,
        platform: trackPlatform,
        campaign_name: trackCampaign,
        custom_code: trackCustomCode,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      notify(`Link rastreável /r/${data.code} criado com sucesso!`);
      setTrackCustomCode('');
      fetchAll();
    } else {
      notify(data.error || 'Erro ao criar link.', 'error');
    }
  };

  const handleTestRealClick = async (code: string) => {
    const res = await fetch(`/r/${code}?preview=1`);
    const data = await res.json();
    if (res.ok) {
      notify(`Clique real contabilizado em /r/${code}! Total: ${data.newClicksCount} cliques.`);
      fetchAll();
    }
  };

  const handleRegisterConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/analytics/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tracking_code: convCode,
        subscriber_ref: convSubscriber,
        plan_type: 'MENSAL',
        revenue_brl: 29.9,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao atribuir assinatura.', 'error');
      return;
    }
    notify(`Assinatura atribuída com auditoria UTM ao código ${convCode}!`);
    setConvSubscriber('');
    fetchAll();
  };

  // Handlers do Módulo VIDEO INTELLIGENCE & WATERMARK DETECTOR
  const handleAnalyzeSingleVideo = async (pipelineId: number, forceReprocess = true) => {
    const res = await fetch(`/api/intelligence/analyze/${pipelineId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceReprocess }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Falha ao executar Video Intelligence.', 'error');
      return;
    }
    notify(
      `Análise de IA concluída para o vídeo #${pipelineId} → Decisão: ${data.analysis?.recommended_decision}`
    );
    fetchAll();
  };

  const handleAnalyzeAllBatch = async () => {
    setIsAnalyzingBatch(true);
    try {
      const res = await fetch('/api/intelligence/analyze-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceReprocess: true }),
      });
      const data = await res.json();
      if (res.ok) {
        notify(`Varredura de Video Intelligence concluída em ${data.processedCount} vídeos do pipeline!`);
        fetchAll();
      }
    } finally {
      setIsAnalyzingBatch(false);
    }
  };

  const handleUpdateAutomationRules = async (updatedRules: any) => {
    const res = await fetch('/api/intelligence/rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedRules),
    });
    if (res.ok) {
      notify('Regras de decisão automática do pipeline atualizadas!');
      fetchAll();
    }
  };

  const handleAttachCleanVersion = async (pipelineId: number) => {
    const file = cleanVersionUploadFiles[pipelineId];
    if (!file) {
      notify('Selecione um arquivo de vídeo limpo (.mp4) autorizado antes de associar.', 'warn');
      return;
    }
    const form = new FormData();
    form.append('cleanVideoFile', file);
    const res = await fetch(`/api/intelligence/${pipelineId}/attach-clean-version`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || 'Erro ao vincular versão limpa.', 'error');
      return;
    }
    notify(`Versão limpa legítima (${data.cleanVersionFileName}) vinculada ao registro #${pipelineId}!`);
    setCleanVersionUploadFiles((prev) => ({ ...prev, [pipelineId]: null }));
    fetchAll();
  };

  const handleValidateContinuationCandidate = async (candidateId: number, status: 'CONFIRMED' | 'REJECTED') => {
    const res = await fetch(`/api/intelligence/continuation-candidates/${candidateId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validation_status: status }),
    });
    if (res.ok) {
      notify(
        status === 'CONFIRMED'
          ? 'Continuação confirmada e sequência agrupada!'
          : 'Candidato de continuação descartado pelo operador.'
      );
      fetchAll();
    }
  };

  // Filtragem local da Biblioteca
  const filteredLibrary = libraryItems.filter((item) => {
    if (libCategoryTab !== 'ALL' && item.category_group !== libCategoryTab) return false;
    if (!includeDemo && item.is_demo === 1) return false;
    if (libSearch.trim() !== '') {
      const q = libSearch.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.work_reference?.toLowerCase().includes(q) ||
        item.hashtags?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* TOAST DE NOTIFICAÇÃO OPERACIONAL */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-fade-in">
          <div
            className={`px-4 py-3 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
              toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : toast.type === 'warn'
                  ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                  : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-100'
            }`}
          >
            {toast.type === 'error' ? (
              <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : toast.type === 'warn' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs leading-relaxed font-medium">{toast.text}</div>
          </div>
        </div>
      )}

      {/* TOP HEADER OPERACIONAL DE IA */}
      <header className="border-b border-slate-800/80 bg-[#0B0F17]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-wider text-sm text-white">EGO VIRAL ENGINE</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  AI Content Ops v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Central de Inteligência, Direitos & Publicação — Meta Global:{' '}
                <strong className="text-slate-200 font-mono">90 vídeos/dia</strong> (3 Canais × 30)
              </p>
            </div>
          </div>

          {/* FILTROS GLOBAIS & TRANSPARÊNCIA DEMO vs REAL */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL" className="bg-slate-900">Todos os Canais (90/dia)</option>
                <option value="ego-filmes" className="bg-slate-900">🎬 EGO FILMES (30/dia)</option>
                <option value="ego-anime" className="bg-slate-900">⚡ EGO ANIME (30/dia)</option>
                <option value="ego-series" className="bg-slate-900">📺 EGO SÉRIES (30/dia)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="ALL" className="bg-slate-900">Todas Plataformas (6 Contas)</option>
                <option value="TIKTOK" className="bg-slate-900">TikTok (3 Contas)</option>
                <option value="INSTAGRAM" className="bg-slate-900">Instagram Reels (3 Contas)</option>
              </select>
            </div>

            <button
              onClick={() => setIncludeDemo(!includeDemo)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                includeDemo
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              }`}
              title="Alternar visibilidade dos registros demonstrativos iniciais"
            >
              <span className={`w-2 h-2 rounded-full ${includeDemo ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {includeDemo ? 'Modo: Real + Demo Identificado' : 'Modo: Apenas Dados Reais'}
            </button>

            <button
              onClick={fetchAll}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
              title="Sincronizar Painel"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300"
            >
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>{user?.name || 'Operador'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* LAYOUT PRINCIPAL COM SIDEBAR E CONTEÚDO */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex">
        {/* SIDEBAR DE NAVEGAÇÃO */}
        <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-[#090D14] p-4 flex flex-col justify-between">
          <nav className="space-y-1.5">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-slate-500">
              Núcleo Operacional
            </div>
            {[
              { id: 'DASHBOARD', label: 'Dashboard Principal', icon: Activity, badge: '90/dia' },
              { id: 'RADAR', label: 'Viral Radar', icon: Radar, badge: radarData.items.length },
              { id: 'PIPELINE', label: 'Video Pipeline (90/dia)', icon: Film, badge: pipelineData.items.length },
              { id: 'INTELLIGENCE', label: 'Video Intelligence (IA)', icon: Sparkles, badge: intelligenceData.summary?.totalInPipeline || pipelineData.items.length },
              { id: 'LIBRARY', label: 'Biblioteca & Direitos', icon: FolderKanban, badge: libraryItems.length },
              { id: 'PREPARATION', label: 'Estúdio de Preparação', icon: Wand2 },
              { id: 'CALENDAR', label: 'Calendário & Fila', icon: CalendarClock, badge: queueData.queue.length },
              { id: 'ANALYTICS', label: 'Analytics & Ego TV', icon: BarChart3 },
              { id: 'CHANNELS', label: 'Canais & Contas (6)', icon: Settings2 },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as TabId)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* RESUMO DAS METAS DIÁRIAS NA SIDEBAR */}
          <div className="mt-8 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Meta Operacional Diária</span>
              <span className="text-[11px] font-mono text-cyan-400">90 Vídeos</span>
            </div>
            {dashboardData?.channelProgress?.map((cp: any) => (
              <div key={cp.id} className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{cp.name}</span>
                  <span className="font-mono text-slate-200">
                    {cp.readyCount}/{cp.dailyGoal}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(4, cp.percentage)}%`, backgroundColor: cp.color }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Gatekeeper de Direitos Ativo</span>
            </div>
          </div>
        </aside>

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* AVISO TRANSPARENTE DE DADOS DEMONSTRATIVOS */}
          {dashboardData?.dataTransparency && (
            <div
              className={`px-4 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
                dashboardData.dataTransparency.showingDemoData
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{dashboardData.dataTransparency.notice}</span>
              </div>
              <span className="font-mono text-[11px] uppercase px-2 py-0.5 rounded bg-black/30">
                Transparência de Dados Ativa
              </span>
            </div>
          )}

          {/* ================================================================
              ABA 1: DASHBOARD PRINCIPAL
             ================================================================ */}
          {activeTab === 'DASHBOARD' && dashboardData && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Painel de Controle Operacional — Ego TV
                  </h1>
                  <p className="text-xs text-slate-400">
                    Monitoramento em tempo real do funil de descoberta, direitos, fila de publicação e conversão comercial.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">Status: Todos</option>
                    {Object.entries(WORKFLOW_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GRID DE 9 INDICADORES EXIGIDOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  {
                    title: 'Vídeos Identificados Hoje',
                    value: dashboardData.kpis.videosIdentifiedToday,
                    sub: 'Radar + Biblioteca em triagem',
                    icon: Radar,
                    accent: 'text-cyan-400 border-cyan-500/30',
                  },
                  {
                    title: 'Aguardando Aprovação / Direitos',
                    value: dashboardData.kpis.videosAwaitingApproval,
                    sub: 'Requerem validação do operador',
                    icon: Clock,
                    accent: 'text-amber-400 border-amber-500/30',
                  },
                  {
                    title: 'Vídeos Aprovados',
                    value: dashboardData.kpis.videosApproved,
                    sub: 'Direitos verificados e liberados',
                    icon: ShieldCheck,
                    accent: 'text-emerald-400 border-emerald-500/30',
                  },
                  {
                    title: 'Preparados para Publicação',
                    value: dashboardData.kpis.videosPrepared,
                    sub: 'Com copy TikTok/IG + metadados validados',
                    icon: Wand2,
                    accent: 'text-indigo-400 border-indigo-500/30',
                  },
                  {
                    title: 'Publicações Concluídas (API Oficial)',
                    value: dashboardData.kpis.publicationsCompleted,
                    sub: `${dashboardData.kpis.publicationsAwaitingCredentials} aguardando credenciais OAuth`,
                    icon: CheckCircle2,
                    accent: 'text-teal-400 border-teal-500/30',
                  },
                  {
                    title: 'Publicações com Falha',
                    value: dashboardData.kpis.publicationsFailed,
                    sub: 'Monitoradas com retentativa controlada',
                    icon: AlertTriangle,
                    accent: 'text-rose-400 border-rose-500/30',
                  },
                  {
                    title: 'Visualizações Observadas (Radar)',
                    value: dashboardData.kpis.accumulatedObservedViews.toLocaleString('pt-BR'),
                    sub: 'Métrica observada nas fontes analisadas',
                    icon: Eye,
                    accent: 'text-purple-400 border-purple-500/30',
                  },
                  {
                    title: 'Cliques Direcionados à Ego TV',
                    value: dashboardData.kpis.egoTvClicks,
                    sub: 'Rastreados via links /r/:code',
                    icon: MousePointerClick,
                    accent: 'text-cyan-400 border-cyan-500/30',
                  },
                  {
                    title: 'Assinaturas Atribuídas (UTM)',
                    value: dashboardData.kpis.attributedSubscriptions,
                    sub: 'Apenas conversões com vínculo comprovado',
                    icon: Sparkles,
                    accent: 'text-emerald-400 border-emerald-500/30',
                  },
                ].map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#0D131F] border border-slate-800/90 hover:border-slate-700 transition flex items-start justify-between"
                    >
                      <div className="space-y-1">
                        <span className="text-xs text-slate-400">{card.title}</span>
                        <div className="text-2xl font-bold font-mono text-white">{card.value}</div>
                        <p className="text-[11px] text-slate-500">{card.sub}</p>
                      </div>
                      <div className={`p-2.5 rounded-xl bg-slate-900/90 border ${card.accent}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PROGRESSO DAS METAS DIÁRIAS POR CANAL (30 VÍDEOS/DIA CADA = 90 VÍDEOS) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {dashboardData.channelProgress.map((ch: any) => (
                  <div
                    key={ch.id}
                    className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ch.color }}
                        />
                        <h3 className="font-bold text-sm text-white">{ch.name}</h3>
                      </div>
                      <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-200">
                        Meta: {ch.readyCount} / {ch.dailyGoal} vídeos/dia
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(5, ch.percentage)}%`,
                          backgroundColor: ch.color,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Itens no Funil: {ch.totalInPipeline}</span>
                      <span className="font-mono text-slate-300">{ch.percentage}% da meta diária</span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/70 flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          setActiveTab('RADAR');
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 transition"
                      >
                        Abrir Radar
                      </button>
                      <button
                        onClick={() => {
                          setSelectedChannel(ch.id);
                          setActiveTab('LIBRARY');
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 transition"
                      >
                        Ver Biblioteca
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* REGISTRO DE ATIVIDADES OPERACIONAIS */}
              <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Auditoria & Registro de Atividades em Tempo Real
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Últimos eventos persistidos no SQLite</span>
                </div>
                <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
                  {dashboardData.recentLogs?.map((log: any) => (
                    <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                            log.severity === 'WARN'
                              ? 'bg-amber-500/15 text-amber-300'
                              : log.severity === 'ERROR'
                                ? 'bg-rose-500/15 text-rose-300'
                                : 'bg-cyan-500/15 text-cyan-300'
                          }`}
                        >
                          {log.module}
                        </span>
                        <span className="text-slate-200">{log.details}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 shrink-0">
                        {log.created_at}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 2: VIRAL RADAR (DESCOBERTA & CLASSIFICAÇÃO MULTICRITÉRIO)
             ================================================================ */}
          {activeTab === 'RADAR' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Radar className="w-5 h-5 text-cyan-400" />
                  VIRAL RADAR — Inteligência de Tendências & Classificação
                </h1>
                <p className="text-xs text-slate-400">
                  Mecanismo multicritério: avalia Velocidade de Crescimento + Qualidade de Engajamento + Aderência ao Canal (não depende de views isoladas). Coleta 100% autorizada.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COLUNA 1: FONTES, PALAVRAS-CHAVE E FRANQUIAS MONITORADAS */}
                <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4">
                  <h3 className="text-sm font-bold text-white">
                    Fontes, Keywords & Franquias Cadastradas
                  </h3>
                  <form onSubmit={handleAddRadarSource} className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newSourceChannel}
                        onChange={(e) => setNewSourceChannel(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                      >
                        <option value="ego-filmes">EGO FILMES</option>
                        <option value="ego-anime">EGO ANIME</option>
                        <option value="ego-series">EGO SÉRIES</option>
                      </select>
                      <select
                        value={newSourceType}
                        onChange={(e) => setNewSourceType(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200"
                      >
                        <option value="KEYWORD">Palavra-chave</option>
                        <option value="FRANCHISE">Franquia Anime</option>
                        <option value="TITLE">Filme / Série</option>
                        <option value="THEME">Tema / Categoria</option>
                        <option value="PUBLIC_PROFILE">Perfil Público Ref.</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Cyberpunk / A24 / Sakuga..."
                        value={newSourceValue}
                        onChange={(e) => setNewSourceValue(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </form>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {radarData.sources.map((src: any) => (
                      <div
                        key={src.id}
                        className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                              {src.source_type}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{src.channel_id}</span>
                          </div>
                          <div className="font-medium text-slate-200 mt-1">{src.value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* COLUNA 2 & 3: MOTOR DE BUSCA DE VIRAIS DO TIKTOK POR TAGS + FORMULÁRIO & LISTA */}
                <div className="lg:col-span-2 space-y-6">
                  {/* PAINEL AUTOMÁTICO: BUSCAR VIRAIS DO TIKTOK POR HASHTAGS (#filmes, #anime, #series) E SEPARAR OS 90 PARA AS 3 CONTAS */}
                  <form
                    onSubmit={handleScanAndSeparateTikTokVirals}
                    className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-[#0D131F] to-purple-950/30 border border-cyan-500/40 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400" />
                          Busca Exclusiva TikTok por Hashtags — Separar Virais p/ as 3 Contas (90 Vídeos)
                        </h3>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Filtra exclusivamente referências virais do TikTok pelas tags de cada conta e já separa todas (30 Ego Filmes + 30 Ego Anime + 30 Ego Séries) prontas para postagem no Video Pipeline.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        APENAS ORIGEM TIKTOK
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] text-cyan-300 font-semibold mb-1">
                          🎬 Tags EGO FILMES (30 virais)
                        </label>
                        <input
                          type="text"
                          value={ttTagsFilmes}
                          onChange={(e) => setTtTagsFilmes(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-purple-300 font-semibold mb-1">
                          ⚡ Tags EGO ANIME (30 virais)
                        </label>
                        <input
                          type="text"
                          value={ttTagsAnime}
                          onChange={(e) => setTtTagsAnime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-emerald-300 font-semibold mb-1">
                          📺 Tags EGO SÉRIES (30 virais)
                        </label>
                        <input
                          type="text"
                          value={ttTagsSeries}
                          onChange={(e) => setTtTagsSeries(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">
                        Remove referências que não sejam do TikTok e preenche os 90 slots diários nas 3 filas.
                      </span>
                      <button
                        type="submit"
                        disabled={isScanningTikTok}
                        className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                      >
                        <Radar className="w-4 h-4" />
                        {isScanningTikTok
                          ? 'Buscando & Separando 90 Virais...'
                          : 'Buscar Virais TikTok por Tags & Separar Todos (90)'}
                      </button>
                    </div>
                  </form>

                  <form
                    onSubmit={handleCreateRadarItem}
                    className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        Adicionar Referência Individual do TikTok (Manual ou oEmbed TikTok)
                      </h3>
                      <span className="text-[11px] font-mono text-cyan-400">
                        Deduplicação de URL Ativa
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Canal Sugerido</label>
                        <select
                          value={radarForm.channel_id}
                          onChange={(e) => setRadarForm({ ...radarForm, channel_id: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="ego-filmes">EGO FILMES</option>
                          <option value="ego-anime">EGO ANIME</option>
                          <option value="ego-series">EGO SÉRIES</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Plataforma de Origem</label>
                        <select
                          value={radarForm.platform}
                          onChange={(e) => setRadarForm({ ...radarForm, platform: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        >
                          <option value="TIKTOK">TikTok (Referência por Tag)</option>
                          <option value="TIKTOK_PUBLIC">TikTok (Perfil Público)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">URL de Origem *</label>
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            required
                            placeholder="https://..."
                            value={radarForm.source_url}
                            onChange={(e) => setRadarForm({ ...radarForm, source_url: e.target.value })}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={handleFetchOembed}
                            className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-cyan-300 border border-slate-700 shrink-0"
                            title="Consultar metadados públicos via oEmbed"
                          >
                            oEmbed
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Título ou Descrição *</label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Trailer Oficial 4K - Cena do Interrogatório"
                          value={radarForm.title}
                          onChange={(e) => setRadarForm({ ...radarForm, title: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Obra / Filme / Série / Franquia</label>
                        <input
                          type="text"
                          placeholder="Ex: Duna / Solo Leveling / Ruptura"
                          value={radarForm.franchise_or_work}
                          onChange={(e) => setRadarForm({ ...radarForm, franchise_or_work: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Views (se disponível)</label>
                        <input
                          type="number"
                          placeholder="Opcional"
                          value={radarForm.views_observed}
                          onChange={(e) => setRadarForm({ ...radarForm, views_observed: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Likes (se disponível)</label>
                        <input
                          type="number"
                          placeholder="Opcional"
                          value={radarForm.likes_observed}
                          onChange={(e) => setRadarForm({ ...radarForm, likes_observed: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Comentários (opcional)</label>
                        <input
                          type="number"
                          placeholder="Opcional"
                          value={radarForm.comments_observed}
                          onChange={(e) => setRadarForm({ ...radarForm, comments_observed: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Publicação Original</label>
                        <input
                          type="datetime-local"
                          value={radarForm.original_published_at}
                          onChange={(e) => setRadarForm({ ...radarForm, original_published_at: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition flex items-center gap-2"
                      >
                        <Radar className="w-4 h-4" />
                        Calcular Relevância & Registrar no Radar
                      </button>
                    </div>
                  </form>

                  {/* LISTA DE TENDÊNCIAS DO RADAR */}
                  <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-3">
                    <h3 className="text-sm font-bold text-white">
                      Registros do Viral Radar ({radarData.items.length})
                    </h3>
                    <div className="space-y-3">
                      {radarData.items
                        .filter((i) => includeDemo || i.is_demo === 0)
                        .map((item: any) => (
                          <div
                            key={item.id}
                            className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                  Score: {item.relevance_score}/100
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                  {item.channel_id}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                  {item.platform}
                                </span>
                                {item.is_demo === 1 && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                    DADO DEMONSTRATIVO
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-sm text-white">{item.title}</h4>
                              <p className="text-xs text-slate-400">
                                Obra: <strong className="text-slate-300">{item.franchise_or_work || 'N/A'}</strong> •
                                Views: <span className="font-mono">{item.views_observed?.toLocaleString('pt-BR') ?? 'N/D'}</span> •
                                Likes: <span className="font-mono">{item.likes_observed?.toLocaleString('pt-BR') ?? 'N/D'}</span> •
                                Comentários: <span className="font-mono">{item.comments_observed?.toLocaleString('pt-BR') ?? 'N/D'}</span>
                              </p>
                              <p className="text-[11px] text-slate-500">{item.notes}</p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={item.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                                title="Abrir URL de origem"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                              {item.analysis_status !== 'SENT_TO_LIBRARY' ? (
                                <button
                                  onClick={() => handlePromoteRadarItem(item.id)}
                                  className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition"
                                >
                                  Aprovar p/ Video Pipeline
                                </button>
                              ) : (
                                <span className="text-[11px] font-mono text-emerald-400 px-2 py-1 bg-emerald-950/50 rounded">
                                  ✓ No Video Pipeline
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 2.5: VIDEO PIPELINE (INTEGRAÇÃO VIRAL RADAR -> 90 VÍDEOS/DIA)
             ================================================================ */}
          {activeTab === 'PIPELINE' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Film className="w-5 h-5 text-cyan-400" />
                    VIDEO PIPELINE — Operação de 90 Vídeos Diários (3 Filas × 30)
                  </h1>
                  <p className="text-xs text-slate-400">
                    Fluxo integrado ao VIRAL RADAR: preserva a origem e o ID original em todas as etapas, valida direitos antes da obtenção (Opções A, B e C) e separa vídeos únicos preparados de publicações multi-plataforma.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={pipelineQueueFilter}
                    onChange={(e) => setPipelineQueueFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">Todas as 3 Filas (90/dia)</option>
                    <option value="ego-filmes">🎬 Fila EGO FILMES (30/dia)</option>
                    <option value="ego-anime">⚡ Fila EGO ANIME (30/dia)</option>
                    <option value="ego-series">📺 Fila EGO SÉRIES (30/dia)</option>
                  </select>

                  <select
                    value={pipelineStateFilter}
                    onChange={(e) => setPipelineStateFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                  >
                    <option value="ALL">Todos os 11 Estados da Fila</option>
                    {Object.entries(PIPELINE_STATE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* BANNER DE CONEXÃO RÁPIDA: CONECTAR APENAS TIKTOK DE EGO FILMES PARA TESTAR O FLUXO */}
              {(() => {
                const filmesChannel = channelsData.channels.find((c: any) => c.id === 'ego-filmes');
                const ttFilmesAcc = filmesChannel?.social_accounts?.find((a: any) => a.id === 'tt-filmes');
                const isConnected = Boolean(ttFilmesAcc?.oauth_connected);

                return (
                  <div
                    className={`p-4 rounded-2xl border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 ${
                      isConnected
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-[#0D131F] border-cyan-500/40'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                          }`}
                        />
                        <h3 className="text-sm font-bold text-white">
                          {isConnected
                            ? `Conta TikTok EGO FILMES Conectada (${ttFilmesAcc?.handle}) — Fluxo Exclusivo de Filmes Ativo`
                            : 'Modo de Validação de Fluxo: Conectar Conta TikTok de EGO FILMES'}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                          {ttFilmesAcc?.connection_status || 'PENDING_CREDENTIALS'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        {isConnected
                          ? 'Todos os vídeos da fila EGO FILMES estão apontados para publicação direta na conta TikTok conectada. Clique em "Aprovar & Postar no TikTok" em qualquer vídeo abaixo para testar o disparo completo.'
                          : 'Conecte primeiro apenas a conta do TikTok de Filmes para validar o fluxo de ponta a ponta (Viral Radar → Video Pipeline → Video Intelligence → Publicação TikTok) antes de ativar as demais contas.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex flex-wrap items-center gap-2 w-full pt-2 border-t border-slate-800/80">
                        <div className="flex-1 min-w-[280px]">
                          <label className="block text-[11px] text-cyan-300 font-semibold mb-1 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5" />
                            Sessão Automática TikTok (@egotv00) — Cookie `sessionid`:
                          </label>
                          <input
                            type="password"
                            placeholder="Cole aqui o cookie sessionid da conta @egotv00 (ex: 7a8b9c...)"
                            value={accountTokenInputs['tt-filmes'] ?? ''}
                            onChange={(e) =>
                              setAccountTokenInputs((prev) => ({ ...prev, ['tt-filmes']: e.target.value }))
                            }
                            className="w-full bg-slate-900 border border-cyan-500/50 rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        <div className="flex items-end gap-2 pt-4">
                          <button
                            type="button"
                            onClick={() =>
                              handleConnectSocialAccount('tt-filmes', {
                                handle: '@egotv00',
                                access_token: accountTokenInputs['tt-filmes'],
                                connection_mode: 'WEB_SESSION',
                                exclusive_mode: true,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
                          >
                            Salvar Sessão Automática
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAutoCurateAndPublish('ego-filmes')}
                        disabled={isAnalyzingBatch}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20"
                      >
                        <Sparkles className="w-4 h-4" />
                        {isAnalyzingBatch
                          ? 'Baixando, Filtrando & Postando no @egotv00...'
                          : '🚀 Baixar Vídeo Limpo & Postar Automático no TikTok (@egotv00)'}
                      </button>
                      <input
                        type="text"
                        placeholder={ttFilmesAcc?.handle || '@egofilmes.oficial'}
                        value={accountHandleInputs['tt-filmes'] ?? ''}
                        onChange={(e) =>
                          setAccountHandleInputs((prev) => ({ ...prev, ['tt-filmes']: e.target.value }))
                        }
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono w-44"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleConnectSocialAccount('tt-filmes', {
                            handle: accountHandleInputs['tt-filmes'] || ttFilmesAcc?.handle || '@egofilmes.oficial',
                            exclusive_mode: true,
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
                      >
                        {isConnected ? 'Atualizar / Reconectar TikTok Filmes' : 'Conectar TikTok (Ego Filmes) & Filtrar'}
                      </button>
                      {isConnected && (
                        <button
                          type="button"
                          onClick={() => handleDisconnectSocialAccount('tt-filmes')}
                          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs transition"
                        >
                          Desconectar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PAINEL DAS 3 FILAS INDEPENDENTES (30 VÍDEOS/DIA CADA = 90 VÍDEOS ÚNICOS) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {pipelineData.queuesByChannel.map((q: any) => (
                  <div
                    key={q.channelId}
                    className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: q.color }} />
                        <h3 className="font-bold text-sm text-white">{q.channelName}</h3>
                      </div>
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                        Meta Diária: {q.dailyGoal} vídeos únicos
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Encontrados:</span>
                        <strong className="font-mono text-white">{q.foundCount}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Aprovados:</span>
                        <strong className="font-mono text-cyan-300">{q.approvedCount}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Direitos OK:</span>
                        <strong className="font-mono text-emerald-300">{q.rightsConfirmedCount}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Arquivos Recebidos:</span>
                        <strong className="font-mono text-blue-300">{q.filesReceivedCount}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Prontos (Únicos):</span>
                        <strong className="font-mono text-teal-300">{q.readyUniqueVideosCount}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex justify-between">
                        <span className="text-slate-400">Publicados:</span>
                        <strong className="font-mono text-purple-300">{q.publishedUniqueVideosCount}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Faltam para atingir a meta de hoje:</span>
                      <span className="font-mono font-bold text-amber-300">
                        {q.remainingToGoal} vídeos únicos
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex justify-between pt-1">
                      <span>Vídeos únicos preparados: {q.readyUniqueVideosCount}</span>
                      <span>Publicações nas redes (TikTok/IG): {q.platformPublicationsTotal}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* LISTA DE CANDIDATOS NO VIDEO PIPELINE */}
              <div className="space-y-4">
                {pipelineData.items
                  .filter((item) => {
                    if (pipelineQueueFilter !== 'ALL' && item.channel_id !== pipelineQueueFilter) return false;
                    if (pipelineStateFilter !== 'ALL' && item.pipeline_state !== pipelineStateFilter) return false;
                    return true;
                  })
                  .map((item) => {
                    const stBadge = PIPELINE_STATE_LABELS[item.pipeline_state] || {
                      label: item.pipeline_state,
                      color: 'bg-slate-800 text-slate-300',
                    };
                    const isExpanded = activePipelineItem?.id === item.id;

                    return (
                      <div
                        key={item.id}
                        className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                      >
                        {/* CABEÇALHO DO CANDIDATO COM DADOS ORIGINAIS PRESERVADOS */}
                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono font-bold text-cyan-400">
                                Pipeline #{item.id}
                              </span>
                              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${stBadge.color}`}>
                                {stBadge.label}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                                {item.channel_id.toUpperCase()} • {item.niche_label}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                                ID Original: {item.original_external_id}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400">
                                Origem: {item.source_platform}
                              </span>
                            </div>

                            <h3 className="text-sm font-bold text-white">{item.title}</h3>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                              <span>
                                URL Original:{' '}
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-cyan-400 hover:underline font-mono"
                                >
                                  {item.source_url}
                                </a>
                              </span>
                              <span>Aprovado em: <strong className="font-mono text-slate-300">{item.approved_at}</strong></span>
                              <span>
                                Métricas Conhecidas:{' '}
                                <strong className="font-mono text-slate-300">
                                  Views: {item.known_metrics?.views ?? 'N/D'} | Score: {item.known_metrics?.relevance_score ?? 'N/D'}
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <a
                              href={item.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Analisar Link no TikTok
                            </a>
                            <button
                              onClick={() =>
                                handlePipelineEnqueue(
                                  item.id,
                                  item.target_platforms || 'BOTH'
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition"
                            >
                              Aprovar & Postar/Agendar
                            </button>
                            <button
                              onClick={() => setActivePipelineItem(isExpanded ? null : item)}
                              className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition"
                            >
                              {isExpanded ? 'Fechar Edição' : 'Editar Copy / Arquivo'}
                            </button>
                          </div>
                        </div>

                        {/* BANCADA EXPANDIDA DE OPERAÇÃO DO CANDIDATO (PLAYER EMBED TIKTOK + ETAPAS 2, 3, 5 E 6) */}
                        {isExpanded && (
                          <div className="pt-4 border-t border-slate-800 space-y-4">
                            {item.source_url?.includes('tiktok.com/') && (
                              <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 flex flex-col md:flex-row items-center gap-5">
                                <div className="rounded-xl overflow-hidden border border-slate-700 bg-black shrink-0">
                                  <iframe
                                    title={`TikTok Preview ${item.id}`}
                                    src={`https://www.tiktok.com/player/v1/${
                                      item.known_metrics?.video_id ||
                                      item.source_url.match(/\/video\/(\d+)/)?.[1] ||
                                      ''
                                    }?music_info=1&description=1`}
                                    width="300"
                                    height="530"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                                <div className="space-y-2.5 flex-1">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
                                    ✓ Vídeo Real Verificado & Disponível no TikTok
                                  </span>
                                  <h4 className="text-sm font-bold text-white">{item.title}</h4>
                                  <p className="text-xs text-slate-300">
                                    Criador Original: <strong className="text-cyan-300 font-mono">{item.known_metrics?.creator || 'TikTok'}</strong> ({item.work_reference})
                                  </p>
                                  <p className="text-xs text-slate-400">
                                    Você pode assistir ao vídeo diretamente no player ao lado ou abrir o link original no TikTok antes de postar nas contas da Ego TV.
                                  </p>
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    <a
                                      href={item.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Abrir Vídeo Direto no TikTok
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(item.source_url, `Link #${item.id}`)}
                                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      Copiar URL do Vídeo
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* ETAPA A: SITUAÇÃO DOS DIREITOS DE USO (FLUXO DIRETO ATIVO) */}
                            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase font-mono text-cyan-300">
                                  1. Situação dos Direitos de Uso
                                </h4>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                                  {item.rights_status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                O processamento para obtenção e publicação fica bloqueado enquanto os direitos não estiverem regularizados.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() =>
                                    handlePipelineRights(
                                      item.id,
                                      'VERIFIED_AUTHORIZED',
                                      'Direitos confirmados pelo operador para utilização no TikTok e Instagram.'
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium"
                                >
                                  ✓ Liberar p/ Utilização
                                </button>
                                <button
                                  onClick={() =>
                                    handlePipelineRights(
                                      item.id,
                                      'PENDING_VERIFICATION',
                                      'Direitos marcados como pendentes de verificação complementar.'
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs"
                                >
                                  Marcar Direitos Pendentes
                                </button>
                              </div>

                              {/* HISTÓRICO DE OPERAÇÕES DESTE CANDIDATO */}
                              <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                                  Histórico Rastreável ({item.history?.length || 0})
                                </span>
                                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                                  {item.history?.map((h: any) => (
                                    <div key={h.id} className="text-[11px] p-1.5 rounded bg-slate-950 border border-slate-800/80">
                                      <span className="font-mono text-cyan-400">[{h.new_state}]</span>{' '}
                                      <span className="text-slate-300">{h.details}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* ETAPA B: OBTENÇÃO DO ARQUIVO (OPÇÃO A, OPÇÃO B, OPÇÃO C E SUBSTITUIÇÃO) */}
                            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase font-mono text-blue-300">
                                2. Obtenção Autorizada do Arquivo
                              </h4>

                              {/* OPÇÃO A */}
                              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                <div className="text-xs font-semibold text-white">
                                  Opção A — Obtenção Automatizada
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Verifica se a fonte original oferece download direto autorizado (ex: Press Kit). Não contorna DRM.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => handlePipelineAutoAcquire(item.id)}
                                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs"
                                >
                                  Verificar & Obter Automaticamente
                                </button>
                              </div>

                              {/* OPÇÃO B */}
                              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                                <div className="text-xs font-semibold text-white">
                                  Opção B — Obtenção Manual Assistida
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Abra a fonte original para obter o material pelos meios legítimos do detentor e associe abaixo.
                                </p>
                                <a
                                  href={item.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  Abrir Fonte Original
                                </a>
                              </div>

                              {/* OPÇÃO C */}
                              <form
                                onSubmit={(e) => handlePipelineUploadFile(e, item.id)}
                                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2"
                              >
                                <div className="text-xs font-semibold text-white">
                                  Opção C — Importação e Vinculação de Arquivo Local
                                </div>
                                <select
                                  value={pipelineAcqMethod}
                                  onChange={(e) => setPipelineAcqMethod(e.target.value as any)}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300"
                                >
                                  <option value="OPTION_C_UPLOAD">Opção C: Upload Local Direto</option>
                                  <option value="OPTION_B_MANUAL">Opção B: Obtido Manualmente da Fonte</option>
                                </select>
                                <input
                                  type="file"
                                  accept="video/*,.mp4,.mov"
                                  onChange={(e) => setPipelineUploadFile(e.target.files?.[0] || null)}
                                  className="w-full text-[11px] text-slate-300 bg-slate-900 border border-slate-800 rounded p-1.5"
                                />
                                <button
                                  type="submit"
                                  className="w-full py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold text-xs"
                                >
                                  Validar SHA-256 & Associar ao Candidato
                                </button>
                              </form>

                              {/* SUBSTITUIÇÃO SE ARQUIVO PENDENTE */}
                              {item.pipeline_state === 'ARQUIVO_PENDENTE' && (
                                <form
                                  onSubmit={(e) => handlePipelineReplaceCandidate(e, item.id)}
                                  className="p-2.5 rounded-lg bg-orange-950/30 border border-orange-500/40 space-y-2"
                                >
                                  <div className="text-xs font-bold text-orange-300">
                                    Substituir Candidato com Arquivo Pendente
                                  </div>
                                  <input
                                    type="url"
                                    required
                                    placeholder="Nova URL de origem autorizada..."
                                    value={replaceForm.new_source_url}
                                    onChange={(e) => setReplaceForm({ ...replaceForm, new_source_url: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                  />
                                  <input
                                    type="text"
                                    required
                                    placeholder="Novo título do material autorizado..."
                                    value={replaceForm.new_title}
                                    onChange={(e) => setReplaceForm({ ...replaceForm, new_title: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                  />
                                  <button
                                    type="submit"
                                    className="w-full py-1.5 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-semibold text-xs"
                                  >
                                    Substituir por Conteúdo Autorizado
                                  </button>
                                </form>
                              )}
                            </div>

                            {/* ETAPA C: VISUALIZAÇÃO, PREPARAÇÃO E ENVIO PARA A FILA DE PUBLICAÇÃO */}
                            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                              <h4 className="text-xs font-bold uppercase font-mono text-teal-300">
                                3. Preparação, Revisão & Fila de Publicação
                              </h4>

                              {item.file_path ? (
                                <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between text-emerald-300 font-semibold">
                                    <span>✓ Arquivo Utilizável Vinculado</span>
                                    <span className="font-mono text-[10px]">{item.acquisition_method}</span>
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-300 break-all">
                                    {item.file_name} ({item.video_format} • {item.duration_seconds}s)
                                  </div>
                                  <a
                                    href={item.file_path}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                                  >
                                    <Play className="w-3 h-3" /> Visualizar Arquivo Recebido
                                  </a>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-400">
                                  Nenhum arquivo vinculado ainda. Utilize a Opção A, B ou C ao lado.
                                </div>
                              )}

                              <div className="space-y-2 text-xs">
                                <div>
                                  <label className="block text-[11px] text-slate-400 mb-1">
                                    Legenda TikTok
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={activePipelineItem.caption_tiktok || ''}
                                    onChange={(e) =>
                                      setActivePipelineItem({ ...activePipelineItem, caption_tiktok: e.target.value })
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[11px] text-slate-400 mb-1">
                                    Legenda Instagram Reels
                                  </label>
                                  <textarea
                                    rows={2}
                                    value={activePipelineItem.caption_instagram || ''}
                                    onChange={(e) =>
                                      setActivePipelineItem({ ...activePipelineItem, caption_instagram: e.target.value })
                                    }
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Hashtags</label>
                                    <input
                                      type="text"
                                      value={activePipelineItem.hashtags || ''}
                                      onChange={(e) =>
                                        setActivePipelineItem({ ...activePipelineItem, hashtags: e.target.value })
                                      }
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Destino</label>
                                    <select
                                      value={activePipelineItem.target_platforms || 'BOTH'}
                                      onChange={(e) =>
                                        setActivePipelineItem({ ...activePipelineItem, target_platforms: e.target.value })
                                      }
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                                    >
                                      <option value="BOTH">TikTok + Instagram (2 pubs)</option>
                                      <option value="TIKTOK">Apenas TikTok (1 pub)</option>
                                      <option value="INSTAGRAM">Apenas Instagram (1 pub)</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handlePipelinePrepare(activePipelineItem, true)}
                                    className="flex-1 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition"
                                  >
                                    Revisar & Marcar Pronto p/ Publicação
                                  </button>
                                </div>
                              </div>

                              {/* AGENDAR NA FILA DE PUBLICAÇÃO */}
                              <div className="pt-2 border-t border-slate-800 space-y-2">
                                <label className="block text-[11px] text-slate-400">
                                  Horário de Agendamento na Fila Oficial:
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="datetime-local"
                                    value={pipeScheduleTime}
                                    onChange={(e) => setPipeScheduleTime(e.target.value)}
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handlePipelineEnqueue(
                                        item.id,
                                        activePipelineItem.target_platforms || item.target_platforms || 'BOTH'
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold text-xs shrink-0"
                                  >
                                    Colocar na Fila
                                  </button>
                                </div>
                              </div>
                            </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 2.6: VIDEO INTELLIGENCE & WATERMARK DETECTOR (ANÁLISE VISUAL IA)
             ================================================================ */}
          {activeTab === 'INTELLIGENCE' && (
            <div className="space-y-6">
              {/* CABEÇALHO DO PAINEL DE INTELIGÊNCIA */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0D131F] via-[#111827] to-[#0D131F] border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <h1 className="text-xl font-bold text-white">
                      Módulo Video Intelligence & Watermark Detector (Inspeção Multi-Quadro IA)
                    </h1>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      Cache SHA-256 Ativo
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Camada de inteligência artificial integrada ao <strong>Video Pipeline</strong>: extrai e examina quadros ao longo do tempo (evento inicial → progressão → evento final), gera a <strong>Ficha de Conteúdo</strong>, detecta e agrupa <strong>Continuações (Parte 1/2/Suspense)</strong>, inspeciona os 4 cantos contra <strong>Marcas d’Água</strong> (sem remoção não autorizada) e calcula o <strong>Score de Qualidade Técnica (0–100)</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleAnalyzeAllBatch}
                    disabled={isAnalyzingBatch}
                    className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
                  >
                    <RefreshCw className={`w-4 h-4 ${isAnalyzingBatch ? 'animate-spin' : ''}`} />
                    {isAnalyzingBatch ? 'Reprocessando Lote...' : 'Reprocessar Inteligência (Lote)'}
                  </button>
                </div>
              </div>

              {/* KPIs RESUMO DA INTELIGÊNCIA VISUAL */}
              {intelligenceData.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-slate-800">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">Total Analisado</span>
                    <strong className="text-lg font-bold text-white font-mono">
                      {intelligenceData.summary.totalInPipeline}
                    </strong>
                    <span className="text-[10px] text-slate-500 block">No Pipeline</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-cyan-500/30">
                    <span className="text-[10px] font-mono uppercase text-cyan-300 block">Inspeção Visual</span>
                    <strong className="text-lg font-bold text-cyan-300 font-mono">
                      {intelligenceData.summary.fullVisualAnalyzedCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Com Arquivo .MP4</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-amber-500/30">
                    <span className="text-[10px] font-mono uppercase text-amber-300 block">Continuações</span>
                    <strong className="text-lg font-bold text-amber-300 font-mono">
                      {intelligenceData.summary.withContinuationsCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Sequência / Suspense</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-rose-500/30">
                    <span className="text-[10px] font-mono uppercase text-rose-300 block">Marcas d’Água</span>
                    <strong className="text-lg font-bold text-rose-300 font-mono">
                      {intelligenceData.summary.withWatermarksCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Criador / Plataforma</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-orange-500/30">
                    <span className="text-[10px] font-mono uppercase text-orange-300 block">Baixa Qualidade</span>
                    <strong className="text-lg font-bold text-orange-300 font-mono">
                      {intelligenceData.summary.lowQualityCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Score &lt; 65</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-emerald-500/30">
                    <span className="text-[10px] font-mono uppercase text-emerald-300 block">Perfil Vídeo A</span>
                    <strong className="text-lg font-bold text-emerald-300 font-mono">
                      {intelligenceData.summary.approvedArchetypeACount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Avançar Preparação</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-amber-500/30">
                    <span className="text-[10px] font-mono uppercase text-amber-300 block">Perfil Vídeo B</span>
                    <strong className="text-lg font-bold text-amber-300 font-mono">
                      {intelligenceData.summary.blockedArchetypeBCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Bloqueado Pendência</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0D131F] border border-rose-500/30">
                    <span className="text-[10px] font-mono uppercase text-rose-300 block">Perfil Vídeo C</span>
                    <strong className="text-lg font-bold text-rose-300 font-mono">
                      {intelligenceData.summary.reviewArchetypeCCount}
                    </strong>
                    <span className="text-[10px] text-slate-400 block">Revisão / Descarte</span>
                  </div>
                </div>
              )}

              {/* MOTOR DE REGRAS CONFIGURÁVEIS DE DECISÃO AUTOMÁTICA (SEÇÃO 7) */}
              {intelligenceData.rules && (
                <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-cyan-400" />
                        Motor de Regras Configuráveis — Decisão Automática do Pipeline (Perfis VÍDEO A, B e C)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Importante: a ausência de marca d’água não comprova, por si só, autorização de direitos autorais.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="block text-[11px] text-slate-400 mb-1">Score Mínimo Qualidade (0-100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={intelligenceData.rules.min_quality_score}
                        onChange={(e) =>
                          handleUpdateAutomationRules({ min_quality_score: Number(e.target.value) })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <label className="block text-[11px] text-slate-400 mb-1">Confiança Mín. Conteúdo (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={intelligenceData.rules.min_content_confidence}
                        onChange={(e) =>
                          handleUpdateAutomationRules({ min_content_confidence: Number(e.target.value) })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400">Bloquear Marca de Criador</span>
                      <button
                        onClick={() =>
                          handleUpdateAutomationRules({
                            block_on_creator_watermark: !intelligenceData.rules.block_on_creator_watermark,
                          })
                        }
                        className={`mt-2 px-3 py-1.5 rounded-lg font-mono text-[11px] border ${
                          intelligenceData.rules.block_on_creator_watermark
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {intelligenceData.rules.block_on_creator_watermark ? 'ATIVO (Bloqueia Vídeo B)' : 'DESATIVADO'}
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400">Bloquear Continuação Incompleta</span>
                      <button
                        onClick={() =>
                          handleUpdateAutomationRules({
                            block_on_probable_continuation: !intelligenceData.rules.block_on_probable_continuation,
                          })
                        }
                        className={`mt-2 px-3 py-1.5 rounded-lg font-mono text-[11px] border ${
                          intelligenceData.rules.block_on_probable_continuation
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {intelligenceData.rules.block_on_probable_continuation ? 'ATIVO (Aguarda Partes)' : 'DESATIVADO'}
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400">Vídeos Horizontais (16:9)</span>
                      <button
                        onClick={() =>
                          handleUpdateAutomationRules({
                            allow_adaptable_horizontal: !intelligenceData.rules.allow_adaptable_horizontal,
                          })
                        }
                        className={`mt-2 px-3 py-1.5 rounded-lg font-mono text-[11px] border ${
                          intelligenceData.rules.allow_adaptable_horizontal
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        }`}
                      >
                        {intelligenceData.rules.allow_adaptable_horizontal
                          ? 'PERMITIR SE ADAPTÁVEL 9:16'
                          : 'DESCARTAR HORIZONTAIS'}
                      </button>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                      <span className="text-[11px] text-slate-400">Política Anti-Remoção</span>
                      <span className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                        Remoção de Marca d’Água: PROIBIDA
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* FILTROS DO PAINEL DE INTELIGÊNCIA (SEÇÃO 8) */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'ALL', label: 'Todos os Vídeos' },
                    { id: 'FULL_VISUAL', label: 'Inspeção Multi-Quadro (.MP4)' },
                    { id: 'CONTINUATIONS', label: 'Vídeos com Continuação / Sequência' },
                    { id: 'WATERMARKS', label: 'Vídeos com Marca d’Água' },
                    { id: 'LOW_QUALITY', label: 'Vídeos com Baixa Qualidade' },
                    { id: 'INCONCLUSIVE', label: 'Vídeos Inconclusivos' },
                    { id: 'AWAITING_FILE', label: 'Aguardando Arquivo Acessível' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setIntelligenceFilter(f.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition ${
                        intelligenceFilter === f.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-bold'
                          : 'bg-[#0D131F] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LISTA DETALHADA DE FICHAS DE INTELIGÊNCIA DE VÍDEO */}
              <div className="space-y-4">
                {intelligenceData.items.map(({ pipelineItem, analysis }: any) => {
                  if (!analysis) return null;
                  const isFullVisual = analysis.analysis_mode === 'FULL_VISUAL_AND_AUDIO';

                  const decisionBadge =
                    analysis.recommended_decision === 'AVANCAR_PARA_PREPARACAO'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                      : analysis.recommended_decision === 'MANTER_BLOQUEADO_PENDENCIAS'
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                        : analysis.recommended_decision === 'ENCAMINHAR_REVISAO_OU_DESCARTAR'
                          ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                          : 'bg-slate-800 text-slate-300 border-slate-700';

                  return (
                    <div
                      key={pipelineItem.id}
                      className="p-6 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-5"
                    >
                      {/* LINHA SUPERIOR: MINIATURA / ORIGEM / DECISÃO RECOMENDADA */}
                      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                        <div className="flex items-start gap-4">
                          <div className="w-20 h-28 rounded-xl bg-slate-900 border border-slate-700/80 flex flex-col items-center justify-center p-2 text-center shrink-0">
                            <Film className="w-6 h-6 text-cyan-400 mb-1" />
                            <span className="text-[10px] font-mono text-slate-300">
                              {isFullVisual ? `${analysis.frames_analyzed_count} Frames` : 'URL TikTok'}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                              {analysis.aspect_ratio}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono text-cyan-400 font-bold">
                                Pipeline #{pipelineItem.id}
                              </span>
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                                {pipelineItem.niche_label}
                              </span>
                              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                Origem: {analysis.source_platform}
                              </span>
                              <span
                                className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${
                                  isFullVisual
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {isFullVisual
                                  ? `Inspeção Multi-Quadro (${analysis.frames_analyzed_count} quadros)`
                                  : 'Pré-Análise de Metadados (Aguardando Arquivo .MP4)'}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-white">{pipelineItem.title}</h3>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <a
                                href={analysis.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {analysis.source_url}
                              </a>
                              {analysis.file_hash_sha256 && (
                                <span className="font-mono text-[11px] text-slate-500">
                                  SHA-256: {analysis.file_hash_sha256.slice(0, 16)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono ${decisionBadge}`}>
                            Decisão IA: {analysis.recommended_decision} ({analysis.decision_archetype})
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAnalyzeSingleVideo(pipelineItem.id, true)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700 flex items-center gap-1.5 transition"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reprocessar Vídeo
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* OS 7 STATUS INDEPENDENTES DO PIPELINE (SEÇÃO 7) */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[11px]">
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">1. Análise de Conteúdo</span>
                          <strong className="text-cyan-300 font-mono">{analysis.status_content_analysis}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">2. Continuação</span>
                          <strong className="text-amber-300 font-mono">{analysis.status_continuation}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">3. Marca d’Água</span>
                          <strong className="text-purple-300 font-mono">{analysis.status_watermark}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">4. Qualidade Técnica</span>
                          <strong className="text-emerald-300 font-mono">{analysis.status_technical_quality}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">5. Direitos de Uso</span>
                          <strong className="text-slate-200 font-mono">{analysis.status_rights}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">6. Preparação</span>
                          <strong className="text-indigo-300 font-mono">{analysis.status_preparation}</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                          <span className="text-slate-400 block text-[10px]">7. Publicação</span>
                          <strong className="text-teal-300 font-mono">{analysis.status_publication}</strong>
                        </div>
                      </div>

                      {/* EXPLICAÇÃO DA DECISÃO RECOMENDADA */}
                      <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-200">
                        <strong className="text-cyan-400 font-mono mr-2">[Parecer do Motor de Decisão]:</strong>
                        {analysis.decision_explanation}
                      </div>

                      {/* GRID DE 4 PILARES: FICHA DE CONTEÚDO | CONTINUAÇÕES | WATERMARK DETECTOR | QUALIDADE TÉCNICA */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* PILAR 1 & 2: FICHA DE CONTEÚDO E PROGRESSÃO TEMPORAL */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-cyan-300 uppercase font-mono">
                              1. Ficha de Conteúdo & Progressão Multi-Quadro
                            </span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                              Confiança: {analysis.content_confidence}% ({analysis.content_classification})
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div>
                              <span className="text-slate-400">Resumo da Cena: </span>
                              <span className="text-slate-200">{analysis.scene_summary}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Obra Provável: </span>
                              <strong className="text-white">{analysis.probable_work}</strong>{' '}
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">
                                {analysis.work_identification_status}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Categoria / Subcategoria: </span>
                              <span className="text-slate-200">
                                {analysis.detected_category} • {analysis.detected_subcategory}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Personagens Reconhecidos: </span>
                              <span className="text-slate-200 font-medium">
                                {analysis.recognized_characters?.length > 0
                                  ? analysis.recognized_characters.join(', ')
                                  : 'Nenhum personagem confirmado sem margem de invenção'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] font-mono text-slate-400 block">Evento Inicial:</span>
                                <span className="text-slate-200 text-[11px]">{analysis.initial_event}</span>
                              </div>
                              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                                <span className="text-[10px] font-mono text-slate-400 block">Evento Final:</span>
                                <span className="text-slate-200 text-[11px]">{analysis.final_event}</span>
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-400 pt-1">
                              Mudanças de cena: <strong className="text-white">{analysis.scene_changes_count}</strong> • Áudio/Transcrição:{' '}
                              <span className="text-slate-300">{analysis.audio_transcript_summary}</span>
                            </div>
                          </div>
                        </div>

                        {/* PILAR 3: DETECÇÃO DE CONTINUAÇÕES E AGRUPAMENTO DE SEQUÊNCIA */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-amber-300 uppercase font-mono">
                              2. Detecção de Continuações & Sequências
                            </span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                              {analysis.continuation_classification} ({analysis.continuation_confidence}%)
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <span className="text-slate-400">Estrutura Narrativa: </span>
                              <strong className="text-white">{analysis.appears_isolated_or_sequence}</strong>
                              {analysis.sequence_group_id && (
                                <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/40">
                                  Grupo: {analysis.sequence_group_id} (Parte {analysis.sequence_part_number || 1})
                                </span>
                              )}
                            </div>

                            {analysis.continuation_indicators?.length > 0 && (
                              <div>
                                <span className="text-slate-400 block mb-1">Indícios de Sequência Detectados:</span>
                                <ul className="list-disc list-inside text-[11px] text-amber-200 space-y-0.5">
                                  {analysis.continuation_indicators.map((ind: string, idx: number) => (
                                    <li key={idx}>{ind}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <p className="text-[11px] text-slate-300">{analysis.continuation_search_notes}</p>

                            {analysis.continuation_candidates?.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-mono uppercase text-slate-400 block">
                                  Vídeos Relacionados / Partes da Sequência Encontradas:
                                </span>
                                {analysis.continuation_candidates.map((cand: any) => (
                                  <div
                                    key={cand.id}
                                    className="p-2.5 rounded-lg bg-slate-950 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2"
                                  >
                                    <div className="space-y-0.5">
                                      <div className="font-semibold text-white text-[11px]">
                                        [{cand.relationship_type} — Ordem #{cand.suggested_order_index}] {cand.candidate_title}
                                      </div>
                                      <a
                                        href={cand.candidate_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-[10px] font-mono text-cyan-400 hover:underline block"
                                      >
                                        {cand.candidate_url}
                                      </a>
                                      <div className="text-[10px] text-slate-400">
                                        Evidências: {cand.evidence?.join(' • ')} (Confiança: {cand.confidence_score}%)
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleValidateContinuationCandidate(cand.id, 'CONFIRMED')}
                                        className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px]"
                                      >
                                        Confirmar Parte
                                      </button>
                                      <button
                                        onClick={() => handleValidateContinuationCandidate(cand.id, 'REJECTED')}
                                        className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px]"
                                      >
                                        Descartar
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PILAR 4 & 5: WATERMARK DETECTOR E POLÍTICA DE TRATAMENTO */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-purple-300 uppercase font-mono">
                              3. Watermark Detector (Inspeção 4 Cantos & Centro)
                            </span>
                            <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300">
                              {analysis.watermark_classification} ({analysis.watermark_confidence}%)
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-slate-400">Regiões com Sobrepor/Marca:</span>
                              {analysis.watermark_locations?.length > 0 ? (
                                analysis.watermark_locations.map((loc: string, i: number) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-500/40 font-mono text-[10px]"
                                  >
                                    {loc}
                                  </span>
                                ))
                              ) : (
                                <span className="text-emerald-300 font-mono text-[11px]">
                                  Nenhuma marca d’água nos 4 cantos/centro
                                </span>
                              )}
                            </div>

                            {analysis.watermark_detected_text && (
                              <div>
                                <span className="text-slate-400">Texto/Identificador Reconhecido: </span>
                                <strong className="text-white font-mono">{analysis.watermark_detected_text}</strong> (Padrão:{' '}
                                <span className="font-mono text-slate-300">{analysis.watermark_temporal_pattern}</span>)
                              </div>
                            )}

                            <p className="text-[11px] text-slate-300">{analysis.watermark_policy_explanation}</p>

                            {(analysis.watermark_detected === 1 || analysis.clean_version_file_path) && (
                              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                                {analysis.clean_version_file_path ? (
                                  <div className="text-[11px] text-emerald-300 font-mono">
                                    ✓ Versão Limpa Autorizada Vinculada: {analysis.clean_version_file_name}
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="file"
                                      accept="video/*,.mp4"
                                      onChange={(e) =>
                                        setCleanVersionUploadFiles((prev) => ({
                                          ...prev,
                                          [pipelineItem.id]: e.target.files?.[0] || null,
                                        }))
                                      }
                                      className="text-[11px] text-slate-300 bg-slate-900 border border-slate-700 rounded px-2 py-1"
                                    />
                                    <button
                                      onClick={() => handleAttachCleanVersion(pipelineItem.id)}
                                      className="px-2.5 py-1 rounded bg-cyan-500 text-slate-950 font-semibold text-[11px]"
                                    >
                                      Associar Versão Limpa Autorizada
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* PILAR 6: ANÁLISE DE QUALIDADE TÉCNICA (0-100) */}
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 text-xs">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-emerald-300 uppercase font-mono">
                              4. Análise de Qualidade Técnica (Score 0–100)
                            </span>
                            <span
                              className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded ${
                                !isFullVisual
                                  ? 'bg-slate-800 text-slate-400'
                                  : analysis.quality_score >= 75
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : analysis.quality_score >= 60
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {isFullVisual ? `Score: ${analysis.quality_score}/100` : 'Aguardando Arquivo'}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[11px]">
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Resolução / Formato</span>
                              <strong className="text-white font-mono">
                                {isFullVisual
                                  ? `${analysis.resolution_width}x${analysis.resolution_height} (${analysis.aspect_ratio})`
                                  : 'Sem arquivo local'}
                              </strong>
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Adaptação Vertical 9:16</span>
                              <strong className="text-cyan-300 font-mono">
                                {analysis.is_vertical
                                  ? 'Vertical Nativo'
                                  : analysis.adaptable_to_vertical
                                    ? 'Horizontal Adaptável'
                                    : 'Inadequado'}
                              </strong>
                            </div>
                            <div className="p-2 rounded bg-slate-950 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Nitidez & Áudio</span>
                              <strong className="text-slate-200 font-mono">
                                {analysis.blur_level} • {analysis.audio_quality_status}
                              </strong>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-mono uppercase text-slate-400 block">
                              Fatores Explicativos da Pontuação:
                            </span>
                            {analysis.quality_factors?.map((qf: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-[11px] bg-slate-950 px-2.5 py-1 rounded border border-slate-800/80"
                              >
                                <span className="text-slate-300">{qf.detail}</span>
                                <span
                                  className={`font-mono ml-2 ${
                                    qf.impact < 0 ? 'text-rose-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {qf.impact === 0 ? 'OK' : `${qf.impact} pts`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 3: BIBLIOTECA CENTRAL & CONTROLE DE DIREITOS (GATEKEEPER)
             ================================================================ */}
          {activeTab === 'LIBRARY' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-cyan-400" />
                    Biblioteca Central & Controle de Direitos Autorais
                  </h1>
                  <p className="text-xs text-slate-400">
                    Organizada em Filmes, Animes e Séries. Nenhum material pode ser aprovado ou agendado sem direitos verificados (`VERIFIED_AUTHORIZED`).
                  </p>
                </div>

                {/* SELETOR DE ORGANIZAÇÃO: FILMES / ANIMES / SÉRIES */}
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  {[
                    { id: 'ALL', label: 'Todos' },
                    { id: 'FILMES', label: '🎬 Filmes' },
                    { id: 'ANIME', label: '⚡ Animes' },
                    { id: 'SERIES', label: '📺 Séries' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLibCategoryTab(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        libCategoryTab === tab.id
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* UPLOAD DE MATERIAL AUTORIZADO */}
              <form
                onSubmit={handleUploadLibrary}
                className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-cyan-400" />
                    Cadastrar / Fazer Upload de Material de Fonte Autorizada
                  </h3>
                  <span className="text-[11px] font-mono text-slate-400">
                    Inspeção de Duplicatas por SHA-256 e URL Ativa
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Canal Associado *</label>
                    <select
                      value={uploadForm.channel_id}
                      onChange={(e) => setUploadForm({ ...uploadForm, channel_id: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="ego-filmes">EGO FILMES</option>
                      <option value="ego-anime">EGO ANIME</option>
                      <option value="ego-series">EGO SÉRIES</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Título do Corte / Material *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Cena Oficial do Desfecho — Press Kit Autorizado"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Obra / Licença Ref.</label>
                    <input
                      type="text"
                      placeholder="Ex: Licença #EGO-2026"
                      value={uploadForm.work_reference}
                      onChange={(e) => setUploadForm({ ...uploadForm, work_reference: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Arquivo de Vídeo (.mp4/.mov)</label>
                    <input
                      type="file"
                      accept="video/*,.mp4,.mov"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">URL de Origem (Opcional)</label>
                    <input
                      type="url"
                      placeholder="https://egotv.com.br/..."
                      value={uploadForm.source_url}
                      onChange={(e) => setUploadForm({ ...uploadForm, source_url: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nota de Direitos de Uso</label>
                    <input
                      type="text"
                      placeholder="Ex: Press Kit / Licença Cedida"
                      value={uploadForm.rights_license_notes}
                      onChange={(e) => setUploadForm({ ...uploadForm, rights_license_notes: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                    >
                      Salvar na Biblioteca Central
                    </button>
                  </div>
                </div>
              </form>

              {/* BARRA DE PESQUISA NA BIBLIOTECA */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Pesquisar por título, obra ou hashtags..."
                    value={libSearch}
                    onChange={(e) => setLibSearch(e.target.value)}
                    className="w-full bg-[#0D131F] border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* LISTA DE MATERIAIS E PAINEL DE DIREITOS / APROVAÇÃO */}
              <div className="space-y-3">
                {filteredLibrary.map((item) => {
                  const wf = WORKFLOW_LABELS[item.workflow_status] || {
                    label: item.workflow_status,
                    color: 'bg-slate-800 text-slate-300',
                  };
                  const rt = RIGHTS_LABELS[item.rights_status] || {
                    label: item.rights_status,
                    badge: 'bg-slate-800 text-slate-300',
                  };

                  return (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400">#{item.id}</span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                            {item.category_group} • {item.channel_id}
                          </span>
                          <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${wf.color}`}>
                            Status: {wf.label}
                          </span>
                          <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${rt.badge}`}>
                            {rt.label}
                          </span>
                          {item.is_demo === 1 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              DEMO
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        <p className="text-xs text-slate-400">
                          Obra/Ref: <strong className="text-slate-200">{item.work_reference}</strong> • Arquivo:{' '}
                          <span className="font-mono text-slate-300">{item.file_name || 'Referência Externa'}</span> (
                          {item.resolution}, {item.duration_seconds}s)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Licença/Direitos: {item.rights_license_notes || 'Não informado'}
                        </p>
                      </div>

                      {/* AÇÕES DE CONTROLE DE DIREITOS E FLUXO DE APROVAÇÃO */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {item.rights_status !== 'VERIFIED_AUTHORIZED' ? (
                          <button
                            onClick={() =>
                              handleVerifyRights(
                                item.id,
                                'VERIFIED_AUTHORIZED',
                                'Direitos de uso verificados e liberados pelo operador.'
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-medium flex items-center gap-1.5 transition"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Confirmar Direitos
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              handleVerifyRights(
                                item.id,
                                'RESTRICTED_BLOCKED',
                                'Direitos revogados/bloqueados pelo operador.'
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] transition"
                          >
                            Revogar Direitos
                          </button>
                        )}

                        <button
                          onClick={() => handleWorkflowTransition(item.id, 'APPROVED')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-medium transition"
                          title="Só aprova se os direitos estiverem verificados"
                        >
                          Aprovar Conteúdo
                        </button>

                        <button
                          onClick={() => handleWorkflowTransition(item.id, 'REJECTED')}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs transition"
                        >
                          Rejeitar
                        </button>

                        <button
                          onClick={() => {
                            handleSelectPrepItem(String(item.id));
                            setActiveTab('PREPARATION');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs transition"
                        >
                          Preparar Copy
                        </button>

                        <button
                          onClick={() => setSelectedContentModal(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                        >
                          Detalhes & Histórico
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 4: ESTÚDIO DE PREPARAÇÃO (LEGENDAS TIKTOK vs INSTAGRAM & VALIDAÇÃO)
             ================================================================ */}
          {activeTab === 'PREPARATION' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-cyan-400" />
                  Módulo de Preparação & Copywriting por Plataforma
                </h1>
                <p className="text-xs text-slate-400">
                  Gera modelos distintos para TikTok (gancho curto + SEO) e Instagram Reels (narrativa + engajamento), validando requisitos técnicos e bloqueando alegações enganosas.
                </p>
              </div>

              <form
                onSubmit={handleSavePreparation}
                className="p-6 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">
                      Selecionar Material da Biblioteca
                    </label>
                    <select
                      value={prepContentId}
                      onChange={(e) => handleSelectPrepItem(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    >
                      <option value="">-- Escolha um item da Biblioteca --</option>
                      {libraryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.id} [{item.channel_id.toUpperCase()}] {item.title} ({item.rights_status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Ângulo Criativo da Copy</label>
                    <div className="flex gap-2">
                      <select
                        value={prepAngle}
                        onChange={(e) => setPrepAngle(e.target.value as any)}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                      >
                        <option value="HIGHLIGHT">Destaque Cinematográfico</option>
                        <option value="CURIOSITY">Detalhe Oculto / Curiosidade</option>
                        <option value="DEBATE">Pergunta Polêmica / Debate</option>
                        <option value="BEHIND_THE_SCENES">Bastidores & Produção</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleGenerateCopy}
                        className="px-3.5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-semibold shrink-0"
                      >
                        Gerar Sugestões
                      </button>
                    </div>
                  </div>
                </div>

                {/* TEMPLATES SEPARADOS: TIKTOK VS INSTAGRAM */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cyan-300">
                        Modelo Exclusivo TikTok (Gancho Rápido + SEO)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(prepTiktok, 'Legenda TikTok')}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedText === 'Legenda TikTok' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copiar
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={prepTiktok}
                      onChange={(e) => setPrepTiktok(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100"
                      placeholder="Legenda otimizada para o TikTok..."
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300">
                        Modelo Exclusivo Instagram Reels (Discussão & Bio)
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(prepInstagram, 'Legenda Instagram')}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {copiedText === 'Legenda Instagram' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        Copiar
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={prepInstagram}
                      onChange={(e) => setPrepInstagram(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100"
                      placeholder="Legenda otimizada para o Instagram Reels..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-slate-400 mb-1">Hashtags Relevantes</label>
                    <input
                      type="text"
                      value={prepHashtags}
                      onChange={(e) => setPrepHashtags(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Duração Técnica (seg)</label>
                    <input
                      type="number"
                      value={prepDuration}
                      onChange={(e) => setPrepDuration(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Proporção / Resolução</label>
                    <select
                      value={prepResolution}
                      onChange={(e) => setPrepResolution(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    >
                      <option value="1080x1920">1080x1920 (9:16 Vertical Full HD)</option>
                      <option value="720x1280">720x1280 (9:16 Vertical HD)</option>
                      <option value="1920x1080">1920x1080 (16:9 Horizontal - Requer Corte)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-emerald-400" />
                    <span>
                      Conformidade Ego TV: Proibidas promessas enganosas de disponibilidade gratuita indevida.
                    </span>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                  >
                    Validar Metadados & Marcar como Preparado
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================================================================
              ABA 5: CALENDÁRIO E FILA DE PUBLICAÇÃO OFICIAL
             ================================================================ */}
          {activeTab === 'CALENDAR' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <CalendarClock className="w-5 h-5 text-cyan-400" />
                    Calendário Operacional & Fila de Publicação (TikTok & Instagram)
                  </h1>
                  <p className="text-xs text-slate-400">
                    Prevenção de duplicatas, aprovação prévia no MVP e retentativas controladas. Nunca simula uma publicação falsa caso as chaves OAuth não estejam ativas.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setCalendarView('DAILY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      calendarView === 'DAILY' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    Visão Diária (Slots 90/dia)
                  </button>
                  <button
                    onClick={() => setCalendarView('WEEKLY')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      calendarView === 'WEEKLY' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    Visão Semanal (630/sem)
                  </button>
                </div>
              </div>

              {/* FORMULÁRIO DE AGENDAMENTO NA FILA */}
              <form
                onSubmit={handleSchedulePublication}
                className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
              >
                <h3 className="text-sm font-bold text-white">
                  Enfileirar Vídeo Autorizado nas Contas Sociais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Vídeo (Requer Direitos Verificados + Aprovado/Preparado)
                    </label>
                    <select
                      value={schedContentId}
                      onChange={(e) => setSchedContentId(Number(e.target.value) || '')}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- Selecione o vídeo para agendar --</option>
                      {libraryItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          #{item.id} [{item.workflow_status}] {item.title} ({item.rights_status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Conta Social de Destino (6 Contas)</label>
                    <select
                      value={schedAccountId}
                      onChange={(e) => setSchedAccountId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="tt-filmes">TikTok: @egofilmes.oficial</option>
                      <option value="ig-filmes">Instagram: @egofilmes.tv</option>
                      <option value="tt-anime">TikTok: @egoanime.oficial</option>
                      <option value="ig-anime">Instagram: @egoanime.tv</option>
                      <option value="tt-series">TikTok: @egoseries.oficial</option>
                      <option value="ig-series">Instagram: @egoseries.tv</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Data e Horário</label>
                    <input
                      type="datetime-local"
                      value={schedDateTime}
                      onChange={(e) => setSchedDateTime(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedApproveNow}
                      onChange={(e) => setSchedApproveNow(e.target.checked)}
                      className="rounded border-slate-700"
                    />
                    <span>Aprovar disparo imediatamente pelo operador (Requisito MVP)</span>
                  </label>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                  >
                    Agendar & Adicionar à Fila
                  </button>
                </div>
              </form>

              {/* GRADE VISUAL DIÁRIA / SEMANAL DE SLOTS OPERACIONAIS */}
              {calendarView === 'WEEKLY' && (
                <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                  {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, idx) => (
                    <div key={day} className="p-3.5 rounded-xl bg-[#0D131F] border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{day}</span>
                        <span className="text-[10px] font-mono text-cyan-400">Meta: 90</span>
                      </div>
                      <div className="text-[11px] text-slate-400 space-y-1">
                        <div>🎬 Filmes: 30 slots</div>
                        <div>⚡ Anime: 30 slots</div>
                        <div>📺 Séries: 30 slots</div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                        Agendados: {idx === 1 ? queueData.queue.length : 0}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FILA DE PUBLICAÇÃO COM STATUS E RESULTADO DA ÚLTIMA TENTATIVA */}
              <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4">
                <h3 className="text-sm font-bold text-white">
                  Fila de Publicação Ativa ({queueData.queue.length} registros)
                </h3>

                {queueData.queue.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">
                    Nenhum item enfileirado com os filtros selecionados. Agende um material preparado acima.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {queueData.queue.map((q: any) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-400">Fila #{q.id}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                              {q.platform} • {q.account_handle}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              Horário: {q.scheduled_for}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                q.status === 'PUBLISHED_OFFICIAL_API'
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : q.status === 'AWAITING_CREDENTIALS'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : q.status === 'FAILED'
                                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                      : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              }`}
                            >
                              Status: {q.status}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Tentativas: {q.attempts}/{q.max_attempts}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-white">{q.content_title}</h4>
                          <p className="text-xs text-slate-400 line-clamp-2 font-mono bg-slate-950/70 p-2 rounded border border-slate-800/80">
                            {q.caption_used}
                          </p>
                          {q.external_post_id && q.status === 'PUBLISHED_OFFICIAL_API' && (
                            <div className="text-[11px] text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-lg font-mono">
                              <strong>✓ Publicado com sucesso em {q.account_handle}:</strong> Post ID {q.external_post_id} ({q.published_at || 'Agora'})
                            </div>
                          )}
                          {q.last_error && (
                            <div className="text-[11px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 rounded-lg">
                              <strong>Resultado da última tentativa:</strong> {q.last_error}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {q.status === 'PUBLISHED_OFFICIAL_API' ? (
                            <span className="px-3.5 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Publicado no TikTok
                            </span>
                          ) : (
                            <>
                              {!q.approved_for_publish && (
                                <button
                                  onClick={() => handleApproveQueueItem(q.id)}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium"
                                >
                                  Aprovar Disparo
                                </button>
                              )}
                              <button
                                onClick={() => handleDispatchQueueItem(q.id)}
                                className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition"
                              >
                                <Play className="w-3.5 h-3.5" />
                                Disparar via API Oficial
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 6: ANALYTICS, LINKS RASTREÁVEIS (/r/:code) E CONVERSÕES EGO TV
             ================================================================ */}
          {activeTab === 'ANALYTICS' && analyticsData && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Analytics Comercial, Links Rastreáveis & Atribuição Ego TV
                </h1>
                <p className="text-xs text-slate-400">
                  Separação rigorosa entre métricas observadas, cliques reais rastreados e métricas indisponíveis sem OAuth. Nenhuma assinatura é atribuída sem vínculo comprovado de campanha.
                </p>
              </div>

              {/* DIFERENCIAÇÃO DE MÉTRICAS REAIS, OBSERVADAS E INDISPONÍVEIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(analyticsData.metricsClassification).map(([key, item]: [string, any]) => (
                  <div key={key} className="p-4 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                        {item.type}
                      </span>
                    </div>
                    <div className="text-2xl font-bold font-mono text-white">
                      {item.value === null ? 'INDISPONÍVEL' : item.value.toLocaleString('pt-BR')}
                    </div>
                    <p className="text-xs text-slate-400">{item.note}</p>
                  </div>
                ))}
              </div>

              {/* CONVERSÃO POR CANAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analyticsData.conversionByChannel.map((c: any) => (
                  <div key={c.channelId} className="p-4 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{c.channelName}</span>
                      <span className="font-mono text-xs text-emerald-400">
                        Conversão: {c.conversionRatePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Cliques Ego TV: <strong className="text-white font-mono">{c.clicks}</strong></span>
                      <span>Assinaturas UTM: <strong className="text-emerald-300 font-mono">{c.attributedSubscriptions}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* GERADOR DE LINKS RASTREÁVEIS & REGISTRO DE ASSINATURA ATRIBUÍDA */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <form
                  onSubmit={handleCreateTrackingLink}
                  className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                >
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-cyan-400" />
                    Criar Link Rastreável com UTM para Ego TV (`/r/:code`)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Canal de Origem</label>
                      <select
                        value={trackChannel}
                        onChange={(e) => setTrackChannel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="ego-filmes">EGO FILMES</option>
                        <option value="ego-anime">EGO ANIME</option>
                        <option value="ego-series">EGO SÉRIES</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Plataforma</label>
                      <select
                        value={trackPlatform}
                        onChange={(e) => setTrackPlatform(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      >
                        <option value="TIKTOK">TikTok</option>
                        <option value="INSTAGRAM">Instagram</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Nome da Campanha UTM</label>
                      <input
                        type="text"
                        required
                        value={trackCampaign}
                        onChange={(e) => setTrackCampaign(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Slug Curto (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: filmes-out-01"
                        value={trackCustomCode}
                        onChange={(e) => setTrackCustomCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
                  >
                    Gerar Link Rastreável
                  </button>
                </form>

                {/* SIMULADOR DE WEBHOOK DE ASSINATURA COM VINCULAÇÃO UTM OBRIGATÓRIA */}
                <form
                  onSubmit={handleRegisterConversion}
                  className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                >
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Registrar Conversão de Assinatura Auditada (Webhook / UTM)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exige um código de link rastreável válido e a referência do assinante para comprovar a atribuição ao canal.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Código de Tracking Vinculado</label>
                      <select
                        value={convCode}
                        onChange={(e) => setConvCode(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      >
                        {analyticsData.trackingLinks.map((l: any) => (
                          <option key={l.id} value={l.code}>
                            /r/{l.code} ({l.channel_id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ID / Ref. do Pedido Ego TV *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: SUB-EGOTV-9941"
                        value={convSubscriber}
                        onChange={(e) => setConvSubscriber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition"
                  >
                    Confirmar Atribuição de Assinatura
                  </button>
                </form>
              </div>

              {/* TABELA DE LINKS RASTREÁVEIS ATIVOS */}
              <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-3">
                <h3 className="text-sm font-bold text-white">Links Rastreáveis Ativos (`/r/:code`)</h3>
                <div className="space-y-2.5">
                  {analyticsData.trackingLinks.map((link: any) => (
                    <div
                      key={link.id}
                      className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-cyan-300">/r/{link.code}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {link.channel_id} • {link.platform}
                          </span>
                          {link.is_demo === 1 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                              DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono break-all">
                          Destino: {link.destination_url}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-slate-200">{link.clicks_count} cliques</div>
                          <div className="text-emerald-400 text-[11px]">{link.attributed_subscriptions} assinaturas</div>
                        </div>
                        <button
                          onClick={() => handleTestRealClick(link.code)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs transition"
                        >
                          Testar Clique Real (+1)
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              ABA 7: CONFIGURAÇÃO DOS 3 CANAIS & 6 CONTAS SOCIAIS
             ================================================================ */}
          {activeTab === 'CHANNELS' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-cyan-400" />
                  Estrutura de Canais (3) & Contas Sociais Conectadas (6)
                </h1>
                <p className="text-xs text-slate-400">
                  Configurações independentes por canal (EGO FILMES, EGO ANIME, EGO SÉRIES) e status de integração das 6 contas oficiais (3 TikTok + 3 Instagram).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {channelsData.channels.map((ch: any) => (
                  <div
                    key={ch.id}
                    className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: ch.color }} />
                        <h3 className="font-bold text-base text-white">{ch.name}</h3>
                      </div>
                      <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                        Meta: {ch.daily_goal}/dia
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-1">Categorias do Canal:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ch.categories.map((cat: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-1">Palavras-chave de Pesquisa:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ch.search_keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-slate-900/70 text-cyan-300 font-mono text-[11px]">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-400 block mb-1">Chamada para Ação (CTA Padrão):</span>
                        <p className="p-2 rounded bg-slate-900 text-slate-200 border border-slate-800">
                          {ch.default_cta}
                        </p>
                      </div>
                    </div>

                    {/* CONTAS SOCIAIS DO CANAL (1 TIKTOK + 1 INSTAGRAM) */}
                    <div className="pt-3 border-t border-slate-800 space-y-2.5">
                      <span className="text-xs font-bold text-slate-300 block">
                        Contas Sociais Vinculadas ({ch.social_accounts.length})
                      </span>
                      {ch.social_accounts.map((acc: any) => {
                        const isConnected = Boolean(acc.oauth_connected);
                        return (
                          <div
                            key={acc.id}
                            className={`p-3.5 rounded-xl border space-y-2.5 text-xs ${
                              isConnected
                                ? 'bg-emerald-950/25 border-emerald-500/40'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                                    }`}
                                  />
                                  {acc.platform}: {acc.handle}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Meta da conta: {acc.daily_target} vídeos/dia
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                  isConnected
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {acc.connection_status}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder={acc.handle}
                                value={accountHandleInputs[acc.id] ?? ''}
                                onChange={(e) =>
                                  setAccountHandleInputs((prev) => ({
                                    ...prev,
                                    [acc.id]: e.target.value,
                                  }))
                                }
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono"
                              />
                              <input
                                type="password"
                                placeholder="Access Token OAuth (Opcional)"
                                value={accountTokenInputs[acc.id] ?? ''}
                                onChange={(e) =>
                                  setAccountTokenInputs((prev) => ({
                                    ...prev,
                                    [acc.id]: e.target.value,
                                  }))
                                }
                                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleConnectSocialAccount(acc.id, {
                                    handle: accountHandleInputs[acc.id] || acc.handle,
                                    access_token: accountTokenInputs[acc.id] || undefined,
                                    exclusive_mode: false,
                                  })
                                }
                                className={`flex-1 py-1.5 rounded-lg font-semibold text-[11px] transition ${
                                  isConnected
                                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                }`}
                              >
                                {isConnected ? '✓ Conta Conectada (Atualizar)' : `Conectar ${acc.platform}`}
                              </button>
                              {isConnected && (
                                <button
                                  type="button"
                                  onClick={() => handleDisconnectSocialAccount(acc.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-[11px] transition"
                                >
                                  Desconectar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* STATUS DAS INTEGRAÇÕES OFICIAIS E CREDENCIAIS */}
              {channelsData.integrations && (
                <div className="p-5 rounded-2xl bg-[#0D131F] border border-slate-800/90 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-cyan-400" />
                    Diagnóstico da Camada de Integração Oficial (Variáveis de Ambiente)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {Object.entries(channelsData.integrations).map(([k, v]: [string, any]) => (
                      <div key={k} className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                        <div className="font-bold text-white">{v.apiName}</div>
                        <div className="text-[11px] font-mono text-amber-300">{v.statusLabel}</div>
                        {v.requiredScopes && (
                          <div className="text-[11px] text-slate-400">
                            Escopos: <span className="font-mono">{v.requiredScopes.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE DETALHES E HISTÓRICO DE AUDITORIA DO ITEM DA BIBLIOTECA */}
      {selectedContentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0D131F] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">
                Dossiê do Material #{selectedContentModal.id} — {selectedContentModal.title}
              </h3>
              <button
                onClick={() => setSelectedContentModal(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Status de Fluxo:</span>
                <strong className="text-white font-mono">{selectedContentModal.workflow_status}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Direitos de Uso:</span>
                <strong className="text-cyan-300 font-mono">{selectedContentModal.rights_status}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Hash SHA-256 (Deduplicação):</span>
                <strong className="text-slate-300 font-mono break-all">
                  {selectedContentModal.file_hash || 'Sem arquivo local'}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-400 block">Especificação Técnica:</span>
                <strong className="text-slate-300 font-mono">
                  {selectedContentModal.resolution} • {selectedContentModal.duration_seconds}s
                </strong>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase font-mono">
                Histórico de Processamento & Auditoria ({selectedContentModal.history?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedContentModal.history?.map((h: any) => (
                  <div key={h.id} className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs flex justify-between">
                    <div>
                      <span className="font-mono text-cyan-400 mr-2">[{h.event_type}]</span>
                      <span className="text-slate-200">{h.details}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">{h.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AUTENTICAÇÃO DO OPERADOR */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleLogin}
            className="bg-[#0D131F] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Autenticação de Operador — Ego TV</h3>
              <button
                type="button"
                onClick={() => setShowLoginModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fechar
              </button>
            </div>
            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/40 text-xs text-rose-200">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">E-mail Operacional</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Senha</label>
              <input
                type="password"
                required
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
            >
              Autenticar com JWT
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
