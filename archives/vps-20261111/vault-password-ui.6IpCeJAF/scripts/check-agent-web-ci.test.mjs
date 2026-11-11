// One aggregate synthetic tooling acceptance case; no upstream/install/compiler required.
import { test, expect } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileSha256, inventory, verifyPackaged } from '../tooling/agent-web/ci.mjs';

test('synthetic packaging preserves JavaScript and licenses, rejects drift and escaping paths', () => {
  expect(process.versions.bun).toBe('1.4.4');
  const root = resolve(import.meta.dir, '..');
  const cache = join(root, '.cache');
  mkdirSync(cache, { recursive: true });
  const fixture = mkdtempSync(join(cache, 'agent-web-ci-fixture-'));
  const source = join(fixture, 'compiled');
  const packaged = join(fixture, 'web');
  const pin = join(root, 'tooling/agent-web/pin.json');
  const lock = join(root, 'tooling/agent-web/bun.lock');
  const before = [fileSha256(pin), fileSha256(lock)];
  function packageAt(output) {
    return Bun.spawnSync(['python3', 'scripts/prepare-agent-web-release.py', source, '--output', output], {
      cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 10000,
    });
  }
  try {
    mkdirSync(join(source, 'images'), { recursive: true });
    mkdirSync(join(source, 'locales/en'), { recursive: true });
    writeFileSync(join(source, 'index.html'), '<html><head><title page-title>Vault</title><meta name="viewport" content="width=1000"/></head></html>');
    writeFileSync(join(source, 'manifest.json'), '{"name":"Synthetic fixture"}');
    writeFileSync(join(source, 'locales/en/messages.json'), '{"appLogoLabel":{"message":"Synthetic fixture logo"}}');
    writeFileSync(join(source, 'bundle.js'), '/* Synthetic fixture only: Agent access, Request sign-in */\nglobalThis.fixture = 1;\n');
    writeFileSync(join(source, '3rdpartylicenses.txt'), 'Synthetic attribution fixture.\n');
    const original = inventory(source);
    const result = packageAt(packaged);
    expect(new TextDecoder().decode(result.stderr)).toBe('');
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(new TextDecoder().decode(result.stdout)).javascriptFilesPreserved).toBe(1);
    const receipt = verifyPackaged(source, packaged);
    expect(receipt.javascriptFiles).toBe(1);
    expect(receipt.licenseFiles).toBe(1);
    expect(receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(join(packaged, 'index.html'), 'utf8')).toContain('css/vaultwarden.css');
    expect(JSON.parse(readFileSync(join(packaged, 'manifest.json'), 'utf8')).name).toBe('Vault');
    expect(inventory(source)).toEqual(original);
    expect(packageAt(packaged).exitCode).not.toBe(0); // Never overwrite an existing release.
    writeFileSync(join(packaged, 'bundle.js'), 'changed');
    expect(() => verifyPackaged(source, packaged)).toThrow('JavaScript');
    cpSync(join(source, 'bundle.js'), join(packaged, 'bundle.js'));
    writeFileSync(join(packaged, '3rdpartylicenses.txt'), 'changed');
    expect(() => verifyPackaged(source, packaged)).toThrow('licenses');
    symlinkSync(fixture, join(fixture, 'linked'));
    expect(packageAt(join(fixture, 'linked/escape')).exitCode).not.toBe(0);
    symlinkSync(join(source, 'bundle.js'), join(source, 'linked.js'));
    expect(packageAt(join(fixture, 'linked-source-output')).exitCode).not.toBe(0);
    expect([fileSha256(pin), fileSha256(lock)]).toEqual(before);
    console.log('Synthetic fixture: packaging identity, attribution, immutable input, overwrite/link guards and drift rejection passed; no Angular or live app acceptance');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
