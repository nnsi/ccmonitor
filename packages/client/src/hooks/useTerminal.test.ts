import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTerminal } from './useTerminal';

// Mock xterm.js with proper class implementation
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: class MockTerminal {
      loadAddon = vi.fn();
      open = vi.fn();
      write = vi.fn();
      clear = vi.fn();
      dispose = vi.fn();
      scrollToBottom = vi.fn();
      cols = 80;
      rows = 24;
    },
  };
});

vi.mock('@xterm/addon-fit', () => {
  return {
    FitAddon: class MockFitAddon {
      fit = vi.fn();
    },
  };
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('useTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return terminalRef, write and clear functions', () => {
    const { result } = renderHook(() => useTerminal());

    expect(result.current.terminalRef).toBeDefined();
    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('should accept onResize option', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() => useTerminal({ onResize }));

    expect(result.current.terminalRef).toBeDefined();
    expect(typeof result.current.write).toBe('function');
    expect(typeof result.current.clear).toBe('function');
  });

  it('should return stable function references', () => {
    const { result, rerender } = renderHook(() => useTerminal());

    const write1 = result.current.write;
    const clear1 = result.current.clear;

    rerender();

    const write2 = result.current.write;
    const clear2 = result.current.clear;

    // useCallback should return stable references
    expect(write1).toBe(write2);
    expect(clear1).toBe(clear2);
  });
});
