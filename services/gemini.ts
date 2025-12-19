
import { GoogleGenAI, Type, Chat, Content, FunctionDeclaration, Modality, GroundingChunk as GenAIGroundingChunk, FunctionCall } from '@google/genai';
import { Book, ChapterOutline, GroundingChunk, AnalysisResult, KnowledgeSheet, Series, PacingAnalysisResult, ShowTellAnalysisResult, SeriesInconsistency, StyleSuggestion, CharacterVoiceInconsistency, PlotHole, LoreInconsistency } from '../types';

// Lazily initialize to avoid crashing on load if API_KEY is missing.
let aiInstance: GoogleGenAI | null = null;

export const isAiEnabled = (): boolean => {
    const apiKey = process.env.API_KEY;
    return !!apiKey && apiKey !== 'undefined' && apiKey !== '';
};

const checkOnline = () => {
    if (!navigator.onLine) {
        throw new Error("You are currently offline. AI features require an internet connection.");
    }
};

/**
 * Lazily initializes and returns the GoogleGenAI instance.
 * Throws an error if the API key is not available.
 */
export const getAi = (): GoogleGenAI => {
    checkOnline(); // Fail fast if offline

    if (aiInstance) {
        return aiInstance;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey || apiKey === 'undefined') {
        throw new Error("Gemini API key is not configured. Please set the API_KEY environment variable.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
}

export const PERSONA_INSTRUCTIONS: Record<string, string> = {
    'Standard Co-Author': 'You are an expert co-author and editor. Be helpful, creative, and encouraging.',
    'Ruthless Editor': 'You are a harsh, critical editor. Focus on cutting fluff, fixing logic holes, and improving pacing. Do not sugarcoat your feedback. Be direct and concise.',
    'Cheerleader': 'You are an enthusiastic writing coach. Focus on what is working well, offer gentle suggestions, and keep the user motivated. Use emojis and encouraging language.',
    'Lorekeeper': 'You are a continuity expert. You are obsessed with consistency in names, dates, world-building rules, and character histories. Flag any contradiction immediately.',
    'Poet': 'You are a master of prose. Focus on sensory details, metaphors, rhythm, and emotional resonance. Suggest lyrical improvements.',
};

export const formatKnowledgeBaseForPrompt = (
    bookKnowledgeBase?: KnowledgeSheet[],
    seriesKnowledgeBase?: KnowledgeSheet[]
): string => {
    const allSheets = [
        ...(seriesKnowledgeBase?.map(s => ({ sheet: s, scope: 'Series' })) || []),
        ...(bookKnowledgeBase?.map(s => ({ sheet: s, scope: 'Book' })) || [])
    ];

    if (allSheets.length === 0) {
        return '';
    }

    let worldviewString = '';
    let narrativeDirectivesString = '';
    const otherSheets: { sheet: KnowledgeSheet; scope: string }[] = [];

    // Separate sheets into categories for prioritized prompting
    allSheets.forEach(item => {
        if (item.sheet.category === 'Value System & Beliefs') {
            worldviewString += `\n## ${item.sheet.name} (${item.scope}-level)\n${item.sheet.content}`;
        } else if (item.sheet.category === 'Plot & Narrative Structure' || item.sheet.category === 'Theme & Tone') {
            narrativeDirectivesString += `\n## ${item.sheet.name} (${item.scope}-level)\n${item.sheet.content}`;
        } else {
            otherSheets.push(item);
        }
    });

    let prompt = '';

    if (narrativeDirectivesString.trim()) {
        prompt += '\n\n---\nNARRATIVE DIRECTIVES:\nThis is the master guide for the story. ALL generated content must strictly follow these plot, theme, and tone instructions.\n' + narrativeDirectivesString.trim() + '\n---';
    }

    if (worldviewString.trim()) {
        prompt += '\n\n---\nWORLDVIEW LENS:\nThe following defines the core value system and beliefs of this world. ALL generated content, character motivations, and societal reactions MUST be viewed through this lens.\n' + worldviewString.trim() + '\n---';
    }

    if (otherSheets.length > 0) {
        const groupedByScope = otherSheets.reduce((acc, item) => {
            if (!acc[item.scope]) {
                acc[item.scope] = [];
            }
            acc[item.scope].push(`## ${item.sheet.name} (${item.sheet.category})\n${item.sheet.content}`);
            return acc;
        }, {} as Record<string, string[]>);

        prompt += '\n\n---\nWORLD KNOWLEDGE BASE:\nYou MUST adhere to the facts and descriptions provided in this knowledge base to maintain consistency.\n';

        if (groupedByScope['Series']) {
            prompt += `\n### SERIES KNOWLEDGE (Applies to all books in this series)\n${groupedByScope['Series'].join('\n\n')}\n`;
        }
        if (groupedByScope['Book']) {
            prompt += `\n### BOOK-SPECIFIC KNOWLEDGE\n${groupedByScope['Book'].join('\n\n')}\n`;
        }
        prompt += '---';
    }

    return prompt;
};

const updateChapterTool: FunctionDeclaration = {
    name: 'updateChapter',
    description: 'Updates the text content of a specific chapter. Use this tool when the user asks you to rewrite, edit, fix, or change the text/prose of a chapter body. You must provide the FULL new HTML content for the chapter.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            chapterIndex: { type: Type.INTEGER, description: 'The zero-based index of the chapter to update.' },
            newContent: { type: Type.STRING, description: 'The complete, new HTML content for the chapter.' },
            changeDescription: { type: Type.STRING, description: 'A concise summary of what changes were made (e.g., "Rewrote the dialogue to be more tense", "Fixed grammar and pacing").' }
        },
        required: ['chapterIndex', 'newContent', 'changeDescription']
    }
};

