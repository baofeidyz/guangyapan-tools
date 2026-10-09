import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.__GTR_TEST__ = true;
import '../src/types.js';
import '../src/parser.js';
import '../src/plan.js';
import '../src/ui.js';
import '../src/main.js';

const { createUi, episodeLabel, episodeListMarkup, filterEpisodes, normalizeEpisodeSearch, renderPanelMarkup, parseFolderLocation, selectedFolderName } = globalThis.GTR;
const base = { authReady: false, hasToken: false, folder: { displayPath: '节目/S03' }, candidates: [], plan: [], mode: 'full', results: [] };

test('renders missing credential and authorization readiness', () => {
  const html = renderPanelMarkup(base);
  assert.match(html, /等待页面请求/); assert.match(html, /TMDB：未配置/);
  assert.match(html, /https:\/\/www\.themoviedb\.org\/settings\/api/);
  assert.match(html, /不可点击：请先填写并保存 TMDB Token/);
});

test('renders explicit candidate confirmation and metadata', () => {
  const html = renderPanelMarkup({ ...base, candidates: [{ id: 7, name: '节目', originalName: 'Show', firstAirDate: '2025-01-01', originCountry: ['CN'], posterPath: null, tmdbUrl: 'https://www.themoviedb.org/tv/7' }] });
  assert.match(html, /确认选择并加载/); assert.match(html, /Show/); assert.match(html, /2025/);
  assert.match(html, /不可点击：请先选择一个 TMDB 搜索结果/);
});

test('renders low-confidence unchecked row, manual control, conflicts and results', () => {
  const item = { fileId: '1', oldName: '第一期上.mp4', targetName: '节目.S03E01.mp4', selected: false, episode: { id: 1, seasonNumber: 3, episodeNumber: 1, name: '第一期' }, confidence: 'low', evidence: ['顺序'], warnings: ['需确认'] };
  const html = renderPanelMarkup({ ...base, plan: [item], episodes: [item.episode], validation: { errors: [{ fileId: '1', code: 'occupied-target' }] }, progress: '用户已取消执行', results: [{ ...item, status: 'mismatch', message: '不一致' }] });
  assert.match(html, /gtr-low/); assert.match(html, /class="gtr-episode-search"/); assert.match(html, /role="combobox"/); assert.match(html, /value="S03E01 第一期"/); assert.match(html, /occupied-target/); assert.match(html, /用户已取消执行/); assert.match(html, /mismatch/);
  assert.match(html, /不可点击：存在 1 个阻断错误/);
});

test('renders ordered action buttons with distinct style hooks', () => {
  const item = { fileId: '1', oldName: 'a.mp4', targetName: '节目.S03E01.mp4', selected: true, episode: { id: 1, seasonNumber: 3, episodeNumber: 1, name: '第一期' }, confidence: 'high', evidence: [], warnings: [] };
  const html = renderPanelMarkup({ ...base, hasToken: true, authReady: true, selectedFolderName: '节目', candidates: [{ id: 7, name: '节目', originCountry: [], tmdbUrl: '#' }], selectedSeriesId: 7, series: { id: 7 }, plan: [item], episodes: [item.episode], validation: { errors: [] }, recoveryPlan: [item] });
  for (const style of ['save', 'search', 'choose', 'reload', 'execute', 'recover']) assert.match(html, new RegExp(`gtr-btn-${style}`));
  for (const step of ['1　保存', '2　按', '3　确认', '4　重新', '5　确认', '6　恢复']) assert.match(html, new RegExp(step));
});

test('parses Guangya hash folder and season and escapes markup', () => {
  const folder = parseFolderLocation('#/home/123-脱口秀和Ta的朋友们/456-S03');
  assert.equal(folder.parentId, '456'); assert.equal(folder.seriesTitle, '脱口秀和Ta的朋友们'); assert.equal(folder.seasonNumber, 3);
  assert.doesNotMatch(renderPanelMarkup({ ...base, folder: { displayPath: '<script>' } }), /<script>/);
});

test('uses the selected folder name as the TMDB search term', () => {
  const nameNode = { textContent: '脱口秀和Ta的朋友们' };
  const row = { dataset: {}, getAttribute: () => null, querySelector: () => nameNode, querySelectorAll: () => [] };
  const documentLike = { querySelector: (selector) => selector === '.ant-table-row-selected' ? row : null };
  assert.equal(selectedFolderName(documentLike, 'fallback'), '脱口秀和Ta的朋友们');
  assert.equal(selectedFolderName({ querySelector: () => null }, '当前目录'), '当前目录');
  const html = renderPanelMarkup({ ...base, selectedFolderName: '选中的文件夹' });
  assert.match(html, /value="选中的文件夹"/); assert.match(html, /readonly/);
});

