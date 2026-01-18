import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp, type AppDependencies } from './app.js';

// モックセッションマネージャー
function createMockSessionManager() {
  const sessions = new Map<string, { id: string; cwd: string; status: 'running' | 'waiting' | 'completed'; createdAt: Date; pty: unknown }>();
  let idCounter = 0;

  return {
    sessions,
    getAllSessions: vi.fn(() => Array.from(sessions.values())),
    createSession: vi.fn((cwd: string) => {
      const id = `session-${++idCounter}`;
      const session: { id: string; cwd: string; status: 'running' | 'waiting' | 'completed'; createdAt: Date; pty: unknown } = {
        id,
        cwd,
        status: 'running',
        createdAt: new Date(),
        pty: {},
      };
      sessions.set(id, session);
      return session;
    }),
    deleteSession: vi.fn((id: string) => {
      if (!sessions.has(id)) return false;
      sessions.delete(id);
      return true;
    }),
    getSession: vi.fn((id: string) => sessions.get(id)),
    findSessionByCwd: vi.fn((cwd: string) => {
      for (const session of sessions.values()) {
        if (session.cwd.toLowerCase() === cwd.toLowerCase()) {
          return session;
        }
      }
      return undefined;
    }),
    updateStatus: vi.fn((id: string, status: 'running' | 'waiting' | 'completed') => {
      const session = sessions.get(id);
      if (!session) return false;
      session.status = status;
      return true;
    }),
    getOutputBuffer: vi.fn(() => ''),
    toSessionInfo: vi.fn((session: { id: string; cwd: string; status: string; createdAt: Date }) => ({
      id: session.id,
      cwd: session.cwd,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
    })),
    toSessionHistory: vi.fn((session: { id: string; cwd: string; status: string; createdAt: Date }) => ({
      id: session.id,
      cwd: session.cwd,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      outputSize: 0,
    })),
    onData: vi.fn(),
    onExit: vi.fn(),
  };
}

// モック履歴マネージャー
function createMockHistoryManager() {
  const history: Array<{ id: string; cwd: string; status: string; createdAt: string; endedAt?: string; outputSize: number }> = [];

  return {
    history,
    loadHistory: vi.fn(async () => {}),
    saveSession: vi.fn(async (session: { id: string; cwd: string; status: string; createdAt: string; outputSize: number }) => {
      history.push({ ...session });
    }),
    updateSessionStatus: vi.fn(async (id: string, status: string, outputSize?: number) => {
      const session = history.find(h => h.id === id);
      if (session) {
        session.status = status;
        if (outputSize !== undefined) session.outputSize = outputSize;
      }
    }),
    endSession: vi.fn(async (id: string, outputSize?: number) => {
      const session = history.find(h => h.id === id);
      if (session) {
        session.status = 'completed';
        session.endedAt = new Date().toISOString();
        if (outputSize !== undefined) session.outputSize = outputSize;
      }
    }),
    getHistory: vi.fn(() => [...history]),
    clearHistory: vi.fn(async () => {
      history.length = 0;
    }),
  };
}

