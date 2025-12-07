
import { Book, ChapterOutline, ChapterContent } from '../types';
import { marked } from 'marked';
import * as pdfjsLib from 'pdfjs-dist';
import { toastService } from './toastService';
import { getGoogleDocContent } from './googleDrive';

// pdf.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';


declare const JSZip: any;

interface ImportOptions {
    markdownSplitLevel?: 1 | 2 | 3;
    partSplitLevel?: null | 1 | 2;
}

const filterStyles = (styleString: string): string => {
    let newStyle = '';
    const styles = styleString.split(';').map(s => s.trim()).filter(s => s);
    styles.forEach(s => {
        const parts = s.split(':');
        if (parts.length < 2) return;
        const prop = parts[0].trim().toLowerCase();
        const val = parts[1].trim().toLowerCase();

        if (prop === 'font-weight' && (val === 'bold' || val === '700' || parseInt(val) >= 700)) {
            newStyle += 'font-weight: bold; ';
        }
        else if (prop === 'font-style' && val === 'italic') {
            newStyle += 'font-style: italic; ';
        }
        else if (prop === 'text-decoration') {
            if (val.includes('underline')) newStyle += 'text-decoration: underline; ';
            if (val.includes('line-through')) newStyle += 'text-decoration: line-through; ';
        }
        else if (prop === 'text-align') {
            if (['center', 'right', 'justify'].includes(val)) {
                newStyle += `text-align: ${val}; `;
            }
        }
        else if (prop === 'background-color') {
             // Preserve highlight colors (common in Google Docs)
             // Google Docs often uses 'transparent' which we can ignore
             if (val !== 'transparent' && val !== 'rgba(0, 0, 0, 0)') {
                 newStyle += `background-color: ${val}; `;
             }
        }
        else if (prop === 'color') {
            // Preserve text color if it's not black/auto
            if (val !== '#000000' && val !== 'black' && !val.startsWith('rgba(0,0,0')) {
                newStyle += `color: ${val}; `;
            }
        }
    });
    return newStyle;
};

// Helper to parse CSS text into a map of className -> styleString
const parseCssClasses = (cssText: string): Map<string, string> => {
    const cssClassMap = new Map<string, string>();
    // Regex to match .classname { ... }
    // Handles single line and multi-line css blocks
    const regex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
    let match;
    while ((match = regex.exec(cssText)) !== null) {
        const className = match[1];
        const styleBody = match[2];
        // We don't filter yet, we store the raw style, filtering happens on application
        if (styleBody) {
            cssClassMap.set(className, styleBody);
        }
    }
    return cssClassMap;
};

// Helper to apply class-based styles inline
const inlineCssStyles = (root: Element, cssClassMap: Map<string, string>) => {
    if (cssClassMap.size === 0) return;
    const allElements = root.querySelectorAll('*');
    
    // Iterate backwards or standard loop
    for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const className = el.getAttribute('class');
        if (className) {
            const classes = className.split(/\s+/);
            let combinedStyle = el.getAttribute('style') || '';
            
            classes.forEach(cls => {
                if (cssClassMap.has(cls)) {
                    const classStyle = cssClassMap.get(cls);
                    if (classStyle) {
                        combinedStyle += (combinedStyle.endsWith(';') ? ' ' : '; ') + classStyle;
                    }
                }
            });
            
            if (combinedStyle) {
                // Filter styles here to ensure we only keep what we support
                const safeStyles = filterStyles(combinedStyle);
                if (safeStyles) {
                     el.setAttribute('style', safeStyles.trim());
                }
            }
        }
    }
};