const updateBookMetadataTool: FunctionDeclaration = {
    name: 'updateBookMetadata',
    description: 'Updates the main book details. Use this to change the book title, subtitle, author name, or description.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            topic: { type: Type.STRING, description: 'The new book title.' },
            subtitle: { type: Type.STRING, description: 'The new subtitle.' },
            author: { type: Type.STRING, description: 'The author name.' },
            description: { type: Type.STRING, description: 'The book description.' }
        }
    }
};

const updateChapterMetadataTool: FunctionDeclaration = {
    name: 'updateChapterMetadata',
    description: 'Updates the structure/outline of a specific chapter. Use this to rename a chapter, assign it to a different Part, or change its summary.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            chapterIndex: { type: Type.INTEGER, description: 'The zero-based index of the chapter to update.' },
            title: { type: Type.STRING, description: 'The new chapter title (heading).' },
            part: { type: Type.STRING, description: 'The Part/Section name (e.g., "Part 1").' },
            partContent: { type: Type.STRING, description: 'Introductory text for the Part.' },
            summary: { type: Type.STRING, description: 'The summary of the chapter.' }
        },
        required: ['chapterIndex']
    }
};

const addChapterTool: FunctionDeclaration = {
    name: 'addChapter',
    description: 'Adds a new chapter to the book outline.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: 'The title of the new chapter.' },
            index: { type: Type.INTEGER, description: 'The zero-based index where the chapter should be inserted. If omitted, adds to the end.' },
            part: { type: Type.STRING, description: 'The Part this chapter belongs to.' },
            summary: { type: Type.STRING, description: 'A summary of the new chapter.' }
        },
        required: ['title']
    }
};

const deleteChapterTool: FunctionDeclaration = {
    name: 'deleteChapter',
    description: 'Deletes a chapter from the book.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            chapterIndex: { type: Type.INTEGER, description: 'The zero-based index of the chapter to delete.' }
        },
        required: ['chapterIndex']
    }
};

export const streamChatWithBook = async (
    userMessage: string,
    history: Content[],
    bookContext: { 
        topic: string; 
        outline: ChapterOutline[]; 
        currentChapter?: { title: string; content: string };
        knowledgeBase?: KnowledgeSheet[];
        seriesKnowledgeBase?: KnowledgeSheet[];
    },
    personaInstructions: string,
    onChunk: (text: string) => void,
    onToolCall: (toolCall: FunctionCall) => void
): Promise<Content[]> => {
    const ai = getAi();
    
    // Sanitize history: filter out empty messages which can crash the API
    const validHistory = history.filter(h => h.parts && h.parts.length > 0 && h.parts.some(p => (p.text && p.text.trim() !== '') || p.functionCall));

    // Construct a system instruction that gives the AI deep context about the book
    let systemPrompt = `${personaInstructions || PERSONA_INSTRUCTIONS['Standard Co-Author']}
You are assisting the user in writing the book titled "${bookContext.topic}".

${formatKnowledgeBaseForPrompt(bookContext.knowledgeBase, bookContext.seriesKnowledgeBase)}

**Book Outline:**
${bookContext.outline.map((ch, i) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}
`;

    if (bookContext.currentChapter) {
        systemPrompt += `
**Current Chapter Context:**
You are currently focused on the chapter: "${bookContext.currentChapter.title}".
Here is the current content of this chapter (use this to answer questions or provide specific suggestions):
---
${bookContext.currentChapter.content.substring(0, 15000)}... (truncated)
---
`;
    }

    systemPrompt += `
**Instructions:**
- Act as a "perfect servant" to the user's vision, while offering expert advice based on your persona.
- If the user asks for ideas, ensure they fit the established outline, characters, and tone.
- You have the ability to propose edits to the book content using the \`updateChapter\` tool.
- **IMPORTANT:** If the user explicitly asks you to "rewrite", "edit", "fix", or "change" the content of the current chapter, you MUST use the \`updateChapter\` tool to propose the new content.
- When using \`updateChapter\`, ensure the \`newContent\` is the complete, fully formed HTML for the chapter. 
- You also have tools to manage the book structure: \`updateBookMetadata\` (title, author), \`updateChapterMetadata\` (chapter titles, parts), \`addChapter\`, and \`deleteChapter\`. Use these when the user asks to restructure the book.
- Format your text responses using Markdown (bold, italics, lists, etc.) for readability.
`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash', // Use stable model
        history: validHistory,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: [updateChapterTool, updateBookMetadataTool, updateChapterMetadataTool, addChapterTool, deleteChapterTool] }]
        },
    });

    try {
        const responseStream = await chat.sendMessageStream({ message: userMessage });
        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
                onChunk(text);
            }
            const fc = chunk.functionCalls;
            if (fc && fc.length > 0) {
                onToolCall(fc[0]);
            }
        }
        return await chat.getHistory();
    } catch (error) {
        console.error("Error in chat stream:", error);
        throw error;
    }
};

