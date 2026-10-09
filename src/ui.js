globalThis.GTR = globalThis.GTR || {};

(() => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const confidenceText = { high: '高', medium: '中', low: '低', unmatched: '未匹配' };
  function button(action, label, { enabled = true, hint = '', disabledReason = '', kind = '' } = {}) {
    const title = enabled ? hint : disabledReason;
    return `<button class="gtr-btn gtr-btn-${escapeHtml(kind || action)}" data-action="${escapeHtml(action)}" title="${escapeHtml(title)}"${enabled ? '' : ' disabled'}>${escapeHtml(label)}</button>`;
  }

  function renderCandidate(candidate) {
    const year = candidate.firstAirDate?.slice(0, 4) || '年份未知';
    const country = candidate.originCountry?.join('/') || '地区未知';
    const poster = candidate.posterPath
      ? `<img class="gtr-poster" src="https://image.tmdb.org/t/p/w154${escapeHtml(candidate.posterPath)}" alt="">`
      : '<div class="gtr-poster gtr-poster-empty">无海报</div>';
    return `<label class="gtr-candidate">${poster}<span><input type="radio" name="gtr-series" value="${candidate.id}"> <strong>${escapeHtml(candidate.name)}</strong><br><small>${escapeHtml(candidate.originalName || '')} · ${year} · ${escapeHtml(country)}</small><br><a href="${escapeHtml(candidate.tmdbUrl)}" target="_blank" rel="noopener">TMDB 页面</a></span></label>`;
  }

  const episodeKey = (episode) => episode ? `${episode.seasonNumber}:${episode.episodeNumber}` : '';
  const episodeLabel = (episode) => episode
    ? `S${String(episode.seasonNumber).padStart(2, '0')}E${String(episode.episodeNumber).padStart(2, '0')} ${episode.name || ''}`.trim()
    : '';
  const normalizeEpisodeSearch = (value) => String(value || '').toLocaleLowerCase().normalize('NFKC').replace(/[\s\-_.:/\\]+/g, '');

  function episodeSearchText(episode) {
    const season = Number(episode.seasonNumber);
    const number = Number(episode.episodeNumber);
    return [
      `S${String(season).padStart(2, '0')}E${String(number).padStart(2, '0')}`,
      `S${season}E${number}`,
      `${season}:${number}`,
      String(number),
      episode.name,
      ...(episode.alternateNames || [])
    ].map(normalizeEpisodeSearch).filter(Boolean).join(' ');
  }

  function filterEpisodes(episodes, query) {
    const fragments = String(query || '').trim().split(/\s+/).map(normalizeEpisodeSearch).filter(Boolean);
    if (!fragments.length) return [...episodes];
    return episodes.filter((episode) => {
      const searchText = episodeSearchText(episode);
      return fragments.every((fragment) => searchText.includes(fragment));
    });
  }

  function episodeSelector(episodes, selected, index) {
    const selectedKey = episodeKey(selected);
    const selectedLabel = episodeLabel(selected);
    const listId = `gtr-episode-list-${index}`;
    return `<div class="gtr-episode-combobox" data-index="${index}">
      <input class="gtr-episode-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${listId}" autocomplete="off" placeholder="搜索集数或标题" value="${escapeHtml(selectedLabel)}" data-selected-key="${escapeHtml(selectedKey)}" data-selected-label="${escapeHtml(selectedLabel)}">
      <div class="gtr-episode-list" id="${listId}" role="listbox" hidden></div>
    </div>`;
  }

  function episodeListMarkup(episodes, query) {
    const matches = filterEpisodes(episodes, query);
    const clear = '<button type="button" class="gtr-episode-option gtr-episode-clear" role="option" data-episode-key="">不匹配</button>';
    const options = matches.map((episode) => `<button type="button" class="gtr-episode-option" role="option" data-episode-key="${escapeHtml(episodeKey(episode))}">${escapeHtml(episodeLabel(episode))}</button>`).join('');
    const empty = matches.length ? '' : '<div class="gtr-episode-empty">没有匹配的剧集</div>';
    return `${clear}${options}${empty}`;
  }

  function renderPlanRows(plan, episodes) {
    return plan.map((item, index) => `<tr data-index="${index}">
      <td><input class="gtr-select" type="checkbox" ${item.selected ? 'checked' : ''} ${item.episode ? '' : 'disabled'}></td>
      <td title="${escapeHtml(item.oldName)}">${escapeHtml(item.oldName)}</td>
      <td>${episodeSelector(episodes, item.episode, index)}</td>
      <td><span class="gtr-confidence gtr-${item.confidence}">${confidenceText[item.confidence] || item.confidence}</span><br><small>${escapeHtml(item.evidence.join('；'))}</small></td>
      <td title="${escapeHtml(item.targetName)}">${escapeHtml(item.targetName || '—')}</td>
      <td class="gtr-warning">${escapeHtml(item.warnings.join('；'))}</td>
    </tr>`).join('');
  }

  function renderPanelMarkup(state) {
    const authText = state.authReady ? '光鸭授权：已捕获' : '光鸭授权：等待页面请求（请刷新文件列表）';
    const tokenText = state.hasToken ? 'TMDB：已配置' : 'TMDB：未配置';
    const errors = state.validation?.errors || [];
    const selectedCount = state.plan?.filter((item) => item.selected).length || 0;
    const warnings = state.plan?.filter((item) => item.selected).reduce((sum, item) => sum + item.warnings.length, 0) || 0;
    const searchReady = Boolean(state.hasToken && state.selectedFolderName);
    const chooseReady = Boolean(state.selectedSeriesId && state.candidates?.some((item) => item.id === state.selectedSeriesId));
    const reloadReady = Boolean(state.series && state.authReady && !state.running);
    const executeReason = state.running ? '正在执行，请等待当前批次结束' : errors.length ? `存在 ${errors.length} 个阻断错误，请先修正` : !selectedCount ? '没有已勾选且已匹配的文件' : '';
    return `<div class="gtr-head"><strong>TMDB 文件重命名</strong>${button('close', '×', { hint: '关闭面板', kind: 'close' })}</div>
      <div class="gtr-status"><span class="${state.authReady ? 'ok' : 'bad'}">${authText}</span><span class="${state.hasToken ? 'ok' : 'bad'}">${tokenText}</span><span>${escapeHtml(state.folder?.displayPath || '未识别当前目录')}</span></div>
      <div class="gtr-guide"><span class="${state.hasToken ? 'done' : 'active'}">1 Token</span><span class="${state.candidates?.length ? 'done' : 'active'}">2 搜索</span><span class="${state.series ? 'done' : 'active'}">3 选剧</span><span class="${state.plan?.length ? 'done' : 'active'}">4 预览</span><span class="${state.results?.length ? 'done' : 'active'}">5 执行</span></div>
      <section><h3>1. 设置与剧集</h3><div class="gtr-token-help">需要 TMDB Read Access Token。<a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener">前往 TMDB 官方 API 设置页获取 Token ↗</a></div><div class="gtr-line"><input id="gtr-token" type="password" placeholder="粘贴 TMDB Read Access Token" autocomplete="off">${button('save-token', '1　保存 Token', { hint: '保存到油猴隔离存储', kind: 'save' })}</div>
      <div class="gtr-line"><input id="gtr-query" value="${escapeHtml(state.selectedFolderName || state.query || state.folder?.seriesTitle || '')}" placeholder="选中文件夹名称" readonly>${button('search', '2　按文件夹名称搜索', { enabled: searchReady, hint: `使用“${state.selectedFolderName}”搜索 TMDB`, disabledReason: !state.hasToken ? '不可点击：请先填写并保存 TMDB Token' : '不可点击：请先在光鸭页面选中目标文件夹', kind: 'search' })}</div>
      <div class="gtr-candidates">${(state.candidates || []).map(renderCandidate).join('')}</div>${state.candidates?.length ? button('choose-series', '3　确认选择并加载', { enabled: chooseReady, hint: '确认当前选中的 TMDB 剧集并加载季数据', disabledReason: '不可点击：请先选择一个 TMDB 搜索结果', kind: 'choose' }) : ''}</section>
      <section><h3>2. 预览</h3><div class="gtr-line"><label>命名方式 <select id="gtr-mode"><option value="full"${state.mode === 'full' ? ' selected' : ''}>剧名.SxxExx.标题</option><option value="compact"${state.mode === 'compact' ? ' selected' : ''}>剧名.SxxExx</option></select></label>${button('reload', '4　重新扫描并预览', { enabled: reloadReady, hint: '重新读取当前目录和 TMDB 季数据', disabledReason: !state.series ? '不可点击：请先完成第 3 步并确认 TMDB 剧集' : !state.authReady ? '不可点击：尚未捕获光鸭授权，请刷新文件列表' : '不可点击：正在执行任务', kind: 'reload' })}</div>
      ${state.plan?.length ? `<div class="gtr-table-wrap"><table><thead><tr><th>选</th><th>原名称</th><th>TMDB 剧集</th><th>置信度/依据</th><th>目标名称</th><th>警告</th></tr></thead><tbody>${renderPlanRows(state.plan, state.episodes || [])}</tbody></table></div>` : '<p>选择 TMDB 剧集后生成预览。</p>'}
      <div class="gtr-summary">已选 ${selectedCount} 项；警告 ${warnings} 条；阻断错误 ${errors.length} 条。</div>${errors.length ? `<div class="gtr-errors">${errors.map((error) => escapeHtml(`${error.fileId || ''}: ${error.code}`)).join('<br>')}</div>` : ''}
      ${button('execute', `5　确认并执行 ${selectedCount} 项`, { enabled: !executeReason, hint: `执行 ${selectedCount} 个已审核的重命名操作`, disabledReason: `不可点击：${executeReason}`, kind: 'execute' })}</section>
      <section><h3>3. 执行结果</h3><div class="gtr-progress">${escapeHtml(state.progress || '尚未执行')}</div>${state.results?.length ? `<ul>${state.results.map((item) => `<li>${escapeHtml(item.oldName || item.fileId)} → ${escapeHtml(item.targetName || '')}：${escapeHtml(item.status)}${item.message ? `（${escapeHtml(item.message)}）` : ''}</li>`).join('')}</ul>` : ''}${state.recoveryPlan?.length ? button('recover', '6　恢复本次已成功项目', { enabled: !state.running, hint: '将本次已验证成功的文件恢复为原名称', disabledReason: '不可点击：正在执行任务', kind: 'recover' }) : ''}</section>`;
  }

  function installStyles(document) {
    if (document.getElementById('gtr-style')) return;
    const style = document.createElement('style'); style.id = 'gtr-style';
    style.textContent = `#gtr-launcher{position:fixed;right:18px;bottom:90px;z-index:2147483645;border:0;border-radius:22px;padding:11px 16px;background:#1677ff;color:#fff;box-shadow:0 4px 16px #0004;cursor:pointer;font-weight:700}#gtr-launcher:hover{filter:brightness(1.08);transform:translateY(-1px)}#gtr-panel{position:fixed;inset:5vh 3vw;z-index:2147483646;background:#fff;color:#1f2329;border-radius:12px;box-shadow:0 12px 48px #0007;padding:18px;overflow:auto;font:14px/1.5 system-ui,sans-serif}#gtr-panel[hidden]{display:none}.gtr-head{position:sticky;top:-18px;z-index:20;display:flex;justify-content:space-between;align-items:center;margin:-18px -18px 0;padding:14px 18px;background:#fff;border-bottom:1px solid #e4e7ec;border-radius:12px 12px 0 0;box-shadow:0 3px 8px #10182812;font-size:20px}.gtr-status,.gtr-line,.gtr-guide{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:10px 0}.gtr-status span,.gtr-guide span{padding:4px 8px;border-radius:5px;background:#f2f3f5}.gtr-guide span{border:1px solid #d0d5dd;color:#667085}.gtr-guide .done{background:#ecfdf3;border-color:#75e0a7;color:#067647}.gtr-guide .active{background:#eff8ff;border-color:#84caff;color:#175cd3}.gtr-status .ok{color:#16803c}.gtr-status .bad,.gtr-warning,.gtr-errors{color:#b42318}.gtr-token-help{padding:9px 11px;background:#f5f8ff;border-left:4px solid #6172f3}.gtr-token-help a{color:#3538cd;font-weight:700}.gtr-line input{min-width:280px;padding:7px}.gtr-candidates{display:flex;gap:10px;overflow:auto}.gtr-candidate{display:flex;min-width:280px;gap:8px;border:1px solid #ddd;padding:8px;border-radius:8px}.gtr-poster{width:58px;height:87px;object-fit:cover;background:#eee}.gtr-poster-empty{display:grid;place-items:center;font-size:11px}.gtr-table-wrap{overflow:auto;max-height:42vh}#gtr-panel table{width:100%;border-collapse:collapse;table-layout:auto}#gtr-panel th,#gtr-panel td{border-bottom:1px solid #eee;padding:7px;vertical-align:top;max-width:300px;overflow:visible;text-overflow:ellipsis}.gtr-episode-combobox{position:relative;min-width:220px}.gtr-episode-search{box-sizing:border-box;width:100%;padding:6px 28px 6px 8px;border:1px solid #d0d5dd;border-radius:6px;background:#fff;color:#1f2329}.gtr-episode-search:focus{border-color:#1570ef;outline:2px solid #84caff66}.gtr-episode-list{position:absolute;z-index:40;top:calc(100% + 3px);left:0;right:0;max-height:230px;overflow:auto;border:1px solid #d0d5dd;border-radius:7px;background:#fff;box-shadow:0 8px 20px #1018282e}.gtr-episode-list[hidden]{display:none}.gtr-episode-option{display:block;width:100%;border:0;border-bottom:1px solid #f2f4f7;padding:7px 9px;background:#fff;color:#1f2329;text-align:left;cursor:pointer}.gtr-episode-option:hover,.gtr-episode-option.gtr-active{background:#eff8ff;color:#175cd3}.gtr-episode-clear{color:#667085}.gtr-episode-empty{padding:9px;color:#667085;text-align:center}.gtr-confidence{font-weight:700}.gtr-high{color:#16803c}.gtr-medium,.gtr-low{color:#b54708}.gtr-unmatched{color:#667085}.gtr-btn{border:0;border-radius:7px;padding:8px 13px;color:#fff;font-weight:700;cursor:pointer;box-shadow:0 1px 3px #0003;transition:filter .15s,transform .15s,opacity .15s}.gtr-btn:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px)}.gtr-btn-save{background:#7f56d9}.gtr-btn-search{background:#1570ef}.gtr-btn-choose{background:#0891b2}.gtr-btn-reload{background:#d97706}.gtr-btn-execute{background:#039855}.gtr-btn-recover{background:#d92d20}.gtr-btn-close{background:#475467;width:34px;height:34px;padding:0;font-size:24px;line-height:30px;border-radius:50%}.gtr-btn:disabled{cursor:not-allowed;opacity:.42;filter:grayscale(.65);box-shadow:none}.gtr-btn:disabled:hover{outline:2px dashed #98a2b3;outline-offset:2px}#gtr-panel section{border-top:1px solid #eee;margin-top:12px}.gtr-summary{margin:10px 0}`;
    document.head.appendChild(style);
  }

  function createUi(document, handlers, initialState) {
    installStyles(document);
    const launcher = document.createElement('button'); launcher.id = 'gtr-launcher'; launcher.textContent = 'TMDB 重命名'; launcher.title = '打开 TMDB 文件重命名向导';
    const panel = document.createElement('div'); panel.id = 'gtr-panel'; panel.hidden = true;
    let state = initialState;
    const render = (next = state) => { state = next; panel.innerHTML = renderPanelMarkup(state); };
    const openEpisodeList = (input) => {
      const list = input.closest('.gtr-episode-combobox')?.querySelector('.gtr-episode-list');
      if (!list) return;
      list.innerHTML = episodeListMarkup(state.episodes || [], input.value);
      list.hidden = false; input.setAttribute('aria-expanded', 'true'); input.removeAttribute('aria-activedescendant');
    };
    const closeEpisodeList = (input, restore = false) => {
      const list = input.closest('.gtr-episode-combobox')?.querySelector('.gtr-episode-list');
      if (list) list.hidden = true;
      input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
      if (restore) input.value = input.dataset.selectedLabel || '';
    };
    const setActiveEpisode = (input, direction) => {
      const list = input.closest('.gtr-episode-combobox')?.querySelector('.gtr-episode-list');
      const options = [...(list?.querySelectorAll('.gtr-episode-option') || [])];
      if (!options.length) return null;
      let index = options.findIndex((option) => option.classList.contains('gtr-active'));
      index = (index + direction + options.length) % options.length;
      options.forEach((option, optionIndex) => option.classList.toggle('gtr-active', optionIndex === index));
      if (!options[index].id) options[index].id = `${list.id}-option-${index}`;
      input.setAttribute('aria-activedescendant', options[index].id); options[index].scrollIntoView?.({ block: 'nearest' });
      return options[index];
    };
    const commitEpisode = (option) => {
      const box = option.closest('.gtr-episode-combobox');
      const input = box?.querySelector('.gtr-episode-search');
      if (!input) return;
      handlers['choose-episode']?.({ index: Number(box.dataset.index), key: option.dataset.episodeKey || '' }, panel);
    };
    launcher.addEventListener('click', () => { panel.hidden = false; handlers.open?.(); });
    panel.addEventListener('click', (event) => {
      const episodeOption = event.target.closest?.('.gtr-episode-option');
      if (episodeOption) { commitEpisode(episodeOption); return; }
      const action = event.target.closest?.('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'close') panel.hidden = true;
      else handlers[action]?.(panel);
    });
    panel.addEventListener('change', (event) => {
      if (event.target.matches?.('input[name="gtr-series"]')) {
        const choose = panel.querySelector('[data-action="choose-series"]');
        if (choose) { choose.disabled = false; choose.title = '确认当前选中的 TMDB 剧集并加载季数据'; }
      }
      handlers.change?.(event, panel);
    });
    panel.addEventListener('focusin', (event) => {
      if (event.target.matches?.('.gtr-episode-search')) { event.target.select?.(); openEpisodeList(event.target); }
    });
    panel.addEventListener('input', (event) => {
      if (event.target.matches?.('.gtr-episode-search')) openEpisodeList(event.target);
    });
    panel.addEventListener('keydown', (event) => {
      const input = event.target.matches?.('.gtr-episode-search') ? event.target : null;
      if (!input) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); if (input.getAttribute('aria-expanded') !== 'true') openEpisodeList(input);
        setActiveEpisode(input, event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter') {
        const active = input.closest('.gtr-episode-combobox')?.querySelector('.gtr-episode-option.gtr-active');
        if (active) { event.preventDefault(); commitEpisode(active); }
      } else if (event.key === 'Escape') {
        event.preventDefault(); closeEpisodeList(input, true);
      }
    });
    panel.addEventListener('focusout', (event) => {
      const input = event.target.matches?.('.gtr-episode-search') ? event.target : null;
      if (input && !input.closest('.gtr-episode-combobox')?.contains(event.relatedTarget)) closeEpisodeList(input, true);
    });
    document.body.append(launcher, panel); render();
    return { render, open: () => { panel.hidden = false; }, close: () => { panel.hidden = true; }, panel, launcher };
  }

  Object.assign(globalThis.GTR, { escapeHtml, button, episodeKey, episodeLabel, normalizeEpisodeSearch, episodeSearchText, filterEpisodes, episodeSelector, episodeListMarkup, renderPanelMarkup, createUi });
})();
