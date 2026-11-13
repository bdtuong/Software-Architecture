import type { Principal } from '../modules/attendance/domain/identity';
import { jwtVerify } from 'jose';
import { z } from 'zod';

export const principalSchema = z.object({
  sub: z.string().min(1),
  role: z.enum([
    'GATEWAY',
    'EMPLOYEE',
    'SUPERVISOR',
    'HR',
    'SECURITY',
    'EXECUTIVE',
    'ADMIN',
    'REPORTING',
    'INTEGRATION',
  ]),
  factories: z.array(z.enum(['BINH_DUONG', 'LONG_AN'])).default([]),
  employeeIds: z.array(z.string().min(1)).default([]),
});
export type TokenVerifier = (token: string) => Promise<Principal>;

export function createTokenVerifier(secret: string): TokenVerifier {
  const key = new TextEncoder().encode(secret);
  return async (token) => {
    const { payload } = await jwtVerify(token, key, {
      issuer: 'tmc-identity-service',
      audience: 'tmc-attendance-service',
      algorithms: ['HS256'],
      requiredClaims: ['sub', 'iat', 'exp'],
      maxTokenAge: '15m',
    });
    return principalSchema.parse(payload);
  };
}
