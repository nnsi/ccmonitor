import { useEffect } from 'react';
import { useHistory, useClearHistory } from '../api/history';
import type { SessionStatus } from '@ccmonitor/shared';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'running':
      return 'text-green-400';
    case 'waiting':
      return 'text-yellow-400';
    case 'completed':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}

function getStatusBgColor(status: SessionStatus): string {
  switch (status) {
    case 'running':
      return 'bg-green-400/20';
    case 'waiting':
      return 'bg-yellow-400/20';
    case 'completed':
      return 'bg-gray-400/20';
    default:
      return 'bg-gray-400/20';
  }
}

export function HistoryModal({ isOpen, onClose }: Props) {
  const { data: history = [], isLoading, refetch } = useHistory();
  const clearHistory = useClearHistory();

  // Refetch when modal opens
  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      clearHistory.mutate();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-3xl shadow-xl border border-gray-700 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Session History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearHistory}
              disabled={history.length === 0 || clearHistory.isPending}
              className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear History
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              Loading...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No history records</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-700/50 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-400 mb-1 truncate" title={item.cwd}>
                        {item.cwd}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className={`px-2 py-0.5 rounded ${getStatusBgColor(item.status)} ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        <span title="Output size">
                          {formatBytes(item.outputSize)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs text-gray-400 mt-3">
                    <div>
                      <span className="text-gray-500">Created: </span>
                      {formatDateTime(item.createdAt)}
                    </div>
                    {item.endedAt && (
                      <div>
                        <span className="text-gray-500">Ended: </span>
                        {formatDateTime(item.endedAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