export const streamBrainstorm = async (
    userMessage: string,
    history: Content[],
    onChunk: (text: string) => void,
    context?: string
): Promise<Content[]> => {
    const ai = getAi();
    let systemPrompt = `You are a world-class Book Architect and Creative Consultant. Your goal is to help the user build a complete, robust foundation for a new book.
    
    **Your Process:**
    1.  **Interview:** Ask probing, creative questions to flesh out the core concept, genre, tone, main characters, setting, and central conflict. Do not ask too many questions at once; keep it conversational.
    2.  **Structure:** Once the idea is clear, start suggesting structural elements (Three-Act, Hero's Journey, etc.) and high-level plot points.
    3.  **Refine:** Help the user tighten the premise and character motivations.
    
    **Goal:** By the end of this conversation, you should have enough information to generate a full chapter outline, a list of characters/places for the knowledge base, and style instructions.
    
    Be encouraging, insightful, and proactive. Suggest ideas if the user is stuck.`;

    if (context) {
        systemPrompt += `\n\nINITIAL CONTEXT:\n${context}`;
    }

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
        config: { systemInstruction: systemPrompt },
    });

    const responseStream = await chat.sendMessageStream({ message: userMessage });
    for await (const chunk of responseStream) {
        if (chunk.text) onChunk(chunk.text);
    }
    return await chat.getHistory();
};

export const generateFullBookDataFromChat = async (history: Content[]): Promise<{ 
    topic: string; 
    description: string; 
    instructions: string; 
    generateImages: boolean; 
    imageStyle: string;
    outline: ChapterOutline[];
    knowledgeBase: KnowledgeSheet[];
}> => {
    const ai = getAi();
    const prompt = `Analyze the entire brainstorming conversation provided below. Your task is to architect the full book structure based on this discussion.
    
    You must extract and generate:
    1. **Metadata**: Title, Description, Writing Style/Tone instructions.
    2. **Visuals**: Whether to generate images and the art style.
    3. **Outline**: A detailed, chapter-by-chapter outline.
    4. **Knowledge Base**: A comprehensive list of characters, places, and lore mentioned or implied in the chat.

    **Conversation History:**
    ${history.map(h => `${h.role}: ${h.parts.map(p => p.text).join('')}`).join('\n')}

    **Output Requirements:**
    Return a valid JSON object matching this structure exactly:
    {
      "topic": "Book Title",
      "description": "1-2 sentence premise.",
      "instructions": "Detailed writing style, tone, and perspective instructions for the AI author.",
      "generateImages": true/false,
      "imageStyle": "Art style description",
      "outline": [
        {
          "title": "Chapter Title",
          "part": "Part Name (optional)",
          "summary": "Detailed paragraph describing events in this chapter."
        }
      ],
      "knowledgeBase": [
        {
          "name": "Character/Place Name",
          "category": "Character" | "Place" | "Object" | "Event" | "Lore" | "Other",
          "content": "Detailed description of this entity based on the chat."
        }
      ]
    }

    Generate the full JSON now.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        topic: { type: Type.STRING },
                        description: { type: Type.STRING },
                        instructions: { type: Type.STRING },
                        generateImages: { type: Type.BOOLEAN },
                        imageStyle: { type: Type.STRING },
                        outline: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    part: { type: Type.STRING },
                                    summary: { type: Type.STRING }
                                },
                                required: ["title", "summary"]
                            }
                        },
                        knowledgeBase: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    category: { type: Type.STRING },
                                    content: { type: Type.STRING }
                                },
                                required: ["name", "category", "content"]
                            }
                        }
                    },
                    required: ["topic", "outline", "knowledgeBase"]
                }
            }
        });
        
        const result = JSON.parse(response.text.trim());
        
        // Post-process to ensure IDs exist where needed
        if (result.knowledgeBase) {
            result.knowledgeBase = result.knowledgeBase.map((kb: any) => ({ ...kb, id: crypto.randomUUID() }));
        }
        
        return result;

    } catch (error) {
        console.error("Error generating full book data:", error);
        throw new Error("Failed to generate book structure from chat. Please try again.");
    }
};

// Re-export other functions...
export const extractBookMetadataFromChat = async (history: Content[]) => { 
    // Kept for backward compat if needed, but generateFullBookDataFromChat supersedes it.
    const data = await generateFullBookDataFromChat(history);
    return {
        topic: data.topic,
        description: data.description,
        instructions: data.instructions,
        generateImages: data.generateImages,
        imageStyle: data.imageStyle
    };
};

export const generateSpeech = async (text: string, voiceName: string, voiceInstructions?: string): Promise<string> => {
    const ai = getAi();
    let promptText = text;
    if (voiceInstructions && voiceInstructions.trim()) {
        promptText = `(Perform with the following style: ${voiceInstructions}) ${text}`;
    }
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: promptText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio data returned from API.");
        return base64Audio;
    } catch (error) {
        console.error("Error generating speech:", error);
        if (error instanceof Error && error.message.includes('API key not valid')) {
            throw new Error('The Gemini API key is invalid. Please check your settings.');
        }
        throw new Error("Failed to generate speech. The service may be busy or unavailable.");
    }
};

export const generateVoiceInstructions = async (topic: string, contentSample: string): Promise<string> => {
    const ai = getAi();
    const prompt = `Analyze the following book excerpt and suggest a concise voice style instruction for an audiobook narrator.
    Describe the ideal tone, pace, and emotional delivery.
    Book Topic: "${topic}"
    Excerpt: "${contentSample.substring(0, 2000)}"
    Return ONLY the instruction string (e.g., "A warm, soothing voice with a slow pace."). Do not include quotes or intro text.`;
    try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        return response.text.trim();
    } catch (e) {
        console.error("Error generating voice instructions:", e);
        return "A clear and engaging narration style.";
    }
};

export const improveInstructionPrompt = async (prompt: string, name: string): Promise<string> => {
    const ai = getAi();
    const fullPrompt = `You are an expert prompt engineer. A user has provided an instruction template for an AI author. Your task is to refine and improve this prompt to be clearer, more detailed, and more effective for guiding a large language model.
**Template Name:** "${name}"
**Original Prompt:** "${prompt}"
**Your Task:**
Rewrite the prompt. Add details, specify output formats if relevant, provide examples, and clarify any ambiguities. The goal is to make the AI's output more consistent and higher quality when using this template. Return ONLY the improved prompt text.`;
    try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: fullPrompt });
        return response.text.trim();
    } catch (error) {
        console.error("Error improving instruction prompt:", error);
        throw new Error("Failed to generate suggestion for the instruction prompt.");
    }
};

