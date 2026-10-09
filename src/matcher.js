globalThis.GTR = globalThis.GTR || {};

(() => {
  function normalizeToken(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  function tokenSet(value) {
    const normalized = normalizeToken(value);
    const words = normalized.split(/\s+/).filter(Boolean);
    const chars = normalized.replace(/\s+/g, '').length > 1
      ? [...normalized.replace(/\s+/g, '')].filter(Boolean)
      : [];
    return new Set([...words, ...chars]);
  }

  function jaccard(left, right) {
    const a = left instanceof Set ? left : tokenSet(left);
    const b = right instanceof Set ? right : tokenSet(right);
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const item of a) if (b.has(item)) intersection += 1;
    return intersection / (a.size + b.size - intersection);
  }

  function scoreCandidate(parsed, episode, context = {}) {
    let score = 0;
    const evidence = [];
    const warnings = [];
    const specialDomain = episode.seasonNumber === 0;

    if (parsed.explicitEpisode) {
      if (parsed.explicitEpisode.season === episode.seasonNumber && parsed.explicitEpisode.episode === episode.episodeNumber) {
        score += 100;
        evidence.push('标准 SxxExx 完全一致');
      } else {
        score -= 90;
        warnings.push('文件名标准集号与候选冲突');
      }
    }

    const localTitle = [...parsed.titleTokens, ...(parsed.specialTerms || [])].join(' ');
    const titles = [episode.name, ...(episode.alternateNames || [])].filter(Boolean);
    const similarity = Math.max(0, ...titles.map((title) => jaccard(localTitle, title)));
    if (similarity >= 0.65) {
      score += 55;
      evidence.push('标题高度相似');
    } else if (similarity >= 0.3) {
      score += 30;
      evidence.push('标题部分相似');
    } else if (similarity > 0) {
      score += 10;
      evidence.push('标题存在弱相似');
    }

    if (parsed.date && episode.airDate) {
      if (parsed.date === episode.airDate) {
        score += 65;
        evidence.push('播出日期一致');
      } else {
        const delta = Math.abs(Date.parse(parsed.date) - Date.parse(episode.airDate)) / 86400000;
        if (delta <= 1) {
          score += 25;
          evidence.push('播出日期相差一天以内');
        }
      }
    }

    if (!specialDomain && Number.isFinite(context.localOrdinal) && Number.isFinite(context.episodeOrdinal)) {
      const distance = Math.abs(context.localOrdinal - context.episodeOrdinal);
      if (distance === 0) {
        score += 24;
        evidence.push('目录语义顺序一致');
      } else if (distance === 1) {
        score += 8;
        evidence.push('目录语义顺序相邻');
      }
    }

    if (parsed.isSpecial !== specialDomain) score -= 45;
    if (specialDomain && parsed.isSpecial) evidence.push('属于 S00 候选类别');

    const substantiveEvidence = parsed.explicitEpisode || similarity >= 0.3 ||
      (parsed.date && episode.airDate && Math.abs(Date.parse(parsed.date) - Date.parse(episode.airDate)) <= 86400000);
    if (specialDomain && !substantiveEvidence) {
      score = Math.min(score, 0);
      warnings.push('S00 缺少标题、日期或显式编号证据');
    }

    return { score, evidence, warnings, similarity };
  }

  function confidenceFor(score, warnings = []) {
    if (score < 1) return 'unmatched';
    if (warnings.length) return score >= 70 ? 'medium' : 'low';
    if (score >= 70) return 'high';
    if (score >= 35) return 'medium';
    return 'low';
  }

  function semanticOrder(parsed) {
    if (parsed.explicitEpisode) return parsed.explicitEpisode.episode;
    if (parsed.issueNumber !== null) return parsed.issueNumber * 10 + (parsed.segment?.order || 1);
    return Number.POSITIVE_INFINITY;
  }

  function alignEpisodes(files, episodes, options = {}) {
    const parsedFiles = files.map((file, index) => ({
      file,
      parsed: file.parsed || globalThis.GTR.parseFilename(file.name),
      inputIndex: index
    }));
    const episodeByKey = new Map(episodes.map((episode) => [`${episode.seasonNumber}:${episode.episodeNumber}`, episode]));
    const explicitOwners = new Map();
    const matches = new Map();
    const lockedEpisodeIds = new Set();
    for (const row of parsedFiles) {
      const explicit = row.parsed.explicitEpisode;
      if (!explicit) continue;
      const key = `${explicit.season}:${explicit.episode}`;
      const episode = episodeByKey.get(key);
      if (!episode) continue;
      const previousOwner = explicitOwners.get(key);
      explicitOwners.set(key, row.inputIndex);
      lockedEpisodeIds.add(episode.id);
      const detail = scoreCandidate(row.parsed, episode);
      const versionWarning = previousOwner === undefined ? [] : ['同一标准集号存在多个文件，需要版本信息区分'];
      matches.set(row.inputIndex, { episode, score: detail.score, evidence: detail.evidence, warnings: [...detail.warnings, ...versionWarning], confidence: confidenceFor(detail.score, detail.warnings) });
      if (previousOwner !== undefined) {
        const previous = matches.get(previousOwner);
        if (previous && !previous.warnings.includes(versionWarning[0])) previous.warnings.push(versionWarning[0]);
      }
    }
    const unlockedFiles = parsedFiles.filter((row) => !matches.has(row.inputIndex))
      .sort((a, b) => semanticOrder(a.parsed) - semanticOrder(b.parsed) || a.inputIndex - b.inputIndex);
    const orderedEpisodes = episodes.filter((episode) => !lockedEpisodeIds.has(episode.id)).sort((a, b) => a.episodeNumber - b.episodeNumber);
    const parsedFileRows = unlockedFiles;
    const n = parsedFileRows.length;
    const m = orderedEpisodes.length;
    const gapFile = options.gapFile ?? -18;
    const gapEpisode = options.gapEpisode ?? -10;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Number.NEGATIVE_INFINITY));
    const back = Array.from({ length: n + 1 }, () => Array(m + 1).fill(null));
    dp[0][0] = 0;
    for (let i = 1; i <= n; i += 1) { dp[i][0] = dp[i - 1][0] + gapFile; back[i][0] = 'skip-file'; }
    for (let j = 1; j <= m; j += 1) { dp[0][j] = dp[0][j - 1] + gapEpisode; back[0][j] = 'skip-episode'; }

    for (let i = 1; i <= n; i += 1) {
      for (let j = 1; j <= m; j += 1) {
        const detail = scoreCandidate(parsedFileRows[i - 1].parsed, orderedEpisodes[j - 1], {
          localOrdinal: i - 1,
          episodeOrdinal: j - 1
        });
        const matchValue = detail.score > 0 ? dp[i - 1][j - 1] + detail.score : Number.NEGATIVE_INFINITY;
        const candidates = [
          [matchValue, 'match'],
          [dp[i - 1][j] + gapFile, 'skip-file'],
          [dp[i][j - 1] + gapEpisode, 'skip-episode']
        ].sort((a, b) => b[0] - a[0]);
        [dp[i][j], back[i][j]] = candidates[0];
      }
    }

    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      const action = back[i][j];
      if (action === 'match') {
        const row = parsedFileRows[i - 1];
        const episode = orderedEpisodes[j - 1];
        const detail = scoreCandidate(row.parsed, episode, { localOrdinal: i - 1, episodeOrdinal: j - 1 });
        matches.set(row.inputIndex, {
          episode, score: detail.score, evidence: detail.evidence,
          warnings: detail.warnings, confidence: confidenceFor(detail.score, detail.warnings)
        });
        i -= 1; j -= 1;
      } else if (action === 'skip-file') {
        i -= 1;
      } else if (action === 'skip-episode') {
        j -= 1;
      } else break;
    }

    return files.map((file, index) => matches.get(index) || {
      episode: null, score: 0, evidence: [], warnings: ['未匹配到 TMDB 剧集'], confidence: 'unmatched'
    });
  }

  function matchDirectory(files, regularEpisodes, specialEpisodes) {
    const regularIndexes = [];
    const specialIndexes = [];
    files.forEach((file, index) => {
      const parsed = file.parsed || globalThis.GTR.parseFilename(file.name);
      (parsed.isSpecial ? specialIndexes : regularIndexes).push(index);
    });
    const output = Array(files.length).fill(null);
    const run = (indexes, episodes) => {
      const subset = indexes.map((index) => files[index]);
      alignEpisodes(subset, episodes).forEach((match, position) => { output[indexes[position]] = match; });
    };
    run(regularIndexes, regularEpisodes);
    run(specialIndexes, specialEpisodes);
    return output;
  }

  Object.assign(globalThis.GTR, { normalizeToken, jaccard, scoreCandidate, confidenceFor, semanticOrder, alignEpisodes, matchDirectory });
})();
