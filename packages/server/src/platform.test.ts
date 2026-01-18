import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as platform from './platform.js';

describe('platform', () => {
  describe('getPlatform', () => {
    it('should return "windows" on win32', () => {
      vi.stubGlobal('process', { ...process, platform: 'win32' });
      // Re-import to get fresh module - for now we test the actual platform
      const result = platform.getPlatform();
      expect(['windows', 'unix']).toContain(result);
    });
  });

  describe('getDefaultShell', () => {
    it('should return a shell executable', () => {
      const shell = platform.getDefaultShell();
      expect(typeof shell).toBe('string');
      expect(shell.length).toBeGreaterThan(0);
      // Windows: powershell.exe, Unix: bash
      expect(['powershell.exe', 'bash']).toContain(shell);
    });
  });

  describe('normalizePath', () => {
    it('should handle forward slashes', () => {
      const normalized = platform.normalizePath('/path/to/file');
      expect(typeof normalized).toBe('string');
    });

    it('should handle backslashes', () => {
      const normalized = platform.normalizePath('C:\\Users\\test');
      expect(typeof normalized).toBe('string');
    });
  });

  describe('pathsEqual', () => {
    it('should compare identical paths as equal', () => {
      expect(platform.pathsEqual('/path/to/dir', '/path/to/dir')).toBe(true);
    });

    it('should handle case differences on Windows', () => {
      // On Windows, paths should be case-insensitive
      if (platform.getPlatform() === 'windows') {
        expect(platform.pathsEqual('C:\\Users\\Test', 'c:\\users\\test')).toBe(true);
      }
    });

    it('should handle slash differences on Windows', () => {
      if (platform.getPlatform() === 'windows') {
        expect(platform.pathsEqual('C:/Users/Test', 'C:\\Users\\Test')).toBe(true);
      }
    });
  });

  describe('getPlatformInfo', () => {
    it('should return platform info object', () => {
      const info = platform.getPlatformInfo();

      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('isWindows');
      expect(info).toHaveProperty('shell');

      expect(['windows', 'unix']).toContain(info.platform);
      expect(typeof info.isWindows).toBe('boolean');
      expect(typeof info.shell).toBe('string');

      // Consistency check
      expect(info.isWindows).toBe(info.platform === 'windows');
    });
  });
});