describe('API Endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let mockSessionManager: ReturnType<typeof createMockSessionManager>;
  let mockHistoryManager: ReturnType<typeof createMockHistoryManager>;
  let mockBroadcast: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSessionManager = createMockSessionManager();
    mockHistoryManager = createMockHistoryManager();
    mockBroadcast = vi.fn();

    app = createApp({
      sessionManager: mockSessionManager as unknown as AppDependencies['sessionManager'],
      historyManager: mockHistoryManager as unknown as AppDependencies['historyManager'],
      getPlatformInfo: () => ({ platform: 'windows', isWindows: true, shell: 'powershell.exe' }),
      broadcastToClients: mockBroadcast,
    });
  });

  describe('GET /api/sessions', () => {
    it('should return empty array when no sessions', async () => {
      const res = await app.request('/api/sessions');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({ sessions: [] });
    });

    it('should return all sessions', async () => {
      // Create some sessions first
      mockSessionManager.createSession('/path/to/project1');
      mockSessionManager.createSession('/path/to/project2');

      const res = await app.request('/api/sessions');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.sessions).toHaveLength(2);
    });
  });

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/path/to/project' }),
      });

      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.session).toBeDefined();
      expect(data.session.cwd).toBe('/path/to/project');
      expect(data.session.status).toBe('running');
    });

    it('should return 400 if cwd is missing', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('cwd is required');
    });

    it('should return 400 for invalid JSON', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(res.status).toBe(400);
    });

    it('should broadcast session creation', async () => {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/path/to/project' }),
      });

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:created',
          session: expect.objectContaining({ cwd: '/path/to/project' }),
        })
      );
    });

    it('should save session to history', async () => {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: '/path/to/project' }),
      });

      expect(mockHistoryManager.saveSession).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should delete an existing session', async () => {
      // Create a session first
      const session = mockSessionManager.createSession('/path/to/project');

      const res = await app.request(`/api/sessions/${session.id}`, {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const res = await app.request('/api/sessions/non-existent-id', {
        method: 'DELETE',
      });

      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toBe('Session not found');
    });

    it('should broadcast session deletion', async () => {
      const session = mockSessionManager.createSession('/path/to/project');

      await app.request(`/api/sessions/${session.id}`, {
        method: 'DELETE',
      });

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session:deleted',
          sessionId: session.id,
        })
      );
    });
  });

  describe('GET /api/history', () => {
    it('should return empty array when no history', async () => {
      const res = await app.request('/api/history');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({ history: [] });
    });

    it('should return history entries', async () => {
      // Add some history entries
      await mockHistoryManager.saveSession({
        id: 'session-1',
        cwd: '/path/to/project',
        status: 'completed',
        createdAt: new Date().toISOString(),
        outputSize: 1000,
      });

      const res = await app.request('/api/history');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.history).toHaveLength(1);
      expect(data.history[0].cwd).toBe('/path/to/project');
    });
  });

  describe('DELETE /api/history', () => {
    it('should clear all history', async () => {
      // Add some history
      await mockHistoryManager.saveSession({
        id: 'session-1',
        cwd: '/path/to/project',
        status: 'completed',
        createdAt: new Date().toISOString(),
        outputSize: 1000,
      });

      const res = await app.request('/api/history', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(mockHistoryManager.clearHistory).toHaveBeenCalled();
    });
  });

  describe('GET /api/platform', () => {
    it('should return platform info', async () => {
      const res = await app.request('/api/platform');
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({
        platform: 'windows',
        isWindows: true,
        shell: 'powershell.exe',
      });
    });
  });

  describe('POST /api/notify', () => {
    it('should update session status to waiting', async () => {
      const session = mockSessionManager.createSession('/path/to/project');

      const res = await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'waiting', cwd: '/path/to/project' }),
      });

      expect(res.status).toBe(200);
      expect(mockSessionManager.updateStatus).toHaveBeenCalledWith(session.id, 'waiting');
    });

    it('should update session status to running', async () => {
      const session = mockSessionManager.createSession('/path/to/project');
      session.status = 'waiting';

      const res = await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'running', cwd: '/path/to/project' }),
      });

      expect(res.status).toBe(200);
      expect(mockSessionManager.updateStatus).toHaveBeenCalledWith(session.id, 'running');
    });

    it('should update session status to completed', async () => {
      const session = mockSessionManager.createSession('/path/to/project');

      const res = await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'completed', cwd: '/path/to/project' }),
      });

      expect(res.status).toBe(200);
      expect(mockSessionManager.updateStatus).toHaveBeenCalledWith(session.id, 'completed');
    });

    it('should broadcast notification', async () => {
      mockSessionManager.createSession('/path/to/project');

      await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'waiting', cwd: '/path/to/project' }),
      });

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'notification',
          notifyType: 'waiting',
          status: 'waiting',
        })
      );
    });

    it('should succeed even if session not found', async () => {
      const res = await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'waiting', cwd: '/unknown/path' }),
      });

      expect(res.status).toBe(200);
    });

    it('should return 400 for invalid JSON', async () => {
      const res = await app.request('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(res.status).toBe(400);
    });
  });
});
