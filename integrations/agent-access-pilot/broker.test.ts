import { expect, test } from 'bun:test';
import { openBroker, type Account } from './broker.ts';

const a: Account = { id: '811a7959-53ac-4762-a01b-d8ab0c100001', label: 'A', origin: 'http://127.0.0.1:8888', identity: 'a@fixture.invalid' };
const b: Account = { ...a, id: '811a7959-53ac-4762-a01b-d8ab0c100002', label: 'B', identity: 'b@fixture.invalid' };
const fixtureProof = { signedOut: true, privateFill: true, identityVerified: true, records: 2 } as const;

test('known IDs, spoofed identities, and override URLs never reach the executor', async () => {
  let executed = 0;
  const broker = openBroker(':memory:', [a, b], async () => { executed++; return fixtureProof; });
  try {
    broker.grant(a.id);
    const list = await broker.handle({ op: 'list' });
    expect(list).toMatchObject({ accounts: [{ id: a.id, label: 'A' }] });
    expect(JSON.stringify(list)).not.toContain(b.id);
    const denied = [
      { op: 'read', accountId: b.id },
      { op: 'read', accountId: a.id, url: 'https://other.invalid' },
      { op: 'read', accountId: b.id, agentId: 'owner' },
      { op: 'owner_revoke', accountId: a.id },
      { op: 'private_fill', accountId: b.id },
    ];
    for (const input of denied) expect(await broker.handle(input)).toMatchObject({ status: 'denied' });
    expect(executed).toBe(0);
    expect(await broker.handle({ op: 'read', accountId: a.id })).toMatchObject({ status: 'ok' });
    expect(executed).toBe(1);
  } finally { broker.close(); }
});

test('revoking and regranting cannot revive a prior in-flight use', async () => {
  let changeGrant: (() => void) | undefined;
  const broker = openBroker(':memory:', [a], async (_account, recheck) => {
    recheck();
    changeGrant?.();
    recheck();
    return fixtureProof;
  });
  try {
    broker.grant(a.id);
    changeGrant = () => {
      broker.revoke(a.id);
      broker.grant(a.id);
      changeGrant = undefined;
    };
    expect(await broker.handle({ op: 'read', accountId: a.id })).toMatchObject({ status: 'denied' });
    expect(await broker.handle({ op: 'read', accountId: a.id })).toMatchObject({ status: 'ok' });
  } finally { broker.close(); }
});
