import { UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

const user = { _id: 'user', status: 'ACTIVE' };

test('refresh returns the replacement access token, never the refresh credential', async () => {
  const refreshSession = jest.fn().mockResolvedValue({ sessionId: 'access-b', user });
  const controller = new AuthController({ refreshSession } as unknown as AuthService);
  const res = { cookie: jest.fn() } as unknown as Response;
  const result = await controller.refresh({ headers: { cookie: 'rt=refresh-only' } } as Request, res);
  expect(result).toEqual({ success: true, data: { user, token: 'access-b' } });
  expect(refreshSession).toHaveBeenCalledWith('refresh-only');
  expect(JSON.stringify(result)).not.toContain('refresh-only');
  expect(res.cookie).toHaveBeenCalledWith('sid', 'access-b', expect.objectContaining({ httpOnly: true }));
});

test('missing refresh credential is rejected before service invocation', async () => {
  const refreshSession = jest.fn();
  const controller = new AuthController({ refreshSession } as unknown as AuthService);
  await expect(controller.refresh({ headers: {} } as Request, {} as Response)).rejects.toBeInstanceOf(UnauthorizedException);
  expect(refreshSession).not.toHaveBeenCalled();
});
