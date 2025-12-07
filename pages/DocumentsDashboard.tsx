
import React, { useContext, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import Icon from '../components/Icon';
import { GeneralDoc } from '../types';
import { modalService } from '../services/modalService';

const DocumentsDashboard: React.FC = () => {
    const { documents, createNewDocument, deleteDocument } = useContext(AppContext);
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        setIsLoading(true);
        try {
            const id = await createNewDocument();
            navigate(`/documents/${id}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const confirmed = await modalService.confirm({
            title: 'Delete Document?',
            message: 'Are you sure you want to delete this document? This action cannot be undone.',
            danger: true,
            confirmText: 'Delete'
        });
        if (confirmed) {
            await deleteDocument(id);
        }
    };

    const filteredDocs = useMemo(() => {
        if (!searchQuery.trim()) return documents;
        return documents.filter(doc => doc.title.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [documents, searchQuery]);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <Icon name="FILE_TEXT" className="text-indigo-600 dark:text-indigo-400" />
                    Documents
                </h1>
                <button
                    onClick={handleCreate}
                    disabled={isLoading}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 transition-all flex items-center space-x-2 disabled:opacity-70"
                >
                    <Icon name="PLUS" className="w-5 h-5" />
                    <span>New Document</span>
                </button>
            </div>

            <div className="mb-6">
                <div className="relative">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="SEARCH" className="h-5 w-5 text-zinc-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full pl-10 pr-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                    />
                </div>
            </div>

            {filteredDocs.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                    <Icon name="FILE_TEXT" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                    <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">No documents yet</h2>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-400">Create a new document to start writing.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredDocs.map(doc => (
                        <div 
                            key={doc.id}
                            onClick={() => navigate(`/documents/${doc.id}`)}
                            className="group bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer flex flex-col h-64"
                        >
                            <div className="flex-grow p-5 overflow-hidden relative">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-zinc-800 opacity-90 z-10 pointer-events-none"></div>
                                <div className="prose prose-sm dark:prose-invert scale-75 origin-top-left pointer-events-none opacity-60 select-none" dangerouslySetInnerHTML={{ __html: doc.content || '<p>Empty document</p>' }} />
                            </div>
                            <div className="p-4 border-t border-zinc-100 dark:border-zinc-700/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/30 rounded-b-xl">
                                <div className="min-w-0 flex-1 mr-2">
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 truncate text-sm" title={doc.title}>{doc.title}</h3>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Updated {new Date(doc.updatedAt).toLocaleDateString()}</p>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(e, doc.id)}
                                    className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete"
                                >
                                    <Icon name="TRASH" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DocumentsDashboard;
