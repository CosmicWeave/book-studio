// Temporary code to add to Settings.tsx

    const handleAddGeminiKey = () => {
        if (!newGeminiKey.trim()) {
            toastService.error('Please enter a Gemini API key.');
            return;
        }
        handleSaveAiConfig(newGeminiKey.trim());
    };

    const handleSaveAiConfig = async (keyToAdd?: string) => {
        setIsLoading(true);
        setLoadingMessage('Saving AI configuration...');
        try {
            let geminiApiKeysPayload: Array<{ key: string; exhaustedUntil?: number }> | undefined;
            if (keyToAdd) {
                geminiApiKeysPayload = [{ key: keyToAdd }];
            }

            const payload: Record<string, unknown> = {
                provider: aiProvider,
                model: aiModel.trim() || undefined,
                ollamaUrl: ollamaUrl.trim() || undefined,
                anythingllmUrl: anythingllmUrl.trim() || undefined,
                openaiBaseUrl: openaiBaseUrl.trim() || undefined,
            };

            if (geminiApiKeysPayload) payload.geminiApiKeys = geminiApiKeysPayload;
            if (anythingllmApiKey.trim()) payload.anythingllmApiKey = anythingllmApiKey.trim();
            if (openaiApiKey.trim()) payload.openaiApiKey = openaiApiKey.trim();

            const res = await fetch('/api/ai/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed to save AI config' }));
                throw new Error(err.error || 'Failed to save AI config');
            }

            const [configRes, healthRes] = await Promise.all([
                fetch('/api/ai/config'),
                fetch('/api/ai/health'),
            ]);

            if (configRes.ok) {
                const cfg = await configRes.json();
                setGeminiApiKeys(cfg.geminiApiKeys || []);
                setHasGeminiKey(!!cfg.hasGeminiKey);
                setHasAnythingllmKey(!!cfg.hasAnythingllmKey);
                setHasOpenaiKey(!!cfg.hasOpenaiKey);
            }
            if (healthRes.ok) {
                const health = await healthRes.json();
                setAiAvailable(health.available === true);
                setActiveAiProvider(health.provider || 'none');
            }

            if (keyToAdd) setNewGeminiKey('');
            setAnythingllmApiKey('');
            setOpenaiApiKey('');
            toastService.success('AI configuration saved.');
        } catch (e: any) {
            toastService.error(`Failed to save AI config: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };


// UI for multiple Gemini keys (replaces the single geminiApiKey input):

                                {aiProvider === 'gemini' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Gemini API Keys</label>
                                            <p className="text-xs text-zinc-500 mb-2">Manage multiple keys for quota rotation. Keys are masked (last 4 chars visible).</p>
                                            
                                            {/* Display existing keys */}
                                            {geminiApiKeys.length > 0 && (
                                                <div className="space-y-2 mb-3 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                    {geminiApiKeys.map((keyEntry, index) => (
                                                        <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                                            <div className="flex-1">
                                                                <code className="text-sm font-mono text-zinc-700 dark:text-zinc-300">{keyEntry.masked}</code>
                                                                {keyEntry.isExhausted && (
                                                                    <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                                                                        ⚠️ Exhausted (rotating to next key)
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))                                                </div>
                                            )}
                                            
                                            {/* Add new key */}
                                            <div className="flex gap-2">
                                                <input
                                                    type="password"
                                                    aria-label="Add new Gemini API key"
                                                    value={newGeminiKey}
                                                    onChange={(e) => setNewGeminiKey(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleAddGeminiKey()}
                                                    placeholder="Paste a new Gemini API key to add"
                                                    className="flex-1 rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm"
                                                />
                                                <button
                                                    onClick={handleAddGeminiKey}
                                                    disabled={!newGeminiKey.trim()}
                                                    className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 disabled:bg-zinc-400 transition-colors"
                                                >
                                                    Add Key
                                                </button>
                                            </div>
                                            <p className="text-xs text-zinc-500 mt-2">Multiple keys enable automatic fallback when one hits its limit.</p>
                                        </div>
                                    </div>
                                )}
