// SPDX-License-Identifier: GPL-3.0-only
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { readPrivateFile } from '../engine/private-file.mjs';

export const fail = () => { throw new Error('bridge_unavailable'); };
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const exactKeys = (value, keys) => object(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
export const uuid = value => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const text = (value, max, empty = false) => typeof value === 'string' &&
  value.length <= max && (empty || value.length > 0) && !/[\u0000-\u001f\u007f]/u.test(value);
const sourceRoot = path.resolve(import.meta.dir, '../../..');
const outsideSource = filename => filename !== sourceRoot && !filename.startsWith(sourceRoot + path.sep);

export function origin(value, engine = false) {
  if (!text(value, 2048)) fail();
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password ||
        (url.protocol !== 'https:' && !(engine && url.protocol === 'http:' &&
          (['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname) || value === 'http://engine:14321')))) fail();
    return value;
  } catch { fail(); }
}

// All ancestors must be canonical (no symlinks); the private containing directory
// must be owned by this uid and exactly 0700. System ancestors are not chmodded.
export async function privateParent(filename) {
  if (!text(filename, 4096) || !path.isAbsolute(filename) || path.resolve(filename) !== filename || !outsideSource(filename)) fail();
  const parent = path.dirname(filename);
  const stat = await lstat(parent);
  if (!stat.isDirectory() || stat.uid !== process.getuid() ||
      (stat.mode & 0o7777) !== 0o700 || await realpath(parent) !== parent) fail();
}

export async function privateRead(filename, max) {
  await privateParent(filename);
  const entry = await lstat(filename);
  if (!entry.isFile() || entry.uid !== process.getuid() ||
      (entry.mode & 0o7777) !== 0o600 || entry.nlink !== 1) fail();
  return readPrivateFile(filename, max);
}

export function validateConfig(config) {
  const keys = ['version', 'vaultOrigin', 'allowedUserIds', 'manifestPath', 'workerTokenFile', 'databasePath', 'engineAddress'];
  if (config?.version === 2) keys.push('permissionsPath');
  if (!exactKeys(config, keys) || ![1, 2].includes(config.version) || !Array.isArray(config.allowedUserIds) ||
      !config.allowedUserIds.length || config.allowedUserIds.length > 32 ||
      !config.allowedUserIds.every(uuid) || new Set(config.allowedUserIds).size !== config.allowedUserIds.length) fail();
  origin(config.vaultOrigin);
  origin(config.engineAddress, true);
  const paths = keys.filter(key => key.endsWith('Path') || key === 'workerTokenFile');
  if (paths.some(key => !text(config[key], 4096) || !path.isAbsolute(config[key]) || path.resolve(config[key]) !== config[key] || !outsideSource(config[key])) ||
      new Set(paths.map(key => config[key])).size !== paths.length) fail();
  return Object.freeze({ ...config, allowedUserIds: Object.freeze([...config.allowedUserIds]) });
}

export async function loadConfig(filename = process.env.VAULT_AGENT_WEB_CONFIG) {
  try {
    const config = validateConfig(JSON.parse(await privateRead(filename, 16384)));
    if ([config.manifestPath, config.workerTokenFile, config.databasePath, config.permissionsPath].includes(filename)) fail();
    return config;
  } catch { fail(); }
}

export async function prepareDatabase(filename) {
  await privateParent(filename);
  let handle;
  try {
    try {
      handle = await open(filename, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      handle = await open(filename, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    }
    const stat = await handle.stat();
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o7777) !== 0o600 ||
        stat.nlink !== 1 || stat.size > 32 * 1024 * 1024) fail();
    // DELETE journaling avoids persistent WAL files. Refuse unsafe leftovers too.
    for (const suffix of ['-journal', '-wal', '-shm']) {
      try {
        const sidecar = await lstat(filename + suffix);
        if (!sidecar.isFile() || sidecar.uid !== process.getuid() ||
            (sidecar.mode & 0o7777) !== 0o600 || sidecar.nlink !== 1 || sidecar.size > 32 * 1024 * 1024) fail();
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } finally { await handle?.close(); }
}
