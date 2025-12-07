import React from 'react';
import { AlertModalOptions } from '../services/modalService';

interface AlertModalProps extends AlertModalOptions {
  onClose: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({ title, message, closeText = 'OK', onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001] p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-300 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
        <div className="text-gray-600 dark:text-gray-400 mt-4 space-y-3">{message}</div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors">
            {closeText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
