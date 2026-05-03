import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoryControls from '@/components/HistoryControls';
import { historyService } from '@/services/historyService';

// Mock the apiClient used by historyService
vi.mock('@/services/apiClient', () => ({
    db: {
        history: {
            get: vi.fn().mockResolvedValue(null),
            put: vi.fn().mockResolvedValue(undefined),
        },
    },
}));

// Reset historyService state between tests
function resetHistory() {
    (historyService as any).undoStack = [];
    (historyService as any).redoStack = [];
    (historyService as any).notify(false);
}

describe('HistoryControls', () => {
    beforeEach(() => {
        resetHistory();
    });

    it('renders undo and redo buttons', () => {
        render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);
        expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
        expect(screen.getByRole('button', { name: /redo/i })).toBeDefined();
    });

    it('undo button is disabled when canUndo is false', () => {
        render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);
        const undoBtn = screen.getByRole('button', { name: /undo/i }) as HTMLButtonElement;
        expect(undoBtn.disabled).toBe(true);
    });

    it('redo button is disabled when canRedo is false', () => {
        render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);
        const redoBtn = screen.getByRole('button', { name: /redo/i }) as HTMLButtonElement;
        expect(redoBtn.disabled).toBe(true);
    });

    it('enables undo button when historyService has undo available', async () => {
        render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);

        act(() => {
            (historyService as any).undoStack = [{ id: 'step1', state: '{}', timestamp: Date.now() }];
            (historyService as any).notify(false);
        });

        const undoBtn = screen.getByRole('button', { name: /undo/i }) as HTMLButtonElement;
        expect(undoBtn.disabled).toBe(false);
    });

    it('enables redo button when historyService has redo available', async () => {
        render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);

        act(() => {
            (historyService as any).redoStack = [{ id: 'step1', state: '{}', timestamp: Date.now() }];
            (historyService as any).notify(false);
        });

        const redoBtn = screen.getByRole('button', { name: /redo/i }) as HTMLButtonElement;
        expect(redoBtn.disabled).toBe(false);
    });

    it('calls onUndo when undo button is clicked', async () => {
        const onUndo = vi.fn();
        render(<HistoryControls onUndo={onUndo} onRedo={vi.fn()} />);

        act(() => {
            (historyService as any).undoStack = [{ id: 'step1', state: '{}', timestamp: Date.now() }];
            (historyService as any).notify(false);
        });

        await userEvent.click(screen.getByRole('button', { name: /undo/i }));
        expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('calls onRedo when redo button is clicked', async () => {
        const onRedo = vi.fn();
        render(<HistoryControls onUndo={vi.fn()} onRedo={onRedo} />);

        act(() => {
            (historyService as any).redoStack = [{ id: 'step1', state: '{}', timestamp: Date.now() }];
            (historyService as any).notify(false);
        });

        await userEvent.click(screen.getByRole('button', { name: /redo/i }));
        expect(onRedo).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes from historyService on unmount', () => {
        const subscribeSpy = vi.spyOn(historyService, 'subscribe');
        const unsubscribeMock = vi.fn();
        subscribeSpy.mockReturnValue(unsubscribeMock);

        const { unmount } = render(<HistoryControls onUndo={vi.fn()} onRedo={vi.fn()} />);
        unmount();

        expect(unsubscribeMock).toHaveBeenCalled();
        subscribeSpy.mockRestore();
    });
});
