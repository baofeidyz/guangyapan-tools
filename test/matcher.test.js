import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/types.js';
import '../src/parser.js';
import '../src/matcher.js';

const { alignEpisodes, matchDirectory, parseFilename } = globalThis.GTR;
const episode = (number, extra = {}) => ({ id: number, seasonNumber: 3, episodeNumber: number, name: '', alternateNames: [], airDate: null, ...extra });
const file = (id, name) => ({ id, name, parsed: parseFilename(name) });

test('aligns split issues to consecutive TMDB episodes', () => {
  const files = [file('a', '第一期上.mp4'), file('b', '第一期下.mp4'), file('c', '第二期上.mp4'), file('d', '第二期下.mp4')];
  const matches = alignEpisodes(files, [1, 2, 3, 4].map((value) => episode(value)));
  assert.deepEqual(matches.map((match) => match.episode?.episodeNumber), [1, 2, 3, 4]);
});

test('can retain a TMDB gap when a dated local file is missing', () => {
  const files = [file('a', '2026.07.01-第一期上.mp4'), file('c', '2026.07.03-第二期上.mp4')];
  const episodes = [episode(1, { airDate: '2026-07-01' }), episode(2, { airDate: '2026-07-02' }), episode(3, { airDate: '2026-07-03' })];
  const matches = alignEpisodes(files, episodes);
  assert.deepEqual(matches.map((match) => match.episode?.episodeNumber), [1, 3]);
});

test('reports an explicit episode missing from TMDB as unmatched', () => {
  const matches = alignEpisodes([file('a', 'Show.S03E09.mp4')], [episode(1)]);
  assert.equal(matches[0].episode, null);
});

test('keeps duplicate explicit episode files as multi-version candidates', () => {
  const matches = alignEpisodes([file('a', 'Show.S03E15.2160p.H265.mp4'), file('b', 'Show.S03E15.1080p.H264.mp4')], [episode(15)]);
  assert.deepEqual(matches.map((match) => match.episode?.episodeNumber), [15, 15]);
  assert.ok(matches.every((match) => match.warnings.some((warning) => warning.includes('多个文件'))));
});

test('locks an explicit S03E14 match despite issue text and mixed directory ordering', () => {
  const targetName = '脱口秀和Ta的朋友们.S03E14.第7期上 哈哈曹模仿毛豆 瞿颖毒舌吐槽.mp4';
  const files = [file('early', '第二期上.mp4'), file('target', targetName), file('late', '第八期下.mp4')];
  const episodes = Array.from({ length: 18 }, (_, index) => episode(index + 1, {
    name: index === 13 ? '第7期上 哈哈曹模仿毛豆 瞿颖毒舌吐槽' : ''
  }));
  const matches = alignEpisodes(files, episodes);
  assert.equal(matches[1].episode?.episodeNumber, 14);
  assert.equal(matches[1].confidence, 'high');
  assert.ok(matches[1].evidence.includes('标准 SxxExx 完全一致'));
});

test('matches a special by title evidence but not category alone', () => {
  const specials = [episode(1, { seasonNumber: 0, name: '幕后花絮' })];
  const matched = matchDirectory([file('a', '幕后花絮.mp4')], [], specials);
  assert.equal(matched[0].episode?.seasonNumber, 0);
  const unmatched = matchDirectory([file('a', '加更.mp4')], [], specials);
  assert.equal(unmatched[0].episode, null);
});
