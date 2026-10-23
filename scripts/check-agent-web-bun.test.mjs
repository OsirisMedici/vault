// One tiny differential regression. Reads installed public dependencies; writes only a local fixture.
import { test, expect } from 'bun:test';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCompiler } from './build-agent-web-bun.mjs';

test('pinned Bun CLI interop failure and public compiler API success', async () => {
  expect(process.versions.bun).toBe('1.4.4');
  const dependencies = realpathSync(resolve(process.env.VAULT_WEB_REGRESSION_DEPENDENCIES || '.cache/agent-web-bun'));
  const pin = JSON.parse(readFileSync(new URL('../tooling/agent-web/pin.json', import.meta.url), 'utf8'));
  for (const name of ['webpack', 'webpack-cli']) {
    expect(JSON.parse(readFileSync(join(dependencies, 'node_modules', name, 'package.json'), 'utf8')).version).toBe(pin.criticalVersions[name]);
  }
  const cache = resolve(import.meta.dir, '../.cache');
  mkdirSync(cache, { recursive: true });
  expect(realpathSync(cache)).toBe(cache);
  const fixture = mkdtempSync(join(cache, 'bun-cli-regression-'));
  try {
    const require = createRequire(join(dependencies, 'package.json'));
    const cli = join(dependencies, 'node_modules/webpack-cli');
    const plugin = await import(pathToFileURL(join(cli, 'lib/plugins/cli-plugin.js')).href);
    // CLI 7.0.2 destructures .default.default. Bun exposes the class at .default.
    expect(typeof plugin.default).toBe('function');
    expect(plugin.default.default).toBeUndefined();
    writeFileSync(join(fixture, 'entry.js'), 'globalThis.vaultBunRegression = 42;\n');
    const config = {
      context: fixture, mode: 'none', entry: './entry.js', devtool: false,
      optimization: { minimize: false }, output: { path: join(fixture, 'out'), filename: 'bundle.js' },
    };
    writeFileSync(join(fixture, 'webpack.config.cjs'), `module.exports = ${JSON.stringify(config)};\n`);
    const broken = Bun.spawnSync([process.execPath, '--bun', join(cli, 'bin/cli.js'), '--config', join(fixture, 'webpack.config.cjs')], {
      cwd: fixture, env: { ...process.env, WEBPACK_CLI_SKIP_IMPORT_LOCAL: '1' }, stdout: 'pipe', stderr: 'pipe', timeout: 15000,
    });
    const stderr = new TextDecoder().decode(broken.stderr);
    expect(broken.exitCode).not.toBe(0);
    expect(stderr).toContain('undefined is not a constructor');
    expect(stderr).toContain('new CLIPlugin');
    console.log('Reproduced pinned webpack-cli failure: undefined is not a constructor, new CLIPlugin');
    const stats = await runCompiler(require('webpack'), config);
    expect(stats.hasErrors()).toBe(false);
    expect(readFileSync(join(fixture, 'out/bundle.js'), 'utf8')).toContain('vaultBunRegression = 42');
    console.log('Same tiny input compiled successfully through the Bun public compiler API runner');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}, 25000);
