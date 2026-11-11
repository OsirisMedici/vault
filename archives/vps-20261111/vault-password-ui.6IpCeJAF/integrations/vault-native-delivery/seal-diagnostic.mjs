// MIT, see T3-LICENSE in the generated source receipt. No app launch or install.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { realpath, writeFile } from 'node:fs/promises';

const [sourceInput, appInput] = process.argv.slice(2);
const source = await realpath(sourceInput);
const app = await realpath(appInput);
const cache = resolve(import.meta.dirname, '../../.cache');
if (!source.startsWith(cache + '/') || !app.startsWith(cache + '/') || !app.endsWith('.app')) {
  throw new Error('Diagnostic signing is limited to generated Vault cache artifacts');
}
const require = createRequire(join(source, 'scripts/package.json'));
const { sign } = require('@electron/osx-sign');
const entitlements = join(app, '../diagnostic-entitlements.plist');
// Keep hardened runtime enabled. Only the existing app's runtime exceptions
// are used; no Apple team, Keychain group or restricted entitlement is claimed.
await writeFile(entitlements, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>
<key>com.apple.security.device.audio-input</key><true/>
<key>com.apple.security.device.camera</key><true/>
</dict></plist>\n`, { flag: 'wx' });
await sign({ app, identity: '-', identityValidation: false, platform: 'darwin',
  preAutoEntitlements: false, preEmbedProvisioningProfile: false, strictVerify: true,
  optionsForFile: () => ({ hardenedRuntime: true, entitlements, timestamp: 'none' }) });
