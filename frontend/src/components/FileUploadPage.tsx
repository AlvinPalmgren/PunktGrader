import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { CloudUpload, Description } from '@mui/icons-material';

interface FileUploadPageProps {
  onUploadComplete: (totalStudents: number) => void;
}

const FileUploadPage: React.FC<FileUploadPageProps> = ({ onUploadComplete }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      // Filter for PDF files only
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
      if (pdfFiles.length !== files.length) {
        setError('Only PDF files are allowed. Non-PDF files have been filtered out.');
      } else {
        setError('');
      }
      setSelectedFiles(pdfFiles);
    }
  }, []);

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select PDF files to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      console.log(`Starting upload of ${selectedFiles.length} files, total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('pdfs', file);
      });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.error || 'Upload failed');
      }

      const result = await response.json();
      
      if (result.success) {
        setUploadProgress(100);
        console.log(`Upload completed: ${result.totalStudents} students processed`);
        setTimeout(() => onUploadComplete(result.totalStudents), 500); // Small delay to show 100% progress
      } else {
        setError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload files. Please try again.');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Card sx={{ mb: 4, border: '1px solid #f1f5f9' }}>
        <CardContent sx={{ py: 5 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ color: '#1e293b', mb: 2 }}>
            Welcome to Exam Grader
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.6 }}>
            Select a folder containing one PDF per student to begin the grading process.
            Each PDF will be sorted by problem to enable fair grading across multiple graders.
          </Typography>
        </CardContent>
      </Card>

      <Paper sx={{ p: 5, textAlign: 'center', mb: 3, border: '1px solid #f1f5f9' }}>
        <CloudUpload sx={{ fontSize: 64, color: '#a5b4fc', mb: 3 }} />
        
        <Typography variant="h5" gutterBottom>
          Upload Student PDFs
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Select the folder containing your exam PDFs. Each PDF should contain one student's complete exam.
          The browser will ask you to choose a folder - all PDF files in that folder will be uploaded.
        </Typography>

        <Button
          variant="contained"
          component="label"
          size="large"
          sx={{ 
            mb: 3,
            py: 1.5,
            px: 4,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            }
          }}
          disabled={isUploading}
        >
          Choose Folder with PDFs
          <input
            type="file"
            {...({ webkitdirectory: "" } as any)}
            multiple
            accept=".pdf"
            hidden
            onChange={handleFileSelect}
          />
        </Button>

        {selectedFiles.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>
              Selected Files ({selectedFiles.length})
            </Typography>
            
            <Paper sx={{ maxHeight: 200, overflow: 'auto', mb: 3 }}>
              <List dense>
                {selectedFiles.map((file, index) => (
                  <ListItem key={index}>
                    <Description sx={{ mr: 1, color: 'text.secondary' }} />
                    <ListItemText 
                      primary={file.name}
                      secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Button
              variant="contained"
              size="large"
              onClick={handleUpload}
              disabled={isUploading}
              sx={{ minWidth: 200 }}
            >
              {isUploading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  {uploadProgress > 0 ? `Processing... ${uploadProgress}%` : 'Uploading...'}
                </>
              ) : (
                'Start Sorting Process'
              )}
            </Button>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default FileUploadPage; 