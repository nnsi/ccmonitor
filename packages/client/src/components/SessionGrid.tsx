import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { TerminalTile, TerminalTileHandle } from './TerminalTile';
import { Session } from '../api/sessions';

interface Props {
  sessions: Session[];
  onInput: (sessionId: string, data: string) => void;
  onDelete: (sessionId: string) => void;
  onSubscribe: (sessionId: string) => void;
  onUnsubscribe: (sessionId: string) => void;
}

export interface SessionGridHandle {
  writeToTerminal: (sessionId: string, data: string) => void;
}

export const SessionGrid = forwardRef<SessionGridHandle, Props>(
  function SessionGrid({ sessions, onInput, onDelete, onSubscribe, onUnsubscribe }, ref) {
    const terminalRefs = useRef<Map<string, TerminalTileHandle>>(new Map());
    const subscribedIds = useRef<Set<string>>(new Set());

    // Expose method to write to specific terminal
    useImperativeHandle(ref, () => ({
      writeToTerminal: (sessionId: string, data: string) => {
        const terminal = terminalRefs.current.get(sessionId);
        console.log('[DEBUG] writeToTerminal:', sessionId, 'terminal exists:', !!terminal, 'data length:', data.length);
        terminal?.write(data);
      }
    }), []);

    // Subscribe to new sessions and unsubscribe from removed ones
    useEffect(() => {
      const currentIds = new Set(sessions.map(s => s.id));

      // Subscribe to new sessions
      currentIds.forEach(id => {
        if (!subscribedIds.current.has(id)) {
          onSubscribe(id);
          subscribedIds.current.add(id);
        }
      });

      // Unsubscribe from removed sessions and clean up refs
      subscribedIds.current.forEach(id => {
        if (!currentIds.has(id)) {
          onUnsubscribe(id);
          subscribedIds.current.delete(id);
          terminalRefs.current.delete(id);
        }
      });
    }, [sessions, onSubscribe, onUnsubscribe]);

    const setTerminalRef = useCallback((sessionId: string, handle: TerminalTileHandle | null) => {
      if (handle) {
        terminalRefs.current.set(sessionId, handle);
      } else {
        terminalRefs.current.delete(sessionId);
      }
    }, []);

    // Determine grid columns based on session count
    const getGridClass = () => {
      const count = sessions.length;
      if (count === 1) {
        return 'grid-cols-1';
      } else if (count === 2) {
        return 'grid-cols-1 md:grid-cols-2';
      } else if (count <= 4) {
        return 'grid-cols-1 md:grid-cols-2';
      } else {
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      }
    };

    // Determine row configuration
    const getGridRows = () => {
      const count = sessions.length;
      if (count <= 2) {
        return '';
      } else if (count <= 4) {
        return 'grid-rows-2';
      } else {
        return 'grid-rows-2';
      }
    };

    return (
      <div className={`grid ${getGridClass()} ${getGridRows()} gap-4 h-full`}>
        {sessions.map(session => (
          <TerminalTile
            key={session.id}
            ref={(handle) => setTerminalRef(session.id, handle)}
            sessionId={session.id}
            cwd={session.cwd}
            status={session.status}
            onData={(data) => onInput(session.id, data)}
            onDelete={() => onDelete(session.id)}
          />
        ))}
      </div>
    );
  }
);
