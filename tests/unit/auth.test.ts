import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createTokenVerifier } from '../../src/config/auth';

const secret = 'a-test-secret-that-is-long-enough-for-hs256';
const key = new TextEncoder().encode(secret);

async function token(overrides: Record<string, unknown> = {}) {
  return new SignJWT({
    role: 'GATEWAY',
    factories: ['BINH_DUONG'],
    ...overrides,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('gateway-bd')
    .setIssuer('tmc-identity-service')
    .setAudience('tmc-attendance-service')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

describe('service token verifier', () => {
  it('accepts a signed, scoped token', async () => {
    await expect(
      createTokenVerifier(secret)(await token()),
    ).resolves.toMatchObject({
      sub: 'gateway-bd',
      role: 'GATEWAY',
      factories: ['BINH_DUONG'],
    });
  });
  it('rejects tampering and unknown roles', async () => {
    const signed = await token();
    await expect(createTokenVerifier(secret)(signed + 'x')).rejects.toThrow();
    await expect(
      createTokenVerifier(secret)(await token({ role: 'ROOT' })),
    ).rejects.toThrow();
  });
});
