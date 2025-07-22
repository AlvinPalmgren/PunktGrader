import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ButtonGroup,
  Button,
  TextField,
  Chip,
  Stack,
  Grid
} from '@mui/material';
import { Label, Clear } from '@mui/icons-material';

interface PageLabelerProps {
  currentPage: number;
  pageLabels: { [pageNumber: number]: number[] };
  onPageLabel: (pageNumber: number, problemNumber: number) => void;
  onRemovePageLabel: (pageNumber: number, problemNumber: number) => void;
}

const PageLabeler: React.FC<PageLabelerProps> = ({
  currentPage,
  pageLabels,
  onPageLabel,
  onRemovePageLabel
}) => {
  const [customProblem, setCustomProblem] = useState('');
  
  // Quick problem buttons (1-15 should cover most exams)
  const quickProblems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const currentProblems = pageLabels[currentPage] || [];
  const NOT_A_PROBLEM = -1;

  const handleQuickLabel = (problemNumber: number) => {
    if (currentProblems.includes(problemNumber)) {
      // If already labeled, remove it
      onRemovePageLabel(currentPage, problemNumber);
    } else {
      // If not labeled, add it
      onPageLabel(currentPage, problemNumber);
    }
  };

  const handleNotAProblem = () => {
    if (currentProblems.includes(NOT_A_PROBLEM)) {
      // If already marked as "not a problem", remove it
      onRemovePageLabel(currentPage, NOT_A_PROBLEM);
    } else {
      // If not marked, add it
      onPageLabel(currentPage, NOT_A_PROBLEM);
    }
  };

  const handleCustomLabel = () => {
    const problemNumber = parseInt(customProblem);
    if (problemNumber > 0) {
      onPageLabel(currentPage, problemNumber);
      setCustomProblem('');
    }
  };

  const handleClearLabel = () => {
    // Remove all labels from the current page
    currentProblems.forEach(problemNum => {
      onRemovePageLabel(currentPage, problemNum);
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleCustomLabel();
    }
  };

  return (
    <Paper sx={{ p: 4, border: '1px solid #f1f5f9' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Label sx={{ color: '#6366f1' }} />
        <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 600 }}>
          Label Page {currentPage}
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Click a problem number to label this page, or mark as "Not a problem":
      </Typography>

      {/* Quick Problem Buttons - Using Grid for better alignment */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={1}>
          {quickProblems.map((problemNum) => (
            <Grid item xs={4} sm={3} md={2.4} key={problemNum}>
              <Button
                variant={currentProblems.includes(problemNum) ? 'contained' : 'outlined'}
                size="small"
                onClick={() => handleQuickLabel(problemNum)}
                fullWidth
                sx={{ 
                  minHeight: 36,
                  borderColor: currentProblems.includes(problemNum) ? '#6366f1' : '#e2e8f0',
                  backgroundColor: currentProblems.includes(problemNum) ? '#6366f1' : 'transparent',
                  color: currentProblems.includes(problemNum) ? 'white' : '#64748b',
                  '&:hover': {
                    borderColor: '#6366f1',
                    backgroundColor: currentProblems.includes(problemNum) ? '#4f46e5' : '#f8fafc',
                  }
                }}
              >
                {problemNum}
              </Button>
            </Grid>
          ))}
          
          {/* Not a Problem Button - Takes full width of remaining space */}
          <Grid item xs={12}>
            <Button
              variant={currentProblems.includes(NOT_A_PROBLEM) ? 'contained' : 'outlined'}
              size="small"
              onClick={handleNotAProblem}
              fullWidth
              sx={{ 
                mt: 1,
                minHeight: 36,
                borderColor: currentProblems.includes(NOT_A_PROBLEM) ? '#6b7280' : '#e2e8f0',
                backgroundColor: currentProblems.includes(NOT_A_PROBLEM) ? '#6b7280' : 'transparent',
                color: currentProblems.includes(NOT_A_PROBLEM) ? 'white' : '#64748b',
                '&:hover': {
                  borderColor: '#6b7280',
                  backgroundColor: currentProblems.includes(NOT_A_PROBLEM) ? '#4b5563' : '#f8fafc',
                }
              }}
            >
              Not a problem
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Custom Problem Input */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', mb: 2 }}>
        <TextField
          label="Custom Problem #"
          size="small"
          type="number"
          value={customProblem}
          onChange={(e) => setCustomProblem(e.target.value)}
          onKeyPress={handleKeyPress}
          sx={{ flexGrow: 1 }}
          inputProps={{ min: 1 }}
        />
        <Button
          variant="outlined"
          onClick={handleCustomLabel}
          disabled={!customProblem || parseInt(customProblem) <= 0}
          sx={{ minWidth: 80 }}
        >
          Apply
        </Button>
      </Box>

      {/* Clear All Labels */}
      {currentProblems.length > 0 && (
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<Clear />}
          onClick={handleClearLabel}
          fullWidth
        >
          Clear All Labels
        </Button>
      )}
    </Paper>
  );
};

export default PageLabeler; 