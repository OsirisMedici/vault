// SPDX-License-Identifier: GPL-3.0-only
import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { exactKeys, fail, privateParent, privateRead, text } from './config.mjs';

export const permissionLimits = Object.freeze({ bytes: 1024 * 1024, grants: 4096, owners: 32, accounts: 20000 });
const pair = (accountId, provider) => JSON.stringify([accountId, provider]);
const grantKey = grant => JSON.stringify([grant.userId, grant.accountId, grant.provider]);

export function validatePermissions(value, config, metadata) {
  if (config.version !== 2 || !exactKeys(value, ['version', 'revision', 'owners', 'grants']) || value.version !== 1 ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision >= Number.MAX_SAFE_INTEGER ||
      !Array.isArray(value.owners) || value.owners.length > permissionLimits.owners ||
      !Array.isArray(value.grants) || value.grants.length > permissionLimits.grants) fail();
  const imported = new Set(metadata.accountIds);
  const supported = new Set(metadata.accounts.map(account => pair(account.accountId, account.provider)));
  const owners = new Map();
  const assigned = new Map();
  for (const owner of value.owners) {
    if (!exactKeys(owner, ['ownerId', 'accountIds']) || !config.allowedUserIds.includes(owner.ownerId) ||
        owners.has(owner.ownerId) || !Array.isArray(owner.accountIds) || owner.accountIds.length > permissionLimits.accounts) fail();
    owners.set(owner.ownerId, true);
    for (const id of owner.accountIds) {
      if (!text(id, 256) || !imported.has(id) || assigned.has(id)) fail();
      assigned.set(id, owner.ownerId);
      if (assigned.size > permissionLimits.accounts) fail();
    }
  }
  const seen = new Set();
  for (const grant of value.grants) {
    if (!exactKeys(grant, ['ownerId', 'userId', 'accountId', 'provider']) ||
        !owners.has(grant.ownerId) || assigned.get(grant.accountId) !== grant.ownerId ||
        !config.allowedUserIds.includes(grant.userId) || !supported.has(pair(grant.accountId, grant.provider)) ||
        seen.has(grantKey(grant))) fail();
    seen.add(grantKey(grant));
  }
  return Object.freeze({ version: 1, revision: value.revision,
    owners: Object.freeze(value.owners.map(owner => Object.freeze({ ownerId: owner.ownerId,
      accountIds: Object.freeze([...owner.accountIds]) }))),
    grants: Object.freeze(value.grants.map(grant => Object.freeze({ ...grant }))) });
}

export async function loadPermissions(config, metadata) {
  if (config.version === 1) return null;
  try {
    return validatePermissions(JSON.parse(await privateRead(config.permissionsPath, permissionLimits.bytes)), config, metadata);
  } catch { fail(); }
}

export function canAccess(config, policy, userId, accountId, provider) {
  return config.allowedUserIds.includes(userId) && (config.version === 1 ||
    policy?.grants.some(grant => grant.userId === userId && grant.accountId === accountId && grant.provider === provider) === true);
}

// Host-only administration: caller must authenticate ownerId BEFORE invoking.
// No bearer, profile bypass, user-facing route, ownership/allowlist editing, or
// filesystem security boundary against other unrestricted same-uid host code.
export async function replaceOwnerGrants({ config, metadata, ownerId, expectedRevision, grants }) {
  if (config.version !== 2 || !Array.isArray(grants) || grants.length > permissionLimits.grants ||
      !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) fail();
  const filename = config.permissionsPath;
  const temporary = filename + '.' + randomUUID() + '.tmp';
  const lockname = filename + '.lock';
  let lock;
  let output;
  let staged = false;
  try {
    await privateParent(filename);
    // Cooperative writers serialize; a stale lock fails closed for manual review.
    // O_EXCL never follows/replaces another writer's file or a planted symlink.
    lock = await open(lockname, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    const policy = await loadPermissions(config, metadata);
    if (policy.revision !== expectedRevision || !policy.owners.some(owner => owner.ownerId === ownerId)) fail();
    const replacements = grants.map(grant => {
      if (!exactKeys(grant, ['userId', 'accountId', 'provider'])) fail();
      return { ownerId, ...grant };
    });
    const next = validatePermissions({ ...policy, revision: policy.revision + 1,
      grants: [...policy.grants.filter(grant => grant.ownerId !== ownerId), ...replacements] }, config, metadata);
    const bytes = JSON.stringify(next);
    if (Buffer.byteLength(bytes) > permissionLimits.bytes) fail();
    output = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    staged = true;
    await output.writeFile(bytes);
    await output.sync();
    await output.close(); output = undefined;
    await rename(temporary, filename); staged = false;
    const directory = await open(path.dirname(filename), constants.O_RDONLY);
    try { await directory.sync(); } finally { await directory.close(); }
    return { revision: next.revision };
  } catch { fail(); }
  finally {
    await output?.close().catch(() => {});
    if (staged) await unlink(temporary).catch(() => {});
    await lock?.close().catch(() => {});
    if (lock) await unlink(lockname).catch(() => {});
  }
}
