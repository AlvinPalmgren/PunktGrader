import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const app = express();
const PORT = process.env.PORT || 3001;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Store session data in memory (for demo purposes)
interface StudentData {
  id: number;
  name: string;
  originalPdf: Buffer;
  pageLabels: { [pageNumber: number]: number }; // pageNumber -> problemNumber
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

// Reset session
app.post('/api/reset', (req, res) => {
  sessionData = {
    students: [],
    problemPages: {},
    finalPdfs: {}
  };
  res.json({ success: true });
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

    // Process uploaded PDFs
    const students: StudentData[] = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      console.log(`Processing uploaded file ${i + 1}: ${file.originalname}, size: ${file.size} bytes, type: ${file.mimetype}`);
      
      students.push({
        id: i + 1,
        name: '', // Will be filled during labeling
        originalPdf: file.buffer,
        pageLabels: {}
      });
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

// Get student PDF for labeling
app.get('/api/student/:id', async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = sessionData.students.find(s => s.id === studentId);
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Return PDF as base64 for frontend consumption
    const pdfBase64 = student.originalPdf.toString('base64');
    console.log(`Serving PDF for student ${studentId}, size: ${student.originalPdf.length} bytes, base64 length: ${pdfBase64.length}`);
    
    res.json({
      success: true,
      studentId: student.id,
      studentName: student.name,
      pdfData: pdfBase64,
      pageLabels: student.pageLabels
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ error: 'Failed to get student PDF' });
  }
});

// Label endpoint - receives labeling data for a student
app.post('/api/label', async (req, res) => {
  try {
    const { studentId, studentName, pageLabels } = req.body;
    
    const student = sessionData.students.find(s => s.id === studentId);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update student data
    student.name = studentName;
    student.pageLabels = pageLabels;

    // Process the PDF and create labeled pages
    const pdfDoc = await PDFDocument.load(student.originalPdf);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add labels to each page and organize by problem
    for (const [pageNumStr, problemNum] of Object.entries(pageLabels)) {
      const pageNum = parseInt(pageNumStr);
      const problemNumber = problemNum as number;
      
      if (pageNum <= pages.length && problemNumber > 0) {
        const page = pages[pageNum - 1]; // PDF pages are 0-indexed
        
        // Add red label to the right side of the page
        const { width, height } = page.getSize();
        const labelText = `Problem ${problemNumber}\n${studentName}\nStudent ID: ${studentId}`;
        
        page.drawText(labelText, {
          x: width - 120,
          y: height - 50,
          size: 10,
          font: helveticaFont,
          color: rgb(1, 0, 0), // Red color
        });

        // Create a single-page PDF for this page
        const singlePagePdf = await PDFDocument.create();
        const [copiedPage] = await singlePagePdf.copyPages(pdfDoc, [pageNum - 1]);
        singlePagePdf.addPage(copiedPage);
        const singlePagePdfBytes = await singlePagePdf.save();

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

    res.json({ success: true, message: 'Student labeled successfully' });
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

// Get session status
app.get('/api/status', (req, res) => {
  const totalStudents = sessionData.students.length;
  const labeledStudents = sessionData.students.filter(s => s.name && Object.keys(s.pageLabels).length > 0).length;
  const problems = Object.keys(sessionData.problemPages).map(Number);
  
  res.json({
    totalStudents,
    labeledStudents,
    problems,
    isFinalized: Object.keys(sessionData.finalPdfs).length > 0
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 