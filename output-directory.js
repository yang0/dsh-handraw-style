import { access, mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const invalidDirectory = message => Object.assign(new Error(message), { status: 400 });

/** Validate an owner-configured path on the DSH Host, creating missing directories. */
export async function outputDirectory(value) {
  if (typeof value !== 'string' || value.length > 4096 || value.includes('\0')) {
    throw invalidDirectory('保存目录格式无效。');
  }
  const directory = value.trim();
  if (!directory) return '';
  if (!isAbsolute(directory)) throw invalidDirectory('请填写运行 DSH 的电脑上的绝对保存目录。');
  const target = resolve(directory);
  try {
    await mkdir(target, { recursive: true });
    if (!(await stat(target)).isDirectory()) throw new Error();
    await access(target, constants.W_OK);
  } catch {
    throw invalidDirectory('无法使用这个保存目录，请检查路径和写入权限。');
  }
  return target;
}

/** Write each generated original once, without exposing partially written PNGs. */
export async function saveGeneratedImage(directory, bytes, page, format = 'png') {
  if (!['png', 'gif'].includes(format)) throw invalidDirectory('不支持的图片保存格式。');
  const target = await outputDirectory(directory);
  if (!target) return undefined;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const number = Number.isInteger(page) && page >= 1 && page <= 12 ? '-p' + String(page).padStart(2, '0') : '';
  const filename = 'pose-studio-' + stamp + number + '-' + randomUUID() + '.' + format;
  const destination = join(target, filename);
  const temporary = join(target, '.' + filename + '.tmp');
  let created = false;
  try {
    const handle = await open(temporary, 'wx', 0o600);
    created = true;
    try { await handle.writeFile(bytes); } finally { await handle.close(); }
    await rename(temporary, destination);
    return destination;
  } finally {
    if (created) await unlink(temporary).catch(() => {});
  }
}