export const improveBookInstructions = async (topic: string, instructions: string): Promise<string> => {
    return improveInstructionPrompt(instructions, `Book about ${topic}`);
};

export const generateImageForChapter = async (chapterHtml: string, imageInstructions: string): Promise<string> => {
    const ai = getAi();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterHtml;
    const chapterText = tempDiv.textContent || '';
    const prompt = `Generate an illustration for a book chapter.
**Image Style:** ${imageInstructions}
**Chapter Content Summary:** ${chapterText.substring(0, 1000)}
Create a compelling image that captures the essence of this chapter.`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: { imageConfig: { aspectRatio: "16:9" } },
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
        throw new Error("No image was generated for the chapter.");
    } catch (error) {
        console.error("Error generating chapter image:", error);
        throw new Error("Failed to generate chapter image.");
    }
};

export const analyzePlanCompleteness = async (chapterContent: string, sectionPrompts: string[]): Promise<boolean[]> => {
    const ai = getAi();
    const prompt = `You are a text analysis AI. I have a chapter of a book and a list of topics that were supposed to be covered in it.
For each topic in the plan, determine if the existing chapter content adequately covers it.
Your response MUST be a JSON array of booleans, with the same number of elements as the input topic list. Each boolean should be \`true\` if the topic is covered and \`false\` if it is not.
**Existing Chapter Content:**
---
${chapterContent.substring(0, 4000)}
---
**Chapter Plan (Topics to check):**
${sectionPrompts.map((p, i) => `${i + 1}. ${p}`).join('\n')}
Return ONLY the JSON array.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.BOOLEAN } } }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing plan completeness:", e);
        throw new Error("AI analysis of the plan failed.");
    }
};

export const rewriteChapterTransitions = async (book: Book, chapterIndex: number): Promise<{ newFirstParagraph: string, newLastParagraph: string } | null> => {
    const ai = getAi();
    const currentContent = book.content[chapterIndex]?.htmlContent || '';
    if (!currentContent) return null;
    const prevContent = chapterIndex > 0 ? (book.content[chapterIndex - 1]?.htmlContent || '') : '';
    const nextOutline = chapterIndex < book.outline.length - 1 ? book.outline[chapterIndex + 1]?.summary : '';
    const getText = (html: string) => { const div = document.createElement('div'); div.innerHTML = html; return div.textContent || ''; };
    const prompt = `You are an expert editor focusing on narrative flow. Improve the transitions for Chapter ${chapterIndex + 1}.
**Previous Chapter Ending:** "${getText(prevContent).slice(-500)}"
**Current Chapter Content:** "${getText(currentContent)}"
**Next Chapter Summary:** "${nextOutline}"
**Task:**
1. Rewrite the *first paragraph* of the current chapter to transition smoothly from the previous chapter.
2. Rewrite the *last paragraph* of the current chapter to lead naturally into the next chapter (or provide a good cliffhanger/conclusion if appropriate).
Return a JSON object with "newFirstParagraph" and "newLastParagraph" strings. If the current transitions are already perfect, return them as is.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { newFirstParagraph: { type: Type.STRING }, newLastParagraph: { type: Type.STRING } },
                    required: ["newFirstParagraph", "newLastParagraph"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error rewriting transitions:", e);
        return null;
    }
};