const cleanHtml = (html: string): string => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // 1. Unwrap Google Redirects
    tempDiv.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (href && (href.startsWith('https://www.google.com/url') || href.startsWith('http://www.google.com/url'))) {
            try {
                const urlObj = new URL(href);
                const q = urlObj.searchParams.get('q');
                if (q) a.setAttribute('href', q);
            } catch (e) { /* ignore invalid URLs */ }
        }
    });

    // 2. Convert styled spans to semantic tags where possible for cleaner HTML
    tempDiv.querySelectorAll('span').forEach(span => {
        const style = span.getAttribute('style') || '';
        let content = span.innerHTML;
        let changed = false;
        
        if (/font-weight:\s*(700|bold)/i.test(style)) {
            content = `<strong>${content}</strong>`;
            changed = true;
        }
        if (/font-style:\s*italic/i.test(style)) {
            content = `<em>${content}</em>`;
            changed = true;
        }
        if (/text-decoration:\s*underline/i.test(style)) {
            content = `<u>${content}</u>`;
            changed = true;
        }
        
        if (changed) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = content;
            // If we converted everything semantic, we might not need the span wrapper if no other styles exist
            // But keeping it is safer for other props like color
            // We rely on the next step to strip the 'style' attribute of the converted properties if we wanted to be perfect, 
            // but filterStyles handles the keep list.
            span.innerHTML = content; 
        }
    });
    
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
        // Preserve specific structural attributes needed for tables and links
        const colspan = el.getAttribute('colspan');
        const rowspan = el.getAttribute('rowspan');
        const href = el.getAttribute('href');
        const target = el.getAttribute('target');
        const start = el.getAttribute('start'); // Ordered lists

        el.removeAttribute('class'); 
        el.removeAttribute('id');
        el.removeAttribute('dir');
        el.removeAttribute('align'); // Deprecated, rely on style
        
        // Restore critical attributes
        if (colspan) el.setAttribute('colspan', colspan);
        if (rowspan) el.setAttribute('rowspan', rowspan);
        if (href) el.setAttribute('href', href);
        if (target) el.setAttribute('target', target);
        if (start) el.setAttribute('start', start);
        
        const style = el.getAttribute('style');
        if (style) {
            const keptStyle = filterStyles(style);
            if (keptStyle) el.setAttribute('style', keptStyle.trim());
            else el.removeAttribute('style');
        }

        // Remove empty spans that might remain after style stripping
        if (el.tagName === 'SPAN' && !el.hasAttribute('style') && !el.attributes.length) {
             // Unwrap
             const parent = el.parentNode;
             if (parent) {
                 while (el.firstChild) parent.insertBefore(el.firstChild, el);
                 parent.removeChild(el);
             }
        }
    });

    // 3. Remove empty paragraphs
    // Google Docs often has empty paragraphs for spacing
    tempDiv.querySelectorAll('p').forEach(p => {
        // Check if truly empty (no text, no images, no breaks, no semantic children)
        if (!p.innerText.trim() && !p.querySelector('img') && !p.querySelector('br') && !p.querySelector('hr')) {
            p.remove();
        }
    });
    
    return tempDiv.innerHTML;
}

