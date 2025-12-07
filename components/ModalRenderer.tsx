import React from 'react';
import { ConfirmModalOptions, PromptModalOptions, AlertModalOptions, ModalState, modalService } from '../services/modalService';
import ConfirmModal from './ConfirmModal';
import PromptModal from './PromptModal';
import AlertModal from './AlertModal';

interface ModalRendererProps {
  modalState: ModalState | null;
}

const ModalRenderer: React.FC<ModalRendererProps> = ({ modalState }) => {
  if (!modalState) {
    return null;
  }

  const { type, options } = modalState;

  const handleCancel = () => {
    modalService.handleCancel();
  };
  
  const handleConfirm = (value?: string) => {
    modalService.handleConfirm(value);
  };

  switch (type) {
    case 'confirm':
      return <ConfirmModal {...(options as ConfirmModalOptions)} onConfirm={handleConfirm} onCancel={handleCancel} />;
    case 'prompt':
      return <PromptModal {...(options as PromptModalOptions)} onConfirm={handleConfirm} onCancel={handleCancel} />;
    case 'alert':
      return <AlertModal {...(options as AlertModalOptions)} onClose={handleConfirm} />;
    default:
      return null;
  }
};

export default ModalRenderer;
