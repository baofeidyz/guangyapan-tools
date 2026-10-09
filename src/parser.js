globalThis.GTR = globalThis.GTR || {};

(() => {
  const SPECIAL_TERMS = new Map([
    ['先导', 'pilot'], ['预告', 'preview'], ['花絮', 'behind-the-scenes'],
    ['幕后', 'behind-the-scenes'], ['加更', 'extra'], ['番外', 'extra'],
    ['纯享', 'special'], ['未播', 'unaired'], ['特辑', 'special'],
    ['彩蛋', 'bonus'], ['采访', 'interview'], ['发布会', 'event']
  ]);
  const RELEASE_PATTERNS = [
    /\b(?:2160p|1080p|720p|4k|8k)\b/ig,
    /\b(?:web[- .]?dl|web[- .]?rip|blu[- .]?ray|hdtv)\b/ig,
    /\b(?:h\.?26[45]|x26[45]|hevc|avc|av1|aac|ddp?\d(?:\.\d)?|hdr10?|dolby)\b/ig,
    /(?:国语|中字|中文字幕|完整版|精编版)/ig
  ];
  const CHINESE_DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const CHINESE_UNITS = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

  function chineseNumberToInt(value) {
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    let total = 0;
    let section = 0;
    let digit = 0;
    for (const char of value) {
      if (Object.hasOwn(CHINESE_DIGITS, char)) {
        digit = CHINESE_DIGITS[char];
      } else if (Object.hasOwn(CHINESE_UNITS, char)) {
        const unit = CHINESE_UNITS[char];
        if (unit === 10000) {
          section = (section + digit) * unit;
          total += section;
          section = 0;
        } else {
          section += (digit || 1) * unit;
        }
        digit = 0;
      } else {
        return null;
      }
    }
    return total + section + digit;
  }

  function splitExtension(filename) {
    const normalized = String(filename ?? '').normalize('NFKC').trim();
    const match = normalized.match(/(\.[A-Za-z0-9]{1,12})$/);
    return match
      ? { normalized, stem: normalized.slice(0, -match[1].length), extension: match[1] }
      : { normalized, stem: normalized, extension: '' };
  }

  function normalizeDelimiters(value) {
    return value
      .replace(/[\u2010-\u2015_]+/g, ' ')
      .replace(/[.[\]{}()（）【】《》]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractDate(stem) {
    const match = stem.match(/(?<!\d)(20\d{2})[.\-/年](0?[1-9]|1[0-2])[.\-/月](0?[1-9]|[12]\d|3[01])(?:日)?(?!\d)/);
    if (!match) return null;
    return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  }

  function extractExplicitEpisode(stem) {
    const match = stem.match(/\bS(\d{1,3})\s*[. _-]*E(\d{1,4})\b/i);
    return match ? { season: Number(match[1]), episode: Number(match[2]) } : null;
  }

  function extractIssue(stem) {
    const ordinal = stem.match(/第\s*([\d零〇一二两三四五六七八九十百千万]+)\s*[期集话話]/i);
    if (ordinal) return chineseNumberToInt(ordinal[1]);
    const ep = stem.match(/(?:^|[^A-Za-z0-9])(?:EP?|episode)\s*0*(\d{1,4})(?!\d)/i);
    return ep ? Number(ep[1]) : null;
  }

  function extractSegment(stem) {
    const chinese = stem.match(/(?:^|[\s()（）【】._-])([上中下])(?:集|期|篇|部)?(?:$|[\s()（）【】._-])/);
    if (chinese) return { label: chinese[1], order: { 上: 1, 中: 2, 下: 3 }[chinese[1]] };
    const suffix = stem.match(/[期集]([上中下])(?:集|篇|部)?(?:\b|(?=[^\p{L}\p{N}]|$))/u);
    if (suffix) return { label: suffix[1], order: { 上: 1, 中: 2, 下: 3 }[suffix[1]] };
    const part = stem.match(/\bpart\s*0*(\d{1,2})\b/i);
    return part ? { label: `Part ${Number(part[1])}`, order: Number(part[1]) } : null;
  }

  function collectMatches(stem, patterns) {
    const found = [];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of stem.matchAll(pattern)) found.push(match[0]);
    }
    return [...new Set(found.map((item) => item.trim()).filter(Boolean))];
  }

  function parseFilename(filename) {
    const { normalized, stem, extension } = splitExtension(filename);
    const date = extractDate(stem);
    const explicitEpisode = extractExplicitEpisode(stem);
    const issueNumber = extractIssue(stem);
    const segment = extractSegment(` ${stem} `);
    const specialKinds = [];
    const specialTerms = [];
    for (const [term, kind] of SPECIAL_TERMS) if (stem.includes(term)) {
      specialKinds.push(kind);
      specialTerms.push(term);
    }
    const releaseTags = collectMatches(stem, RELEASE_PATTERNS);

    let residual = stem;
    residual = residual.replace(/(?<!\d)20\d{2}[.\-/年](?:0?[1-9]|1[0-2])[.\-/月](?:0?[1-9]|[12]\d|3[01])(?:日)?(?!\d)/g, ' ');
    residual = residual.replace(/\bS\d{1,3}\s*[. _-]*E\d{1,4}\b/ig, ' ');
    residual = residual.replace(/第\s*[\d零〇一二两三四五六七八九十百千万]+\s*[期集话話]/ig, ' ');
    residual = residual.replace(/\b(?:EP?|episode)\s*0*\d{1,4}\b/ig, ' ');
    residual = residual.replace(/\bpart\s*0*\d{1,2}\b/ig, ' ');
    residual = residual.replace(/[上中下](?:集|期|篇|部)?/g, ' ');
    for (const term of SPECIAL_TERMS.keys()) residual = residual.replaceAll(term, ' ');
    for (const tag of releaseTags) residual = residual.replaceAll(tag, ' ');
    const titleTokens = normalizeDelimiters(residual)
      .split(/\s+/)
      .map((token) => token.trim().toLocaleLowerCase())
      .filter((token) => token && !/^\d+$/.test(token));

    const warnings = [];
    if (issueNumber === null && !explicitEpisode) warnings.push('未识别期号或标准集号');
    if (specialKinds.length > 1) warnings.push('命中多个特别篇类别');

    return {
      original: String(filename ?? ''), normalized, stem, extension,
      delimiterNormalized: normalizeDelimiters(stem), explicitEpisode,
      issueNumber, segment, date, isSpecial: specialKinds.length > 0,
      specialKinds: [...new Set(specialKinds)], specialTerms: [...new Set(specialTerms)],
      releaseTags, titleTokens, warnings
    };
  }

  Object.assign(globalThis.GTR, {
    SPECIAL_TERMS, chineseNumberToInt, splitExtension, normalizeDelimiters, parseFilename
  });
})();
