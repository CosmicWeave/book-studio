import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the module factory so each test gets a fresh singleton
async function freshToastService() {
  // Dynamically re-import to get a predictable state per test file
  const mod = await import('@/services/toastService');
  return mod.toastService;
}

describe('ToastService', () => {
  let toastService: Awaited<ReturnType<typeof freshToastService>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    toastService = await freshToastService();
    // Reset internal state between tests
    (toastService as any).toasts = [];
    (toastService as any).nextId = 0;
    (toastService as any).subscribers = new Set();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribe() immediately delivers current toasts', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push(toasts));
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual([]);
  });

  it('subscribe() returns an unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = toastService.subscribe(cb);
    cb.mockClear();

    unsub();
    toastService.success('Hello');
    expect(cb).not.toHaveBeenCalled();
  });

  it('success() adds a toast with type "success" and icon CLOUD_CHECK', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push([...toasts]));
    received.length = 0; // ignore the immediate delivery

    toastService.success('Saved!');

    expect(received).toHaveLength(1);
    const [toast] = received[0];
    expect(toast.message).toBe('Saved!');
    expect(toast.type).toBe('success');
    expect(toast.icon).toBe('CLOUD_CHECK');
    expect(toast.duration).toBe(5000);
  });

  it('error() adds a toast with type "error" and icon CLOUD_OFF', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push([...toasts]));
    received.length = 0;

    toastService.error('Something broke');

    const [toast] = received[0];
    expect(toast.message).toBe('Something broke');
    expect(toast.type).toBe('error');
    expect(toast.icon).toBe('CLOUD_OFF');
    expect(toast.duration).toBe(7000);
  });

  it('info() adds a toast with type "info" and icon INFO', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push([...toasts]));
    received.length = 0;

    toastService.info('FYI');

    const [toast] = received[0];
    expect(toast.message).toBe('FYI');
    expect(toast.type).toBe('info');
    expect(toast.icon).toBe('INFO');
    expect(toast.duration).toBe(5000);
  });

  it('success() accepts a custom duration', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push([...toasts]));
    received.length = 0;

    toastService.success('Quick', 1000);

    const [toast] = received[0];
    expect(toast.duration).toBe(1000);
  });

  it('toasts auto-remove after their duration', () => {
    const received: any[][] = [];
    toastService.subscribe((toasts) => received.push([...toasts]));
    received.length = 0;

    toastService.success('Gone soon', 3000);
    expect(received[0]).toHaveLength(1);

    vi.advanceTimersByTime(3000);
    // After the timeout, toast should be removed
    const last = received[received.length - 1];
    expect(last).toHaveLength(0);
  });

  it('removeToast() removes only the specified toast by id', () => {
    toastService.success('First');
    toastService.success('Second');

    const allToasts = (toastService as any).toasts as any[];
    expect(allToasts).toHaveLength(2);

    const firstId = allToasts[0].id;
    toastService.removeToast(firstId);

    expect((toastService as any).toasts).toHaveLength(1);
    expect((toastService as any).toasts[0].message).toBe('Second');
  });

  it('each toast gets a unique incrementing id', () => {
    toastService.success('A');
    toastService.success('B');
    toastService.success('C');

    const toasts = (toastService as any).toasts as any[];
    const ids = toasts.map((t: any) => t.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).toBeLessThan(ids[1]);
    expect(ids[1]).toBeLessThan(ids[2]);
  });

  it('multiple subscribers all receive updates', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    toastService.subscribe(cb1);
    toastService.subscribe(cb2);
    cb1.mockClear();
    cb2.mockClear();

    toastService.success('Both get this');

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});
