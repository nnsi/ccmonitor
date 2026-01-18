import { useEffect, useRef, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  data?: string;
  [key: string]: unknown;
}

type MessageHandler = (message: WebSocketMessage) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const onMessageRef = useRef<MessageHandler>(onMessage);
  const pendingMessagesRef = useRef<object[]>([]);

  // Keep the callback reference updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        // Send any pending messages
        while (pendingMessagesRef.current.length > 0) {
          const msg = pendingMessagesRef.current.shift();
          if (msg) {
            console.log('[WebSocket] Sending pending message:', msg);
            ws.send(JSON.stringify(msg));
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          onMessageRef.current(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[WebSocket] Disconnected, reconnecting in 3s...');
        reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message to be sent when connection is established
      console.log('[WebSocket] Queuing message:', message);
      pendingMessagesRef.current.push(message);
    }
  }, []);

  return { send };
}
