import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, AppBar, Toolbar, Chip } from '@mui/material';
import FileUploadPage from './components/FileUploadPage';
import SortingPage from './components/SortingPage';
import DownloadPage from './components/DownloadPage';
import ProgressBar from './components/ProgressBar';

export type AppPhase = 'upload' | 'sorting' | 'download';

interface StudentData {
  studentId: number;
  studentName: string;
  pdfData: string;
  pageLabels: { [pageNumber: number]: number[] };
}

interface AppState {
  phase: AppPhase;
  totalStudents: number;
  currentStudentId: number;
  problems: number[];
  processingStudents: number;
  prefetchedStudentData: StudentData | null; // Cache for prefetched next student
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    phase: 'upload',
    totalStudents: 0,
    currentStudentId: 1,
    problems: [],
    processingStudents: 0,
    prefetchedStudentData: null
  });

  // Poll processing status during sorting phase
  useEffect(() => {
    if (appState.phase !== 'sorting') return;

    const pollStatus = async () => {
      try {
        const response = await fetch('/api/status');
        const status = await response.json();
        
        setAppState(prev => ({
          ...prev,
          processingStudents: status.processingStudents
        }));
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    };

    // Poll every 2 seconds during sorting
    const interval = setInterval(pollStatus, 2000);
    pollStatus(); // Initial poll

    return () => clearInterval(interval);
  }, [appState.phase]);

  const handleUploadComplete = (totalStudents: number) => {
    setAppState({
      phase: 'sorting',
      totalStudents,
      currentStudentId: 1,
      problems: [],
      processingStudents: 0,
      prefetchedStudentData: null
    });
  };

  const handleStudentComplete = () => {
    if (appState.currentStudentId < appState.totalStudents) {
      setAppState(prev => {
        const nextStudentId = prev.currentStudentId + 1;
        
        // Clear prefetched data if it's for the current student we're moving away from
        const newPrefetchedData = prev.prefetchedStudentData?.studentId === nextStudentId 
          ? prev.prefetchedStudentData 
          : null;
        
        console.log(`🚀 Moving from student ${prev.currentStudentId} to ${nextStudentId}`);
        console.log(`🎯 Prefetched data for next student:`, newPrefetchedData ? `Available (Student ${newPrefetchedData.studentId})` : 'Not available');
        
        return {
          ...prev,
          currentStudentId: nextStudentId,
          prefetchedStudentData: newPrefetchedData
        };
      });
    } else {
      // All students processed, finalize and show download page
      finalizeAndShowDownload();
    }
  };

  const handlePrefetchComplete = (studentId: number, data: StudentData) => {
    console.log(`📥 App received prefetched data for student ${studentId}, caching it`);
    setAppState(prev => ({
      ...prev,
      prefetchedStudentData: data
    }));
  };

  const finalizeAndShowDownload = async () => {
    try {
      // First check if all background processing is complete
      const statusResponse = await fetch('/api/status');
      const status = await statusResponse.json();
      
      if (status.processingStudents > 0) {
        console.log(`Waiting for ${status.processingStudents} students to finish processing...`);
        // Wait a bit and try again
        setTimeout(finalizeAndShowDownload, 2000);
        return;
      }
      
      if (status.errorStudents > 0) {
        console.error(`${status.errorStudents} students had processing errors. Check logs for details.`);
        alert(`Warning: ${status.errorStudents} students had processing errors during background processing. You may want to check the server logs and try resubmitting those students.`);
      }
      
      console.log('All students processed, finalizing...');
      const response = await fetch('/api/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      if (result.success) {
        setAppState(prev => ({
          ...prev,
          phase: 'download',
          problems: result.problems
        }));
      }
    } catch (error) {
      console.error('Failed to finalize:', error);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      setAppState({
        phase: 'upload',
        totalStudents: 0,
        currentStudentId: 1,
        problems: [],
        processingStudents: 0,
        prefetchedStudentData: null
      });
    } catch (error) {
      console.error('Failed to reset:', error);
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Exam Grader
          </Typography>
          {appState.phase === 'sorting' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2">
                Student {appState.currentStudentId} of {appState.totalStudents}
              </Typography>
              {appState.processingStudents > 0 && (
                <Chip 
                  label={`${appState.processingStudents} processing`}
                  color="primary"
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        {appState.phase === 'sorting' && (
          <ProgressBar
            current={appState.currentStudentId}
            total={appState.totalStudents}
          />
        )}

        {appState.phase === 'upload' && (
          <FileUploadPage onUploadComplete={handleUploadComplete} />
        )}

        {appState.phase === 'sorting' && (
          <SortingPage
            studentId={appState.currentStudentId}
            onStudentComplete={handleStudentComplete}
            totalStudents={appState.totalStudents}
            prefetchedStudentData={appState.prefetchedStudentData}
            onPrefetchComplete={handlePrefetchComplete}
          />
        )}

        {appState.phase === 'download' && (
          <DownloadPage
            problems={appState.problems}
            onReset={handleReset}
          />
        )}
      </Container>
    </Box>
  );
}

export default App; 