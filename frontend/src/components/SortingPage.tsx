import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Stack
} from '@mui/material';
import { Save, NavigateNext, Person } from '@mui/icons-material';
import PDFViewer from './PDFViewer';
import PageLabeler from './PageLabeler';

interface SortingPageProps {
  studentId: number;
  onStudentComplete: () => void;
}

interface StudentData {
  studentId: number;
  studentName: string;
  pdfData: string;
  pageLabels: { [pageNumber: number]: number };
}

const SortingPage: React.FC<SortingPageProps> = ({ studentId, onStudentComplete }) => {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLabels, setPageLabels] = useState<{ [pageNumber: number]: number }>({});
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Load student data
  useEffect(() => {
    const loadStudent = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        const response = await fetch(`/api/student/${studentId}`);
        const result = await response.json();
        
        if (result.success) {
          setStudentData({
            studentId: result.studentId,
            studentName: result.studentName,
            pdfData: result.pdfData,
            pageLabels: result.pageLabels || {}
          });
          setStudentName(result.studentName || '');
          setPageLabels(result.pageLabels || {});
          
          // Calculate total pages from PDF data
          // This is approximate - the PDFViewer will set the exact count
          setTotalPages(10); // Will be updated by PDFViewer
        } else {
          setError(result.error || 'Failed to load student data');
        }
      } catch (error) {
        console.error('Load student error:', error);
        setError('Failed to load student data');
      } finally {
        setIsLoading(false);
      }
    };

    loadStudent();
  }, [studentId]);

  // Handle page labeling
  const handlePageLabel = useCallback((pageNumber: number, problemNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      if (problemNumber > 0) {
        newLabels[pageNumber] = problemNumber;
      } else {
        delete newLabels[pageNumber];
      }
      return newLabels;
    });
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return; // Don't handle shortcuts when typing in input fields
      }

      // Number keys 1-9 for quick labeling
      if (event.key >= '1' && event.key <= '9') {
        const problemNumber = parseInt(event.key);
        handlePageLabel(currentPage, problemNumber);
        event.preventDefault();
      }
      
      // Arrow keys for navigation
      if (event.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(currentPage - 1);
        event.preventDefault();
      }
      if (event.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, totalPages, handlePageLabel]);

  // Handle saving and submitting
  const handleSubmit = async () => {
    if (!studentName.trim()) {
      setError('Please enter the student name');
      return;
    }

    if (Object.keys(pageLabels).length === 0) {
      setError('Please label at least one page');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId,
          studentName: studentName.trim(),
          pageLabels
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setSuccess('Student processed successfully!');
        setTimeout(() => {
          onStudentComplete();
        }, 1500); // Show success message briefly before moving to next student
      } else {
        setError(result.error || 'Failed to process student');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Failed to submit student data');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading student PDF...
        </Typography>
      </Box>
    );
  }

  if (!studentData) {
    return (
      <Alert severity="error">
        Failed to load student data. Please try refreshing the page.
      </Alert>
    );
  }

  const labeledPages = Object.keys(pageLabels).length;
  const uniqueProblems = new Set(Object.values(pageLabels)).size;

  return (
    <Box>
      {/* Student Info Section */}
      <Paper sx={{ p: 4, mb: 3, border: '1px solid #f1f5f9' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Person sx={{ color: '#6366f1', fontSize: 28 }} />
          <Typography variant="h5" sx={{ color: '#1e293b', fontWeight: 600 }}>
            Student {studentId}
          </Typography>
          <Chip 
            label={`${labeledPages} pages labeled`} 
            sx={{ 
              backgroundColor: labeledPages > 0 ? '#dcfce7' : '#f8fafc',
              color: labeledPages > 0 ? '#166534' : '#64748b',
              border: 'none'
            }}
            variant="filled"
          />
          <Chip 
            label={`${uniqueProblems} problems`} 
            sx={{ 
              backgroundColor: uniqueProblems > 0 ? '#dbeafe' : '#f8fafc',
              color: uniqueProblems > 0 ? '#1e40af' : '#64748b',
              border: 'none'
            }}
            variant="filled"
          />
        </Box>

        <TextField
          label="Student Name"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          fullWidth
          required
          sx={{ mb: 2 }}
          placeholder="Enter the student's name"
        />

        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={isSaving || !studentName.trim() || labeledPages === 0}
          startIcon={isSaving ? <CircularProgress size={20} /> : <Save />}
          sx={{ 
            mr: 2,
            py: 1.5,
            px: 4,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            }
          }}
        >
          {isSaving ? 'Processing...' : 'Submit & Next Student'}
        </Button>

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Main Content Grid */}
      <Grid container spacing={3}>
        {/* PDF Viewer */}
        <Grid item xs={12} md={8}>
          <PDFViewer
            pdfData={studentData.pdfData}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onTotalPagesChange={setTotalPages}
            pageLabels={pageLabels}
            onPageLabel={handlePageLabel}
            scale={scale}
            onScaleChange={setScale}
          />
        </Grid>

        {/* Page Labeler */}
        <Grid item xs={12} md={4}>
          <PageLabeler
            currentPage={currentPage}
            pageLabels={pageLabels}
            onPageLabel={handlePageLabel}
          />
          
          {/* Page Summary */}
          <Paper sx={{ p: 3, mt: 2, border: '1px solid #f1f5f9' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Page Summary
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                const problemNum = pageLabels[pageNum];
                return (
                  <Chip
                    key={pageNum}
                    label={`P${pageNum}: ${problemNum || '?'}`}
                    size="small"
                    sx={{
                      backgroundColor: pageNum === currentPage ? '#6366f1' : 
                                     problemNum ? '#dbeafe' : '#f8fafc',
                      color: pageNum === currentPage ? 'white' : 
                             problemNum ? '#1e40af' : '#64748b',
                      border: pageNum === currentPage ? 'none' : '1px solid #e2e8f0',
                      fontWeight: 500,
                      '&:hover': { 
                        backgroundColor: pageNum === currentPage ? '#4f46e5' : '#f1f5f9',
                        cursor: 'pointer'
                      }
                    }}
                    variant="filled"
                    onClick={() => setCurrentPage(pageNum)}
                    clickable
                  />
                );
              })}
            </Stack>
          </Paper>

          {/* Keyboard Shortcuts */}
          <Paper sx={{ p: 3, mt: 2, border: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Keyboard Shortcuts
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Numbers 1-9: Quick label current page
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Left/Right arrows: Navigate pages
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Enter: Apply custom label
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SortingPage; 