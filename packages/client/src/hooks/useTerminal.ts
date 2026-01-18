import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export interface UseTerminalOptions {
  onResize?: (cols: number, rows: number) => void;
}

export interface UseTerminalReturn {
  terminalRef: React.RefObject<HTMLDivElement>;
  write: (data: string) => void;
  clear: () => void;
}

const TERMINAL_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#1e1e1e',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  black: '#1e1e1e',
  red: '#f44747',
  green: '#6a9955',
  yellow: '#dcdcaa',
  blue: '#569cd6',
  magenta: '#c586c0',
  cyan: '#4ec9b0',
  white: '#d4d4d4',
  brightBlack: '#808080',
  brightRed: '#f44747',
  brightGreen: '#6a9955',
  brightYellow: '#dcdcaa',
  brightBlue: '#569cd6',
  brightMagenta: '#c586c0',
  brightCyan: '#4ec9b0',
  brightWhite: '#ffffff',
};

export function useTerminal(options: UseTerminalOptions = {}): UseTerminalReturn {
  const { onResize } = options;
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const write = useCallback((data: string) => {
    termRef.current?.write(data);
    termRef.current?.scrollToBottom();
  }, []);

  const clear = useCallback(() => {
    termRef.current?.clear();
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: false,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      disableStdin: true,
      scrollback: 5000,
      theme: TERMINAL_THEME,
    });

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    // Initial fit with a small delay to ensure container is sized
    setTimeout(() => fitAddon.fit(), 0);

    termRef.current = term;

    // リサイズ時にサーバーに通知
    const notifyResize = () => {
      fitAddon.fit();
      const { cols, rows } = term;
      if (onResize && cols > 0 && rows > 0) {
        onResize(cols, rows);
      }
    };

    const handleResize = () => {
      notifyResize();
    };
    window.addEventListener('resize', handleResize);

    // Use ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      notifyResize();
    });
    resizeObserver.observe(terminalRef.current);

    // 初期サイズを通知
    setTimeout(() => {
      notifyResize();
    }, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [onResize]);

  return {
    terminalRef: terminalRef as React.RefObject<HTMLDivElement>,
    write,
    clear,
  };
}
