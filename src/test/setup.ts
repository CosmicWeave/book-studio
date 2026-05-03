import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.matchMedia which jsdom doesn't implement
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock navigator.storage for storageService tests
const mockStorage = {
  estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
  persist: vi.fn().mockResolvedValue(true),
  persisted: vi.fn().mockResolvedValue(false),
};

Object.defineProperty(navigator, 'storage', {
  value: mockStorage,
  writable: true,
  configurable: true,
});
