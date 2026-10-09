import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/types.js';
import '../src/parser.js';

const { chineseNumberToInt, normalizeDelimiters, parseFilename } = globalThis.GTR;

test('converts Chinese ordinal numbers', () => {
  assert.equal(chineseNumberToInt('十一'), 11);
  assert.equal(chineseNumberToInt('二十三'), 23);
  assert.equal(chineseNumberToInt('一百零二'), 102);
});

test('normalizes delimiters while preserving original and extension', () => {
  const parsed = parseFilename('【4K】第一期（上）_foo.mp4');
  assert.equal(parsed.original, '【4K】第一期（上）_foo.mp4');
  assert.equal(parsed.extension, '.mp4');
  assert.match(normalizeDelimiters(parsed.stem), /4K/);
});

test('parses the live S03 naming samples without numeric false positives', () => {
  const parsed = parseFilename('2026.08.28-第10期上[1080P WEB-DL].mp4');
  assert.equal(parsed.date, '2026-08-28');
  assert.equal(parsed.issueNumber, 10);
  assert.deepEqual(parsed.segment, { label: '上', order: 1 });
  assert.equal(parsed.explicitEpisode, null);
  assert.equal(parsed.extension, '.mp4');
  assert.ok(parsed.releaseTags.some((value) => /1080p/i.test(value)));
  assert.ok(parsed.releaseTags.some((value) => /web-dl/i.test(value)));
});

test('parses mixed punctuation and lower split', () => {
  const parsed = parseFilename('2026.07.25.第5期下.mp4');
  assert.equal(parsed.issueNumber, 5);
  assert.equal(parsed.segment.order, 3);
});

test('parses standard episode and keeps it separate from issue number', () => {
  const parsed = parseFilename('Show.S03E07.2160p.WEB-DL.mkv');
  assert.deepEqual(parsed.explicitEpisode, { season: 3, episode: 7 });
  assert.equal(parsed.issueNumber, null);
});

test('classifies specials but does not assign episode numbers', () => {
  const parsed = parseFilename('第三期加更-幕后花絮.mp4');
  assert.equal(parsed.isSpecial, true);
  assert.equal(parsed.issueNumber, 3);
  assert.ok(parsed.specialKinds.includes('extra'));
  assert.ok(parsed.specialKinds.includes('behind-the-scenes'));
  assert.equal(parsed.explicitEpisode, null);
});

test('preserves unknown tokens and exposes ambiguity', () => {
  const parsed = parseFilename('MysteryPrefix-第十一期下-未知后缀.mp4');
  assert.equal(parsed.issueNumber, 11);
  assert.equal(parsed.segment.order, 3);
  assert.ok(parsed.titleTokens.some((token) => token.includes('mysteryprefix')));
  assert.ok(parsed.titleTokens.some((token) => token.includes('未知后缀')));
});
