import { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';

export const agent = Object.freeze({ id: 'karen-pilot', label: 'Karen' });
export type Account = { id: string; label: string; identity: string; origin: string };
export class GrantRevoked extends Error {}
type Proof = { signedOut: true; privateFill: true; identityVerified: true; records: number };

export function openBroker(path: string, accounts: Account[],
  execute: (account: Account, recheck: () => void) => Promise<Proof>) {
  const db = new Database(path, { create: true, strict: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS grants (
      id TEXT NOT NULL UNIQUE, agent TEXT NOT NULL, account TEXT NOT NULL,
      active INTEGER NOT NULL CHECK (active IN (0, 1)),
      PRIMARY KEY (agent, account)
    );
    CREATE TABLE IF NOT EXISTS audit (
      seq INTEGER PRIMARY KEY, request TEXT NOT NULL UNIQUE, at TEXT NOT NULL,
      actor TEXT NOT NULL, agent TEXT NOT NULL, account TEXT, grant_id TEXT,
      action TEXT NOT NULL, result TEXT NOT NULL
    );
  `);
  const byId = new Map(accounts.map(account => [account.id, account]));
  const get = db.query<{ id: string; active: number }, [string, string]>(
    'SELECT id, active FROM grants WHERE agent=? AND account=?');
  const auditInsert = db.query('INSERT INTO audit (request,at,actor,agent,account,grant_id,action,result) VALUES (?,?,?,?,?,?,?,?)');
  const receipt = (actor: string, action: string, result: string, account: string | null, grant: string | null) => {
    const requestId = randomUUID();
    auditInsert.run(requestId, new Date().toISOString(), actor, agent.id, account, grant, action, result);
    return { status: result, requestId };
  };
  const set = db.transaction((id: string, active: boolean) => {
    if (!byId.has(id)) throw new Error('unknown owner account');
    // A regrant gets a new generation; a revoked in-flight lease stays invalid.
    const previous = get.get(agent.id, id);
    const grantId = active && previous?.active !== 1 ? randomUUID() : previous?.id ?? randomUUID();
    db.query(`INSERT INTO grants VALUES (?,?,?,?)
      ON CONFLICT(agent,account) DO UPDATE SET id=excluded.id,active=excluded.active`)
      .run(grantId, agent.id, id, Number(active));
    return receipt('owner', active ? 'grant' : 'revoke', active ? 'granted' : 'revoked', id, grantId);
  });
  const effective = (id: string) => get.get(agent.id, id)?.active === 1;
  return {
    grant: (id: string) => set.immediate(id, true),
    revoke: (id: string) => set.immediate(id, false),
    audit: () => db.query('SELECT request AS requestId, at, actor, agent, account, grant_id AS grantId, action, result FROM audit ORDER BY seq').all(),
    ownerAccounts: () => accounts.map(account => ({ ...account, granted: effective(account.id) })),
    close: () => db.close(),
    // Only the trusted launcher for Karen's container receives this handler.
    async handle(message: unknown) {
      const input = message && typeof message === 'object' && !Array.isArray(message)
        ? message as Record<string, unknown> : {};
      const { op, accountId } = input;
      const id = typeof accountId === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(accountId) ? accountId : null;
      const keys = Object.keys(input).sort().join(',');
      if (op === 'list' && keys === 'op') {
        const visible = accounts.filter(account => effective(account.id))
          .map(({ id, label }) => ({ id, label }));
        return { ...receipt(agent.id, 'list', 'ok', null, null), accounts: visible };
      }
      if (op !== 'read' || keys !== 'accountId,op' || !id) {
        const rejected = op === 'private_fill' || op === 'owner_revoke' || op === 'browser_debug' ? op : 'invalid';
        return receipt(agent.id, rejected, 'denied', id, null);
      }
      const account = byId.get(id);
      const grant = get.get(agent.id, id);
      if (!account || !grant || grant.active !== 1) return receipt(agent.id, 'read', 'denied', id, grant?.id ?? null);
      const recheck = () => {
        const current = get.get(agent.id, id);
        if (current?.id !== grant.id || current.active !== 1) throw new GrantRevoked();
      };
      try {
        const proof = await execute(account, recheck);
        recheck();
        return { ...receipt(agent.id, 'read', 'ok', id, grant.id), proof };
      } catch (error) {
        return receipt(agent.id, 'read', error instanceof GrantRevoked ? 'denied' : 'failed', id, grant.id);
      }
    },
  };
}