const parseEpub = async (file: File): Promise<Partial<Book>> => {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded. Please include it in your project.');
    }
    const zip = await new JSZip().loadAsync(file);

    // Case 1: The user zipped a single .epub file.
    const filesInZip = Object.keys(zip.files);
    const epubFilesInZip = filesInZip.filter(f => !zip.files[f].dir && f.toLowerCase().endsWith('.epub'));

    if (epubFilesInZip.length === 1 && !zip.file('META-INF/container.xml')) {
        const epubFileInside = zip.file(epubFilesInZip[0]);
        if (epubFileInside) {
            const epubContent = await epubFileInside.async('blob');
            const newFile = new File([epubContent], epubFilesInZip[0], { type: 'application/epub+zip' });
            return parseEpub(newFile); 
        }
    }

    // Case 2: Standard epub structure
    let containerFile = zip.file('META-INF/container.xml');
    let rootPath = '';

    if (!containerFile) {
        const possibleContainerFiles = zip.file(/META-INF\/container\.xml$/);
        if (possibleContainerFiles.length > 0) {
            containerFile = possibleContainerFiles[0];
            rootPath = containerFile.name.substring(0, containerFile.name.indexOf('META-INF/'));
        }
    }

    if (!containerFile) throw new Error('Invalid EPUB: META-INF/container.xml not found.');

    const containerXml = await containerFile.async('string');
    const parser = new DOMParser();
    const containerDoc = parser.parseFromString(containerXml, 'application/xml');

    let opfPath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
    if (!opfPath) throw new Error('Invalid EPUB: content.opf path not found.');
    opfPath = rootPath + opfPath;

    const contentFile = zip.file(opfPath);
    if (!contentFile) throw new Error(`Invalid EPUB: ${opfPath} not found.`);

    const contentXml = await contentFile.async('string');
    const contentDoc = parser.parseFromString(contentXml, 'application/xml');
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/'));

    const titleElements = Array.from(contentDoc.getElementsByTagName('dc:title'));
    const title = titleElements.length > 0 ? titleElements[0].textContent || file.name.replace('.epub', '') : file.name.replace('.epub', '');
    
    // Try to find subtitle if multiple titles exist
    const subtitle = titleElements.length > 1 ? titleElements[1].textContent || '' : '';

    const author = contentDoc.getElementsByTagName('dc:creator')[0]?.textContent || 'Unknown';

    const manifestItems = new Map<string, { href: string; mediaType: string }>();
    Array.from(contentDoc.getElementsByTagName('item')).forEach(item => {
        const id = item.getAttribute('id');
        const href = item.getAttribute('href');
        const mediaType = item.getAttribute('media-type');
        if (id && href && mediaType) {
            manifestItems.set(id, { href: `${opfDir}/${href}`, mediaType });
        }
    });

    // CSS Handling
    const cssClassMap = new Map<string, string>();
    for (const item of manifestItems.values()) {
        if (item.mediaType === 'text/css') {
            const cssFile = zip.file(item.href);
            if (cssFile) {
                try {
                    const cssText = await cssFile.async('string');
                    const newMap = parseCssClasses(cssText);
                    newMap.forEach((v, k) => cssClassMap.set(k, (cssClassMap.get(k) || '') + v));
                } catch (e) {
                    console.warn('Failed to parse CSS file', item.href, e);
                }
            }
        }
    }

    let coverImage: string | undefined = undefined;
     const metaCover = Array.from(contentDoc.getElementsByTagName('meta')).find(meta => meta.getAttribute('name') === 'cover');
    const coverId = metaCover?.getAttribute('content');
    
    if (coverId) {
        const coverItem = manifestItems.get(coverId);
        if (coverItem && coverItem.href && coverItem.mediaType.includes('image')) {
            const coverFile = zip.file(coverItem.href);
            if (coverFile) {
                try {
                    const coverData = await coverFile.async('base64');
                    coverImage = `data:${coverItem.mediaType};base64,${coverData}`;
                } catch (e) {}
            }
        }
    }

    const spineIds = Array.from(contentDoc.getElementsByTagName('itemref')).map(item => item.getAttribute('idref')).filter(Boolean) as string[];

    const outline: ChapterOutline[] = [];
    const content: ChapterContent[] = [];

    for (const id of spineIds) {
        const item = manifestItems.get(id);
        if (item && item.mediaType === 'application/xhtml+xml') {
            const chapterFile = zip.file(item.href);
            if (chapterFile) {
                const chapterXhtml = await chapterFile.async('string');
                const chapterDoc = parser.parseFromString(chapterXhtml, 'application/xhtml+xml');
                
                // Apply inline styles based on CSS
                inlineCssStyles(chapterDoc.documentElement, cssClassMap);

                // Process images
                const images = Array.from(chapterDoc.getElementsByTagName('img'));
                for(const img of images) {
                    const src = img.getAttribute('src');
                    if (src) {
                        const imgPath = new URL(src, `http://dummy.com/${item.href}`).pathname.substring(1);
                        const imgFile = zip.file(imgPath);
                        if (imgFile) {
                            const imgData = await imgFile.async('base64');
                            let mimeType = 'image/jpeg';
                             for (const manifestItem of manifestItems.values()) {
                                const manifestPath = manifestItem.href.split('/').pop();
                                const imageSrcPath = imgPath.split('/').pop();
                                if (manifestPath && imageSrcPath && manifestPath.endsWith(imageSrcPath)) {
                                    mimeType = manifestItem.mediaType;
                                    break;
                                }
                            }
                            img.src = `data:${mimeType};base64,${imgData}`;
                        }
                    }
                }

                const body = chapterDoc.getElementsByTagName('body')[0];
                const chapterTitle = chapterDoc.getElementsByTagName('title')[0]?.textContent || `Chapter ${outline.length + 1}`;
                const htmlContent = cleanHtml(body.innerHTML);
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;
                if ((tempDiv.textContent || '').trim().length > 100) {
                     outline.push({ title: chapterTitle, summary: 'Imported from EPUB' });
                     content.push({ title: chapterTitle, htmlContent });
                }
            }
        }
    }
    
    return { topic: title, subtitle, author, outline, content, coverImage };
};

