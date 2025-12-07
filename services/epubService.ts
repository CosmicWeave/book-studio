
import { Book, EpubExportOptions } from '../types';

declare const JSZip: any;

// Helper to escape XML characters
const escapeXml = (unsafe: string): string => {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
};

interface ProcessedImage {
    id: string;
    originalSrc: string;
    path: string;
    mimeType: string;
    extension: string;
    data: Blob;
}

export class EpubGenerator {
    private _book: Book;
    private _options: EpubExportOptions;
    private _zip: any;
    private _uuid: string;
    private _images: ProcessedImage[] = [];
    private _coverImage: ProcessedImage | null = null;

    constructor(book: Book, options: EpubExportOptions) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded. Please include it in your project.');
        }
        this._book = book;
        this._options = options;
        this._zip = new JSZip();
        this._uuid = crypto.randomUUID();
    }

    public async generate(): Promise<Blob> {
        this._addMimetype();
        this._addContainerXml();
        
        if (this._options.includeCover) {
            await this._processCoverImage();
        }

        const processedChapters = await this._processContentAndExtractImages();
        this._addStyles();
        await this._addImages();

        if (this._options.includeCover && this._coverImage) {
            this._addCoverXhtml();
        }
        
        this._addContentOpf(processedChapters);
        
        if (this._options.includeToc) {
            this._addTocNcx(processedChapters);
        }

        for (const chapter of processedChapters) {
            this._addChapterXhtml(chapter);
        }

        return this._zip.generateAsync({
            type: 'blob',
            mimeType: 'application/epub+zip',
            compression: 'DEFLATE'
        });
    }

    private _addMimetype(): void {
        this._zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    }

    private _addContainerXml(): void {
        const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
        this._zip.file('META-INF/container.xml', xml);
    }

    private async _processCoverImage(): Promise<void> {
        if (!this._book.coverImage || !this._book.coverImage.startsWith('data:')) {
            return;
        }

        try {
            const src = this._book.coverImage;
            const response = await fetch(src);
            const blob = await response.blob();
            const mimeType = blob.type || 'image/jpeg';
            const extension = mimeType.split('/')[1]?.split('+')[0] || 'jpeg';
            const id = 'cover-image';
            const path = `OEBPS/images/cover.${extension}`;

            this._coverImage = {
                id,
                originalSrc: src,
                path,
                mimeType,
                extension,
                data: blob
            };
        } catch (e) {
            console.warn(`Could not process cover image for EPUB.`, e);
            this._coverImage = null;
        }
    }

    private async _processContentAndExtractImages(): Promise<{ title: string; bodyContent: string; id: string; path: string }[]> {
        const processedChapters = [];
        let imageCounter = 1;
        let lastPart = '';

        for (const [index, chapter] of this._book.content.entries()) {
            if (!chapter || !chapter.htmlContent) continue;
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent || '';
            const imgElements = Array.from(tempDiv.getElementsByTagName('img'));

            for (const img of imgElements) {
                const src = img.getAttribute('src');
                if (src && src.startsWith('data:')) {
                    const existingImage = this._images.find(i => i.originalSrc === src);
                    if (existingImage) {
                        img.setAttribute('src', `../images/${existingImage.id}.${existingImage.extension}`);
                    } else {
                        try {
                            const response = await fetch(src);
                            const blob = await response.blob();
                            const mimeType = blob.type;
                            const extension = mimeType.split('/')[1]?.split('+')[0] || 'jpeg';
                            const id = `img${imageCounter++}`;
                            const path = `OEBPS/images/${id}.${extension}`;

                            const newImage: ProcessedImage = {
                                id,
                                originalSrc: src,
                                path,
                                mimeType,
                                extension,
                                data: blob
                            };
                            this._images.push(newImage);
                            img.setAttribute('src', `../images/${id}.${extension}`);
                        } catch (e) {
                            console.warn(`Could not process image for EPUB: ${src.substring(0, 50)}...`, e);
                            img.remove(); // Remove problematic image
                        }
                    }
                } else if (src) {
                    console.warn(`External image source "${src}" cannot be embedded in EPUB. Removing.`);
                    img.remove();
                }
            }
            
            let finalHtml = tempDiv.innerHTML;
            // 1. Ensure all <img> tags are self-closing for XHTML compatibility.
            finalHtml = finalHtml.replace(/<img([^>]*?)>/g, '<img$1 />');
            // 2. Replace <p> tags that ONLY contain an <img> with a <div>. This is better for ePub structure.
            finalHtml = finalHtml.replace(/<p>\s*(<img[^>]*?\/>)\s*<\/p>/gi, '<div>$1</div>');

            const outline = this._book.outline[index];

            let bodyContent = '';
            if (outline?.part && outline.part !== lastPart) {
                // Use h2 for parts, h3 for chapters as per standard practice, or h1 for parts if preferred.
                // Let's use h1 for Parts for visual distinction in readers that support it.
                bodyContent += `<h1 class="part-header">${escapeXml(outline.part)}</h1>`;
                if (outline.partContent) {
                    bodyContent += `<div class="part-content">${escapeXml(outline.partContent)}</div>`;
                }
                lastPart = outline.part;
            }
            bodyContent += `<h2>${escapeXml(chapter.title)}</h2>`;
            bodyContent += finalHtml;

            const chapterId = `chapter-${index + 1}`;
            processedChapters.push({
                title: chapter.title,
                bodyContent: bodyContent,
                id: chapterId,
                path: `OEBPS/xhtml/${chapterId}.xhtml`
            });
        }
        return processedChapters;
    }

    private _addStyles(): void {
        const defaultCss = `
body { font-family: "Palatino", "Iowan Old Style", "Apple Garamond", "Bookman", "Times New Roman", serif; line-height: 1.6; margin: 1em; }
h1.part-header { font-size: 2.5em; text-align: center; margin-top: 30%; margin-bottom: 1em; page-break-before: always; }
div.part-content { font-size: 1.2em; text-align: center; font-style: italic; margin-bottom: 30%; page-break-after: always; }
h2 { font-family: "Avenir Next", "Helvetica Neue", "Gill Sans", sans-serif; font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; text-align: left; page-break-after: avoid; border-bottom: 1px solid #ccc; padding-bottom: 0.2em; }
h3 { font-size: 1.6em; margin-top: 1.8em; font-weight: bold; }
h4 { font-size: 1.3em; font-style: italic; margin-top: 1.5em; }
p { text-align: justify; text-indent: 1.5em; margin: 0 0 0.75em 0; }
img { max-width: 90%; height: auto; display: block; margin: 2em auto; page-break-inside: avoid; border-radius: 4px; }
div { text-align: center; margin: 2em 0; text-indent: 0; }
ul, ol { margin-left: 1.5em; margin-bottom: 1em; text-align: left; text-indent: 0; }
li { margin-bottom: 0.25em; }
strong { font-weight: bold; }
em { font-style: italic; }
`;
        const finalCss = `${defaultCss}\n\n/* --- Custom User Styles --- */\n${this._options.customCss}`;
        this._zip.file('OEBPS/css/style.css', finalCss);
    }

    private async _addImages(): Promise<void> {
        if (this._options.includeCover && this._coverImage) {
            this._zip.file(this._coverImage.path, this._coverImage.data);
        }
        for (const image of this._images) {
            this._zip.file(image.path, image.data);
        }
    }
    
    private _addChapterXhtml(chapter: { title: string; bodyContent: string; id: string; path: string }): void {
        const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../css/style.css" />
</head>
<body>
  ${chapter.bodyContent}
</body>
</html>`;
        this._zip.file(chapter.path, xhtml);
    }

    private _addCoverXhtml(): void {
        if (!this._coverImage) return;
        const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" style="height:100%">
<head>
  <title>Cover</title>
  <style type="text/css">
    body { margin: 0; padding: 0; height: 100%; text-align: center; }
    svg { width: 100%; height: 100%; }
  </style>
</head>
<body epub:type="cover">
  <svg xmlns="http://www.w3.org/2000/svg" version="1.1" 
       xmlns:xlink="http://www.w3.org/1999/xlink"
       width="100%" height="100%" 
       viewBox="0 0 600 800" preserveAspectRatio="xMidYMid meet">
    <image width="600" height="800" xlink:href="../images/cover.${this._coverImage.extension}" />
  </svg>
</body>
</html>`;
        this._zip.file('OEBPS/xhtml/cover.xhtml', xhtml);
    }

    private _addContentOpf(processedChapters: { id: string; path: string }[]): void {
        const manifestItems = [`<item id="css" href="css/style.css" media-type="text/css" />`];
        
        if (this._options.includeToc) {
            manifestItems.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />`);
        }

        const spineItems = [];
        let coverMeta = '';
        let guideItems = '';

        if (this._options.includeCover && this._coverImage) {
            coverMeta = `\n    <meta name="cover" content="${this._coverImage.id}" />`;
            manifestItems.push(`<item id="cover" href="xhtml/cover.xhtml" media-type="application/xhtml+xml" />`);
            manifestItems.push(`<item id="${this._coverImage.id}" href="images/cover.${this._coverImage.extension}" media-type="${this._coverImage.mimeType}" />`);
            spineItems.push(`<itemref idref="cover" linear="no" />`);
            guideItems = `
  <guide>
    <reference type="cover" title="Cover" href="xhtml/cover.xhtml" />
  </guide>`;
        }

        processedChapters.forEach(chapter => {
            manifestItems.push(`<item id="${chapter.id}" href="xhtml/${chapter.id}.xhtml" media-type="application/xhtml+xml" />`);
            spineItems.push(`<itemref idref="${chapter.id}" />`);
        });

        this._images.forEach(image => {
            manifestItems.push(`<item id="${image.id}" href="images/${image.id}.${image.extension}" media-type="${image.mimeType}" />`);
        });
        
        const spineToc = this._options.includeToc ? ' toc="ncx"' : '';

        const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>${escapeXml(this._book.topic)}</dc:title>
    ${this._book.subtitle ? `<dc:title>${escapeXml(this._book.subtitle)}</dc:title>` : ''}
    <dc:creator opf:role="aut">${escapeXml(this._book.author || 'AI Book Studio')}</dc:creator>
    <dc:publisher>${escapeXml(this._book.publisher || 'AI Book Studio')}</dc:publisher>
    <dc:date>${escapeXml(this._book.publicationDate || new Date().getFullYear().toString())}</dc:date>
    <dc:description>${escapeXml(this._book.description || '')}</dc:description>
    <dc:identifier id="book-id">urn:uuid:${this._uuid}</dc:identifier>
    <dc:language>${escapeXml(this._book.language || 'en')}</dc:language>${coverMeta}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine${spineToc}>
    ${spineItems.join('\n    ')}
  </spine>${guideItems}
</package>`;
        this._zip.file('OEBPS/content.opf', opf);
    }

    private _addTocNcx(processedChapters: { title: string; id: string }[]): void {
        const navPoints = processedChapters.map((chapter, index) => `
    <navPoint id="navpoint-${index + 1}" playOrder="${index + 1}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="xhtml/${chapter.id}.xhtml" />
    </navPoint>`).join('');

        const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${this._uuid}" />
    <meta name="dtb:depth" content="1" />
    <meta name="dtb:totalPageCount" content="0" />
    <meta name="dtb:maxPageNumber" content="0" />
  </head>
  <docTitle><text>${escapeXml(this._book.topic)}</text></docTitle>
  <navMap>${navPoints}
  </navMap>
</ncx>`;
        this._zip.file('OEBPS/toc.ncx', ncx);
    }
}
