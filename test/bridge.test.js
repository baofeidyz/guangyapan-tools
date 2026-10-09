import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/bridge.js';

const { classifyRequest, createCapture, sanitizeObservedHeaders } = globalThis.GTR;

test('observes only supported Guangya file endpoints', () => {
  assert.equal(classifyRequest('https://api.guangyapan.com/userres/v1/file/get_file_list'), 'list');
  assert.equal(classifyRequest('https://api.guangyapan.com/userres/v1/file/get_file_detail'), 'detail');
  assert.equal(classifyRequest('https://api.guangyapan.com/userres/v1/file/rename'), 'rename');
  assert.equal(classifyRequest('https://example.com/file/rename'), null);
});

test('allowlists headers and parses request JSON', () => {
  const headers = sanitizeObservedHeaders({ Authorization: 'Bearer x', Cookie: 'secret', did: 'device' });
  assert.deepEqual(headers, { authorization: 'Bearer x', did: 'device' });
  const capture = createCapture('https://api.guangyapan.com/userres/v1/file/rename', 'post', headers, '{"fileId":"1","newName":"x"}');
  assert.equal(capture.method, 'POST');
  assert.deepEqual(capture.body, { fileId: '1', newName: 'x' });
});
