import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outputDirectory, saveGeneratedImage } from '../output-directory.js';

const temporary = await mkdtemp(join(tmpdir(), 'pose-output-'));
after(() => rm(temporary, { recursive: true, force: true }));
const bytes = Buffer.from('generated png');

test('creates an absolute directory, supports clearing, and rejects files or relative paths', async () => {
  assert.equal(await outputDirectory(''), '');
  await assert.rejects(outputDirectory('relative/path'), { status: 400 });
  await assert.rejects(outputDirectory(null), { status: 400 });
  const folder = join(temporary, '我的图片', 'nested');
  assert.equal(await outputDirectory(folder), folder);
  const file = join(temporary, 'not-a-directory');
  await writeFile(file, 'text');
  await assert.rejects(outputDirectory(file), { status: 400 });
});

test('concurrent generations save complete originals under unique names', async () => {
  const folder = join(temporary, 'batch');
  const paths = await Promise.all(Array.from({ length: 4 }, () => saveGeneratedImage(folder, bytes, 2)));
  assert.equal(new Set(paths).size, 4);
  for (const path of paths) {
    assert.match(path, /-p02-.*\.png$/);
    assert.deepEqual(await readFile(path), bytes);
  }
  assert.equal((await readdir(folder)).filter(name => name.endsWith('.tmp')).length, 0);
  assert.equal(await saveGeneratedImage('', bytes), undefined);
});

test('saves native GIF bytes with .gif extension and rejects unknown formats', async () => {
  const folder = join(temporary, 'animations');
  const gif = Buffer.from('GIF89a sample');
  const path = await saveGeneratedImage(folder, gif, 3, 'gif');
  assert.match(path, /-p03-.*\.gif$/);
  assert.deepEqual(await readFile(path), gif);
  await assert.rejects(saveGeneratedImage(folder, gif, 3, 'webp'), { status: 400 });
});
