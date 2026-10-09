globalThis.GTR = globalThis.GTR || {};

(() => {
  function sanitizeFilename(value) {
    return String(value || '')
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\.{2,}/g, '.')
      .replace(/[. ]+$/g, '')
      .trim();
  }

  function pad(value, width = 2) { return String(value).padStart(width, '0'); }

  function canonicalVariantTag(value) {
    const text = String(value || '').normalize('NFKC').toLowerCase().replace(/[._ -]+/g, '');
    if (!text) return '';
    if (/^(?:4k|uhd|2160p|3840x2160)$/.test(text)) return '2160p';
    if (/^(?:2k|1440p|2560x1440)$/.test(text)) return '1440p';
    if (/^(?:1080p|1920x1080)$/.test(text)) return '1080p';
    if (/^(?:720p|1280x720)$/.test(text)) return '720p';
    if (/^(?:h265|x265|hevc|hev1|hvc1)$/.test(text)) return 'H265';
    if (/^(?:h264|x264|avc|avc1)$/.test(text)) return 'H264';
    if (/^av1$/.test(text)) return 'AV1';
    return '';
  }

  function deepValue(raw, keys) {
    const queue = [raw]; const visited = new Set();
    while (queue.length) {
      const value = queue.shift();
      if (!value || typeof value !== 'object' || visited.has(value)) continue;
      visited.add(value);
      for (const [key, child] of Object.entries(value)) {
        if (keys.includes(key.toLowerCase()) && child !== null && typeof child !== 'object') return child;
        if (child && typeof child === 'object') queue.push(child);
      }
    }
    return null;
  }

  function extractVariantTags(file) {
    const parsed = file.parsed || globalThis.GTR.parseFilename(file.name);
    const tags = (parsed.releaseTags || []).map(canonicalVariantTag).filter(Boolean);
    const raw = file.raw || {};
    const resolution = deepValue(raw, ['resolution', 'videoresolution', 'quality', 'definition']);
    if (resolution) tags.push(canonicalVariantTag(resolution));
    const width = Number(deepValue(raw, ['width', 'videowidth']));
    const height = Number(deepValue(raw, ['height', 'videoheight']));
    if (!tags.some((tag) => /p$/.test(tag))) {
      if (width >= 3000 || height >= 1800) tags.push('2160p');
      else if (width >= 1700 || height >= 1000) tags.push('1080p');
      else if (width >= 1100 || height >= 650) tags.push('720p');
    }
    const codec = deepValue(raw, ['videocodec', 'video_codec', 'codec', 'codecname', 'codec_name', 'encode', 'encoding']);
    if (codec) tags.push(canonicalVariantTag(codec));
    const resolutionTag = tags.find((tag) => /p$/.test(tag));
    const codecTag = tags.find((tag) => ['H265', 'H264', 'AV1'].includes(tag));
    return [resolutionTag, codecTag].filter(Boolean);
  }

  function generateTargetName(seriesTitle, episode, extension, mode = 'full', variantTags = []) {
    if (!episode) return '';
    const parts = [sanitizeFilename(seriesTitle), `S${pad(episode.seasonNumber)}E${pad(episode.episodeNumber)}`];
    if (mode === 'full' && episode.name) parts.push(sanitizeFilename(episode.name));
    parts.push(...variantTags.map(canonicalVariantTag).filter(Boolean));
    const base = parts.filter(Boolean).join('.');
    const ext = extension ? (extension.startsWith('.') ? extension : `.${extension}`) : '';
    return `${sanitizeFilename(base)}${ext}`;
  }

  function createRenamePlan(files, matches, options) {
    const { seriesTitle, mode = 'full', rematchStandard = false } = options;
    const plan = files.map((file, index) => {
      const parsed = file.parsed || globalThis.GTR.parseFilename(file.name);
      const match = matches[index] || { episode: null, confidence: 'unmatched', evidence: [], warnings: ['未匹配'] };
      const existingStandard = Boolean(parsed.explicitEpisode);
      const variantTags = extractVariantTags({ ...file, parsed });
      const targetName = match.episode ? generateTargetName(seriesTitle, match.episode, parsed.extension, mode, variantTags) : '';
      const evidence = [...(match.evidence || [])];
      if (variantTags.length) evidence.push(`媒体规格：${variantTags.join(' ')}`);
      return {
        fileId: String(file.id), parentId: String(file.parentId || ''), oldName: file.name,
        targetName, episode: match.episode, confidence: match.confidence,
        evidence, warnings: [...(match.warnings || [])],
        selected: match.confidence === 'high' && targetName !== file.name && (!existingStandard || variantTags.length > 0 || rematchStandard),
        manuallyConfirmed: false, existingStandard, parsed, mode, seriesTitle,
        variantTags, variantKey: variantTags.join('.').toLowerCase()
      };
    });
    const groups = new Map();
    for (const item of plan.filter((entry) => entry.episode)) {
      const key = `${item.episode.seasonNumber}:${item.episode.episodeNumber}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const items of groups.values()) if (items.length > 1) {
      const keys = items.map((item) => item.variantKey).filter(Boolean);
      const distinguishable = keys.length === items.length && new Set(keys).size === items.length;
      for (const item of items) {
        item.multiVersion = distinguishable;
        if (distinguishable) {
          item.warnings = item.warnings.filter((warning) => !warning.includes('同一标准集号存在多个文件'));
          item.evidence.push(`多版本标识：${item.variantTags.join(' ')}`);
        }
        else item.warnings.push('同集多文件缺少唯一的清晰度/编码组合');
      }
    }
    return plan;
  }

  function assignEpisode(item, episode) {
    const next = { ...item, episode: episode || null, manuallyConfirmed: Boolean(episode) };
    next.targetName = episode
      ? generateTargetName(item.seriesTitle, episode, item.parsed.extension, item.mode, item.variantTags)
      : '';
    next.selected = Boolean(episode);
    next.confidence = episode ? 'high' : 'unmatched';
    if (!episode) next.warnings = [...item.warnings, '用户已清除剧集分配'];
    return next;
  }

  function validatePlan(plan, currentFiles = []) {
    const errors = [];
    const selected = plan.filter((item) => item.selected);
    const targetOwners = new Map();
    const episodeOwners = new Map();
    const selectedIds = new Set(selected.map((item) => String(item.fileId)));
    const currentById = new Map(currentFiles.map((file) => [String(file.id), file]));
    const currentByName = new Map(currentFiles.map((file) => [file.name, file]));
    for (const item of selected) {
      if (!item.fileId || !item.targetName || !item.episode) errors.push({ fileId: item.fileId, code: 'missing-field', blocking: true });
      if (sanitizeFilename(item.targetName) !== item.targetName) errors.push({ fileId: item.fileId, code: 'unsafe-target', blocking: true });
      if (targetOwners.has(item.targetName)) errors.push({ fileId: item.fileId, code: 'duplicate-target', blocking: true, other: targetOwners.get(item.targetName) });
      targetOwners.set(item.targetName, item.fileId);
      const episodeKey = item.episode ? `${item.episode.seasonNumber}:${item.episode.episodeNumber}` : '';
      if (episodeKey && episodeOwners.has(episodeKey)) {
        const other = episodeOwners.get(episodeKey);
        const safelyVersioned = item.multiVersion && other.multiVersion && item.variantKey && item.variantKey !== other.variantKey;
        if (!safelyVersioned) errors.push({ fileId: item.fileId, code: 'duplicate-episode', blocking: true, other: other.fileId });
      }
      if (episodeKey) episodeOwners.set(episodeKey, item);
      const current = currentById.get(String(item.fileId));
      if (current && current.name !== item.oldName && current.name !== item.targetName) errors.push({ fileId: item.fileId, code: 'stale-source', blocking: true, actual: current.name });
      const occupied = currentByName.get(item.targetName);
      if (occupied && String(occupied.id) !== String(item.fileId) && !selectedIds.has(String(occupied.id))) {
        errors.push({ fileId: item.fileId, code: 'occupied-target', blocking: true, other: occupied.id });
      }
    }
    return { valid: !errors.some((error) => error.blocking), errors };
  }

  Object.assign(globalThis.GTR, { sanitizeFilename, canonicalVariantTag, extractVariantTags, generateTargetName, createRenamePlan, assignEpisode, validatePlan });
})();