const parsePdf = async (file: File): Promise<Partial<Book>> => {
    const data = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(data).promise;

    const metadata = await pdf.getMetadata();
    const info = metadata.info as any;
    const title = info?.Title || file.name.replace(/\.pdf$/, '');
    const author = info?.Author || 'Unknown';
    
    const outline: ChapterOutline[] = [];
    const content: ChapterContent[] = [];

    const docOutline = await pdf.getOutline();
    if (docOutline && docOutline.length > 0) {
        // Use bookmarks/outline for chapters if available
        for (let i = 0; i < docOutline.length; i++) {
            const item = docOutline[i];
            const nextPageItem = docOutline[i+1];
            
            const startPage = await pdf.getPageIndex(item.dest[0]);
            const endPage = nextPageItem ? await pdf.getPageIndex(nextPageItem.dest[0]) : pdf.numPages;

            let chapterText = '';
            for(let p = startPage + 1; p <= endPage; p++) {
                const page = await pdf.getPage(p);
                const textContent = await page.getTextContent();
                chapterText += textContent.items.map(i => (i as any).str).join(' ');
            }
            
            const html = `<p>${chapterText.replace(/\s+/g, ' ').replace(/(\r\n|\n|\r)/gm,"</p><p>")}</p>`;
            outline.push({ title: item.title, summary: 'Imported from PDF' });
            content.push({ title: item.title, htmlContent: cleanHtml(html) });
        }
    } else {
        // Fallback: Heuristic chapter detection
        let fullText = '';
        for(let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(i => (i as any).str).join(' ') + '\n\n';
        }
        
        const chapters = fullText.split(/(?=^ *(Chapter \d+|CHAPTER \w+|Prologue|Epilogue))/m).filter(c => c.trim());
        chapters.forEach((chapterText, i) => {
            const lines = chapterText.trim().split('\n');
            const chapterTitle = lines[0].trim() || `Chapter ${i+1}`;
            const body = lines.slice(1).join('\n');
            const html = `<p>${body.replace(/\s+/g, ' ').replace(/(\r\n|\n|\r)/gm,"</p><p>")}</p>`;

            outline.push({ title: chapterTitle, summary: 'Imported from PDF' });
            content.push({ title: chapterTitle, htmlContent: cleanHtml(html) });
        });
    }

    return { topic: title, author, outline, content };
}

/**
 * Extracts frontmatter (metadata between --- lines) and the body content.
 */
const parseFrontMatter = (text: string): { attributes: Record<string, string>, body: string } => {
    const frontMatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*([\s\S]*)$/;
    const match = text.match(frontMatterRegex);

    if (!match) {
        return { attributes: {}, body: text };
    }

    const attributes: Record<string, string> = {};
    const yamlContent = match[1];
    const body = match[2];

    yamlContent.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(':').trim().replace(/^['"](.*)['"]$/, '$1');
            attributes[key] = value;
        }
    });

    return { attributes, body };
};

const parseMarkdown = async (file: File, options: ImportOptions): Promise<Partial<Book>> => {
    const rawText = await file.text();
    const { attributes, body } = parseFrontMatter(rawText);
    
    const tokens = marked.lexer(body);
    const chapterSplitLevel = options.markdownSplitLevel || 1;
    const partSplitLevel = options.partSplitLevel;

    const outline: ChapterOutline[] = [];
    const content: ChapterContent[] = [];
    
    const definitionLinks = tokens.filter(t => t.type === 'def');

    let currentPart: string | undefined = undefined;
    let currentTitle = "Introduction";
    let currentTokens: any[] = [];
    
    const processCurrentChapter = () => {
        if (currentTokens.length > 0) {
            const hasContent = currentTokens.some(t => t.type !== 'space');
            if (hasContent) {
                const chapterTokens = [...currentTokens, ...definitionLinks];
                // @ts-ignore
                const html = marked.parser(chapterTokens);
                
                outline.push({ title: currentTitle, summary: 'Imported from Markdown', part: currentPart });
                content.push({ title: currentTitle, htmlContent: cleanHtml(html) });
            }
        }
    };

    for (const token of tokens) {
        if (token.type === 'heading') {
            if (partSplitLevel !== undefined && token.depth === partSplitLevel) {
                // If we hit a part header, process previous chapter first
                processCurrentChapter();
                currentPart = token.text;
                currentTitle = `${currentPart} - Intro`; // Temporary title if content follows immediately before next H(chapterLevel)
                currentTokens = []; // Reset content
            } else if (token.depth === chapterSplitLevel) {
                processCurrentChapter();
                currentTitle = token.text;
                currentTokens = [];
            } else {
                currentTokens.push(token);
            }
        } else {
            currentTokens.push(token);
        }
    }
    processCurrentChapter();

    if (outline.length === 0 && body.trim().length > 0) {
         const html = await marked.parse(body);
         outline.push({ title: "Full Content", summary: 'Imported from Markdown' });
         content.push({ title: "Full Content", htmlContent: cleanHtml(html) });
    }

    return {
        topic: attributes['title'] || file.name.replace(/\.(md|txt)$/, ''),
        subtitle: attributes['subtitle'] || '',
        author: attributes['author'] || 'Unknown',
        description: attributes['description'] || '',
        outline,
        content
    };
};

