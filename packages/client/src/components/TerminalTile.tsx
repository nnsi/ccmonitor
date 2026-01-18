import { useEffect, useRef, useImperativeHandle, forwardRef, useState, KeyboardEvent } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  sessionId: string;
  cwd: string;
  status: 'running' | 'waiting' | 'completed';
  onData: (data: string) => void;
  onDelete: () => void;
}

export interface TerminalTileHandle {
  write: (data: string) => void;
  clear: () => void;
}

export const TerminalTile = forwardRef<TerminalTileHandle, Props>(
  function TerminalTile({ sessionId, cwd, status, onData, onDelete }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        termRef.current?.write(data);
      },
      clear: () => {
        termRef.current?.clear();
      }
    }), []);

    useEffect(() => {
      if (!terminalRef.current) return;

      const term = new Terminal({
        cursorBlink: false, // 出力専用なのでカーソル不要
        fontSize: 13,
        fontFamily: 'Consolas, "Courier New", monospace',
        disableStdin: true, // 入力を無効化
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#1e1e1e', // カーソルを背景色と同じに
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
          brightWhite: '#ffffff'
        }
      });

      const fitAddon = new FitAddon();
      fitAddonRef.current = fitAddon;
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);

      // Initial fit with a small delay to ensure container is sized
      setTimeout(() => fitAddon.fit(), 0);

      termRef.current = term;

      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener('resize', handleResize);

      // Use ResizeObserver for container size changes
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserver.observe(terminalRef.current);

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        term.dispose();
      };
    }, [sessionId]);

    // Windows ConPTY win32-input-mode のEnterシーケンス
    // ESC [ Vk ; Sc ; Uc ; Kd ; Cs ; Rc _
    // Vk=13(VK_RETURN), Sc=28, Uc=13(\r), Kd=1(keydown), Cs=0, Rc=1
    const WIN32_ENTER_DOWN = '\x1b[13;28;13;1;0;1_';
    const WIN32_ENTER_UP = '\x1b[13;28;13;0;0;1_';

    // 入力送信
    const handleSend = () => {
      // テキストを送信後、win32-input-mode形式のEnterを送信
      onData(inputValue);
      onData(WIN32_ENTER_DOWN);
      onData(WIN32_ENTER_UP);
      setInputValue('');
      inputRef.current?.focus();
    };

    // Enterキーで送信
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    // 特殊キー送信
    const sendSpecialKey = (key: string) => {
      onData(key);
      inputRef.current?.focus();
    };

    const statusColor = {
      running: 'bg-green-500',
      waiting: 'bg-yellow-500',
      completed: 'bg-gray-500'
    }[status];

    const statusText = {
      running: 'Running',
      waiting: 'Waiting',
      completed: 'Completed'
    }[status];

    return (
      <div className="flex flex-col h-full bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-700">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`}
              title={statusText}
            />
            <span className="text-sm text-gray-300 truncate" title={cwd}>
              {cwd}
            </span>
          </div>
          <button
            onClick={onDelete}
            className="text-gray-400 hover:text-red-400 ml-2 flex-shrink-0 p-1"
            title="Close session"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Terminal Output (出力専用) */}
        <div ref={terminalRef} className="flex-1 p-1 min-h-0" />

        {/* Input Area */}
        <div className="border-t border-gray-700 bg-gray-800 p-2">
          {/* 特殊キーボタン */}
          <div className="flex gap-1 mb-2 flex-wrap">
            <button
              onClick={() => sendSpecialKey('\x1b')} // Escape
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="Send Escape key"
            >
              Esc
            </button>
            <button
              onClick={() => sendSpecialKey('\x03')} // Ctrl+C
              className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 rounded text-gray-200 transition-colors"
              title="Send Ctrl+C (interrupt)"
            >
              Ctrl+C
            </button>
            <button
              onClick={() => sendSpecialKey('\x04')} // Ctrl+D
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="Send Ctrl+D (EOF)"
            >
              Ctrl+D
            </button>
            <button
              onClick={() => sendSpecialKey('\t')} // Tab
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="Send Tab (autocomplete)"
            >
              Tab
            </button>
            <div className="border-l border-gray-600 mx-1" />
            <button
              onClick={() => {
                onData('y');
                onData(WIN32_ENTER_DOWN);
                onData(WIN32_ENTER_UP);
                inputRef.current?.focus();
              }}
              className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 rounded text-gray-200 transition-colors"
              title="Send 'y' + Enter"
            >
              Yes
            </button>
            <button
              onClick={() => {
                onData('n');
                onData(WIN32_ENTER_DOWN);
                onData(WIN32_ENTER_UP);
                inputRef.current?.focus();
              }}
              className="px-2 py-1 text-xs bg-yellow-700 hover:bg-yellow-600 rounded text-gray-200 transition-colors"
              title="Send 'n' + Enter"
            >
              No
            </button>
          </div>

          {/* テキスト入力 */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command and press Enter..."
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSend}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    );
  }
);
