
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { GeneralDoc } from '../types';
import Icon from '../components/Icon';
import Loader from '../components/Loader';
import SingleDocumentEditor from '../components/SingleDocumentEditor';

const GeneralEditor: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { documents, updateDocument } = useContext(AppContext);
    const [doc, setDoc] = useState<GeneralDoc | null>(null);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (id) {
            const found = documents.find(d => d.id === id);
            if (found) {
                setDoc(found);
                setTitle(found.title);
            } else if (documents.length > 0) {
                // Wait for documents to load if initial load
                // Ideally we check loading state, but for now redirect if missing
               // navigate('/documents');
            }
        }
    }, [id, documents, navigate]);

    const handleContentUpdate = useCallback((newHtml: string) => {
        if (doc && newHtml !== doc.content) {
            setIsSaving(true);
            updateDocument({ ...doc, content: newHtml, title }).finally(() => {
                 setTimeout(() => setIsSaving(false), 800);
            });
        }
    }, [doc, title, updateDocument]);

    const handleTitleBlur = () => {
        if (doc && title !== doc.title) {
            updateDocument({ ...doc, title });
        }
    };

    if (!doc) return <Loader message="Loading document..." />;

    return (
        <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900">
            {/* Header */}
            <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-4 py-2 flex items-center justify-between flex-shrink-0 pt-[env(safe-area-inset-top)]">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <button onClick={() => navigate('/documents')} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                        <Icon name="CHEVRON_LEFT" className="w-5 h-5" />
                    </button>
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded text-indigo-600 dark:text-indigo-400">
                            <Icon name="FILE_TEXT" className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleTitleBlur}
                            className="bg-transparent border-none focus:ring-0 font-bold text-lg text-zinc-800 dark:text-zinc-100 w-full truncate p-0"
                            placeholder="Untitled Document"
                        />
                    </div>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                    <span className={`text-xs font-medium transition-colors ${isSaving ? 'text-zinc-500' : 'text-emerald-500'}`}>
                        {isSaving ? 'Saving...' : 'Saved'}
                    </span>
                </div>
            </header>

            {/* Editor Area */}
            <div className="flex-1 overflow-hidden">
                <SingleDocumentEditor 
                    content={doc.content} 
                    onUpdate={handleContentUpdate} 
                />
            </div>
        </div>
    );
};

export default GeneralEditor;
