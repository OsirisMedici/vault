import { createEngineClient, loadEngineConfig } from './client.mjs';

try {
  const result = await createEngineClient(await loadEngineConfig(process.argv[2])).health();
  console.log(JSON.stringify(result));
  if (result.state !== 'ready') process.exitCode = 1;
} catch {
  console.log(JSON.stringify({ state: 'engine_unavailable' }));
  process.exitCode = 1;
}
