import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { HistoryModal } from './HistoryModal';

// Mock the history hooks
vi.mock('../api/history', () => ({
  useHistory: vi.fn(),
  useClearHistory: vi.fn(),
}));

import { useHistory, useClearHistory } from '../api/history';

const mockUseHistory = useHistory as ReturnType<typeof vi.fn>;
const mockUseClearHistory = useClearHistory as ReturnType<typeof vi.fn>;

describe('HistoryModal', () => {
  const mockOnClose = vi.fn();
  const mockRefetch = vi.fn();
  const mockClearMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockUseHistory.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: mockRefetch,
    });

    mockUseClearHistory.mockReturnValue({
      mutate: mockClearMutate,
      isPending: false,
    });
  });

  it('should not render when isOpen is false', () => {
    render(<HistoryModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Session History')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Session History')).toBeInTheDocument();
    expect(screen.getByText('Clear History')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseHistory.mockReturnValue({
      data: [],
      isLoading: true,
      refetch: mockRefetch,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show empty state when no history', () => {
    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('No history records')).toBeInTheDocument();
  });

  it('should show history items', () => {
    mockUseHistory.mockReturnValue({
      data: [
        {
          id: 'session-1',
          cwd: '/path/to/project1',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          endedAt: '2024-01-01T11:00:00Z',
          outputSize: 1024,
        },
        {
          id: 'session-2',
          cwd: '/path/to/project2',
          status: 'running',
          createdAt: '2024-01-01T12:00:00Z',
          outputSize: 2048,
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('/path/to/project1')).toBeInTheDocument();
    expect(screen.getByText('/path/to/project2')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('1 KB')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('should call onClose when X button is clicked', async () => {
    const user = userEvent.setup();

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    // Find the close button (the one with X icon after Clear History button)
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find(
      (btn) => btn.classList.contains('text-gray-400') && btn.querySelector('svg')
    );
    if (xButton) {
      await user.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    const backdrop = screen.getByText('Session History').closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should close on Escape key', () => {
    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call clearHistory when Clear History button is clicked and confirmed', async () => {
    const user = userEvent.setup();

    mockUseHistory.mockReturnValue({
      data: [
        {
          id: 'session-1',
          cwd: '/path/to/project',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 1024,
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    const clearButton = screen.getByText('Clear History');
    await user.click(clearButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockClearMutate).toHaveBeenCalled();
  });

  it('should not call clearHistory when confirmation is cancelled', async () => {
    const user = userEvent.setup();

    // Mock confirm to return false
    vi.mocked(global.confirm).mockReturnValueOnce(false);

    mockUseHistory.mockReturnValue({
      data: [
        {
          id: 'session-1',
          cwd: '/path/to/project',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 1024,
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    const clearButton = screen.getByText('Clear History');
    await user.click(clearButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(mockClearMutate).not.toHaveBeenCalled();
  });

  it('should disable Clear History button when no history', () => {
    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    const clearButton = screen.getByText('Clear History');
    expect(clearButton).toBeDisabled();
  });

  it('should disable Clear History button when clearing is pending', () => {
    mockUseHistory.mockReturnValue({
      data: [
        {
          id: 'session-1',
          cwd: '/path/to/project',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 1024,
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    mockUseClearHistory.mockReturnValue({
      mutate: mockClearMutate,
      isPending: true,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    const clearButton = screen.getByText('Clear History');
    expect(clearButton).toBeDisabled();
  });

  it('should refetch history when modal opens', () => {
    const { rerender } = render(
      <HistoryModal isOpen={false} onClose={mockOnClose} />
    );

    rerender(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('should format bytes correctly', () => {
    mockUseHistory.mockReturnValue({
      data: [
        {
          id: 'session-1',
          cwd: '/path/1',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 0,
        },
        {
          id: 'session-2',
          cwd: '/path/2',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 512,
        },
        {
          id: 'session-3',
          cwd: '/path/3',
          status: 'completed',
          createdAt: '2024-01-01T10:00:00Z',
          outputSize: 1048576, // 1 MB
        },
      ],
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<HistoryModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.getByText('512 B')).toBeInTheDocument();
    expect(screen.getByText('1 MB')).toBeInTheDocument();
  });
});
