import { describe, it, expect, beforeEach } from 'vitest';
import { modalService, ConfirmModalOptions, PromptModalOptions, AlertModalOptions } from '@/services/modalService';

function resetModalService() {
  (modalService as any).resolvePromise = undefined;
  (modalService as any).modalType = null;
  (modalService as any).subscribers = new Set();
}

describe('ModalService', () => {
  beforeEach(resetModalService);

  it('subscribe() returns an unsubscribe function', () => {
    const states: any[] = [];
    const unsub = modalService.subscribe((state) => states.push(state));
    expect(typeof unsub).toBe('function');
    unsub();
    // After unsubscribing, notifications should not reach the callback
    const before = states.length;
    modalService.close();
    expect(states.length).toBe(before);
  });

  describe('confirm()', () => {
    it('notifies subscribers with type "confirm"', () => {
      const states: any[] = [];
      modalService.subscribe((s) => states.push(s));

      const options: ConfirmModalOptions = { title: 'Delete?', message: 'Sure?' };
      modalService.confirm(options);

      const last = states[states.length - 1];
      expect(last?.type).toBe('confirm');
      expect(last?.options).toEqual(options);
    });

    it('resolves true when handleConfirm() is called', async () => {
      const options: ConfirmModalOptions = { title: 'Confirm', message: 'Do it?' };
      const promise = modalService.confirm(options);
      modalService.handleConfirm();
      const result = await promise;
      expect(result).toBe(true);
    });

    it('resolves false when handleCancel() is called', async () => {
      const options: ConfirmModalOptions = { title: 'Confirm', message: 'Do it?' };
      const promise = modalService.confirm(options);
      modalService.handleCancel();
      const result = await promise;
      expect(result).toBe(false);
    });

    it('notifies subscribers with null after confirm', async () => {
      const states: any[] = [];
      modalService.subscribe((s) => states.push(s));
      const promise = modalService.confirm({ title: 'X', message: 'Y' });
      modalService.handleConfirm();
      await promise;
      expect(states[states.length - 1]).toBeNull();
    });
  });

  describe('prompt()', () => {
    it('notifies subscribers with type "prompt"', () => {
      const states: any[] = [];
      modalService.subscribe((s) => states.push(s));

      const options: PromptModalOptions = { title: 'Name?', inputLabel: 'Name' };
      modalService.prompt(options);

      const last = states[states.length - 1];
      expect(last?.type).toBe('prompt');
      expect(last?.options).toEqual(options);
    });

    it('resolves the provided value when handleConfirm() is called with a value', async () => {
      const promise = modalService.prompt({ title: 'Name?', inputLabel: 'Name' });
      modalService.handleConfirm('Alice');
      const result = await promise;
      expect(result).toBe('Alice');
    });

    it('resolves null when handleCancel() is called', async () => {
      const promise = modalService.prompt({ title: 'Name?', inputLabel: 'Name' });
      modalService.handleCancel();
      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe('alert()', () => {
    it('notifies subscribers with type "alert"', () => {
      const states: any[] = [];
      modalService.subscribe((s) => states.push(s));

      const options: AlertModalOptions = { title: 'Notice', message: 'FYI' };
      modalService.alert(options);

      const last = states[states.length - 1];
      expect(last?.type).toBe('alert');
      expect(last?.options).toEqual(options);
    });

    it('resolves void when handleConfirm() is called', async () => {
      const promise = modalService.alert({ title: 'Done', message: 'OK' });
      modalService.handleConfirm();
      const result = await promise;
      expect(result).toBeUndefined();
    });

    it('resolves void when handleCancel() is called (alert dismissal)', async () => {
      const promise = modalService.alert({ title: 'Done', message: 'OK' });
      modalService.handleCancel();
      // alert() resolvePromise is () => resolve() which ignores args — resolves undefined
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('close()', () => {
    it('notifies subscribers with null', () => {
      const states: any[] = [];
      modalService.subscribe((s) => states.push(s));
      modalService.close();
      expect(states[states.length - 1]).toBeNull();
    });

    it('clears the modal type', () => {
      modalService.confirm({ title: 'X', message: 'Y' });
      modalService.close();
      expect((modalService as any).modalType).toBeNull();
    });
  });
});