export const analyzeChapterContent = async (
    chapterHtml: string, 
    book: Book, 
    seriesKnowledgeBase?: KnowledgeSheet[],
    personaInstructions?: string
): Promise<AnalysisResult> => {
    const ai = getAi();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterHtml;
    const chapterText = tempDiv.textContent || '';
    const persona = personaInstructions || PERSONA_INSTRUCTIONS['Standard Co-Author'];

    const prompt = `${persona} Analyze the following chapter from a book and provide feedback.
Your response MUST be a JSON object with two keys: "feedback" (a string with your overall analysis) and "suggestions" (an array of objects, each with "title", "description", and "prompt").
**Book Topic:** ${book.topic}
**Overall Instructions:** ${book.instructions}
${formatKnowledgeBaseForPrompt(book.knowledgeBase, seriesKnowledgeBase)}
**Chapter Content to Analyze:**
---
${chapterText.substring(0, 5000)}
---
Provide concise, actionable feedback. The suggestions should be things that can be executed by another AI model by using the 'prompt' value.`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        feedback: { type: Type.STRING },
                        suggestions: {
                            type: Type.ARRAY,
                            items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, prompt: { type: Type.STRING } } }
                        }
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing chapter content:", e);
        throw new Error("AI analysis of the chapter failed.");
    }
};

export const analyzeChapterStyle = async (chapterHtml: string, bookTopic: string, bookInstructions: string): Promise<StyleSuggestion[]> => {
    const ai = getAi();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterHtml;
    const chapterText = tempDiv.textContent || '';
    const prompt = `You are an expert developmental editor. Analyze the style and tone of the following book chapter. Compare it against the author's overall instructions and provide specific, actionable suggestions for improvement.
Your response MUST be a JSON array of objects. Each object must have three keys: "originalPassage", "suggestedRewrite", and "explanation".
**Author's Overall Instructions for the Book:** "${bookInstructions}"
**Book Topic:** "${bookTopic}"
**Chapter Content to Analyze:**
---
${chapterText.substring(0, 8000)}
---
**Your Task:**
Identify up to 5 key passages where the writing style or tone deviates from the author's instructions. For each passage:
1. Extract the exact original text into "originalPassage".
2. Provide a rewritten version that better matches the desired style in "suggestedRewrite".
3. Briefly explain why the rewrite is an improvement in "explanation".
If the chapter's style is already excellent, return an empty array [].`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { originalPassage: { type: Type.STRING }, suggestedRewrite: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ["originalPassage", "suggestedRewrite", "explanation"] }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing chapter style:", e);
        throw new Error("AI analysis of the chapter style failed.");
    }
};

export const rewriteChapterWithPrompt = async (chapterHtml: string, book: Book, seriesKnowledgeBase: KnowledgeSheet[] | undefined, rewritePrompt: string): Promise<string> => {
    const ai = getAi();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = chapterHtml;
    const chapterText = tempDiv.textContent || '';
    const prompt = `You are a professional author. Rewrite the following chapter content based on the provided instruction.
Return ONLY the rewritten chapter content in valid, semantic HTML format.
**Formatting Rules:** Paragraphs <p>, Lists <ul>/<ol>, Emphasis <strong>/<em>, Blockquotes <blockquote>, Subheadings <h4>, Breaks <hr />. Preserve Images.
**Book Topic:** ${book.topic}
**Overall Style:** ${book.instructions}
${formatKnowledgeBaseForPrompt(book.knowledgeBase, seriesKnowledgeBase)}
**Rewrite Instruction:** "${rewritePrompt}"
**Original Chapter Content:**
---
${chapterText.substring(0, 5000)}
---
Now, provide the rewritten HTML content adhering to the formatting rules.`;
    try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        return response.text.trim();
    } catch (e) {
        console.error("Error rewriting chapter with prompt:", e);
        throw new Error("AI failed to rewrite the chapter.");
    }
};

export const analyzePacingAndFlow = async (content: string): Promise<PacingAnalysisResult> => {
    const ai = getAi();
    const prompt = `Analyze the pacing and flow of the following text.
Return a JSON object with: "sentenceLengthHistogram", "dialogueRatio", "pacingFeedback".
**Text:** "${content.substring(0, 10000)}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        sentenceLengthHistogram: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { range: { type: Type.STRING }, count: { type: Type.INTEGER } } } },
                        dialogueRatio: { type: Type.NUMBER },
                        pacingFeedback: { type: Type.STRING }
                    },
                    required: ["sentenceLengthHistogram", "dialogueRatio", "pacingFeedback"]
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing pacing:", e);
        return { sentenceLengthHistogram: [{ range: "Error", count: 0 }], dialogueRatio: 0, pacingFeedback: "Could not analyze pacing." };
    }
};

export const analyzeShowDontTell = async (content: string): Promise<ShowTellAnalysisResult[]> => {
    const ai = getAi();
    const prompt = `Analyze the text for "telling" instead of "showing". Identify up to 3 instances. Return JSON array: "passage", "suggestion".
**Text:** "${content.substring(0, 10000)}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { passage: { type: Type.STRING }, suggestion: { type: Type.STRING } }, required: ["passage", "suggestion"] } } }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing show vs tell:", e);
        return [];
    }
};

