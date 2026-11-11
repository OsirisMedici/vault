// SPDX-License-Identifier: GPL-3.0-only
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail, MAX_BYTES } from './common.mjs';

export async function checkParent(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename) || path.normalize(filename) !== filename) fail('private_file_unsafe');
  const parent = path.dirname(filename);
  const stat = await lstat(parent);
  if (!stat.isDirectory() || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o700 ||
      await realpath(parent) !== parent) fail('private_file_unsafe');
}
const valid = stat => stat.isFile() && stat.uid === process.getuid() &&
  (stat.mode & 0o7777) === 0o600 && stat.nlink === 1 && stat.size > 0 && stat.size <= MAX_BYTES;

export async function readJSON(filename, optional = false) {
  let handle;
  let bytes;
  try {
    await checkParent(filename);
    try { handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
    catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
    const before = await handle.stat();
    if (!valid(before)) fail('private_file_unsafe');
    bytes = Buffer.alloc(before.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat();
    if (!valid(after) || length !== before.size || before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) fail('private_file_unsafe');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
  } catch { fail('private_file_unsafe'); }
  finally { bytes?.fill(0); await handle?.close().catch(() => {}); }
}

async function syncDirectory(filename) {
  const handle = await open(path.dirname(filename), constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

// Each file is replaced atomically. The durable journal coordinates the two-file commit.
export async function saveJSON(filename, value) {
  let temporary;
  let handle;
  try {
    await checkParent(filename);
    await readJSON(filename, true); // Refuse an unsafe existing destination, including symlinks.
    const bytes = Buffer.from(JSON.stringify(value));
    if (!bytes.length || bytes.length > MAX_BYTES) fail('private_file_unsafe');
    temporary = path.join(path.dirname(filename), `.vault-sync-${randomUUID()}`);
    handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { bytes.fill(0); }
    await handle.close(); handle = undefined;
    await rename(temporary, filename);
    temporary = undefined;
    await syncDirectory(filename);
  } catch { fail('private_file_unsafe'); }
  finally { await handle?.close().catch(() => {}); if (temporary) await unlink(temporary).catch(() => {}); }
}

export function createPrivateStore({ manifestPath, statePath, journalPath }) {
  const paths = [manifestPath, statePath, journalPath];
  if (paths.some(p => typeof p !== 'string' || !path.isAbsolute(p)) || new Set(paths).size !== 3 ||
      new Set(paths.map(p => path.dirname(p))).size !== 1) fail('invalid_config');
  const lockPath = `${statePath}.lock`;
  if (paths.includes(lockPath)) fail('invalid_config');
  return Object.freeze({
    async read() {
      return { manifest: await readJSON(manifestPath), state: await readJSON(statePath, true),
        journal: await readJSON(journalPath, true) };
    },
    async locked(consume) {
      let lock;
      try {
        await checkParent(lockPath);
        try { lock = await open(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
        catch (error) { if (error.code === 'EEXIST') fail('sync_busy'); throw error; }
        await lock.writeFile('sync-in-progress\n'); await lock.sync();
        return await consume();
      } finally {
        if (lock) { await lock.close(); await unlink(lockPath); await syncDirectory(lockPath); }
      }
    },
    stage: journal => saveJSON(journalPath, journal),
    async commit(journal) {
      // Leave the journal on every failure. Explicit resume validates before finishing.
      await saveJSON(manifestPath, journal.nextManifest);
      await saveJSON(statePath, journal.nextState);
      await unlink(journalPath);
      await syncDirectory(journalPath);
    },
  });
}
