import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/guangya-client.js';

const { createGuangyaClient, planRenamePhases, withRetry, executeRenamePlan, verifyExecution } = globalThis.GTR;
const response = (body, status = 200) => ({ status, responseText: JSON.stringify(body) });
const context = { headers: { authorization: 'Bearer redacted' } };

test('loads numbered pages and normalizes stable file identities', async () => {
  const bodies = [];
  const request = async ({ data }) => {
    const body = JSON.parse(data); bodies.push(body);
    return response({ data: { list: body.pageNo ? [{ fileId: '2', fileName: 'b.mp4' }] : [{ fileId: '1', fileName: 'a.mp4' }, { fileId: '2', fileName: 'b.mp4' }] } });
  };
  const files = await createGuangyaClient({ context, request }).listFiles('p', { pageSize: 2 });
  assert.deepEqual(files.map((file) => file.id), ['1', '2']);
  assert.equal(bodies[1].pageNo, 2);
});

test('rename uses minimal captured contract and reports business errors', async () => {
  let sent;
  const request = async (details) => { sent = JSON.parse(details.data); return response({ code: 200 }); };
  await createGuangyaClient({ context, request }).renameFile('7', 'new.mkv');
  assert.deepEqual(sent, { fileId: '7', newName: 'new.mkv' });
  await assert.rejects(() => createGuangyaClient({ context, request: async () => response({ code: 5001, message: '名称重复' }) }).renameFile('7', 'x'), /名称重复/);
});

test('loads file details and merges video resolution without blocking on one failure', async () => {
  const urls = [];
  const request = async ({ url, data }) => {
    urls.push(url);
    const { fileId } = JSON.parse(data);
    if (fileId === '2') return response({ code: 5001, message: '详情暂不可用' });
    return response({ code: 200, data: { fileInfo: { fileId }, videoResource: [{ info: { resolution: { width: 1920, height: 1080 } } }] } });
  };
  const client = createGuangyaClient({ context: { ...context, listUrl: 'https://api.guangyapan.com/nd.bizuserres.s/v1/file/get_file_list' }, request });
  const files = await client.enrichFileDetails([
    { id: '1', type: 'file', raw: { fileId: '1' } },
    { id: '2', type: 'file', raw: { fileId: '2' } }
  ], { concurrency: 2 });
  assert.ok(urls.every((url) => url.endsWith('/nd.bizuserres.s/v1/file/get_file_detail')));
  assert.equal(files[0].raw.detail.videoResource[0].info.resolution.height, 1080);
  assert.match(files[1].detailError, /详情暂不可用/);
  assert.deepEqual(files[1].raw, { fileId: '2' });
});

test('detects swaps and creates unique temporary staging names', () => {
  const plan = [
    { fileId: '1', oldName: 'a', targetName: 'b', selected: true, parsed: { extension: '' } },
    { fileId: '2', oldName: 'b', targetName: 'a', selected: true, parsed: { extension: '' } }
  ];
  const phases = planRenamePhases(plan, [{ id: '1', name: 'a' }, { id: '2', name: 'b' }]);
  assert.equal(phases.temporary.length, 2);
  assert.notEqual(phases.temporary[0].targetName, phases.temporary[1].targetName);
});

test('retry is bounded and authorization is never retried', async () => {
  let calls = 0;
  const value = await withRetry(async () => { calls += 1; if (calls < 3) { const error = new Error('busy'); error.status = 500; throw error; } return 9; }, { sleep: async () => {}, retries: 3 });
  assert.equal(value, 9); assert.equal(calls, 3);
  calls = 0;
  await assert.rejects(() => withRetry(async () => { calls += 1; const error = new Error('auth'); error.status = 401; throw error; }, { sleep: async () => {} }), /auth/);
  assert.equal(calls, 1);
});

test('executor rejects stale sources, skips idempotent targets, and verifies state', async () => {
  const plan = [
    { fileId: '1', parentId: 'p', oldName: 'a', targetName: 'aa', selected: true },
    { fileId: '2', parentId: 'p', oldName: 'b', targetName: 'bb', selected: true },
    { fileId: '3', parentId: 'p', oldName: 'c', targetName: 'cc', selected: true }
  ];
  let pass = 0; const renamed = [];
  const listFiles = async () => (++pass === 1 ? [{ id: '1', name: 'changed' }, { id: '2', name: 'bb' }, { id: '3', name: 'c' }] : [{ id: '1', name: 'changed' }, { id: '2', name: 'bb' }, { id: '3', name: 'cc' }]);
  const outcome = await executeRenamePlan({ plan, listFiles, renameFile: async (id, name) => renamed.push([id, name]) });
  assert.deepEqual(renamed, [['3', 'cc']]);
  assert.deepEqual(outcome.results.map((item) => item.status).sort(), ['skipped', 'stale', 'verified']);
  assert.equal(outcome.recoveryPlan[0].targetName, 'c');
});

test('temporary-stage failure aborts dependent cycle and verification spots mismatch', async () => {
  const swap = [
    { fileId: '1', parentId: 'p', oldName: 'a', targetName: 'b', selected: true, parsed: { extension: '' } },
    { fileId: '2', parentId: 'p', oldName: 'b', targetName: 'a', selected: true, parsed: { extension: '' } }
  ];
  const outcome = await executeRenamePlan({ plan: swap, listFiles: async () => [{ id: '1', name: 'a' }, { id: '2', name: 'b' }], renameFile: async () => { throw Object.assign(new Error('no'), { status: 400 }); } });
  assert.equal(outcome.aborted, true);
  assert.equal(outcome.results.length, 2);
  assert.equal(verifyExecution([swap[0]], [{ id: '1', name: 'other' }], [{ fileId: '1', ok: true }])[0].status, 'mismatch');
});

test('authorization failure stops unscheduled work and partial success yields recovery', async () => {
  const plan = Array.from({ length: 3 }, (_, index) => ({ fileId: String(index + 1), parentId: 'p', oldName: `a${index}`, targetName: `b${index}`, selected: true }));
  let reads = 0; const calls = [];
  const listFiles = async () => { reads += 1; return reads === 1 ? plan.map((item) => ({ id: item.fileId, name: item.oldName })) : plan.map((item) => ({ id: item.fileId, name: item.fileId === '1' ? item.targetName : item.oldName })); };
  const renameFile = async (id) => { calls.push(id); if (id === '2') throw Object.assign(new Error('expired'), { status: 401 }); };
  const outcome = await executeRenamePlan({ plan, listFiles, renameFile, retryOptions: { concurrency: 1 } });
  assert.equal(outcome.aborted, true); assert.deepEqual(calls, ['1', '2']);
  assert.equal(outcome.recoveryPlan.length, 1);
});
