import React from 'react';
import { Box, LinearProgress, Typography, Paper } from '@mui/material';

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const progress = total > 0 ? (current / total) * 100 : 0;
  const completed = current - 1; // current is 1-indexed, but we want completed count

  return (
    <Paper sx={{ p: 4, mb: 3, border: '1px solid #f1f5f9' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#1e293b', fontWeight: 600 }}>
          Sorting Progress
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {completed} of {total} students completed
        </Typography>
      </Box>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ 
          height: 10, 
          borderRadius: 5,
          mb: 2,
          backgroundColor: '#f1f5f9',
          '& .MuiLinearProgress-bar': {
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            borderRadius: 5,
          }
        }} 
      />
      
      <Typography variant="body2" color="text.secondary" align="center" sx={{ fontWeight: 500 }}>
        Currently processing: Student {current}
      </Typography>
    </Paper>
  );
};

export default ProgressBar; 