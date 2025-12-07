
import React, { useState, useEffect } from 'react';
import { ToastMessage, toastService } from '../services/toastService';
import Toast from './Toast';

const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe(setToasts);
    return () => unsubscribe();
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[10001] w-full max-w-xs space-y-3">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

export default ToastContainer;