test('filters episodes by codes, numbers, titles and multiple fragments', () => {
  const episodes = [
    { id: 1, seasonNumber: 3, episodeNumber: 12, name: '最后一战', alternateNames: ['The Finale'] },
    { id: 2, seasonNumber: 0, episodeNumber: 2, name: '幕后花絮', alternateNames: ['Behind The Scenes'] }
  ];
  for (const query of ['S03E12', 's3e12', '3:12', '12', '最后', 'FINALE', '12 finale']) {
    assert.deepEqual(filterEpisodes(episodes, query).map((item) => item.id), [1], query);
  }
  assert.deepEqual(filterEpisodes(episodes, 'behind scenes').map((item) => item.id), [2]);
  assert.deepEqual(filterEpisodes(episodes, '不存在'), []);
  assert.equal(normalizeEpisodeSearch(' S03-E12 '), 's03e12');
  assert.equal(episodeLabel(episodes[0]), 'S03E12 最后一战');
  assert.match(episodeListMarkup(episodes, '不存在'), /不匹配[\s\S]*没有匹配的剧集/);
});

function interactionHarness(episodes) {
  class Element {
    constructor(tag) { this.tag = tag; this.listeners = {}; this.hidden = false; this.dataset = {}; this.attributes = {}; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
    append() {}
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name]; }
    removeAttribute(name) { delete this.attributes[name]; }
  }
  const panel = new Element('div');
  const launcher = new Element('button');
  const style = new Element('style');
  const documentLike = {
    createElement: (tag) => tag === 'div' ? panel : tag === 'button' ? launcher : style,
    getElementById: () => null,
    body: { append() {} }, head: { appendChild() {} }
  };
  const chosen = [];
  createUi(documentLike, { 'choose-episode': (detail) => chosen.push(detail) }, { authReady: false, hasToken: false, folder: {}, candidates: [], plan: [], episodes, mode: 'full', results: [] });

  const list = new Element('div'); list.id = 'episode-list'; list.hidden = false; list.options = [];
  list.querySelectorAll = () => list.options;
  list.querySelector = () => list.options.find((option) => option.classList.contains('gtr-active')) || null;
  const box = new Element('div'); box.dataset.index = '4';
  const input = new Element('input'); input.value = ''; input.dataset.selectedLabel = 'S03E01 原分配';
  input.matches = (selector) => selector === '.gtr-episode-search';
  input.closest = (selector) => selector === '.gtr-episode-combobox' ? box : null;
  input.select = () => {};
  box.querySelector = (selector) => selector === '.gtr-episode-list' ? list : selector === '.gtr-episode-search' ? input : selector === '.gtr-episode-option.gtr-active' ? list.querySelector(selector) : null;
  box.contains = () => false;
  const option = (key) => {
    const classes = new Set(['gtr-episode-option']);
    return {
      id: '', dataset: { episodeKey: key },
      classList: { contains: (name) => classes.has(name), toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) },
      closest: (selector) => selector === '.gtr-episode-option' ? optionNode : selector === '.gtr-episode-combobox' ? box : null,
      scrollIntoView() {}
    };
  };
  let optionNode;
  const makeOption = (key) => { optionNode = option(key); return optionNode; };
  return { panel, chosen, input, list, makeOption };
}

test('combobox filters on input and supports mouse assignment and clearing', () => {
  const episodes = [{ id: 12, seasonNumber: 3, episodeNumber: 12, name: '最后一战', alternateNames: ['The Finale'] }];
  const { panel, chosen, input, list, makeOption } = interactionHarness(episodes);
  input.value = 'finale'; panel.listeners.input({ target: input });
  assert.match(list.innerHTML, /S03E12 最后一战/); assert.equal(input.getAttribute('aria-expanded'), 'true');
  panel.listeners.click({ target: makeOption('3:12') });
  panel.listeners.click({ target: makeOption('') });
  assert.deepEqual(chosen, [{ index: 4, key: '3:12' }, { index: 4, key: '' }]);
});

test('combobox supports keyboard selection and restores uncommitted text', () => {
  const { panel, chosen, input, list, makeOption } = interactionHarness([]);
  list.options = [makeOption(''), makeOption('3:12')]; input.setAttribute('aria-expanded', 'true');
  const event = (key) => ({ target: input, key, preventDefault() {} });
  panel.listeners.keydown(event('ArrowDown')); panel.listeners.keydown(event('ArrowDown')); panel.listeners.keydown(event('Enter'));
  assert.deepEqual(chosen, [{ index: 4, key: '3:12' }]);
  input.value = '未确认自由文本'; list.hidden = false; panel.listeners.keydown(event('Escape'));
  assert.equal(input.value, 'S03E01 原分配'); assert.equal(list.hidden, true); assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(chosen, [{ index: 4, key: '3:12' }]);
});
