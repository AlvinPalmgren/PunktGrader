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

interface StudentData {
  studentId: number;
  studentName: string;
  pdfData: string;
  pageLabels: { [pageNumber: number]: number[] }; // Array of problem numbers per page
}

interface SortingPageProps {
  studentId: number;
  onStudentComplete: () => void;
  totalStudents: number; // Need this to know if we should prefetch next student
  prefetchedStudentData?: StudentData | null; // Prefetched data for current student
  onPrefetchComplete?: (studentId: number, data: StudentData) => void; // Callback when prefetch completes
}

const SortingPage: React.FC<SortingPageProps> = ({ 
  studentId, 
  onStudentComplete, 
  totalStudents, 
  prefetchedStudentData, 
  onPrefetchComplete 
}) => {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageLabels, setPageLabels] = useState<{ [pageNumber: number]: number[] }>({});
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Prefetching state
  const [hasPrefetchedNext, setHasPrefetchedNext] = useState(false);
  const [isUserLabeling, setIsUserLabeling] = useState(false);
  
  // State for timing-based two-digit keyboard input
  const [lastAddedProblem, setLastAddedProblem] = useState<number | null>(null);
  const [lastAddedTimestamp, setLastAddedTimestamp] = useState<number>(0);
  const [lastAddedTimeout, setLastAddedTimeout] = useState<number | null>(null);
  const [lastAddedWasNew, setLastAddedWasNew] = useState<boolean>(false);

  // Clear two-digit combination state when page changes
  useEffect(() => {
    if (lastAddedTimeout) {
      clearTimeout(lastAddedTimeout);
    }
    setLastAddedProblem(null);
    setLastAddedTimestamp(0);
    setLastAddedTimeout(null);
    setLastAddedWasNew(false);
  }, [currentPage]);

  // Prefetch next student's PDF in background
  const prefetchNextStudent = useCallback(async () => {
    const nextStudentId = studentId + 1;
    
    // Don't prefetch if this is the last student or we already prefetched
    if (nextStudentId > totalStudents || hasPrefetchedNext) {
      console.log(`🚫 Skipping prefetch: nextId=${nextStudentId}, total=${totalStudents}, alreadyPrefetched=${hasPrefetchedNext}`);
      return;
    }

    try {
      console.log(`🔄 Starting background prefetch of student ${nextStudentId} (current: ${studentId})`);
      setHasPrefetchedNext(true);
      const prefetchStartTime = performance.now();

      const response = await fetch(`/api/student/${nextStudentId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to prefetch student');
      }
      
      // Get metadata from headers
      const studentName = response.headers.get('X-Student-Name') || '';
      const pageLabels = JSON.parse(response.headers.get('X-Page-Labels') || '{}');
      
      // Convert binary response to base64 for PDF.js compatibility (non-blocking for large files)
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      console.log(`🔄 Converting ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB to base64...`);
      
      // For large files, chunk the base64 conversion to avoid blocking the main thread
      const base64String = await new Promise<string>((resolve) => {
        if (arrayBuffer.byteLength < 5 * 1024 * 1024) { // Less than 5MB, convert normally
          const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
          resolve(btoa(binaryString));
        } else {
                     // Large file - chunk the conversion to avoid UI blocking
           let binaryString = '';
           let index = 0;
           // Adaptive chunk size: larger files get bigger chunks for efficiency
           const chunkSize = Math.min(64 * 1024, Math.max(8192, Math.floor(arrayBuffer.byteLength / 200)));
          
          const processChunk = () => {
            const end = Math.min(index + chunkSize, uint8Array.length);
            for (let i = index; i < end; i++) {
              binaryString += String.fromCharCode(uint8Array[i]);
            }
            index = end;
            
            if (index < uint8Array.length) {
              // More chunks to process, yield control to UI
              setTimeout(processChunk, 0);
            } else {
              // Done, convert to base64
              resolve(btoa(binaryString));
            }
          };
          
          processChunk();
        }
      });
      
      const prefetchedData: StudentData = {
        studentId: nextStudentId,
        studentName: studentName,
        pdfData: base64String,
        pageLabels: pageLabels
      };

      const prefetchEndTime = performance.now();
      const sizeInMB = arrayBuffer.byteLength / 1024 / 1024;
      console.log(`✅ Background prefetch complete for student ${nextStudentId} in ${(prefetchEndTime - prefetchStartTime).toFixed(0)}ms`);
      console.log(`📊 Prefetched data: ${sizeInMB.toFixed(1)}MB → ${(base64String.length / 1024 / 1024).toFixed(1)}MB base64`);
      
      // Warn about large files that might cause performance issues
      if (sizeInMB > 20) {
        console.warn(`⚠️ Large file prefetched (${sizeInMB.toFixed(1)}MB) - consider optimizing PDF size for better performance`);
      }
      
      // Cache the prefetched data in parent (App state) - this should NOT affect current UI
      if (onPrefetchComplete) {
        console.log(`💾 Caching prefetched student ${nextStudentId} data in App state`);
        onPrefetchComplete(nextStudentId, prefetchedData);
      }
    } catch (error) {
      console.error(`❌ Background prefetch failed for student ${nextStudentId}:`, error);
      setHasPrefetchedNext(false); // Allow retry
    }
  }, [studentId, totalStudents, hasPrefetchedNext, onPrefetchComplete]);

  // Load student data - check for prefetched data first, then fetch if needed
  useEffect(() => {
    console.log(`📚 Loading student ${studentId}...`);
    
    const loadStudent = async () => {
      try {
        setIsLoading(true);
        setError('');
        
        // Reset prefetching state for new student
        setHasPrefetchedNext(false);
        setIsUserLabeling(false);
        
        // Check if we have prefetched data for this exact student
        // This check happens at load time to avoid dependency issues
        if (prefetchedStudentData && prefetchedStudentData.studentId === studentId) {
          console.log(`⚡ Using prefetched data for student ${studentId} - instant load!`);
          console.log(`📦 Prefetched data size: ${prefetchedStudentData.pdfData.length} chars`);
          
          setStudentData(prefetchedStudentData);
          setStudentName(prefetchedStudentData.studentName);
          setPageLabels(prefetchedStudentData.pageLabels);
          
          // Reset to page 1 when new student PDF is loaded
          setCurrentPage(1);
          setTotalPages(10); // Will be updated by PDFViewer
          
          setIsLoading(false);
          return;
        }
        
        // No prefetched data available, fetch normally
        console.log(`🔄 No prefetched data available, fetching student ${studentId} normally...`);
        const startTime = performance.now();
        const response = await fetch(`/api/student/${studentId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load student');
        }
        
        // Get metadata from headers
        const studentName = response.headers.get('X-Student-Name') || '';
        const pageLabels = JSON.parse(response.headers.get('X-Page-Labels') || '{}');
        
        // Convert binary response to base64 for PDF.js compatibility (non-blocking for large files)
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        console.log(`🔄 Converting ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)}MB to base64...`);
        
        // For large files, chunk the base64 conversion to avoid blocking the main thread
        const base64String = await new Promise<string>((resolve) => {
          if (arrayBuffer.byteLength < 5 * 1024 * 1024) { // Less than 5MB, convert normally
            const binaryString = uint8Array.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
            resolve(btoa(binaryString));
          } else {
            // Large file - chunk the conversion to avoid UI blocking
            let binaryString = '';
            let index = 0;
            // Adaptive chunk size: larger files get bigger chunks for efficiency
            const chunkSize = Math.min(64 * 1024, Math.max(8192, Math.floor(arrayBuffer.byteLength / 200)));
            
            const processChunk = () => {
              const end = Math.min(index + chunkSize, uint8Array.length);
              for (let i = index; i < end; i++) {
                binaryString += String.fromCharCode(uint8Array[i]);
              }
              index = end;
              
              if (index < uint8Array.length) {
                // More chunks to process, yield control to UI
                setTimeout(processChunk, 0);
              } else {
                // Done, convert to base64
                resolve(btoa(binaryString));
              }
            };
            
            processChunk();
          }
        });
        
        const endTime = performance.now();
        console.log(`✅ Loaded PDF for student ${studentId} in ${(endTime - startTime).toFixed(0)}ms, size: ${arrayBuffer.byteLength} bytes, converted to base64: ${base64String.length} chars`);
        
        setStudentData({
          studentId: studentId,
          studentName: studentName,
          pdfData: base64String,
          pageLabels: pageLabels
        });
        setStudentName(studentName);
        setPageLabels(pageLabels);
        
        // Reset to page 1 when new student PDF is loaded
        setCurrentPage(1);
        
        // Calculate total pages from PDF data
        // This is approximate - the PDFViewer will set the exact count
        setTotalPages(10); // Will be updated by PDFViewer
      } catch (error) {
        console.error('Load student error:', error);
        setError(error instanceof Error ? error.message : 'Failed to load student data');
      } finally {
        setIsLoading(false);
      }
    };

    loadStudent();
  }, [studentId]); // Only re-run when studentId changes, not when prefetch data arrives

  // Handle page labeling - now supports multiple problems per page
  const handlePageLabel = useCallback((pageNumber: number, problemNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      const currentProblems = newLabels[pageNumber] || [];
      
      if (problemNumber === -1) {
        // Handle "Not a problem" - replace all existing labels with just -1
        newLabels[pageNumber] = [-1];
      } else if (problemNumber > 0) {
        // For regular problems, only add if not already present and not marked as "Not a problem"
        if (!currentProblems.includes(-1) && !currentProblems.includes(problemNumber)) {
          newLabels[pageNumber] = [...currentProblems, problemNumber];
        }
      }
      
      // Trigger prefetching when user has made substantial progress (indicates strong commitment)
      if (!isUserLabeling && Object.keys(newLabels).length >= 3) {
        console.log('User has labeled several pages - triggering prefetch of next student');
        setIsUserLabeling(true);
        // Start prefetching in background with longer delay to avoid interfering
        setTimeout(() => prefetchNextStudent(), 4000);
      }
      
      return newLabels;
    });
  }, [isUserLabeling, prefetchNextStudent]);

  // Handle page labeling from keyboard - always adds labels (allows duplicates)
  const handleKeyboardPageLabel = useCallback((pageNumber: number, problemNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      const currentProblems = newLabels[pageNumber] || [];
      
      if (problemNumber === -1) {
        // Handle "Not a problem" - replace all existing labels with just -1
        newLabels[pageNumber] = [-1];
      } else if (problemNumber > 0) {
        // For regular problems, only add if not marked as "Not a problem"
        if (!currentProblems.includes(-1)) {
          newLabels[pageNumber] = [...currentProblems, problemNumber];
        }
      }
      
      // Trigger prefetching when user has made substantial progress via keyboard (indicates strong commitment)
      if (!isUserLabeling && Object.keys(newLabels).length >= 3) {
        console.log('User has labeled several pages via keyboard - triggering prefetch of next student');
        setIsUserLabeling(true);
        // Start prefetching in background with longer delay to avoid interfering
        setTimeout(() => prefetchNextStudent(), 4000);
      }
      
      return newLabels;
    });
    return true; // Return true to indicate a label was actually added
  }, [isUserLabeling, prefetchNextStudent]);

  // Handle removing a specific problem label from a page
  const handleRemovePageLabel = useCallback((pageNumber: number, problemNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      const currentProblems = newLabels[pageNumber] || [];
      const filteredProblems = currentProblems.filter(p => p !== problemNumber);
      
      if (filteredProblems.length === 0) {
        delete newLabels[pageNumber];
      } else {
        newLabels[pageNumber] = filteredProblems;
      }
      return newLabels;
    });
  }, []);

  // Handle removing the last instance of a specific problem label from a page
  const handleRemoveLastInstancePageLabel = useCallback((pageNumber: number, problemNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      const currentProblems = newLabels[pageNumber] || [];
      
      // Find the last occurrence and remove only that one
      const lastIndex = currentProblems.lastIndexOf(problemNumber);
      if (lastIndex !== -1) {
        const updatedProblems = [...currentProblems];
        updatedProblems.splice(lastIndex, 1);
        
        if (updatedProblems.length === 0) {
          delete newLabels[pageNumber];
        } else {
          newLabels[pageNumber] = updatedProblems;
        }
      }
      return newLabels;
    });
  }, []);

  // Handle removing the most recent label (backslash shortcut)
  const handleRemoveLastLabel = useCallback((pageNumber: number) => {
    setPageLabels(prev => {
      const newLabels = { ...prev };
      const currentProblems = newLabels[pageNumber] || [];
      
      if (currentProblems.length > 0) {
        const updatedProblems = [...currentProblems];
        updatedProblems.pop(); // Remove the last (most recent) problem
        
        if (updatedProblems.length === 0) {
          delete newLabels[pageNumber];
        } else {
          newLabels[pageNumber] = updatedProblems;
        }
      }
      return newLabels;
    });
  }, []);

  // Handle keyboard shortcuts with timing-based two-digit support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target && (event.target as HTMLElement).tagName === 'INPUT') {
        return; // Don't handle shortcuts when typing in input fields
      }

      // Prevent key repeat
      if (event.repeat) return;

      const key = event.key;
      const now = Date.now();

             // Number keys 1-9 and 0 for quick labeling (timing-based two-digit combinations)
       if ((key >= '1' && key <= '9') || key === '0') {
         const newProblemNumber = parseInt(key);
         const currentProblems = pageLabels[currentPage] || [];
         
         // First, check if we need to clear expired state
         if (lastAddedProblem !== null && lastAddedTimestamp > 0 && (now - lastAddedTimestamp) > 500) {
           // More than 500ms has passed, clear the state
           if (lastAddedTimeout) {
             clearTimeout(lastAddedTimeout);
           }
           setLastAddedProblem(null);
           setLastAddedTimestamp(0);
           setLastAddedTimeout(null);
           setLastAddedWasNew(false);
         }
         
         // Special handling for '0' - it can only be used as second digit
         if (key === '0') {
           // 0 can only be used as second digit in combination
           if (lastAddedProblem !== null && 
               lastAddedTimestamp > 0 && 
               (now - lastAddedTimestamp) <= 500) {
             // Clear the existing timeout
             if (lastAddedTimeout) {
               clearTimeout(lastAddedTimeout);
               setLastAddedTimeout(null);
             }
             
             // Create the two-digit combination (e.g., 10, 20, 30, etc.)
             const combinedNumber = parseInt(lastAddedProblem.toString() + key);
             
             // Only add the combined number if it doesn't already exist
             if (!currentProblems.includes(combinedNumber)) {
               // If the first digit was actually added (was new), remove it first
               if (lastAddedWasNew) {
                 handleRemoveLastInstancePageLabel(currentPage, lastAddedProblem);
               }
               
               // Add the two-digit combination
               handleKeyboardPageLabel(currentPage, combinedNumber);
             }
             
             // Clear the last added state
             setLastAddedProblem(null);
             setLastAddedTimestamp(0);
             setLastAddedWasNew(false);
           }
           // If no recent digit or outside 500ms window, do nothing with '0'
           event.preventDefault();
           return;
         }
         
         // Check if this should be a two-digit combination (for digits 1-9)
         // Only allow if we have a recent label AND we're still within the 500ms window
         if (lastAddedProblem !== null && 
             lastAddedTimestamp > 0 && 
             (now - lastAddedTimestamp) <= 500) {
           // Clear the existing timeout
           if (lastAddedTimeout) {
             clearTimeout(lastAddedTimeout);
             setLastAddedTimeout(null);
           }
           
           // Create the two-digit combination
           const combinedNumber = parseInt(lastAddedProblem.toString() + key);
           
           // Only add the combined number if it doesn't already exist
           if (!currentProblems.includes(combinedNumber)) {
             // If the first digit was actually added (was new), remove it first
             if (lastAddedWasNew) {
               handleRemoveLastInstancePageLabel(currentPage, lastAddedProblem);
             }
             
             // Add the two-digit combination
             handleKeyboardPageLabel(currentPage, combinedNumber);
           }
           
           // Clear the last added state
           setLastAddedProblem(null);
           setLastAddedTimestamp(0);
           setLastAddedWasNew(false);
         } else {
           // Clear any existing timeout since we're starting fresh
           if (lastAddedTimeout) {
             clearTimeout(lastAddedTimeout);
           }
           
           // Check if this number already exists on the page
           const alreadyExists = currentProblems.includes(newProblemNumber);
           let wasAdded = false;
           
           // Add the single digit label only if it doesn't already exist
           if (!alreadyExists) {
             handleKeyboardPageLabel(currentPage, newProblemNumber);
             wasAdded = true;
           }
           
           // Always record the press for potential two-digit combination
           setLastAddedProblem(newProblemNumber);
           setLastAddedTimestamp(now);
           setLastAddedWasNew(wasAdded);
           
           // Set timeout to clear the state after 500ms
           const timeoutId = setTimeout(() => {
             setLastAddedProblem(null);
             setLastAddedTimestamp(0);
             setLastAddedTimeout(null);
             setLastAddedWasNew(false);
           }, 500);
           setLastAddedTimeout(timeoutId);
         }
         
         event.preventDefault();
       }
      
      // Arrow keys for navigation
      if (key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(currentPage - 1);
        event.preventDefault();
      }
      if (key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
        event.preventDefault();
      }
      
      // Backspace key to remove most recent label
      if (key === 'Backspace') {
        handleRemoveLastLabel(currentPage);
        event.preventDefault();
      }

      // Spacebar key for "Not a problem"
      if (key === ' ') {
        handleKeyboardPageLabel(currentPage, -1);
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      // Clear timeout on cleanup
      if (lastAddedTimeout) {
        clearTimeout(lastAddedTimeout);
      }
    };
  }, [currentPage, totalPages, pageLabels, handlePageLabel, handleKeyboardPageLabel, handleRemovePageLabel, handleRemoveLastInstancePageLabel, handleRemoveLastLabel, 
      lastAddedProblem, lastAddedTimestamp, lastAddedTimeout, lastAddedWasNew]);

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

    // Check if all pages are labeled
    const unlabeledPages = [];
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (!pageLabels[pageNum] || pageLabels[pageNum].length === 0) {
        unlabeledPages.push(pageNum);
      }
    }

    if (unlabeledPages.length > 0) {
      setError(`Please label all pages. Missing labels for page${unlabeledPages.length > 1 ? 's' : ''}: ${unlabeledPages.join(', ')}`);
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
        setSuccess('Student submitted! Processing in background...');
        console.log(`Student ${studentId} submitted successfully, processing in background`);
        
        // Note: Prefetching should already be happening in background from when user started labeling
        // No need to trigger it here as well
        
        // Proceed to next student immediately - no need to wait for processing
        setTimeout(() => {
          onStudentComplete();
        }, 300); // Very brief delay just for user feedback
      } else {
        setError(result.error || 'Failed to process student');
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError('Failed to submit student data');
    } finally {
      setTimeout(() => setIsSaving(false), 300);
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
  const uniqueProblems = new Set(Object.values(pageLabels).flat()).size;

  // Check if all pages are labeled
  const allPagesLabeled = totalPages > 0 && Array.from({ length: totalPages }, (_, i) => i + 1)
    .every(pageNum => pageLabels[pageNum] && pageLabels[pageNum].length > 0);

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
            label={`${labeledPages} of ${totalPages} pages labeled`} 
            sx={{ 
              backgroundColor: allPagesLabeled ? '#dcfce7' : '#fef2f2',
              color: allPagesLabeled ? '#166534' : '#dc2626',
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

        {!allPagesLabeled && totalPages > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              All pages must be labeled before proceeding to the next student. 
              You can label pages with problem numbers or mark them as "Not a problem" if they don't contain any problems.
            </Typography>
          </Alert>
        )}

        <Button
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={isSaving || !studentName.trim() || !allPagesLabeled}
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
      <Grid container spacing={3} sx={{ alignItems: 'flex-start' }}>
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
            onRemovePageLabel={handleRemovePageLabel}
            scale={scale}
            onScaleChange={setScale}
          />
        </Grid>

        {/* Page Labeler */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PageLabeler
            currentPage={currentPage}
            pageLabels={pageLabels}
            onPageLabel={handlePageLabel}
            onRemovePageLabel={handleRemovePageLabel}
          />
          
          {/* Page Summary */}
          <Paper sx={{ p: 3, border: '1px solid #f1f5f9' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Page Summary
            </Typography>
            <Grid container spacing={1}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                const problemNums = pageLabels[pageNum] || [];
                const problemsText = problemNums.length > 0 ? problemNums.join(',') : '?';
                return (
                  <Grid item xs={6} sm={4} md={3} key={pageNum}>
                    <Chip
                      label={`P${pageNum}: ${problemsText}`}
                      size="small"
                      sx={{
                        width: '100%',
                        backgroundColor: pageNum === currentPage ? '#6366f1' : 
                                       problemNums.length > 0 ? '#dbeafe' : '#f8fafc',
                        color: pageNum === currentPage ? 'white' : 
                               problemNums.length > 0 ? '#1e40af' : '#64748b',
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
                  </Grid>
                );
              })}
            </Grid>
          </Paper>

          {/* Keyboard Shortcuts */}
          <Paper sx={{ p: 3, border: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Keyboard Shortcuts
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Numbers 1-9: Quick label current page
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Two digits: Press 1, then 2 within 500ms = Problem 12
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Tens: Press 1, then 0 within 500ms = Problem 10
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Left/Right arrows: Navigate pages
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Backspace: Remove last added label
            </Typography>
            <Typography variant="caption" display="block" sx={{ color: '#64748b', lineHeight: 1.5 }}>
              • Spacebar: Mark current page as "Not a problem"
            </Typography>
            {lastAddedProblem !== null && (
              <Typography variant="caption" display="block" sx={{ color: '#6366f1', fontWeight: 600, mt: 1 }}>
                Last pressed: {lastAddedProblem} {lastAddedWasNew ? '(added)' : '(exists)'} - press another digit within 500ms to combine
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SortingPage; 