import type { RequestHandler } from 'express';
import type { TokenVerifier } from '../../../config/auth';
import type { Principal } from '../domain/identity';

export type AuthenticatedRequest = Express.Request & { principal: Principal };

export function requirePrincipal(verify: TokenVerifier): RequestHandler {
  return async (request, response, next) => {
    const header = request.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      response.status(401).json({ error: 'Bearer token required' });
      return;
    }
    try {
      const principal = await verify(header.slice(7));
      (request as typeof request & { principal: Principal }).principal =
        principal;
      next();
    } catch {
      response.status(401).json({ error: 'Invalid bearer token' });
    }
  };
}

export function principalOf(request: Express.Request): Principal {
  return (request as typeof request & { principal: Principal }).principal;
}
