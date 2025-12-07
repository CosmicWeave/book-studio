
import { Book, EpubExportOptions } from '../types';
import { toastService } from './toastService';
import { EpubGenerator } from './epubService';

declare const jspdf: any;
declare const html2canvas: any;

const escapeHtml = (unsafe: string): string => {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export const exportToPdf = async (book: Book): Promise<void> => {
    const { jsPDF } = (window as any).jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pdfMargin = 40;
    const contentWidth = pdfWidth - pdfMargin * 2;
    const contentHeight = pdfHeight - pdfMargin * 2;

    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.width = `${contentWidth}pt`;
    printContainer.style.fontFamily = 'Times, serif';
    printContainer.style.color = 'black';

    // Add styles for proper typography in the PDF
    const styleSheet = document.createElement('style');
    styleSheet.innerHTML = `
        :root {
            font-size: 12pt;
            line-height: 1.6;
        }
        h1.book-title { font-size: 28pt; font-weight: 800; text-align: center; margin-bottom: 0.5em; line-height: 1.2; }
        h2.book-subtitle { font-size: 18pt; font-weight: 300; text-align: center; margin-bottom: 2em; font-style: italic; color: #555; }
        h2.part-header { font-size: 24pt; text-align: center; margin-top: 100pt; margin-bottom: 20pt; font-weight: bold; page-break-before: always; }
        div.part-content { font-size: 14pt; text-align: center; font-style: italic; margin-bottom: 100pt; padding: 0 2em; }
        h3.chapter-title { font-size: 20pt; margin-top: 40pt; margin-bottom: 20pt; font-weight: bold; text-align: left; border-bottom: 1px solid #ccc; padding-bottom: 5pt; page-break-before: always; page-break-after: avoid; }
        h4 { font-size: 16pt; margin-top: 24pt; margin-bottom: 12pt; font-weight: bold; page-break-after: avoid; }
        h5 { font-size: 14pt; margin-top: 18pt; margin-bottom: 10pt; font-weight: bold; font-style: italic; }
        p { margin-bottom: 12pt; text-align: justify; }
        ul, ol { margin-left: 25pt; margin-bottom: 10pt; }
        li { margin-bottom: 5pt; }
        img { max-width: 100%; height: auto; display: block; margin: 20pt auto; border-radius: 0.25rem; }
    `;
    printContainer.appendChild(styleSheet);


    // Title Page
    const titlePage = document.createElement('div');
    titlePage.style.width = `${contentWidth}pt`;
    titlePage.style.height = `${contentHeight}pt`;
    titlePage.style.display = 'flex';
    titlePage.style.flexDirection = 'column';
    titlePage.style.justifyContent = 'center';
    titlePage.style.alignItems = 'center';
    titlePage.innerHTML = `
        <h1 class="book-title">${book.topic}</h1>
        ${book.subtitle ? `<h2 class="book-subtitle">${book.subtitle}</h2>` : ''}
        <p style="font-size: 14pt; text-align: center; margin-top: 2em;">By ${book.author || 'AI Book Studio'}</p>
    `;
    printContainer.appendChild(titlePage);
    
    // Content Pages
    let lastPart = '';
    book.content.forEach((content, index) => {
        if (!content) return;
        
        const outline = book.outline[index];
        let chapterHtml = '';

        if (outline?.part && outline.part !== lastPart) {
            chapterHtml += `<h2 class="part-header">${escapeHtml(outline.part)}</h2>`;
            if (outline.partContent) {
                chapterHtml += `<div class="part-content">${escapeHtml(outline.partContent)}</div>`;
            }
            lastPart = outline.part;
        }
        
        chapterHtml += `
            <div>
                <h3 class="chapter-title">${escapeHtml(content.title)}</h3>
                <div>${content.htmlContent || ''}</div>
            </div>`;
            
        const chapterDiv = document.createElement('div');
        chapterDiv.innerHTML = chapterHtml;
        printContainer.appendChild(chapterDiv);
    });

    document.body.appendChild(printContainer);

    try {
        const canvas = await (window as any).html2canvas(printContainer, {
            scale: 2, // Higher scale for better quality
        });

        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        
        const canvasWidth = imgProps.width;
        const canvasHeight = imgProps.height;
        
        const ratio = canvasHeight / canvasWidth;
        const totalPdfHeight = contentWidth * ratio;

        let heightLeft = totalPdfHeight;
        let position = 0;
        
        pdf.addImage(imgData, 'PNG', pdfMargin, pdfMargin, contentWidth, totalPdfHeight);
        heightLeft -= contentHeight;

        while (heightLeft > 0) {
            position -= pdfHeight; // Move the image "up" on the page to show the next part
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', pdfMargin, position + pdfMargin, contentWidth, totalPdfHeight);
            heightLeft -= pdfHeight;
        }

        // Add page numbers
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            if (i > 1) { // No page number on title page
                pdf.text(
                    `Page ${i - 1}`,
                    pdfWidth / 2,
                    pdfHeight - 20,
                    { align: 'center' }
                );
            }
        }
        
        pdf.save(`${book.topic.replace(/ /g, '_')}.pdf`);

    } catch (error) {
        console.error("Failed to export PDF:", error);
        toastService.error("An error occurred during PDF export. The content might be too large or complex. See console for details.");
    } finally {
        document.body.removeChild(printContainer);
    }
};

export const exportToEpub = async (book: Book, options: EpubExportOptions): Promise<void> => {
    try {
        const generator = new EpubGenerator(book, options);
        const epubBlob = await generator.generate();

        const url = URL.createObjectURL(epubBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${book.topic.replace(/ /g, '_')}.epub`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to generate ePub:", error);
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        toastService.error(`An error occurred during ePub export: ${message}`);
    }
};
