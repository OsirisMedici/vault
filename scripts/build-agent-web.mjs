#!/usr/bin/env bun
// Use Webpack's public compiler API. Its pinned CLI plugin fails under Bun.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { realpath, readFile } from 'node:fs/promises';

const root = resolve(import.meta.dir, '..');
const candidate = await realpath(resolve(process.argv[2] || join(root, '.cache/agent-web-source')));
if (!candidate.startsWith(join(root, '.cache') + '/')) throw new Error('candidate_required');
const packageInfo = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8'));
if (packageInfo.packageManager !== 'bun@1.4.4') throw new Error('bun_candidate_required');
process.env.ENV = 'selfhosted';
process.env.NODE_ENV = 'production';
process.env.LOGGING = 'false';
process.env.CACHE_TAG = 'vault-agent-20261023';
process.chdir(join(candidate, 'apps/web'));
const require = createRequire(join(candidate, 'package.json'));
const webpack = require('webpack');
const factory = require(join(candidate, 'apps/web/webpack.config.js'));
console.log('Building patched OSS Vault web with Bun and the Webpack compiler API');
const compiler = webpack(factory());
await new Promise((resolveBuild, rejectBuild) => {
  compiler.run((error, stats) => {
    compiler.close(closeError => {
      if (error || closeError) return rejectBuild(error || closeError);
      if (stats.hasErrors()) {
        console.error(stats.toString({all:false,errors:true,errorDetails:true}));
        return rejectBuild(new Error('web_compile_failed'));
      }
      console.log(stats.toString({all:false,timings:true,assets:true,warnings:true}));
      resolveBuild();
    });
  });
});