export const generateAlternativeOpenings = async (content: string): Promise<string[]> => {
    const ai = getAi();
    const prompt = `Read the following opening of a chapter. Generate 3 alternative opening paragraphs. Return JSON array of strings.
**Current Opening:** "${content.substring(0, 1000)}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error generating alternative openings:", e);
        return ["Could not generate openings."];
    }
};

export const analyzeSeriesConsistency = async (content: string, book: Book, otherBooks: Book[], series: Series): Promise<SeriesInconsistency[]> => {
    const ai = getAi();
    const seriesContext = `**Series Title:** ${series.title}\n**Current Book:** ${book.topic}\n**Series Knowledge Base:** ${(series.sharedKnowledgeBase || []).map(s => `- ${s.name}: ${s.content}`).join('\n')}\n**Other Books:** ${otherBooks.map(b => `- ${b.topic}: ${b.description}`).join('\n')}`;
    const prompt = `You are a continuity editor. Check the provided chapter text for consistency errors against the series context. Return JSON array: "inconsistentPassage", "contradictionSource", "explanation".
**Context:** ${seriesContext}
**Chapter Text:** "${content.substring(0, 15000)}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { inconsistentPassage: { type: Type.STRING }, contradictionSource: { type: Type.STRING }, explanation: { type: Type.STRING } }, required: ["inconsistentPassage", "contradictionSource", "explanation"] } } }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing series consistency:", e);
        return [];
    }
};

export const analyzeCharacterVoice = async (content: string, knowledgeBase: KnowledgeSheet[]): Promise<CharacterVoiceInconsistency[]> => {
    const ai = getAi();
    const characters = knowledgeBase.filter(k => k.category === 'Character');
    if (characters.length === 0) return [];

    const charactersContext = characters.map(c => `- ${c.name}: ${c.content}`).join('\n');
    const prompt = `You are a dialogue coach and character editor. Analyze the following chapter text specifically for character voice consistency.
    
    **Characters:**
    ${charactersContext}
    
    **Chapter Text:**
    "${content.substring(0, 20000)}"
    
    **Task:**
    Identify up to 5 instances where a character's dialogue does NOT match their established voice, personality, or background as described.
    
    Return a JSON array of objects with:
    - "characterName": The name of the character speaking.
    - "dialogue": The specific line of dialogue that is out of character.
    - "inconsistencyReason": Why this doesn't sound like them.
    - "suggestedFix": A rewritten version of the dialogue that fits their voice better.
    
    If all dialogue is consistent, return an empty array.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            characterName: { type: Type.STRING },
                            dialogue: { type: Type.STRING },
                            inconsistencyReason: { type: Type.STRING },
                            suggestedFix: { type: Type.STRING }
                        },
                        required: ["characterName", "dialogue", "inconsistencyReason", "suggestedFix"]
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing character voice:", e);
        return [];
    }
};

export const analyzePlotHoles = async (content: string, outline: ChapterOutline[], knowledgeBase: KnowledgeSheet[]): Promise<PlotHole[]> => {
    const ai = getAi();
    const outlineContext = outline.map((c, i) => `${i + 1}. ${c.title}: ${c.summary}`).join('\n');
    const kbContext = knowledgeBase.map(k => `- ${k.name} (${k.category}): ${k.content}`).join('\n');
    
    const prompt = `You are a narrative consistency checker and plot hole detector.
    
    **Story Outline:**
    ${outlineContext}
    
    **World Knowledge:**
    ${kbContext}
    
    **Current Chapter Content:**
    "${content.substring(0, 20000)}"
    
    **Task:**
    Analyze the current chapter content for logical inconsistencies, contradictions with the outline or world rules, or unexplained events.
    
    Return a JSON array of objects with:
    - "issue": A brief title for the plot hole.
    - "location": The specific part of the text (quote) where the issue occurs.
    - "severity": "High", "Medium", or "Low".
    - "explanation": Detailed explanation of why this is a plot hole.
    - "suggestion": How to fix it.
    
    If no plot holes are found, return an empty array.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            issue: { type: Type.STRING },
                            location: { type: Type.STRING },
                            severity: { type: Type.STRING },
                            explanation: { type: Type.STRING },
                            suggestion: { type: Type.STRING }
                        },
                        required: ["issue", "location", "severity", "explanation", "suggestion"]
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing plot holes:", e);
        return [];
    }
};

