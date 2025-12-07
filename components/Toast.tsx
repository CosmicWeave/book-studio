

import React, { useEffect, useState } from 'react';
import { ToastMessage, toastService } from '../services/toastService';
import { IconName } from './Icon';
import Icon from './Icon';

interface ToastProps {
  toast: ToastMessage;
}

const Toast: React.FC<ToastProps> = ({ toast }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, toast.duration! - 500); // Start fade out 500ms before removal

    return () => clearTimeout(timer);
  }, [toast]);

  const baseClasses = 'flex items-center w-full max-w-xs p-4 space-x-4 text-gray-500 bg-white rounded-lg shadow-lg dark:text-gray-400 dark:bg-gray-800 ring-1 ring-black ring-opacity-5 transition-all duration-300 ease-in-out';
  const positionClasses = isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0';
  
  const typeStyles = {
    success: 'text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200',
    error: 'text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200',
    info: 'text-blue-500 bg-blue-100 dark:bg-blue-800 dark:text-blue-200',
  };

  return (
    <div role="alert" className={`${baseClasses} ${positionClasses}`}>
      <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg ${typeStyles[toast.type]}`}>
        <Icon name={toast.icon as IconName} className="w-5 h-5" />
      </div>
      <div className="text-sm font-normal flex-1">{toast.message}</div>
      <button 
        type="button" 
        className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" 
        aria-label="Close"
        onClick={() => toastService.removeToast(toast.id)}
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
      </button>
    </div>
  );
};

export default Toast;
