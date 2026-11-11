// Trusted host factory template for the later assembled checkout. No secrets here.
// Copy outside the checkout, mode600 within the mode700 integration-v1 directory.
// Replace these absolute module paths with the assembled checkout paths.
import { createEngineClient } from '/absolute/assembled/checkout/integrations/agent-vault/engine/client.mjs';
import { createCredentialProvider } from '/absolute/assembled/checkout/integrations/agent-vault/credentials/provider.mjs';
export async function createRuntime() {
  // Supply a validated private engine config through the engine owner's loader.
  // Its tokenFile contains the private management capability, never its contents.
  const engine = createEngineClient({address:'http://127.0.0.1:18431',vaultName:'bitwarden-import-20261022',tokenFile:'/private/path/member-token'});
  return {credentials:createCredentialProvider({engine,manifestPath:'/private/path/import-manifest.json'})};
}
