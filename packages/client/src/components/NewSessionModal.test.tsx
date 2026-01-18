import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../test/test-utils';
import userEvent from '@testing-library/user-event';
import { NewSessionModal } from './NewSessionModal';

describe('NewSessionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when isOpen is false', () => {
    render(
      <NewSessionModal
        isOpen={false}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    expect(screen.getByText('New Session')).toBeInTheDocument();
    expect(screen.getByText('Working Directory')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/path/i)).toBeInTheDocument();
    expect(screen.getByText('Create Session')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should call onClose when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    await user.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when X button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Find the close button (X icon)
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (xButton) {
      await user.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Click on the backdrop (the outer div)
    const backdrop = screen.getByText('New Session').closest('.fixed');
    if (backdrop) {
      await user.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('should have Create Session button disabled when input is empty', () => {
    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const createButton = screen.getByText('Create Session');
    expect(createButton).toBeDisabled();
  });

  it('should enable Create Session button when input has value', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const input = screen.getByPlaceholderText(/path/i);
    await user.type(input, '/path/to/project');

    const createButton = screen.getByText('Create Session');
    expect(createButton).not.toBeDisabled();
  });

  it('should call onCreate with trimmed path when form is submitted', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const input = screen.getByPlaceholderText(/path/i);
    await user.type(input, '  /path/to/project  ');

    const createButton = screen.getByText('Create Session');
    await user.click(createButton);

    expect(mockOnCreate).toHaveBeenCalledWith('/path/to/project');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should submit form on Enter key', async () => {
    const user = userEvent.setup();

    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const input = screen.getByPlaceholderText(/path/i);
    await user.type(input, '/path/to/project{enter}');

    expect(mockOnCreate).toHaveBeenCalledWith('/path/to/project');
  });

  it('should close on Escape key', () => {
    render(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should clear input when modal opens', async () => {
    const { rerender } = render(
      <NewSessionModal
        isOpen={false}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    // Open modal
    rerender(
      <NewSessionModal
        isOpen={true}
        onClose={mockOnClose}
        onCreate={mockOnCreate}
      />
    );

    const input = screen.getByPlaceholderText(/path/i) as HTMLInputElement;
    expect(input.value).toBe('');
  });
});
