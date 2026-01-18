import { useEffect, useRef, useImperativeHandle, forwardRef, useState, KeyboardEvent, useMemo } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { getPlatformInfo, InputSequences } from '../lib/platform';

interface Props {
  sessionId: string;
  cwd: string;
  status: 'running' | 'waiting' | 'completed';
  onData: (data: string) => void;
  onDelete: () => void;
  onResize?: (cols: number, rows: number) => void;
}

export interface TerminalTileHandle {
  write: (data: string) => void;
  clear: () => void;
}

export const TerminalTile = forwardRef<TerminalTileHandle, Props>(
  function TerminalTile({ sessionId, cwd, status, onData, onDelete, onResize }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');

    // プラットフォームに応じた入力シーケンスを取得
    const inputSequences = useMemo(() => {
      const platformInfo = getPlatformInfo();
      return new InputSequences(platformInfo);
    }, []);

    useImperativeHandle(ref, () => ({
      write: (data: string) => {
        termRef.current?.write(data);
        // 自動スクロール
        termRef.current?.scrollToBottom();
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
        scrollback: 5000, // スクロールバックバッファを増やす
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
      };
    }, [sessionId, onResize]);

    // テキストとEnterを送信するヘルパー関数
    const sendTextWithEnter = (text: string) => {
      const sequences = inputSequences.getTextWithEnter(text);
      sequences.forEach(seq => onData(seq));
    };

    // 入力送信
    const handleSend = () => {
      sendTextWithEnter(inputValue);
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

    // タイル全体のスタイル（状態に応じて変更）
    const tileStyles = {
      running: 'border-gray-700 bg-gray-800',
      waiting: 'border-yellow-500 bg-yellow-950/30 ring-2 ring-yellow-500/50',
      completed: 'border-gray-600 bg-gray-900 opacity-60'
    }[status];

    const headerStyles = {
      running: 'bg-gray-700',
      waiting: 'bg-yellow-900/50',
      completed: 'bg-gray-800'
    }[status];

    return (
      <div className={`flex flex-col h-full rounded-lg overflow-hidden border-2 transition-all duration-300 ${tileStyles}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-3 py-2 ${headerStyles}`}>
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
              onClick={() => sendSpecialKey(InputSequences.ESCAPE)}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="Escキーを送信"
            >
              戻る
            </button>
            <button
              onClick={() => sendSpecialKey(InputSequences.CTRL_C)}
              className="px-2 py-1 text-xs bg-red-700 hover:bg-red-600 rounded text-gray-200 transition-colors"
              title="処理を中断 (Ctrl+C)"
            >
              中断
            </button>
            <button
              onClick={() => sendSpecialKey(InputSequences.CTRL_D)}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="入力終了/EOF送信 (Ctrl+D)"
            >
              終了
            </button>
            <button
              onClick={() => sendSpecialKey(InputSequences.TAB)}
              className="px-2 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200 transition-colors"
              title="自動補完 (Tab)"
            >
              補完
            </button>
            <div className="border-l border-gray-600 mx-1" />
            <button
              onClick={() => {
                sendTextWithEnter('y');
                inputRef.current?.focus();
              }}
              className="px-2 py-1 text-xs bg-green-700 hover:bg-green-600 rounded text-gray-200 transition-colors"
              title="'y' + Enterを送信"
            >
              Yes
            </button>
            <button
              onClick={() => {
                sendTextWithEnter('n');
                inputRef.current?.focus();
              }}
              className="px-2 py-1 text-xs bg-yellow-700 hover:bg-yellow-600 rounded text-gray-200 transition-colors"
              title="'n' + Enterを送信"
            >
              No
            </button>
            <div className="border-l border-gray-600 mx-1" />
            {/* 選択肢ボタン (1-4) */}
            {[1, 2, 3, 4].map((num) => (
              <button
                key={num}
                onClick={() => {
                  sendTextWithEnter(String(num));
                  inputRef.current?.focus();
                }}
                className="px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 rounded text-gray-200 transition-colors min-w-[28px]"
                title={`'${num}' + Enterを送信 (選択肢${num})`}
              >
                {num}
              </button>
            ))}
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
