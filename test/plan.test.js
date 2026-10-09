import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/types.js';
import '../src/parser.js';
import '../src/plan.js';

const { assignEpisode, createRenamePlan, extractVariantTags, generateTargetName, sanitizeFilename, validatePlan } = globalThis.GTR;
const ep = { id: 1, seasonNumber: 3, episodeNumber: 1, name: '朋友初见面' };

test('generates full and compact names and preserves extension', () => {
  assert.equal(generateTargetName('脱口秀和Ta的朋友们', ep, '.mp4', 'full'), '脱口秀和Ta的朋友们.S03E01.朋友初见面.mp4');
  assert.equal(generateTargetName('脱口秀和Ta的朋友们', ep, '.mp4', 'compact'), '脱口秀和Ta的朋友们.S03E01.mp4');
  assert.equal(sanitizeFilename('A:/B?. '), 'A B');
});

test('adds resolution and codec for every file when available', () => {
  assert.deepEqual(extractVariantTags({ name: 'Show.E01.4K.HEVC.mkv', parsed: globalThis.GTR.parseFilename('Show.E01.4K.HEVC.mkv') }), ['2160p', 'H265']);
  assert.deepEqual(extractVariantTags({ name: 'plain.mp4', parsed: globalThis.GTR.parseFilename('plain.mp4'), raw: { mediaInfo: { width: 1920, height: 1080, videoCodec: 'avc1' } } }), ['1080p', 'H264']);
  assert.deepEqual(extractVariantTags({ name: 'detail.mp4', parsed: globalThis.GTR.parseFilename('detail.mp4'), raw: { detail: { videoResource: [{ info: { resolution: { width: 1280, height: 720 } } }] } } }), ['720p']);
  assert.equal(generateTargetName('Show', ep, '.mkv', 'compact', ['4K', 'HEVC']), 'Show.S03E01.2160p.H265.mkv');
});

test('allows duplicate episodes only when unique media versions distinguish them', () => {
  const files = [
    { id: '1', parentId: 'p', name: 'Show.S03E01.2160p.H265.mkv', parsed: globalThis.GTR.parseFilename('Show.S03E01.2160p.H265.mkv') },
    { id: '2', parentId: 'p', name: 'Show.S03E01.1080p.H264.mkv', parsed: globalThis.GTR.parseFilename('Show.S03E01.1080p.H264.mkv') }
  ];
  const matches = files.map(() => ({ episode: ep, confidence: 'high', evidence: [], warnings: [] }));
  const plan = createRenamePlan(files, matches, { seriesTitle: 'Show', rematchStandard: true });
  assert.equal(validatePlan(plan, files).valid, true);
  assert.notEqual(plan[0].targetName, plan[1].targetName);
  const unresolvedFiles = files.map((file, index) => ({ ...file, name: `Show.S03E01.copy${index}.mkv`, parsed: globalThis.GTR.parseFilename(`Show.S03E01.copy${index}.mkv`) }));
  const unresolved = createRenamePlan(unresolvedFiles, matches, { seriesTitle: 'Show', rematchStandard: true });
  assert.equal(validatePlan(unresolved, unresolvedFiles).valid, false);
});

test('skips existing standard names by default', () => {
  const files = [{ id: '1', name: 'Show.S03E01.mp4' }];
  const plan = createRenamePlan(files, [{ episode: ep, confidence: 'high', evidence: [], warnings: [] }], { seriesTitle: 'Show' });
  assert.equal(plan[0].selected, false);
});

test('upgrades an existing standard name when media specification can be added', () => {
  const files = [{ id: '1', name: 'Show.S03E01.4K.HEVC.mp4' }];
  const plan = createRenamePlan(files, [{ episode: ep, confidence: 'high', evidence: [], warnings: [] }], { seriesTitle: 'Show', mode: 'compact' });
  assert.equal(plan[0].selected, true);
  assert.equal(plan[0].targetName, 'Show.S03E01.2160p.H265.mp4');
});

test('manual assignment and clearing are deterministic', () => {
  const base = createRenamePlan([{ id: '1', name: 'raw.mp4' }], [{ episode: null, confidence: 'unmatched', evidence: [], warnings: [] }], { seriesTitle: 'Show' })[0];
  const assigned = assignEpisode(base, ep);
  assert.equal(assigned.targetName, 'Show.S03E01.朋友初见面.mp4');
  assert.equal(assigned.selected, true);
  assert.equal(assignEpisode(assigned, null).selected, false);
});

test('blocks duplicate targets, duplicate episodes and occupied names', () => {
  const item = { fileId: '1', oldName: 'a.mp4', targetName: 'Show.S03E01.mp4', episode: ep, selected: true };
  const result = validatePlan([item, { ...item, fileId: '2', oldName: 'b.mp4' }], []);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'duplicate-target'));
  assert.ok(result.errors.some((error) => error.code === 'duplicate-episode'));
  const occupied = validatePlan([item], [{ id: '1', name: 'a.mp4' }, { id: '9', name: 'Show.S03E01.mp4' }]);
  assert.ok(occupied.errors.some((error) => error.code === 'occupied-target'));
});
