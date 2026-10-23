// SPDX-License-Identifier: GPL-3.0-only
// C03 only. Creates dummy metadata outside the checkout and never contacts a service.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chmod, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCredentialProvider } from './provider.mjs';

let directory;
try {
  directory = await mkdtemp(join(await realpath(tmpdir()), 'vault-credentials-c03-'));
  await chmod(directory, 0o700);
  const manifestPath = join(directory, 'import-manifest.json');
  const origin = 'https://app.example.invalid';
  const username = 'owner@example.invalid';
  const dummyPassword = randomBytes(24).toString('hex');
  const rows = ['A', 'B'].map((suffix) => ({
    accountId: `fixture-${suffix}`, name: 'Example account', username,
    origins: [origin], credentialRef: `VW_FIXTURE${suffix}`,
    sourceItemId: `fixture-${suffix}`, importedAt: '2026-10-22T00:00:00.000Z',
  }));
  await writeFile(manifestPath, JSON.stringify({
    version: 1, vaultName: 'bitwarden-import-20261022', accounts: rows,
  }), { mode: 0o600, flag: 'wx' });
  let engineCalls = 0;
  let consumerCalls = 0;
  const provider = createCredentialProvider({ manifestPath, engine: {
    async health() { return { state: 'ready' }; },
    async withLogin(reference, consume) {
      engineCalls += 1;
      assert.equal(reference, rows[1].credentialRef);
      assert.equal(await consume({ username, password: dummyPassword }), undefined);
      return { password: dummyPassword }; // Must never become the provider result.
    },
  } });
  const status = await provider.status();
  assert.deepEqual(status, { state: 'ready' });
  const found = await provider.findAccounts({ query: 'example', origin: 'https://APP.EXAMPLE.INVALID:443/' });
  assert.equal(found.state, 'accounts_ready');
  assert.equal(found.accounts.length, 2);
  assert.notEqual(found.accounts[0].accountId, found.accounts[1].accountId);
  assert.deepEqual(Object.keys(found.accounts[1]).sort(), ['accountId', 'credentialRef', 'name', 'origins', 'username']);
  assert.equal(engineCalls, 0);
  const result = await provider.withCredential({
    accountId: found.accounts[1].accountId, origin,
  }, async (login) => {
    consumerCalls += 1;
    assert.equal(login.username, username);
    assert.equal(login.password, dummyPassword);
    assert.deepEqual(Object.keys(login).sort(), ['password', 'username']);
    return { state: 'ready' };
  });
  assert.deepEqual(result, { state: 'ready' });
  assert.equal(engineCalls, 1);
  assert.equal(consumerCalls, 1);
  const publicOutput = JSON.stringify({ status, found, result });
  assert.equal(publicOutput.includes(dummyPassword), false);
  assert.equal(publicOutput.includes('"password"'), false);
  assert.equal(publicOutput.includes('"sourceItemId"'), false);
  process.stdout.write('C03 PASS: distinct metadata candidates; selected reference resolved once; credential consumed privately; bounded result.\n');
} catch {
  // Assertion errors can embed the fixture credential. Do not print them.
  process.stderr.write('C03 FAIL: fixture assertion or setup failed; no private details emitted.\n');
  process.exitCode = 1;
} finally {
  if (directory) {
    try { await rm(directory, { recursive: true, force: true }); }
    catch {
      process.stderr.write('C03 cleanup failed; remove the owned temporary fixture directory privately.\n');
      process.exitCode = 1;
    }
  }
}
