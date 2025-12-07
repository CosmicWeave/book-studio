import React, { useState, useEffect, useRef } from 'react';
import { PromptModalOptions } from '../services/modalService';

interface PromptModalProps extends PromptModalOptions {
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const PromptModal: React.FC<PromptModalProps> = ({ title, message, inputLabel, initialValue = '', confirmText = 'Save', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Timeout helps ensure focus works correctly after modal animation
    setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, 100);
  }, []);

  const handleConfirm = () => {
    onConfirm(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  const confirmButtonClass = danger
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-blue-600 hover:bg-blue-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001] p-4 animate-fade-in" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-300 dark:border-gray-700" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{title}</h2>
        {message && <div className="text-gray-600 dark:text-gray-400 mt-4 space-y-3">{message}</div>}
        <div className="mt-4">
          <label htmlFor="prompt-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{inputLabel}</label>
          <input
            ref={inputRef}
            type="text"
            id="prompt-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button onClick={onCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            {cancelText}
          </button>
          <button onClick={handleConfirm} className={`${confirmButtonClass} text-white px-4 py-2 rounded-lg shadow font-semibold transition-colors`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;