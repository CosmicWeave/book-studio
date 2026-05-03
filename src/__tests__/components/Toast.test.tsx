import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Toast from '@/components/Toast';
import ToastContainer from '@/components/ToastContainer';
import type { ToastMessage } from '@/services/toastService';

// Reset toastService state between tests
function resetToastService() {
  const mod = vi.importActual<typeof import('@/services/toastService')>('@/services/toastService');
  // We access the singleton directly for reset
  const { toastService } = require('@/services/toastService');
  (toastService as any).toasts = [];
  (toastService as any).nextId = 0;
  (toastService as any).subscribers = new Set();
}

const makeToast = (overrides: Partial<ToastMessage> = {}): ToastMessage => ({
  id: 1,
  message: 'Test message',
  type: 'success',
  duration: 5000,
  icon: 'CLOUD_CHECK',
  ...overrides,
});

describe('Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the toast message', () => {
    const toast = makeToast({ message: 'File saved' });
    render(<Toast toast={toast} />);
    expect(screen.getByText('File saved')).toBeInTheDocument();
  });

  it('renders with role="alert"', () => {
    render(<Toast toast={makeToast()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders a close button with aria-label="Close"', () => {
    render(<Toast toast={makeToast()} />);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls toastService.removeToast when close button is clicked', async () => {
    const { toastService } = await import('@/services/toastService');
    const removeSpy = vi.spyOn(toastService, 'removeToast').mockImplementation(() => {});

    const toast = makeToast({ id: 42 });
    render(<Toast toast={toast} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(removeSpy).toHaveBeenCalledWith(42);
    removeSpy.mockRestore();
  });

  it('becomes visible (translate-x-0) after mount', async () => {
    render(<Toast toast={makeToast()} />);
    await act(async () => {});
    const alertEl = screen.getByRole('alert');
    expect(alertEl.className).toContain('translate-x-0');
  });
});

describe('ToastContainer component', () => {
  beforeEach(async () => {
    const { toastService } = await import('@/services/toastService');
    (toastService as any).toasts = [];
    (toastService as any).nextId = 0;
    (toastService as any).subscribers = new Set();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastContainer />);
    const alerts = container.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(0);
  });

  it('renders a toast when toastService emits one', async () => {
    const { toastService } = await import('@/services/toastService');
    render(<ToastContainer />);

    await act(async () => {
      toastService.success('Hello world');
    });

    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('removes a toast after its duration', async () => {
    const { toastService } = await import('@/services/toastService');
    render(<ToastContainer />);

    await act(async () => {
      toastService.success('Temporary', 1000);
    });

    expect(screen.getByText('Temporary')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Temporary')).not.toBeInTheDocument();
  });

  it('renders multiple toasts simultaneously', async () => {
    const { toastService } = await import('@/services/toastService');
    render(<ToastContainer />);

    await act(async () => {
      toastService.success('First');
      toastService.error('Second');
    });

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('unsubscribes from toastService on unmount', async () => {
    const { toastService } = await import('@/services/toastService');
    const subscribeSpy = vi.spyOn(toastService, 'subscribe');
    let capturedUnsub: (() => void) | undefined;
    subscribeSpy.mockImplementation((cb) => {
      cb([]);
      capturedUnsub = vi.fn();
      return capturedUnsub;
    });

    const { unmount } = render(<ToastContainer />);
    unmount();

    expect(capturedUnsub).toHaveBeenCalled();
    subscribeSpy.mockRestore();
  });
});
