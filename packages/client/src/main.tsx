import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSessions, useCreateSession, useDeleteSession } from './api/sessions';
import { useWebSocket, WebSocketMessage } from './hooks/useWebSocket';
import { SessionGrid, SessionGridHandle } from './components/SessionGrid';
import { NewSessionModal } from './components/NewSessionModal';
import { HistoryModal } from './components/HistoryModal';
import { fetchPlatformInfo } from './lib/platform';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const { data: sessions = [], refetch } = useSessions();

  // アプリケーション起動時にプラットフォーム情報を取得
  useEffect(() => {
    fetchPlatformInfo().then((info) => {
      console.log('[Platform] Server platform:', info.platform);
    });
  }, []);
  const createSession = useCreateSession();
  const deleteSession = useDeleteSession();

  const sessionGridRef = useRef<SessionGridHandle>(null);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    if (message.type === 'session:data' && message.sessionId && message.data) {
      console.log('[DEBUG] session:data received:', message.sessionId, 'length:', message.data.length);
      sessionGridRef.current?.writeToTerminal(message.sessionId, message.data);
    } else if (
      message.type === 'session:created' ||
      message.type === 'session:deleted' ||
      message.type === 'session:updated' ||
      message.type === 'notification'
    ) {
      refetch();
    }
  }, [refetch]);

  const { send } = useWebSocket(handleMessage);

  const handleInput = useCallback((sessionId: string, data: string) => {
    console.log('[DEBUG] handleInput called:', sessionId, 'data:', JSON.stringify(data));
    send({ type: 'input', sessionId, data });
  }, [send]);

  const handleSubscribe = useCallback((sessionId: string) => {
    send({ type: 'subscribe', sessionId });
  }, [send]);

  const handleUnsubscribe = useCallback((sessionId: string) => {
    send({ type: 'unsubscribe', sessionId });
  }, [send]);

  const handleResize = useCallback((sessionId: string, cols: number, rows: number) => {
    send({ type: 'resize', sessionId, cols, rows });
  }, [send]);

  const handleCreate = useCallback((cwd: string) => {
    createSession.mutate(cwd);
  }, [createSession]);

  const handleDelete = useCallback((id: string) => {
    deleteSession.mutate(id);
  }, [deleteSession]);

  const canCreateMore = sessions.length < 6;

  return (
    <div className="h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">ccmonitor</h1>
          <span className="text-sm text-gray-500">
            {sessions.length} / 6 sessions
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            History
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!canCreateMore}
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Session
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg mb-2">No active sessions</p>
            <p className="text-sm">Click "New Session" to start monitoring a Claude Code session.</p>
          </div>
        ) : (
          <SessionGrid
            ref={sessionGridRef}
            sessions={sessions}
            onInput={handleInput}
            onDelete={handleDelete}
            onSubscribe={handleSubscribe}
            onUnsubscribe={handleUnsubscribe}
            onResize={handleResize}
          />
        )}
      </main>

      <NewSessionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreate}
      />

      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
