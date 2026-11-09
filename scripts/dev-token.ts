import { existsSync } from 'node:fs';
import { SignJWT } from 'jose';
import { principalSchema } from '../src/config/auth';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production')
  throw new Error('Development token tool is disabled in production');
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32)
  throw new Error('Set JWT_SECRET to at least 32 characters');
const [role, sub, factories = '', employeeIds = ''] = process.argv.slice(2);
const principal = principalSchema.parse({
  role,
  sub,
  factories: factories ? factories.split(',') : [],
  employeeIds: employeeIds ? employeeIds.split(',') : [],
});
async function main() {
  const token = await new SignJWT({
    role: principal.role,
    factories: principal.factories,
    employeeIds: principal.employeeIds,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(principal.sub)
    .setIssuer('tmc-identity-service')
    .setAudience('tmc-attendance-service')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(new TextEncoder().encode(secret));
  console.log(token);
}

void main();
