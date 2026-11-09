import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const workerImage = 'python@sha256:1e1f6334529d1fb26a2ef619d7cffb30a7c7d7cc1cc7338ebee283a58d1aeaca';
const source = readFileSync(join(import.meta.dir, 'worker.py'), 'utf8');
const docker = Bun.which('docker');
if (!docker) throw new Error('Docker CLI unavailable');

// Identity is bound by the trusted launcher to this private stdio channel.
// The worker receives no network route, agent token, mounts or Docker socket.
export async function runWorker(args: string[], handle?: (message: unknown) => Promise<unknown>) {
  const name = 'vault-karen-' + randomUUID();
  const proc = spawn(docker!, ['run', '--rm', '--name', name, '--pull=never', '--interactive',
    '--network=none', '--read-only', '--user=65532:65532', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--pids-limit=24', '--memory=96m', '--cpus=.5',
    workerImage, 'python', '-I', '-u', '-c', source, ...args], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { HOME: process.env.HOME, PATH: process.env.PATH, DOCKER_CONTEXT: 'colima' },
  });
  proc.stdin.on('error', () => {});
  const exit = new Promise<number | null>((resolve, reject) => {
    proc.once('error', reject);
    proc.once('close', resolve);
  });
  void exit.catch(() => {});
  const timeout = setTimeout(() => {
    proc.kill();
    Bun.spawnSync([docker!, '--context', 'colima', 'rm', '-f', name], { stdout: 'ignore', stderr: 'ignore' });
  }, 90_000);
  const results: unknown[] = [];
  let pending = '';
  try {
    for await (const chunk of proc.stdout) {
      pending += chunk.toString('utf8');
      if (pending.length > 8192) throw new Error('worker message too large');
      let end: number;
      while ((end = pending.indexOf('\n')) !== -1) {
        const message: unknown = JSON.parse(pending.slice(0, end));
        pending = pending.slice(end + 1);
        if (results.length >= 12) throw new Error('worker request limit');
        if (handle) {
          const result = await handle(message);
          results.push(result);
          proc.stdin.write(JSON.stringify(result) + '\n');
        } else {
          results.push(message);
        }
      }
    }
    if (await exit !== 0 || pending) throw new Error('isolated worker failed');
    return results;
  } finally {
    clearTimeout(timeout);
    if (proc.exitCode === null) {
      proc.kill();
      Bun.spawnSync([docker!, '--context', 'colima', 'rm', '-f', name], { stdout: 'ignore', stderr: 'ignore' });
    }
  }
}

export async function isolationProof(privateFile: string) {
  const canary = randomUUID();
  await Bun.write(privateFile, canary);
  const previous = process.env.PILOT_OWNER_CANARY;
  process.env.PILOT_OWNER_CANARY = canary;
  const sockets = [createServer(socket => socket.end('owner channel canary')),
    createServer(socket => socket.end('browser channel canary'))];
  try {
    const ports = await Promise.all(sockets.map(server => new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') reject(new Error('probe listener unavailable'));
        else resolve(address.port);
      });
    })));
    const [probe] = await runWorker(['probe', privateFile, ...ports.map(String)]) as [Record<string, unknown>];
    const { uid, interfaces, ...checks } = probe;
    const expected = ['trusted_file_denied', 'host_env_absent', 'vault_session_absent', 'docker_cli_absent',
      'docker_socket_denied', 'host_owner_denied', 'host_browser_denied', 'host_namespace_denied',
      'root_escalation_denied', 'root_write_denied', 'capabilities_dropped', 'no_new_privileges'];
    if (uid !== 65532 || JSON.stringify(interfaces) !== '["lo"]' ||
      expected.some(key => checks[key] !== true)) throw new Error('worker isolation gate failed');
    return { uid, interfaces, ...Object.fromEntries(expected.map(key => [key, true])) };
  } finally {
    if (previous === undefined) delete process.env.PILOT_OWNER_CANARY;
    else process.env.PILOT_OWNER_CANARY = previous;
    for (const server of sockets) server.close();
  }
}
