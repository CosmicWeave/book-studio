import React from 'react';
import { createPortal } from 'react-dom';

export function withModalPortal<P extends object>(Component: React.ComponentType<P>) {
  const PortaledModal: React.FC<P> = (props) => {
    const content = <Component {...props} />;

    if (typeof document === 'undefined') {
      return content;
    }

    return createPortal(content, document.body);
  };

  PortaledModal.displayName = `WithModalPortal(${Component.displayName ?? Component.name ?? 'Modal'})`;

  return PortaledModal;
}
