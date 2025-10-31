import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generate a PDF from a React component
 */
export async function generateBracketPDF(
  element: HTMLElement,
  filename: string = 'bracket.pdf'
): Promise<void> {
  try {
    // Create canvas from HTML element
    const canvas = await html2canvas(element, {
      scale: 1.5, // Reduced scale for better compatibility
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (element) => {
        // Skip elements that might cause color parsing issues
        return element.classList.contains('ignore-pdf');
      },
      onclone: (clonedDoc) => {
        // Remove any problematic CSS that might cause lab() color issues
        const style = clonedDoc.createElement('style');
        style.textContent = `
          * {
            color: inherit !important;
            background-color: inherit !important;
          }
        `;
        clonedDoc.head.appendChild(style);
      }
    });

    // Calculate PDF dimensions - use landscape for better bracket fit
    const imgWidth = 297; // A4 landscape width in mm
    const pageHeight = 210; // A4 landscape height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF in landscape mode
    const pdf = new jsPDF('l', 'mm', 'a4');
    
    // Scale to fit landscape page
    const margin = 10;
    const maxWidth = imgWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);
    
    let finalWidth = imgWidth - (margin * 2);
    let finalHeight = imgHeight;
    
    // Scale down if too tall
    if (imgHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = (canvas.width * finalHeight) / canvas.height;
    }
    
    // Scale down if too wide
    if (finalWidth > maxWidth) {
      finalWidth = maxWidth;
      finalHeight = (canvas.height * finalWidth) / canvas.width;
    }
    
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      margin,
      margin,
      finalWidth,
      finalHeight
    );

    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

/**
 * Generate PDF with multiple pages for large content
 */
export async function generateMultiPageBracketPDF(
  element: HTMLElement,
  filename: string = 'bracket.pdf'
): Promise<void> {
  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: element.scrollWidth,
      height: element.scrollHeight,
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    if (imgHeight <= pageHeight) {
      // Single page
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        10,
        10,
        imgWidth - 20,
        imgHeight
      );
    } else {
      // Multiple pages
      const totalPages = Math.ceil(imgHeight / (pageHeight - 20));
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const yOffset = i * (pageHeight - 20);
        const remainingHeight = Math.min(pageHeight - 20, imgHeight - yOffset);
        
        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          10,
          10 - yOffset,
          imgWidth - 20,
          imgHeight
        );
      }
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating multi-page PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}
