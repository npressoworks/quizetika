import { NextRequest } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '../../../src/lib/supabase/auth-verify';
import { createClient } from '../../../src/lib/supabase/server';

// createClient をモック化
jest.mock('../../../src/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

describe('Supabase Auth-Verify Tests', () => {
  const mockGetUser = jest.fn();
  const mockSupabaseClient = {
    auth: {
      getUser: mockGetUser,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockResolvedValue(mockSupabaseClient);
  });

  describe('extractBearerToken', () => {
    it('should return token when valid Authorization header is present', () => {
      const request = {
        headers: new Headers({
          'Authorization': 'Bearer test-token-123',
        }),
      } as unknown as NextRequest;

      const token = extractBearerToken(request);
      expect(token).toBe('test-token-123');
    });

    it('should return null when Authorization header is missing', () => {
      const request = {
        headers: new Headers({}),
      } as unknown as NextRequest;

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });

    it('should return null when Authorization format is invalid', () => {
      const request = {
        headers: new Headers({
          'Authorization': 'Basic test-token-123',
        }),
      } as unknown as NextRequest;

      const token = extractBearerToken(request);
      expect(token).toBeNull();
    });
  });

  describe('verifySupabaseAccessToken', () => {
    it('should return null when token is null or undefined', async () => {
      const result = await verifySupabaseAccessToken(null);
      expect(result).toBeNull();
      expect(mockGetUser).not.toHaveBeenCalled();
    });

    it('should return user.id when getUser successfully verifies the token', async () => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: 'test-user-uuid' },
        },
        error: null,
      });

      const result = await verifySupabaseAccessToken('valid-jwt-token');
      expect(result).toBe('test-user-uuid');
      expect(mockGetUser).toHaveBeenCalledWith('valid-jwt-token');
    });

    it('should return null when getUser returns an error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token signature'),
      });

      const result = await verifySupabaseAccessToken('invalid-jwt-token');
      expect(result).toBeNull();
      expect(mockGetUser).toHaveBeenCalledWith('invalid-jwt-token');
    });

    it('should return null when getUser returns null user and no error', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await verifySupabaseAccessToken('empty-session-token');
      expect(result).toBeNull();
    });

    it('should return null when an exception is thrown', async () => {
      mockGetUser.mockRejectedValue(new Error('Network failure'));

      const result = await verifySupabaseAccessToken('error-token');
      expect(result).toBeNull();
    });
  });
});
