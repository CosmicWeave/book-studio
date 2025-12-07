

import { ICONS } from '../constants';
import { IconName } from '../components/Icon';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  icon: IconName;
}

type Subscriber = (toasts: ToastMessage[]) => void;

class ToastService {
  private toasts: ToastMessage[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private nextId = 0;

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.toasts); // Immediately send current state
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback(this.toasts));
  }

  private addToast(message: string, type: ToastType, duration: number): void {
    const id = this.nextId++;
    const icon: IconName = type === 'success' ? 'CLOUD_CHECK' : type === 'error' ? 'CLOUD_OFF' : 'INFO';
    
    this.toasts = [...this.toasts, { id, message, type, duration, icon }];
    this.notify();

    setTimeout(() => {
      this.removeToast(id);
    }, duration);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.notify();
  }

  success(message: string, duration = 5000): void {
    this.addToast(message, 'success', duration);
  }

  error(message: string, duration = 7000): void {
    this.addToast(message, 'error', duration);
  }

  info(message: string, duration = 5000): void {
    this.addToast(message, 'info', duration);
  }
}

export const toastService = new ToastService();
