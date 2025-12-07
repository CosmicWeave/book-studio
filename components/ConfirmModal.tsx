import React from 'react';
import { ConfirmModalOptions } from '../services/modalService';

interface ConfirmModalProps extends ConfirmModalOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) => {
  const confirmButtonClass = danger
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-indigo-600 hover:bg-indigo-700';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10001] p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-zinc-300 dark:border-zinc-700 animate-slide-in-up" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{title}</h2>
        <div className="text-zinc-600 dark:text-zinc-400 mt-4 space-y-3">{message}</div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onCancel} className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`text-white px-4 py-2 rounded-lg shadow font-semibold transition-colors ${confirmButtonClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;