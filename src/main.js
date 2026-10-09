globalThis.GTR = globalThis.GTR || {};

(() => {
  const G = globalThis.GTR;
  function parseFolderLocation(hash = location.hash) {
    const decoded = decodeURIComponent(String(hash || '').replace(/^#\/?/, ''));
    const segments = decoded.split('/').filter(Boolean);
    const entries = segments.map((segment) => {
      const separator = segment.indexOf('-');
      return separator > 0 ? { id: segment.slice(0, separator), name: segment.slice(separator + 1) } : { id: '', name: segment };
    });
    const current = entries.at(-1) || { id: '', name: '' };
    const parent = entries.at(-2) || { id: '', name: '' };
    const seasonMatch = current.name.match(/(?:^|\b)S(\d{1,3})(?:\b|$)/i);
    return {
      parentId: current.id, seriesTitle: seasonMatch ? parent.name : current.name,
      seasonNumber: seasonMatch ? Number(seasonMatch[1]) : null,
      displayPath: entries.slice(-2).map((entry) => entry.name).filter(Boolean).join('/')
    };
  }

  function selectedFolderName(documentLike, fallback = '') {
    const selectors = [
      '[data-file-type="folder"][aria-selected="true"]',
      '[data-type="folder"][aria-selected="true"]',
      '.ant-table-row-selected',
      '.el-table__row.current-row',
      'tr:has(input[type="checkbox"]:checked)'
    ];
    for (const selector of selectors) {
      let row;
      try { row = documentLike?.querySelector?.(selector); } catch { continue; }
      if (!row) continue;
      const explicit = row.dataset?.fileName || row.dataset?.name || row.getAttribute?.('data-filename');
      const nameNode = row.querySelector?.('[data-file-name], [data-name], .file-name, .filename, [class*="fileName"], [class*="file-name"]');
      const titled = [...(row.querySelectorAll?.('[title]') || [])].map((node) => node.getAttribute('title')).find((value) => value && value.length < 200);
      const value = explicit || nameNode?.getAttribute?.('data-file-name') || nameNode?.getAttribute?.('data-name') || nameNode?.textContent || titled;
      if (String(value || '').trim()) return String(value).trim();
    }
    return fallback;
  }

  function contextFromCaptures(captures) {
    const list = captures.list; const detail = captures.detail; const rename = captures.rename;
    const source = rename || detail || list;
    if (!source?.headers?.authorization) return null;
    return {
      headers: source.headers, listUrl: list?.url, detailUrl: detail?.url, renameUrl: rename?.url,
      listBody: list?.body || {}, renameBody: rename?.body || {}
    };
  }

  function startApplication({ document: doc = document, pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window } = {}) {
    const captures = {};
    let routeKey = location.hash;
    let ui;
    const initialFolder = parseFolderLocation();
    let state = { folder: initialFolder, selectedFolderName: selectedFolderName(doc, initialFolder.seriesTitle), hasToken: Boolean(G.getTmdbToken()), authReady: false, query: '', candidates: [], series: null, episodes: [], files: [], plan: [], validation: null, mode: 'full', results: [], recoveryPlan: [], running: false, progress: '' };
    const update = (patch = {}) => { state = { ...state, ...patch }; ui?.render(state); return state; };
    const observe = G.installGuangyaRequestObserver(pageWindow, (capture) => {
      captures[capture.kind] = capture;
      update({ authReady: Boolean(contextFromCaptures(captures)) });
    });

    async function scan() {
      const context = contextFromCaptures(captures);
      if (!context) throw new Error('尚未捕获光鸭授权；请关闭面板并刷新当前文件列表');
      const folder = parseFolderLocation();
      if (!folder.parentId) throw new Error('无法从当前网址识别目录 ID');
      const client = G.createGuangyaClient({ context });
      const listed = (await client.listFiles(folder.parentId)).filter((file) => file.type === 'file');
      const files = (await client.enrichFileDetails(listed)).map((file) => ({ ...file, parsed: G.parseFilename(file.name) }));
      return { client, files, folder };
    }
    async function loadPlan(series = state.series) {
      if (!series) throw new Error('请先明确选择一个 TMDB 剧集');
      const { client, files, folder } = await scan();
      if (!Number.isInteger(folder.seasonNumber)) throw new Error('当前目录名未包含 Sxx 季号');
      const tmdb = G.createTmdbClient();
      const seasons = await tmdb.loadSeasons(series.id, folder.seasonNumber);
      const episodes = [...seasons.regular, ...seasons.specials];
      const matches = G.matchDirectory(files, seasons.regular, seasons.specials);
      const plan = G.createRenamePlan(files, matches, { seriesTitle: series.name, mode: state.mode });
      update({ client, files, folder, episodes, plan, validation: G.validatePlan(plan, files), results: [], recoveryPlan: [], progress: `已载入 ${files.length} 个文件` });
    }
    const reportError = (error) => update({ running: false, progress: error?.message || String(error) });
    const handlers = {
      open: () => { const folder = parseFolderLocation(); const chosenName = selectedFolderName(doc, folder.seriesTitle); update({ folder, selectedFolderName: chosenName, query: chosenName, hasToken: Boolean(G.getTmdbToken()), authReady: Boolean(contextFromCaptures(captures)) }); },
      'save-token': (panel) => { G.setTmdbToken(panel.querySelector('#gtr-token').value); update({ hasToken: Boolean(G.getTmdbToken()), progress: 'TMDB Token 已保存到油猴隔离存储' }); },
      search: async (panel) => { try { const folder = parseFolderLocation(); const query = selectedFolderName(doc, folder.seriesTitle).trim() || panel.querySelector('#gtr-query').value.trim(); update({ folder, selectedFolderName: query, query, progress: `正在用文件夹名称“${query}”搜索 TMDB…` }); update({ candidates: await G.createTmdbClient().searchTv(query), progress: '请选择准确的 TMDB 剧集' }); } catch (error) { reportError(error); } },
      'choose-series': async (panel) => { try { const id = Number(panel.querySelector('input[name="gtr-series"]:checked')?.value); const series = state.candidates.find((item) => item.id === id); if (!series) throw new Error('请明确选择一个候选剧集'); G.cacheSeries(state.folder.displayPath, series); update({ series, progress: '正在读取目录和 TMDB 季信息…' }); await loadPlan(series); } catch (error) { reportError(error); } },
      reload: async () => { try { update({ progress: '正在重新扫描…' }); await loadPlan(); } catch (error) { reportError(error); } },
      'choose-episode': ({ index, key }) => {
        const plan = [...state.plan];
        const [season, episode] = key.split(':').map(Number);
        const selectedEpisode = key ? state.episodes.find((item) => item.seasonNumber === season && item.episodeNumber === episode) : null;
        if (key && !selectedEpisode) return;
        plan[index] = G.assignEpisode(plan[index], selectedEpisode);
        update({ plan, validation: G.validatePlan(plan, state.files) });
      },
      execute: async () => {
        try {
          const validation = G.validatePlan(state.plan, state.files); update({ validation });
          if (!validation.valid) throw new Error('计划存在阻断错误');
          const selected = state.plan.filter((item) => item.selected); const warningCount = selected.reduce((sum, item) => sum + item.warnings.length, 0);
          if (!confirm(`将重命名 ${selected.length} 个文件，仍有 ${warningCount} 条警告。是否继续？`)) { update({ progress: '用户已取消执行' }); return; }
          update({ running: true, progress: `0/${selected.length}` });
          const outcome = await G.executeRenamePlan({ plan: state.plan, listFiles: state.client.listFiles, renameFile: state.client.renameFile, onProgress: (detail) => update({ progress: detail.type === 'retry' ? `请求重试 ${detail.attempt}` : `${detail.completed}/${detail.total}` }) });
          update({ running: false, results: outcome.results, recoveryPlan: outcome.recoveryPlan, progress: outcome.aborted ? '批次已停止' : '执行并校验完成' });
        } catch (error) { reportError(error); }
      },
      recover: async () => { try { if (!confirm(`恢复 ${state.recoveryPlan.length} 个文件的原名称？`)) return; update({ running: true, progress: '正在恢复…' }); const outcome = await G.executeRenamePlan({ plan: state.recoveryPlan, listFiles: state.client.listFiles, renameFile: state.client.renameFile }); update({ running: false, results: outcome.results, recoveryPlan: [], progress: '恢复操作完成并已校验' }); } catch (error) { reportError(error); } },
      change: async (event) => {
        if (event.target.id === 'gtr-mode') {
          const mode = event.target.value; const plan = state.plan.map((item) => ({ ...item, mode, targetName: item.episode ? G.generateTargetName(item.seriesTitle, item.episode, item.parsed.extension, mode, item.variantTags) : '' })); update({ mode, plan, validation: G.validatePlan(plan, state.files) });
        }
        const row = event.target.closest?.('tr[data-index]'); if (!row) return;
        const index = Number(row.dataset.index); let plan = [...state.plan];
        if (event.target.classList.contains('gtr-select')) plan[index] = { ...plan[index], selected: event.target.checked };
        update({ plan, validation: G.validatePlan(plan, state.files) });
      }
    };
    const mount = () => {
      if (!doc.body || doc.getElementById('gtr-launcher')) return;
      ui = G.createUi(doc, handlers, state);
      const cached = G.getCachedSeries(state.folder.displayPath); if (cached) update({ series: cached, candidates: [cached], progress: '已找到该目录曾确认的 TMDB 剧集，可重新扫描' });
    };
    if (doc.body) mount(); else doc.addEventListener('DOMContentLoaded', mount, { once: true });
    const routeTimer = setInterval(() => { if (location.hash !== routeKey) { routeKey = location.hash; const folder = parseFolderLocation(); update({ folder, selectedFolderName: selectedFolderName(doc, folder.seriesTitle), query: '', series: null, files: [], plan: [], validation: null, results: [], recoveryPlan: [], progress: '目录已变化，旧计划已清除' }); } }, 800);
    return { getState: () => state, handlers, stop: () => { observe(); clearInterval(routeTimer); } };
  }

  Object.assign(G, { parseFolderLocation, selectedFolderName, contextFromCaptures, startApplication });
  if (typeof document !== 'undefined' && !globalThis.__GTR_TEST__) startApplication();
})();
