import React, { useState, useEffect } from 'react';
import { Box, Container, Typography, AppBar, Toolbar } from '@mui/material';
import FileUploadPage from './components/FileUploadPage';
import SortingPage from './components/SortingPage';
import DownloadPage from './components/DownloadPage';
import ProgressBar from './components/ProgressBar';

export type AppPhase = 'upload' | 'sorting' | 'download';

interface AppState {
  phase: AppPhase;
  totalStudents: number;
  currentStudentId: number;
  problems: number[];
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    phase: 'upload',
    totalStudents: 0,
    currentStudentId: 1,
    problems: []
  });

  const handleUploadComplete = (totalStudents: number) => {
    setAppState({
      phase: 'sorting',
      totalStudents,
      currentStudentId: 1,
      problems: []
    });
  };

  const handleStudentComplete = () => {
    if (appState.currentStudentId < appState.totalStudents) {
      setAppState(prev => ({
        ...prev,
        currentStudentId: prev.currentStudentId + 1
      }));
    } else {
      // All students processed, finalize and show download page
      finalizeAndShowDownload();
    }
  };

  const finalizeAndShowDownload = async () => {
    try {
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
        problems: []
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
          <Typography variant="body2">
            {appState.phase === 'sorting' && 
              `Student ${appState.currentStudentId} of ${appState.totalStudents}`
            }
          </Typography>
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