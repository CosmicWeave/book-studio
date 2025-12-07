
import React from 'react';
import { ICONS } from '../../constants';
import { useBookEditor } from '../../contexts/BookEditorContext';
import Icon from '../Icon';

const FloatingChatButton: React.FC = () => {
    const { setIsChatOpen, isAiEnabled } = useBookEditor();

    if (!isAiEnabled) return null;

    return (
        <button
            onClick={() => setIsChatOpen(true)}
            className="fixed bottom-24 right-6 z-50 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-all transform hover:scale-110"
            aria-label="Open AI Assistant Chat"
            title="Open AI Assistant Chat"
        >
            <Icon name="MESSAGE_CIRCLE" className="w-8 h-8" />
        </button>
    );
};

export default FloatingChatButton;
