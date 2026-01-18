import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { TerminalTile, TerminalTileHandle } from './TerminalTile';
import { createRef } from 'react';

// Mock useTerminal hook - this is the key to making TerminalTile testable
const mockWrite = vi.fn();
const mockClear = vi.fn();
const mockTerminalRef = { current: document.createElement('div') };

vi.mock('../hooks/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    terminalRef: mockTerminalRef,
    write: mockWrite,
    clear: mockClear,
  })),
}));

// Mock platform module
vi.mock('../lib/platform', () => {
  class MockInputSequences {
    static ESCAPE = '\x1b';
    static CTRL_C = '\x03';
    static CTRL_D = '\x04';
    static TAB = '\t';

    getTextWithEnter(text: string): string[] {
      return [text, '\r'];
    }
  }

  return {
    getPlatformInfo: () => ({
      platform: 'windows',
      isWindows: true,
      shell: 'powershell.exe',
    }),
    InputSequences: MockInputSequences,
  };
});

describe('TerminalTile', () => {
  const mockOnData = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnResize = vi.fn();

  const defaultProps = {
    sessionId: 'session-1',
    cwd: '/path/to/project',
    status: 'running' as const,
    onData: mockOnData,
    onDelete: mockOnDelete,
    onResize: mockOnResize,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with cwd', () => {
    render(<TerminalTile {...defaultProps} />);
    expect(screen.getByText('/path/to/project')).toBeInTheDocument();
  });

  it('should show running status with green indicator', () => {
    render(<TerminalTile {...defaultProps} status="running" />);
    const indicator = document.querySelector('.bg-green-500');
    expect(indicator).toBeInTheDocument();
  });

  it('should show waiting status with yellow indicator', () => {
    render(<TerminalTile {...defaultProps} status="waiting" />);
    const indicator = document.querySelector('.bg-yellow-500');
    expect(indicator).toBeInTheDocument();
  });

  it('should show completed status with gray indicator', () => {
    render(<TerminalTile {...defaultProps} status="completed" />);
    const indicator = document.querySelector('.bg-gray-500');
    expect(indicator).toBeInTheDocument();
  });

  it('should have highlighted border when waiting', () => {
    render(<TerminalTile {...defaultProps} status="waiting" />);
    const tile = document.querySelector('.border-yellow-500');
    expect(tile).toBeInTheDocument();
  });

  it('should apply opacity when completed', () => {
    render(<TerminalTile {...defaultProps} status="completed" />);
    const tile = document.querySelector('.opacity-60');
    expect(tile).toBeInTheDocument();
  });

  it('should call onDelete when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const closeButton = screen.getByTitle('Close session');
    await user.click(closeButton);

    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('should have special key buttons', () => {
    render(<TerminalTile {...defaultProps} />);

    expect(screen.getByTitle(/Esc/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Ctrl\+C/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Ctrl\+D/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Tab/i)).toBeInTheDocument();
  });

  it('should send Escape when back button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const escButton = screen.getByTitle(/Esc/i);
    await user.click(escButton);

    expect(mockOnData).toHaveBeenCalledWith('\x1b');
  });

  it('should send Ctrl+C when interrupt button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const ctrlCButton = screen.getByTitle(/Ctrl\+C/i);
    await user.click(ctrlCButton);

    expect(mockOnData).toHaveBeenCalledWith('\x03');
  });

  it('should send Ctrl+D when exit button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const ctrlDButton = screen.getByTitle(/Ctrl\+D/i);
    await user.click(ctrlDButton);

    expect(mockOnData).toHaveBeenCalledWith('\x04');
  });

  it('should send Tab when autocomplete button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const tabButton = screen.getByTitle(/Tab/i);
    await user.click(tabButton);

    expect(mockOnData).toHaveBeenCalledWith('\t');
  });

  it('should have Yes/No quick buttons', () => {
    render(<TerminalTile {...defaultProps} />);

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should send "y" with Enter when Yes button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const yesButton = screen.getByText('Yes');
    await user.click(yesButton);

    expect(mockOnData).toHaveBeenCalledWith('y');
    expect(mockOnData).toHaveBeenCalledWith('\r');
  });

  it('should send "n" with Enter when No button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const noButton = screen.getByText('No');
    await user.click(noButton);

    expect(mockOnData).toHaveBeenCalledWith('n');
    expect(mockOnData).toHaveBeenCalledWith('\r');
  });

  it('should have number buttons 1-4 for choices', () => {
    render(<TerminalTile {...defaultProps} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should send number with Enter when number button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const button1 = screen.getByText('1');
    await user.click(button1);

    expect(mockOnData).toHaveBeenCalledWith('1');
    expect(mockOnData).toHaveBeenCalledWith('\r');
  });

  it('should send text when Send button is clicked', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Type command/i);
    await user.type(input, 'hello');
    await user.click(screen.getByText('Send'));

    expect(mockOnData).toHaveBeenCalledWith('hello');
    expect(mockOnData).toHaveBeenCalledWith('\r');
  });

  it('should send text on Enter key', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Type command/i);
    await user.type(input, 'hello{enter}');

    expect(mockOnData).toHaveBeenCalledWith('hello');
    expect(mockOnData).toHaveBeenCalledWith('\r');
  });

  it('should clear input after sending', async () => {
    const user = userEvent.setup();
    render(<TerminalTile {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Type command/i) as HTMLInputElement;
    await user.type(input, 'hello');
    expect(input.value).toBe('hello');

    await user.click(screen.getByText('Send'));
    expect(input.value).toBe('');
  });

  it('should expose write and clear methods via ref', () => {
    const ref = createRef<TerminalTileHandle>();
    render(<TerminalTile {...defaultProps} ref={ref} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.write).toBe('function');
    expect(typeof ref.current?.clear).toBe('function');
  });

  it('should call mockWrite when write is called via ref', () => {
    const ref = createRef<TerminalTileHandle>();
    render(<TerminalTile {...defaultProps} ref={ref} />);

    ref.current?.write('test data');
    expect(mockWrite).toHaveBeenCalledWith('test data');
  });

  it('should call mockClear when clear is called via ref', () => {
    const ref = createRef<TerminalTileHandle>();
    render(<TerminalTile {...defaultProps} ref={ref} />);

    ref.current?.clear();
    expect(mockClear).toHaveBeenCalled();
  });
});
