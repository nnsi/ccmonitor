import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../test/test-utils';
import { SessionGrid, SessionGridHandle } from './SessionGrid';
import { createRef } from 'react';

// Mock TerminalTile since it has complex dependencies
vi.mock('./TerminalTile', () => ({
  TerminalTile: vi.fn().mockImplementation(
    ({ sessionId, cwd, status, onDelete }) => (
      <div data-testid={`terminal-tile-${sessionId}`}>
        <span data-testid="cwd">{cwd}</span>
        <span data-testid="status">{status}</span>
        <button onClick={onDelete} data-testid="delete-button">
          Delete
        </button>
      </div>
    )
  ),
}));

describe('SessionGrid', () => {
  const mockOnInput = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnSubscribe = vi.fn();
  const mockOnUnsubscribe = vi.fn();
  const mockOnResize = vi.fn();

  const defaultProps = {
    sessions: [],
    onInput: mockOnInput,
    onDelete: mockOnDelete,
    onSubscribe: mockOnSubscribe,
    onUnsubscribe: mockOnUnsubscribe,
    onResize: mockOnResize,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty grid when no sessions', () => {
    render(<SessionGrid {...defaultProps} />);

    const grid = document.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.children.length).toBe(0);
  });

  it('should render session tiles for each session', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
      { id: 'session-2', cwd: '/path/to/project2', status: 'waiting' as const, createdAt: '2024-01-01' },
    ];

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    expect(screen.getByTestId('terminal-tile-session-1')).toBeInTheDocument();
    expect(screen.getByTestId('terminal-tile-session-2')).toBeInTheDocument();
  });

  it('should subscribe to new sessions when added', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    expect(mockOnSubscribe).toHaveBeenCalledWith('session-1');
  });

  it('should unsubscribe when sessions are removed', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    const { rerender } = render(<SessionGrid {...defaultProps} sessions={sessions} />);

    // Remove the session
    rerender(<SessionGrid {...defaultProps} sessions={[]} />);

    expect(mockOnUnsubscribe).toHaveBeenCalledWith('session-1');
  });

  it('should call onDelete when delete button is clicked', async () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    const deleteButton = screen.getByTestId('delete-button');
    deleteButton.click();

    expect(mockOnDelete).toHaveBeenCalledWith('session-1');
  });

  it('should apply correct grid columns for 1 session', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    const grid = document.querySelector('.grid');
    expect(grid?.classList.contains('grid-cols-1')).toBe(true);
  });

  it('should apply correct grid columns for 2 sessions', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/1', status: 'running' as const, createdAt: '2024-01-01' },
      { id: 'session-2', cwd: '/path/2', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    const grid = document.querySelector('.grid');
    expect(grid?.classList.contains('md:grid-cols-2')).toBe(true);
  });

  it('should apply correct grid columns for 5+ sessions', () => {
    const sessions = Array.from({ length: 5 }, (_, i) => ({
      id: `session-${i}`,
      cwd: `/path/${i}`,
      status: 'running' as const,
      createdAt: '2024-01-01',
    }));

    render(<SessionGrid {...defaultProps} sessions={sessions} />);

    const grid = document.querySelector('.grid');
    expect(grid?.classList.contains('lg:grid-cols-3')).toBe(true);
  });

  it('should expose writeToTerminal via ref', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    const ref = createRef<SessionGridHandle>();
    render(<SessionGrid {...defaultProps} sessions={sessions} ref={ref} />);

    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.writeToTerminal).toBe('function');
  });

  it('should not subscribe to same session twice', () => {
    const sessions = [
      { id: 'session-1', cwd: '/path/to/project1', status: 'running' as const, createdAt: '2024-01-01' },
    ];

    const { rerender } = render(<SessionGrid {...defaultProps} sessions={sessions} />);

    // Rerender with same sessions
    rerender(<SessionGrid {...defaultProps} sessions={sessions} />);

    // Should only subscribe once
    expect(mockOnSubscribe).toHaveBeenCalledTimes(1);
  });
});
