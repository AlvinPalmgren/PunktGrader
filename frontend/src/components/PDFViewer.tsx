import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Typography, Paper, Chip } from '@mui/material';
import { NavigateBefore, NavigateNext, ZoomIn, ZoomOut } from '@mui/icons-material';
import { pdfjsLib } from '../utils/pdfConfig';

interface PDFViewerProps {
  pdfData: string; // base64 encoded PDF
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onTotalPagesChange?: (totalPages: number) => void; // New prop to communicate total pages
  pageLabels: { [pageNumber: number]: number[] };
  onPageLabel: (pageNumber: number, problemNumber: number) => void;
  onRemovePageLabel: (pageNumber: number, problemNumber: number) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfData,
  currentPage,
  totalPages,
  onPageChange,
  onTotalPagesChange,
  pageLabels,
  onPageLabel,
  onRemovePageLabel,
  scale,
  onScaleChange
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setIsLoading(true);
        console.log('Loading PDF, data length:', pdfData?.length);
        
        if (!pdfData) {
          console.error('No PDF data provided');
          return;
        }
        
        // Convert base64 to Uint8Array
        const binaryStr = atob(pdfData);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        console.log('Converting to PDF document, bytes length:', bytes.length);
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;
        console.log('PDF loaded successfully, pages:', pdf.numPages);
        setPdfDoc(pdf);
        
        // Update parent component with actual page count
        if (onTotalPagesChange && pdf.numPages !== totalPages) {
          onTotalPagesChange(pdf.numPages);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
        console.error('PDF data sample:', pdfData?.substring(0, 100));
      } finally {
        setIsLoading(false);
      }
    };

    if (pdfData) {
      loadPDF();
    }
  }, [pdfData, onTotalPagesChange]); // Removed totalPages dependency to avoid infinite loops

  useEffect(() => {
    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) return;

        // Set canvas dimensions to match PDF page dimensions exactly
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        // Clear any existing content
        context.clearRect(0, 0, canvas.width, canvas.height);

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        console.log(`Rendered page ${currentPage}: ${viewport.width}x${viewport.height} at scale ${scale}`);
      } catch (error) {
        console.error('Error rendering page:', error);
      }
    };

    // Add a small delay to ensure PDF is fully loaded before rendering
    if (pdfDoc) {
      const timer = setTimeout(renderPage, 50);
      return () => clearTimeout(timer);
    }
  }, [pdfDoc, currentPage, scale]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handleZoomIn = () => {
    onScaleChange(Math.min(scale + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    onScaleChange(Math.max(scale - 0.25, 0.5));
  };

  if (isLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Loading PDF...</Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          PDF Data Length: {pdfData?.length || 0} characters
        </Typography>
      </Paper>
    );
  }

  if (!pdfDoc) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', border: '2px solid red' }}>
        <Typography color="error" variant="h6">
          Failed to Load PDF
        </Typography>
        <Typography variant="body2" sx={{ mt: 2 }}>
          PDF Data Available: {pdfData ? 'Yes' : 'No'}<br/>
          Data Length: {pdfData?.length || 0} characters<br/>
          Worker: {pdfjsLib.GlobalWorkerOptions.workerSrc}<br/>
        </Typography>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Check browser console for detailed error messages
        </Typography>
      </Paper>
    );
  }

  const currentProblems = pageLabels[currentPage] || [];
  const actualTotalPages = pdfDoc?.numPages || totalPages;
  const NOT_A_PROBLEM = -1;

  return (
    <Box>
      {/* PDF Controls */}
      <Paper sx={{ p: 3, mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', border: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            onClick={handlePrevPage} 
            disabled={currentPage <= 1}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { color: '#cbd5e1' }
            }}
          >
            <NavigateBefore />
          </IconButton>
          
          <Typography variant="body2" sx={{ minWidth: 80, textAlign: 'center', color: '#1e293b', fontWeight: 500 }}>
            Page {currentPage} of {actualTotalPages}
          </Typography>
          
          <IconButton 
            onClick={handleNextPage} 
            disabled={currentPage >= actualTotalPages}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { color: '#cbd5e1' }
            }}
          >
            <NavigateNext />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton 
            onClick={handleZoomOut} 
            disabled={scale <= 0.5}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { color: '#cbd5e1' }
            }}
          >
            <ZoomOut />
          </IconButton>
          
          <Typography variant="body2" sx={{ minWidth: 60, textAlign: 'center', color: '#1e293b', fontWeight: 500 }}>
            {Math.round(scale * 100)}%
          </Typography>
          
          <IconButton 
            onClick={handleZoomIn} 
            disabled={scale >= 3.0}
            sx={{ 
              color: '#64748b',
              '&:hover': { backgroundColor: '#f8fafc' },
              '&:disabled': { color: '#cbd5e1' }
            }}
          >
            <ZoomIn />
          </IconButton>
        </Box>

        {currentProblems.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {currentProblems.map((problemNum) => (
              <Chip
                key={problemNum}
                label={problemNum === NOT_A_PROBLEM ? 'Not a problem' : `Problem ${problemNum}`}
                sx={{
                  backgroundColor: problemNum === NOT_A_PROBLEM ? '#6b7280' : '#6366f1',
                  color: 'white',
                  fontWeight: 500
                }}
                variant="filled"
                onDelete={() => onRemovePageLabel(currentPage, problemNum)}
                deleteIcon={
                  <Box sx={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>×</Box>
                }
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* PDF Canvas */}
      <Paper 
        sx={{ 
          p: 3, 
          display: 'flex', 
          justifyContent: 'center',
          overflow: 'auto',
          maxHeight: '70vh',
          border: '1px solid #f1f5f9',
          backgroundColor: '#fefefe'
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{ 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            maxWidth: '100%',
            height: 'auto',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            objectFit: 'contain',
            boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.05)'
          }} 
        />
      </Paper>
    </Box>
  );
};

export default PDFViewer; 