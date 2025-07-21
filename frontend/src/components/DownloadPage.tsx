import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Card,
  CardContent,
  Grid,
  Alert,
  Chip,
  Divider
} from '@mui/material';
import { 
  Download, 
  PictureAsPdf, 
  CheckCircle, 
  Refresh,
  Assignment
} from '@mui/icons-material';

interface DownloadPageProps {
  problems: number[];
  onReset: () => void;
}

const DownloadPage: React.FC<DownloadPageProps> = ({ problems, onReset }) => {
  const [downloadingProblems, setDownloadingProblems] = useState<Set<number>>(new Set());

  const handleDownload = async (problemId: number) => {
    setDownloadingProblems(prev => new Set(prev).add(problemId));
    
    try {
      const response = await fetch(`/api/download/${problemId}`);
      
      if (response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Problem_${problemId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        console.error('Download failed:', response.statusText);
      }
    } catch (error) {
      console.error('Download error:', error);
    } finally {
      setDownloadingProblems(prev => {
        const newSet = new Set(prev);
        newSet.delete(problemId);
        return newSet;
      });
    }
  };

  const handleDownloadAll = async () => {
    // Download all problems sequentially to avoid overwhelming the browser
    for (const problemId of problems.sort((a, b) => a - b)) {
      await handleDownload(problemId);
      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Success Header */}
      <Card sx={{ 
        mb: 4, 
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1px solid #bbf7d0'
      }}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <CheckCircle sx={{ fontSize: 80, mb: 3, color: '#16a34a' }} />
          <Typography variant="h3" component="h1" gutterBottom sx={{ color: '#15803d', fontWeight: 700 }}>
            Processing Complete!
          </Typography>
          <Typography variant="h6" sx={{ color: '#166534', lineHeight: 1.6 }}>
            All student PDFs have been successfully organized by problem.
            You can now download the individual problem PDFs for grading.
          </Typography>
        </CardContent>
      </Card>

      {/* Download Section */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 4, border: '1px solid #f1f5f9' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Assignment sx={{ color: '#6366f1', fontSize: 28 }} />
              <Typography variant="h5" sx={{ color: '#1e293b', fontWeight: 600 }}>
                Problem PDFs Ready
              </Typography>
              <Chip 
                label={`${problems.length} problems`} 
                sx={{ backgroundColor: '#6366f1', color: 'white', fontWeight: 500 }}
                variant="filled"
              />
            </Box>

            <Typography variant="body1" color="text.secondary" paragraph>
              Each PDF contains all student responses for that specific problem, 
              organized and labeled for efficient grading.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleDownloadAll}
                startIcon={<Download />}
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
                Download All Problems
              </Button>
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Individual Problem Downloads */}
            <Typography variant="h6" gutterBottom>
              Individual Downloads
            </Typography>
            
            <List>
              {problems.sort((a, b) => a - b).map((problemId) => (
                <ListItem
                  key={problemId}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <ListItemIcon>
                    <PictureAsPdf color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary={`Problem ${problemId}`}
                    secondary={`Contains all student responses for problem ${problemId}`}
                  />
                  <Button
                    variant="outlined"
                    onClick={() => handleDownload(problemId)}
                    disabled={downloadingProblems.has(problemId)}
                    startIcon={<Download />}
                  >
                    {downloadingProblems.has(problemId) ? 'Downloading...' : 'Download'}
                  </Button>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Summary Stats */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Summary
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography>Problems Created:</Typography>
                <Chip label={problems.length} color="primary" size="small" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Each problem PDF is ready for individual grading by different graders.
              </Typography>
            </Box>
          </Paper>

          {/* Instructions */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Next Steps
            </Typography>
            <Typography variant="body2" paragraph>
              1. Download the problem PDFs you need
            </Typography>
            <Typography variant="body2" paragraph>
              2. Distribute each problem to different graders
            </Typography>
            <Typography variant="body2" paragraph>
              3. Graders can focus on one problem across all students
            </Typography>
            <Typography variant="body2">
              4. Ensure consistent and fair grading!
            </Typography>
          </Paper>

          {/* Reset Section */}
          <Paper sx={{ p: 3, border: 1, borderColor: 'warning.main' }}>
            <Typography variant="h6" gutterBottom color="warning.main">
              Start New Session
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Want to process a different set of exams? Reset the application to start over.
            </Typography>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Refresh />}
              onClick={onReset}
              fullWidth
            >
              Reset & Start Over
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Tips */}
      <Alert severity="info" sx={{ mt: 4 }}>
        <Typography variant="body2">
          <strong>Pro Tip:</strong> Save these problem PDFs in clearly labeled folders. 
          Consider naming them like "Problem_1_Algebra.pdf" to help graders understand 
          what they're grading.
        </Typography>
      </Alert>
    </Box>
  );
};

export default DownloadPage; 