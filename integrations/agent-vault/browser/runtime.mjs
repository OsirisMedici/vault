import { homedir } from 'node:os';
import { join } from 'node:path';
import { createEngineClient, loadEngineConfig } from '../engine/client.mjs';
import { createCredentialProvider } from '../credentials/provider.mjs';

export async function createRuntime() {
  const directory = join(homedir(), '.config/osiris-agent-vault/integration-v1');
  const engine = createEngineClient(await loadEngineConfig(join(directory, 'engine.json')));
  return { credentials: createCredentialProvider({
    engine, manifestPath: join(directory, 'import-manifest.json'),
  }) };
}
