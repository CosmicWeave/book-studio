
import React from 'react';
import Icon from './Icon';

interface VoicePromptHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VoicePromptHelpModal: React.FC<VoicePromptHelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10003] p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Icon name="INFO" className="w-6 h-6 text-indigo-500" />
                        Voice Prompting Guide
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-6 text-zinc-700 dark:text-zinc-300">
                    <section>
                        <p className="mb-4">
                            You can guide the AI narrator's performance by providing specific instructions about the tone, pace, and emotion. 
                            Think of this like giving direction to a voice actor in a studio.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-2">Key Elements to Include</h3>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li><strong>Tone:</strong> Cheerful, somber, sarcastic, authoritative, whispering, shouting.</li>
                            <li><strong>Pace:</strong> Fast, slow, erratic, steady.</li>
                            <li><strong>Emotion:</strong> Angry, sad, excited, fearful, bored.</li>
                            <li><strong>Character:</strong> "Like an old wizard," "Like a news anchor," "Like a tired soldier."</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mb-3">Example Prompts</h3>
                        
                        <div className="grid gap-3">
                            <div className="bg-zinc-50 dark:bg-zinc-700/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600">
                                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Fiction / Fantasy</span>
                                <p className="text-sm italic">"Speak with a deep, gravelly voice, slowly and ominously, as if telling a ghost story around a campfire."</p>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-700/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600">
                                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Non-Fiction / Educational</span>
                                <p className="text-sm italic">"Use a clear, professional, and articulate tone. Maintain a steady pace suitable for teaching complex topics."</p>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-700/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600">
                                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Children's Book</span>
                                <p className="text-sm italic">"Narrate in a high-pitched, enthusiastic, and bouncy voice. Express exaggerated excitement and wonder."</p>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-700/50 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600">
                                <span className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase mb-1">Thriller / Noir</span>
                                <p className="text-sm italic">"A hushed, gritty whisper. Fast-paced and urgent, conveying a sense of paranoia."</p>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="pt-6 mt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end">
                    <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 transition-colors">
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VoicePromptHelpModal;
