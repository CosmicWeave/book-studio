import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getStorageStats,
  requestPersistentStorage,
  checkPersistence,
  formatBytes,
} from '@/services/storageService';

// navigator.storage is mocked in src/test/setup.ts

describe('formatBytes()', () => {
  it('returns "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 Bytes');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 ** 3)).toBe('1 GB');
  });

  it('respects decimal precision', () => {
    expect(formatBytes(1536, 1)).toBe('1.5 KB');
  });

  it('handles 0 decimal places', () => {
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });
});

describe('getStorageStats()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns null when navigator.storage is unavailable', async () => {
    const origStorage = navigator.storage;
    Object.defineProperty(navigator, 'storage', { value: null, configurable: true });
    const result = await getStorageStats();
    expect(result).toBeNull();
    Object.defineProperty(navigator, 'storage', { value: origStorage, configurable: true });
  });

  it('returns correct stats when estimate() resolves', async () => {
    vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({
      usage: 512,
      quota: 1024,
    });

    const stats = await getStorageStats();
    expect(stats).not.toBeNull();
    expect(stats!.usage).toBe(512);
    expect(stats!.quota).toBe(1024);
    expect(stats!.percentUsed).toBeCloseTo(50, 1);
    expect(stats!.remaining).toBe(512);
  });

  it('returns null when estimate() throws', async () => {
    vi.spyOn(navigator.storage, 'estimate').mockRejectedValue(new Error('Quota error'));
    const result = await getStorageStats();
    expect(result).toBeNull();
  });

  it('handles zero quota gracefully', async () => {
    vi.spyOn(navigator.storage, 'estimate').mockResolvedValue({ usage: 0, quota: 0 });
    const stats = await getStorageStats();
    expect(stats!.percentUsed).toBe(0);
    expect(stats!.remaining).toBe(0);
  });
});

describe('requestPersistentStorage()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns false when navigator.storage.persist is unavailable', async () => {
    const origStorage = navigator.storage;
    Object.defineProperty(navigator, 'storage', { value: {}, configurable: true });
    const result = await requestPersistentStorage();
    expect(result).toBe(false);
    Object.defineProperty(navigator, 'storage', { value: origStorage, configurable: true });
  });

  it('returns true when permission is granted', async () => {
    vi.spyOn(navigator.storage, 'persist').mockResolvedValue(true);
    expect(await requestPersistentStorage()).toBe(true);
  });

  it('returns false when permission is denied', async () => {
    vi.spyOn(navigator.storage, 'persist').mockResolvedValue(false);
    expect(await requestPersistentStorage()).toBe(false);
  });

  it('returns false when persist() throws', async () => {
    vi.spyOn(navigator.storage, 'persist').mockRejectedValue(new Error('denied'));
    expect(await requestPersistentStorage()).toBe(false);
  });
});

describe('checkPersistence()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns false when navigator.storage is unavailable', async () => {
    const orig = navigator.storage;
    Object.defineProperty(navigator, 'storage', { value: null, configurable: true });
    expect(await checkPersistence()).toBe(false);
    Object.defineProperty(navigator, 'storage', { value: orig, configurable: true });
  });

  it('returns true when storage is already persisted', async () => {
    vi.spyOn(navigator.storage, 'persisted').mockResolvedValue(true);
    expect(await checkPersistence()).toBe(true);
  });

  it('returns false when storage is not persisted', async () => {
    vi.spyOn(navigator.storage, 'persisted').mockResolvedValue(false);
    expect(await checkPersistence()).toBe(false);
  });
});
