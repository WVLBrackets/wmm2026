'use client';

import { useState, useRef } from 'react';
import { generateBracketPDF } from '@/lib/pdfGenerator';

export function usePDFGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const generatePDF = async (filename?: string) => {
    if (!printRef.current) {
      setError('No content to print');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      await generateBracketPDF(printRef.current, filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    printRef,
    generatePDF,
    isGenerating,
    error,
    clearError: () => setError(null)
  };
}