export const importFromGoogleDoc = async (fileId: string, title: string, options: ImportOptions = {}): Promise<Partial<Book>> => {
    const html = await getGoogleDocContent(fileId);
    const chapterSplitLevel = options.markdownSplitLevel || 1;
    const partSplitLevel = options.partSplitLevel;
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    let root = doc.body;

    // --- CSS INLINING START ---
    // Google Docs keeps styles in a <style> tag with classes like .c1, .c2 etc.
    // We must parse these and apply them inline to the elements, otherwise cleanHtml will strip the classes and lose formatting.
    const styleTags = doc.head.getElementsByTagName('style');
    let cssClassMap = new Map<string, string>();
    
    for (let i = 0; i < styleTags.length; i++) {
        const styleContent = styleTags[i].textContent || '';
        const docStyles = parseCssClasses(styleContent);
        docStyles.forEach((v, k) => cssClassMap.set(k, v));
    }
    
    // Apply the styles to the DOM
    if (root) {
        inlineCssStyles(root, cssClassMap);
    }
    // --- CSS INLINING END ---

    // Check if Google wrapped everything in a single div (common in some exports)
    if (root.children.length === 1 && root.children[0].tagName === 'DIV') {
        root = root.children[0] as HTMLElement;
    }
    
    const outline: ChapterOutline[] = [];
    const content: ChapterContent[] = [];
    
    let currentPart: string | undefined = undefined;
    let currentTitle = 'Introduction';
    let currentContent = '';
    
    const chapterTagName = `H${chapterSplitLevel}`;
    const partTagName = partSplitLevel ? `H${partSplitLevel}` : null;
    
    Array.from(root.children).forEach((node) => {
        // Skip empty text nodes or random spacers
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        if (partTagName && node.tagName === partTagName) {
             // Save previous chapter if it has content
            const cleanedPrev = cleanHtml(currentContent);
            if (cleanedPrev.trim()) {
                outline.push({ title: currentTitle, summary: 'Imported from Google Doc', part: currentPart });
                content.push({ title: currentTitle, htmlContent: cleanedPrev });
            }
            currentPart = node.textContent || 'Untitled Part';
            currentTitle = `${currentPart} - Intro`; // Reset
            currentContent = '';
        } else if (node.tagName === chapterTagName) {
            // Save previous chapter if it has content
            const cleanedPrev = cleanHtml(currentContent);
            if (cleanedPrev.trim()) {
                outline.push({ title: currentTitle, summary: 'Imported from Google Doc', part: currentPart });
                content.push({ title: currentTitle, htmlContent: cleanedPrev });
            }
            // Start new chapter
            currentTitle = node.textContent || 'Untitled Chapter';
            currentContent = ''; // Reset content
        } else {
            currentContent += (node as Element).outerHTML;
        }
    });
    
    // Push the last chapter
    const cleanedLast = cleanHtml(currentContent);
    if (cleanedLast.trim()) {
        outline.push({ title: currentTitle, summary: 'Imported from Google Doc', part: currentPart });
        content.push({ title: currentTitle, htmlContent: cleanedLast });
    }
    
    // If no headings were found, treat the whole doc as one chapter
    if (outline.length === 0 && root.innerHTML.trim()) {
        outline.push({ title: 'Document Content', summary: 'Imported from Google Doc' });
        content.push({ title: 'Document Content', htmlContent: cleanHtml(root.innerHTML) });
    }

    return {
        topic: title,
        author: 'Unknown', // Google API doesn't give author name in file metadata easily
        outline,
        content
    };
};

export const previewImportFile = async (file: File, options: ImportOptions = {}): Promise<Partial<Book>> => {
    try {
        const lowerCaseName = file.name.toLowerCase();
        // EPUBs are ZIP files, so we can try to parse .zip as well.
        if (lowerCaseName.endsWith('.epub') || lowerCaseName.endsWith('.zip')) {
            return await parseEpub(file);
        }
        if (lowerCaseName.endsWith('.pdf')) {
            return await parsePdf(file);
        }
        if (lowerCaseName.endsWith('.md') || lowerCaseName.endsWith('.txt')) {
            return await parseMarkdown(file, options);
        }

        throw new Error(`Unsupported file type: ${file.name}`);
    } catch (error: any) {
        console.error("Import failed:", error);
        // Provide a more specific error for zipped files that aren't valid EPUBs.
        if (file.name.toLowerCase().endsWith('.zip') && error.message.includes('Invalid EPUB')) {
             toastService.error(`Failed to parse ZIP. Please ensure it's a valid EPUB file.`);
        } else {
            toastService.error(`Failed to parse file: ${error.message}`);
        }
        throw error;
    }
};
