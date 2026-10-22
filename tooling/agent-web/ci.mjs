// Dependency-free CI helpers. Receipts contain public source/build metadata only.
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const fileSha256 = path => sha256(readFileSync(path));

export function inventory(directory) {
  const records = [];
  let bytes = 0;
  function walk(relative = '') {
    const parent = join(directory, relative);
    if (!lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink()) throw new Error('Artifact directory must be regular');
    for (const name of readdirSync(parent).sort()) {
      const key = relative ? `${relative}/${name}` : name;
      const path = join(directory, key);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error('Artifact links are forbidden');
      if (stat.isDirectory()) { walk(key); continue; }
      if (!stat.isFile() || stat.nlink !== 1) throw new Error('Artifact must contain unlinked regular files');
      bytes += stat.size;
      if (records.length >= 100000 || bytes > 2 * 1024 ** 3 || stat.size > 256 * 1024 ** 2) throw new Error('Artifact exceeds receipt limits');
      records.push([key, stat.size, fileSha256(path)]);
    }
  }
  walk();
  records.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const javascript = records.filter(([name]) => name.endsWith('.js'));
  const licenses = records.filter(([name]) => /license|^(notice|copying)/i.test(name.split('/').at(-1)));
  return {
    files: records.length, bytes, sha256: sha256(JSON.stringify(records)),
    javascriptFiles: javascript.length, javascriptSha256: sha256(JSON.stringify(javascript)),
    licenseFiles: licenses.length, licenseSha256: sha256(JSON.stringify(licenses)),
  };
}

export function verifyPackaged(compiled, packaged) {
  const before = inventory(compiled);
  const after = inventory(packaged);
  if (!before.javascriptFiles || before.javascriptFiles !== after.javascriptFiles ||
      before.javascriptSha256 !== after.javascriptSha256) throw new Error('Packaged JavaScript is not byte-identical');
  if (!before.licenseFiles || before.licenseFiles !== after.licenseFiles ||
      before.licenseSha256 !== after.licenseSha256) throw new Error('Packaged licenses are not byte-identical');
  return after;
}
