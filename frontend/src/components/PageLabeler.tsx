import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ButtonGroup,
  Button,
  TextField,
  Chip,
  Stack
} from '@mui/material';
import { Label, Clear } from '@mui/icons-material';

interface PageLabelerProps {
  currentPage: number;
  pageLabels: { [pageNumber: number]: number };
  onPageLabel: (pageNumber: number, problemNumber: number) => void;
}

const PageLabeler: React.FC<PageLabelerProps> = ({
  currentPage,
  pageLabels,
  onPageLabel
}) => {
  const [customProblem, setCustomProblem] = useState('');
  
  // Quick problem buttons (1-12 should cover most exams)
  const quickProblems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const currentProblem = pageLabels[currentPage];

  const handleQuickLabel = (problemNumber: number) => {
    onPageLabel(currentPage, problemNumber);
  };

  const handleCustomLabel = () => {
    const problemNumber = parseInt(customProblem);
    if (problemNumber > 0) {
      onPageLabel(currentPage, problemNumber);
      setCustomProblem('');
    }
  };

  const handleClearLabel = () => {
    if (currentProblem) {
      // Remove the label by setting it to 0 (which will be filtered out)
      onPageLabel(currentPage, 0);
    }
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
        {currentProblem && (
          <Chip
            label={`Problem ${currentProblem}`}
            sx={{
              backgroundColor: '#6366f1',
              color: 'white',
              fontWeight: 500
            }}
            variant="filled"
            size="small"
          />
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" gutterBottom>
        Click a problem number to label this page, or enter a custom number:
      </Typography>

      {/* Quick Problem Buttons */}
      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        {quickProblems.map((problemNum) => (
          <Button
            key={problemNum}
            variant={currentProblem === problemNum ? 'contained' : 'outlined'}
            size="small"
            onClick={() => handleQuickLabel(problemNum)}
            sx={{ 
              minWidth: 40,
              borderColor: currentProblem === problemNum ? '#6366f1' : '#e2e8f0',
              backgroundColor: currentProblem === problemNum ? '#6366f1' : 'transparent',
              color: currentProblem === problemNum ? 'white' : '#64748b',
              '&:hover': {
                borderColor: '#6366f1',
                backgroundColor: currentProblem === problemNum ? '#4f46e5' : '#f8fafc',
              }
            }}
          >
            {problemNum}
          </Button>
        ))}
      </Stack>

      {/* Custom Problem Input */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 2 }}>
        <TextField
          label="Custom Problem #"
          size="small"
          type="number"
          value={customProblem}
          onChange={(e) => setCustomProblem(e.target.value)}
          onKeyPress={handleKeyPress}
          sx={{ width: 150 }}
          inputProps={{ min: 1 }}
        />
        <Button
          variant="outlined"
          onClick={handleCustomLabel}
          disabled={!customProblem || parseInt(customProblem) <= 0}
        >
          Apply
        </Button>
      </Box>

      {/* Clear Label */}
      {currentProblem && (
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<Clear />}
          onClick={handleClearLabel}
        >
          Clear Label
        </Button>
      )}

      {/* Instructions */}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
        💡 Tip: Use keyboard numbers 1-9 for quick labeling, or navigate with arrow keys
      </Typography>
    </Paper>
  );
};

export default PageLabeler; 