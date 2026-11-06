import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageModels } from '../host.js';

test('loads and filters GPT Image models from the configured gateway', async () => {
  const previous = globalThis.fetch;
  let url, auth;
  globalThis.fetch = async (input, init) => {
    url = input.href || String(input);
    auth = init.headers.Authorization;
    return Response.json({ data: [
      { id: 'gpt-4o' }, { id: 'gpt-image-2.6' }, { id: 'gpt-image-2' },
      { id: 'gpt-image-2.6-flare' }, { id: 'gpt-image-2.6' }, { id: '../invalid' },
    ] });
  };
  try {
    const result = await imageModels({}, {
      baseUrl: 'http://127.0.0.1:38650/v1', key: 'saved-secret-key',
    }, new AbortController().signal);
    assert.equal(url, 'http://127.0.0.1:38650/v1/models');
    assert.equal(auth, 'Bearer saved-secret-key');
    assert.deepEqual(result.models, ['gpt-image-2', 'gpt-image-2.6', 'gpt-image-2.6-flare']);
  } finally { globalThis.fetch = previous; }
});

test('does not forward a stored API key to another gateway', async () => {
  const previous = globalThis.fetch;
  let requested = false;
  globalThis.fetch = async () => { requested = true; return Response.json({data:[]}); };
  try {
    await assert.rejects(imageModels(
      { baseUrl: 'https://other.example/v1' },
      { baseUrl: 'http://127.0.0.1:38650/v1', key: 'saved-secret-key' },
      new AbortController().signal,
    ), { status: 400 });
    assert.equal(requested, false);
  } finally { globalThis.fetch = previous; }
});

test('supports a new gateway when its API key is explicitly entered', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(url).hostname, 'other.example');
    assert.equal(init.headers.Authorization, 'Bearer newly-entered-key');
    return Response.json({ data: [{id:'gpt-image-2.6-sunburst'}] });
  };
  try {
    const response = await imageModels(
      {baseUrl:'https://other.example/v1',key:'newly-entered-key'},
      {baseUrl:'http://127.0.0.1:38650/v1',key:'saved-secret-key'},
      new AbortController().signal,
    );
    assert.deepEqual(response.models, ['gpt-image-2.6-sunburst']);
  } finally { globalThis.fetch = previous; }
});
