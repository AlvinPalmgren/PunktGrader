import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import os from 'os';

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads with disk storage for better performance
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Use system temp directory
    const tempDir = path.join(os.tmpdir(), 'exam-grader-uploads');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      cb(null, tempDir);
    } catch (error) {
      cb(error instanceof Error ? error : new Error(String(error)), tempDir);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.pdf');
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store session data with file paths for better memory management
interface StudentData {
  id: number;
  name: string;
  originalPdfPath: string; // File path instead of buffer for better memory usage
  pageLabels: { [pageNumber: number]: number[] }; // pageNumber -> array of problemNumbers
  processingStatus: 'pending' | 'processing' | 'completed' | 'error';
  processingError?: string;
}

interface ProblemPage {
  studentId: number;
  studentName: string;
  pageNumber: number;
  pdfData: Buffer;
}

let sessionData: {
  students: StudentData[];
  problemPages: { [problemNumber: number]: ProblemPage[] };
  finalPdfs: { [problemNumber: number]: Buffer };
} = {
  students: [],
  problemPages: {},
  finalPdfs: {}
};

// Background processing function
async function processStudentInBackground(studentId: number, studentName: string, pageLabels: { [pageNumber: number]: number[] }) {
  const student = sessionData.students.find(s => s.id === studentId);
  if (!student) {
    console.error(`Student ${studentId} not found for background processing`);
    return;
  }

  try {
    console.log(`Starting background processing for student ${studentId} (${studentName})`);
    student.processingStatus = 'processing';

    // Load PDF from disk and create labeled pages
    let pdfBuffer = await fs.readFile(student.originalPdfPath);
    const originalPdfDoc = await PDFDocument.load(pdfBuffer);
    const originalPages = originalPdfDoc.getPages();
    
    // Add labels to each page and organize by problem
    for (const [pageNumStr, problemNumbers] of Object.entries(pageLabels)) {
      const pageNum = parseInt(pageNumStr);
      const problemNums = problemNumbers as number[];
      
      if (pageNum <= originalPages.length && problemNums.length > 0) {
        // For each problem on this page, create a separate labeled copy
        for (const problemNumber of problemNums) {
          if (problemNumber > 0) {
            // Create a new PDF document for this specific problem page
            const problemPdf = await PDFDocument.create();
            const helveticaFont = await problemPdf.embedFont(StandardFonts.Helvetica);
            
            // Copy the page from the original PDF
            const [copiedPage] = await problemPdf.copyPages(originalPdfDoc, [pageNum - 1]);
            problemPdf.addPage(copiedPage);
            
            // Get the added page to modify it
            const problemPage = problemPdf.getPages()[0];
            
            // Add red watermark label vertically on the right edge
            const { width, height } = problemPage.getSize();
            const labelText = `Problem ${problemNumber} - ${studentName} - Student nr: ${studentId}`;
            
            // Draw the entire text string rotated 90 degrees
            const fontSize = 20;
            const textWidth = helveticaFont.widthOfTextAtSize(labelText, fontSize);
            
            problemPage.drawText(labelText, {
              x: width - 20, // Right edge position
              y: height / 2 - textWidth / 2, // Center the text vertically (adjust for rotation)
              size: fontSize,
              font: helveticaFont,
              color: rgb(1, 0, 0), // Red color
              opacity: 0.3, // Semi-transparent
              rotate: degrees(90), // Rotate the entire string 90 degrees counter-clockwise
            });

            // Save the single-page PDF
            const singlePagePdfBytes = await problemPdf.save();

            // Store in problem pages
            if (!sessionData.problemPages[problemNumber]) {
              sessionData.problemPages[problemNumber] = [];
            }
            
            sessionData.problemPages[problemNumber].push({
              studentId,
              studentName,
              pageNumber: pageNum,
              pdfData: Buffer.from(singlePagePdfBytes)
            });
          }
        }
      }
    }

    // Clean up the loaded PDF buffer from memory
    pdfBuffer = null as any;
    
    // Mark as completed
    student.processingStatus = 'completed';
    
    // Add some logging to track memory usage and performance
    const memUsage = process.memoryUsage();
    console.log(`Completed background processing for student ${studentId} (${studentName}) - Problem pages created: ${Object.keys(pageLabels).length} pages with labels`);
    console.log(`Total problem types in session: ${Object.keys(sessionData.problemPages).length}`);
    console.log(`Memory usage - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
    
    // Force garbage collection for better memory management
    if (global.gc) {
      global.gc();
    }
  } catch (error) {
    console.error(`Background processing failed for student ${studentId}:`, error);
    student.processingStatus = 'error';
    student.processingError = error instanceof Error ? error.message : 'Unknown processing error';
  }
}

// Reset session with cleanup
app.post('/api/reset', async (req, res) => {
  try {
    // Clean up temporary files
    for (const student of sessionData.students) {
      try {
        await fs.unlink(student.originalPdfPath);
      } catch (error) {
        console.warn(`Could not delete temp file: ${student.originalPdfPath}`, error);
      }
    }
    
    sessionData = {
      students: [],
      problemPages: {},
      finalPdfs: {}
    };
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

// Upload endpoint
app.post('/api/upload', upload.array('pdfs'), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files)) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Reset session data
    sessionData.students = [];
    sessionData.problemPages = {};
    sessionData.finalPdfs = {};

    // Process uploaded PDFs - store file paths for better memory management
    const students: StudentData[] = [];
    console.log(`Processing ${req.files.length} uploaded PDF files...`);
    
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`Processing uploaded file ${i + 1}/${req.files.length}: ${file.originalname}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB, path: ${file.path}`);
      
      students.push({
        id: i + 1,
        name: '', // Will be filled during labeling
        originalPdfPath: file.path, // Store file path instead of buffer
        pageLabels: {},
        processingStatus: 'pending'
      });
      
      // Force garbage collection every 10 files for large batches
      if (i > 0 && i % 10 === 0 && global.gc) {
        global.gc();
      }
    }
    
    console.log(`Successfully processed all ${students.length} PDF files`);
    
    // Final garbage collection after upload processing
    if (global.gc) {
      global.gc();
    }

    sessionData.students = students;

    res.json({
      success: true,
      totalStudents: students.length,
      message: `Successfully uploaded ${students.length} PDF files`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process uploaded files' });
  }
});

// Get student PDF for labeling - serve as binary for better performance
app.get('/api/student/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = sessionData.students.find(s => s.id === studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Check if file exists
    try {
      await fs.access(student.originalPdfPath);
    } catch {
      return res.status(404).json({ error: 'PDF file not found on disk' });
    }

    // Get file stats for content length
    const stats = await fs.stat(student.originalPdfPath);
    console.log(`Serving PDF for student ${studentId} from ${student.originalPdfPath}, size: ${stats.size} bytes`);
    
    // Set headers for binary PDF response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stats.size.toString());
    res.setHeader('Cache-Control', 'no-cache');
    
    // Include student metadata in custom headers
    res.setHeader('X-Student-Id', student.id.toString());
    res.setHeader('X-Student-Name', student.name || '');
    res.setHeader('X-Page-Labels', JSON.stringify(student.pageLabels));
    
    // Stream the file directly instead of loading into memory
    const fileBuffer = await fs.readFile(student.originalPdfPath);
    res.send(fileBuffer);
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to get student PDF' });
  }
});

// Label endpoint - receives labeling data for a student and processes asynchronously
app.post('/api/label', async (req, res) => {
  try {
    const { studentId, studentName, pageLabels } = req.body;
    
    const student = sessionData.students.find(s => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update student data immediately
    student.name = studentName;
    student.pageLabels = pageLabels;

    // Return immediately to allow user to proceed to next student
    res.json({ 
      success: true, 
      message: 'Student labeled successfully - processing in background',
      processingStatus: 'processing'
    });

    // Start background processing (don't await - let it run asynchronously)
    processStudentInBackground(studentId, studentName, pageLabels)
      .catch(error => {
        console.error(`Failed to start background processing for student ${studentId}:`, error);
      });

  } catch (error) {
    console.error('Label error:', error);
    res.status(500).json({ error: 'Failed to process labels' });
  }
});

// Finalize endpoint - creates final PDFs grouped by problem
app.post('/api/finalize', async (req, res) => {
  try {
    const problemNumbers = Object.keys(sessionData.problemPages).map(Number);
    
    for (const problemNumber of problemNumbers) {
      const pages = sessionData.problemPages[problemNumber];
      
      // Create a new PDF document for this problem
      const finalPdf = await PDFDocument.create();
      
      // Add all pages for this problem
      for (const page of pages) {
        const pagePdf = await PDFDocument.load(page.pdfData);
        const [copiedPage] = await finalPdf.copyPages(pagePdf, [0]);
        finalPdf.addPage(copiedPage);
      }
      
      const finalPdfBytes = await finalPdf.save();
      sessionData.finalPdfs[problemNumber] = Buffer.from(finalPdfBytes);
    }

    res.json({
      success: true,
      problems: problemNumbers,
      message: `Created ${problemNumbers.length} problem PDFs`
    });
  } catch (error) {
    console.error('Finalize error:', error);
    res.status(500).json({ error: 'Failed to create final PDFs' });
  }
});

// Download endpoint
app.get('/api/download/:problemId', (req, res) => {
  try {
    const problemId = parseInt(req.params.problemId);
    const pdfData = sessionData.finalPdfs[problemId];
    
    if (!pdfData) {
      return res.status(404).json({ error: 'Problem PDF not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Problem_${problemId}.pdf"`);
    res.send(pdfData);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download PDF' });
  }
});

