import React from 'react';

export interface ConfirmModalOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface PromptModalOptions {
  title: string;
  message?: React.ReactNode;
  inputLabel: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface AlertModalOptions {
  title: string;
  message: React.ReactNode;
  closeText?: string;
}

export type ModalState = 
  | ({ type: 'confirm'; options: ConfirmModalOptions })
  | ({ type: 'prompt'; options: PromptModalOptions })
  | ({ type: 'alert'; options: AlertModalOptions });

type Subscriber = (state: ModalState | null) => void;

class ModalService {
  private subscribers: Set<Subscriber> = new Set();
  private resolvePromise?: (value: any) => void;
  private modalType: 'confirm' | 'prompt' | 'alert' | null = null;

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(state: ModalState | null): void {
    this.subscribers.forEach(callback => callback(state));
  }

  confirm(options: ConfirmModalOptions): Promise<boolean> {
    this.modalType = 'confirm';
    return new Promise(resolve => {
      this.resolvePromise = resolve;
      this.notify({ type: 'confirm', options });
    });
  }
  
  prompt(options: PromptModalOptions): Promise<string | null> {
    this.modalType = 'prompt';
    return new Promise(resolve => {
      this.resolvePromise = resolve;
      this.notify({ type: 'prompt', options });
    });
  }
  
  alert(options: AlertModalOptions): Promise<void> {
    this.modalType = 'alert';
    return new Promise(resolve => {
      this.resolvePromise = () => resolve();
      this.notify({ type: 'alert', options });
    });
  }

  handleConfirm(value?: any): void {
    if (this.resolvePromise) {
      this.resolvePromise(value ?? true);
    }
    this.close();
  }

  handleCancel(): void {
    if (this.resolvePromise) {
        if (this.modalType === 'prompt') {
            this.resolvePromise(null);
        } else {
            this.resolvePromise(false);
        }
    }
    this.close();
  }

  close(): void {
    this.modalType = null;
    this.notify(null);
    this.resolvePromise = undefined;
  }
}

export const modalService = new ModalService();