export const analyzeLoreConsistency = async (content: string, knowledgeBase: KnowledgeSheet[]): Promise<LoreInconsistency[]> => {
    const ai = getAi();
    const kbContext = knowledgeBase.map(k => `- ${k.name} (${k.category}): ${k.content}`).join('\n');
    
    const prompt = `You are a world-building and lore consistency expert.
    
    **World Knowledge Base:**
    ${kbContext}
    
    **Chapter Text:**
    "${content.substring(0, 20000)}"
    
    **Task:**
    Analyze the chapter text specifically for contradictions with the established knowledge base (facts, history, character traits, magic rules, etc.).
    
    Return a JSON array of objects with:
    - "passage": The quote from the text containing the error.
    - "contradiction": Explanation of why it contradicts the lore.
    - "knowledgeSheetName": The name of the Knowledge Base entry it contradicts.
    - "suggestion": A rewritten version of the passage that fixes the error.
    
    If no inconsistencies are found, return an empty array.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            passage: { type: Type.STRING },
                            contradiction: { type: Type.STRING },
                            knowledgeSheetName: { type: Type.STRING },
                            suggestion: { type: Type.STRING }
                        },
                        required: ["passage", "contradiction", "knowledgeSheetName", "suggestion"]
                    }
                }
            }
        });
        return JSON.parse(response.text.trim());
    } catch (e) {
        console.error("Error analyzing lore consistency:", e);
        return [];
    }
};

export const predictNextText = async (context: string, bookInstructions: string): Promise<string> => {
    const ai = getAi();
    const prompt = `You are a helpful co-author. Complete the following sentence or paragraph naturally, maintaining the author's style.
    
    **Style Instructions:** ${bookInstructions}
    
    **Preceding Context:**
    "${context.slice(-1000)}"
    
    Return ONLY the completion text. Do not repeat the context. Keep it concise (1-2 sentences).`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { maxOutputTokens: 100 }
        });
        return response.text?.trim() || "";
    } catch (e) {
        console.warn("Prediction failed", e);
        return "";
    }
}

export const generateChapterContent = async (
    topic: string,
    instructions: string,
    bookKnowledgeBase: KnowledgeSheet[] | undefined,
    seriesKnowledgeBase: KnowledgeSheet[] | undefined,
    outline: ChapterOutline,
    chatHistory: Content[],
    onChunk: (text: string) => void,
    language: string = 'en'
): Promise<void> => {
    const ai = getAi();
    const knowledgeBaseContext = formatKnowledgeBaseForPrompt(bookKnowledgeBase, seriesKnowledgeBase);
    const prompt = `Write the full content for the following chapter.
    **Book Topic:** ${topic}
    **Chapter Title:** ${outline.title}
    **Chapter Summary:** ${outline.summary}
    **Writing Style:** ${instructions}
    ${knowledgeBaseContext}
    
    Write the content in HTML format suitable for a book (using <p>, <h2>, etc.). Do not include the chapter title as an <h1>, start directly with the content.`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: chatHistory,
    });

    const result = await chat.sendMessageStream({ message: prompt });
    for await (const chunk of result) {
        if (chunk.text) {
            onChunk(chunk.text);
        }
    }
};

export const autoFillKnowledgeBase = async (topic: string, content: string): Promise<KnowledgeSheet[]> => {
    const ai = getAi();
    const prompt = `You are a literary analyst AI. Read the book content and extract important entities for a knowledge base.
Return JSON array of objects: "name", "content", "category" ('Character', 'Place', 'Object', 'Event', 'Lore', 'Other').
**Book Topic:** ${topic}
**Content:** "${content.substring(0, 20000)}"`;
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: { name: { type: Type.STRING }, content: { type: Type.STRING }, category: { type: Type.STRING } },
                        required: ["name", "content", "category"]
                    }
                }
            }
        });
        const sheets = JSON.parse(response.text.trim());
        return sheets.map((s: any) => ({ ...s, id: crypto.randomUUID() })).filter((s: any) => ['Character', 'Place', 'Object', 'Event', 'Lore', 'Other'].includes(s.category));
    } catch (e) {
        console.error("Error auto-filling knowledge base:", e);
        throw new Error("AI failed to extract knowledge from content.");
    }
};

export const regenerateImageWithPrompt = async (prompt: string): Promise<string> => generateCoverImage(prompt, "");
export const rephraseText = async (text: string, context: string): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Rephrase: "${text}"\nContext: "${context.substring(0,1000)}"` }); return res.text.trim(); };
export const expandText = async (text: string, context: string): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Expand: "${text}"\nContext: "${context.substring(0,1000)}"` }); return res.text.trim(); };
export const summarizeText = async (text: string): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Summarize: "${text}"` }); return res.text.trim(); };
export const suggestNextSentence = async (text: string): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Continue: "${text}"` }); return res.text.trim(); };
export const changeTone = async (text: string, tone: string, context: string): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Rewrite to ${tone} tone: "${text}"\nContext: "${context.substring(0,1000)}"` }); return res.text.trim(); };
export const performResearch = async (query: string): Promise<{ text: string; sources: GroundingChunk[] }> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: query }); return { text: res.text.trim(), sources: [] }; };
// ... (keep generateBookAngles, generateBookParts, generateDetailedOutline, synthesizeBookAngles, synthesizeBookParts for now as legacy/utils if needed)
export const generateBookAngles = async (t: string, i: string, f: string, s: string, w: string, e: string[]=[], c: number=4): Promise<string[]> => {
    const ai = getAi();
    const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Generate ${c} book angles. Topic: ${t}. Instructions: ${i}. Format: JSON array of strings.`, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } } });
    return JSON.parse(res.text.trim());
};
export const synthesizeBookAngles = async (t: string, i: string, f: string, s: string, w: string, a: string[]): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Synthesize these angles into one: ${a.join(', ')}. Topic: ${t}.` }); return res.text.trim(); };
export const generateBookParts = async (t: string, i: string, a: string, f: string, s: string, w: string, e: string[]=[], c: number=4): Promise<string[]> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Generate ${c} book parts. Topic: ${t}. Angle: ${a}. Format: JSON array of strings.`, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } } }); return JSON.parse(res.text.trim()); };
export const synthesizeBookParts = async (t: string, i: string, a: string, f: string, s: string, w: string, p: string[]): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Synthesize these parts into one: ${p.join(', ')}. Topic: ${t}. Angle: ${a}.` }); return res.text.trim(); };
export const generateDetailedOutline = async (t: string, i: string, a: string, f: string, p: {title:string, chapters:number}[], s: string, w: string): Promise<ChapterOutline[]> => {
    const ai = getAi();
    const res = await ai.models.generateContent({ 
        model: "gemini-2.5-flash", 
        contents: `Generate a book outline JSON. Topic: ${t}. Angle: ${a}. Structure: ${p.map(x=>x.title).join(', ')}.`, 
        config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { part: {type: Type.STRING}, title: {type: Type.STRING}, summary: {type: Type.STRING} }, required: ["title", "summary"] } } } 
    });
    return JSON.parse(res.text.trim());
};
export const generateSequelIdeas = async (b: Book, r: 'sequel'|'prequel'): Promise<string[]> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Generate 3 ${r} ideas for book "${b.topic}". Format: JSON string array.`, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } } }); return JSON.parse(res.text.trim()); };
export const summarizeBook = async (b: Book): Promise<string> => { const ai = getAi(); const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Summarize book "${b.topic}".` }); return res.text.trim(); };
export const breakdownChapterSummary = async (t: string, i: string, c: ChapterOutline): Promise<string[]> => { const ai = getAi(); try { const res = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Breakdown chapter "${c.title}": ${c.summary}. 3-5 steps. JSON string array.`, config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } } } }); return JSON.parse(res.text.trim()); } catch { return [c.summary]; } };
export const generateCoverImage = async (t: string, s: string): Promise<string> => { const ai = getAi(); const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: `Book Cover. Title: ${t}. Style: ${s}` }] }, config: { imageConfig: { aspectRatio: "1:1" } } }); for(const p of r.candidates?.[0]?.content?.parts || []) if(p.inlineData) return `data:${p.inlineData.mimeType || 'image/png'};base64,${p.inlineData.data}`; throw new Error("No image"); };
export const editCoverImage = async (img: string, p: string): Promise<string> => { const ai = getAi(); const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ inlineData: { mimeType: 'image/png', data: img.split(',')[1] } }, { text: p }] } }); for(const pt of r.candidates?.[0]?.content?.parts || []) if(pt.inlineData) return `data:${pt.inlineData.mimeType || 'image/png'};base64,${pt.inlineData.data}`; throw new Error("No image"); };
export const generateIllustration = async (p: string, s: string, ar: string): Promise<string> => { const ai = getAi(); const r = await ai.models.generateContent({ model: 'gemini-2.5-flash-image', contents: { parts: [{ text: `${p}. Style: ${s}` }] }, config: { imageConfig: { aspectRatio: ar as any } } }); for(const pt of r.candidates?.[0]?.content?.parts || []) if(pt.inlineData) return `data:${pt.inlineData.mimeType || 'image/png'};base64,${pt.inlineData.data}`; throw new Error("No image"); };
export const editImage = editCoverImage;
export const generateSingleSection = async (topic: string, instructions: string, kb: KnowledgeSheet[]|undefined, skb: KnowledgeSheet[]|undefined, outline: ChapterOutline, subTopic: string, history: Content[], onStream: (chunk: string) => void, language: string = 'en'): Promise<{ newContent: string }> => {
    const ai = getAi();
    const prompt = `Write a section of a chapter.
**Book:** ${topic}
**Chapter:** ${outline.title} - ${outline.summary}
**Section Topic:** ${subTopic}
**Style:** ${instructions}
${formatKnowledgeBaseForPrompt(kb, skb)}
Write ONLY the content for this section in HTML.`;

    const result = await ai.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    let fullText = '';
    for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
            fullText += text;
            onStream(text);
        }
    }
    return { newContent: fullText };
};