// Get session status with performance metrics and processing status
app.get('/api/status', (req, res) => {
  const totalStudents = sessionData.students.length;
  const labeledStudents = sessionData.students.filter(s => s.name && Object.keys(s.pageLabels).length > 0).length;
  const processingStudents = sessionData.students.filter(s => s.processingStatus === 'processing').length;
  const completedStudents = sessionData.students.filter(s => s.processingStatus === 'completed').length;
  const errorStudents = sessionData.students.filter(s => s.processingStatus === 'error').length;
  const problems = Object.keys(sessionData.problemPages).map(Number);
  const memUsage = process.memoryUsage();
  
  res.json({
    totalStudents,
    labeledStudents,
    processingStudents,
    completedStudents,
    errorStudents,
    problems,
    isFinalized: Object.keys(sessionData.finalPdfs).length > 0,
    allProcessingComplete: labeledStudents > 0 && processingStudents === 0 && errorStudents === 0,
    performance: {
      memoryUsage: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) // MB
      },
      tempFilesCount: sessionData.students.length,
      processedPagesCount: Object.values(sessionData.problemPages).reduce((sum, pages) => sum + pages.length, 0)
    }
  });
});

// Get processing status for a specific student
app.get('/api/student/:id/status', (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = sessionData.students.find(s => s.id === studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      studentId: student.id,
      studentName: student.name,
      processingStatus: student.processingStatus,
      processingError: student.processingError,
      hasLabels: Object.keys(student.pageLabels).length > 0
    });
  } catch (error) {
    console.error('Get student status error:', error);
    res.status(500).json({ error: 'Failed to get student status' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 