import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generate, imageModels, isValidModelId, saveConfig } from '../host.js';
import { compilePrompt } from '../prompt.js';

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

test('explains a 404 from a gateway whose Base URL is missing /v1', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response('Not Found', { status: 404 });
  try {
    await assert.rejects(
      imageModels({}, { baseUrl: 'http://127.0.0.1:38650', key: 'saved-secret-key' }, new AbortController().signal),
      error => error.status === 502 && /HTTP 404/.test(error.message) && /\/v1/.test(error.message),
    );
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

test('discovers provider-prefixed and modality-tagged image models with short or long API keys', async () => {
  const previous = globalThis.fetch;
  const seenAuth = [];
  globalThis.fetch = async (input, init) => {
    seenAuth.push(init.headers.Authorization);
    assert.equal(input.href, 'http://127.0.0.1:3425/v1/models');
    return Response.json({
      data: [
        { id: 'auto/deepseek-v4-flash', modalities: { input: ['text', 'image'] } },
        { id: 'auto/gpt-image-2', modalities: { input: ['text', 'image'] } },
        { id: 'me/gpt-image-2', modalities: { input: ['text', 'image'] } },
        { id: 'gptfree-pool/gpt-image-2', modalities: { input: ['text', 'image'], output: ['image'] }, native_endpoints: ['/v1/chat/completions'] },
        { id: 'gptfree-pool/gpt-image-2.6', modalities: { input: ['text', 'image'], output: ['image'] }, native_endpoints: ['/v1/chat/completions'] },
        { id: 'openrouter/google/gemini-omni-1.2-flash', modalities: { input: ['text', 'image', 'video'], output: ['text', 'video'] } },
        { id: 'openrouter/google/gemini-2.5-flash-image', architecture: { modality: 'text+image->image', output_modalities: ['image', 'text'] } },
        { id: 'custom-relay/art-model-v1', supported_endpoints: ['/v1/images/generations'] },
        { id: 'custom-relay/text-only-v1', architecture: { modality: 'text->text', output_modalities: ['text'] } },
        { id: 'black-forest-labs/FLUX.1-schnell' },
        { id: 'openai/gpt-4o-vision' },
        { id: 'openai/text-embedding-3-small' },
        { id: 'bad/../model', modalities: { output: ['image'] } },
      ],
    });
  };
  try {
    const shortKeyResult = await imageModels(
      { baseUrl: 'http://127.0.0.1:3425/v1', key: 'magpie' },
      {},
      new AbortController().signal,
    );
    assert.deepEqual(shortKeyResult.models, [
      'auto/gpt-image-2',
      'black-forest-labs/FLUX.1-schnell',
      'custom-relay/art-model-v1',
      'gptfree-pool/gpt-image-2',
      'gptfree-pool/gpt-image-2.6',
      'me/gpt-image-2',
      'openrouter/google/gemini-2.5-flash-image',
    ]);

    const longKey = 'k'.repeat(700);
    await imageModels({ baseUrl: 'http://127.0.0.1:3425/v1', key: longKey }, {}, new AbortController().signal);
    assert.deepEqual(seenAuth, ['Bearer magpie', 'Bearer ' + longKey]);
  } finally { globalThis.fetch = previous; }
});

test('allows arbitrary header-safe API keys and prefixed model IDs in saveConfig', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pose-studio-cfg-'));
  const store = { dir, file: join(dir, 'openai.json') };
  try {
    const saved = await saveConfig({
      baseUrl: 'http://127.0.0.1:3425/v1',
      key: 'magpie',
      model: 'gptfree-pool/gpt-image-2.6',
    }, store);
    assert.equal(saved.model, 'gptfree-pool/gpt-image-2.6');
    assert.equal(saved.configured, true);
    assert.equal(saved.endpoint, 'http://127.0.0.1:3425/v1/');
    const disk = JSON.parse(await readFile(store.file, 'utf8'));
    assert.equal(disk.key, 'magpie');
    assert.equal(disk.model, 'gptfree-pool/gpt-image-2.6');

    const oneChar = await saveConfig({ key: 'x', model: 'custom/my-model:v1' }, store);
    assert.equal(oneChar.model, 'custom/my-model:v1');

    await assert.rejects(saveConfig({ key: 'bad\nkey', model: 'gpt-image-2.6' }, store), { status: 400 });
    await assert.rejects(saveConfig({ key: '中文密钥', model: 'gpt-image-2.6' }, store), { status: 400 });
    assert.equal(isValidModelId('../invalid'), false);
    assert.equal(isValidModelId('gptfree-pool/gpt-image-2.6'), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('supports prefixed models in compilePrompt and generate (GIF and URL responses)', async () => {
  const list = async kind => kind === 'style'
    ? [{ id: 'FA-001', name: '社论线稿', prompt: 'ink sketch', thumb: 'FA-001.webp' }]
    : [];
  const plain = await compilePrompt({
    design: { theme: 'test', mode: 'pure-image' },
    refs: { style: 'FA-001' },
    model: 'gpt-image-2',
    list,
    size: '1024x1536',
  });
  const prefixed = await compilePrompt({
    design: { theme: 'test', mode: 'pure-image' },
    refs: { style: 'FA-001' },
    model: 'gptfree-pool/gpt-image-2',
    list,
    size: '1024x1536',
  });
  assert.deepEqual(prefixed.refs, plain.refs);
  assert.equal(prefixed.zh, plain.zh);

  const previous = globalThis.fetch;
  const gifBytes = Buffer.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;', 'binary');
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  let callIndex = 0;
  globalThis.fetch = async (url, init) => {
    callIndex++;
    if (callIndex === 1) {
      assert.equal(url.href, 'http://127.0.0.1:3425/v1/images/generations');
      assert.equal(init.headers.Authorization, 'Bearer magpie');
      const sent = JSON.parse(init.body);
      assert.equal(sent.model, 'gptfree-pool/gpt-image-2.6');
      assert.equal(sent.output_format, 'gif');
      return Response.json({ data: [{ b64_json: gifBytes.toString('base64') }] });
    }
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, 'black-forest-labs/FLUX.1-schnell');
    assert.equal('quality' in sent, false);
    return Response.json({ data: [{ url: 'data:image/png;base64,' + pngBytes.toString('base64') }] });
  };
  try {
    const gifRes = await generate(
      { prompt: 'dancing cat', outputFormat: 'gif', frameCount: 4, frameDurationMs: 200 },
      { baseUrl: 'http://127.0.0.1:3425/v1', key: 'magpie', model: 'gptfree-pool/gpt-image-2.6' },
      list,
      new AbortController().signal,
    );
    assert.equal(gifRes.headers.get('content-type'), 'image/gif');

    const urlRes = await generate(
      { prompt: 'sunlit cat', size: '1024x1024' },
      { baseUrl: 'http://127.0.0.1:3425/v1', key: 'magpie', model: 'black-forest-labs/FLUX.1-schnell' },
      list,
      new AbortController().signal,
    );
    assert.equal(urlRes.headers.get('content-type'), 'image/png');
  } finally { globalThis.fetch = previous; }
});
