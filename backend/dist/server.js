"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const multer_1 = __importDefault(require("multer"));
const pdf_lib_1 = require("pdf-lib");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static('public'));
let sessionData = {
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
        const students = [];
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        const originalPdfDoc = await pdf_lib_1.PDFDocument.load(student.originalPdf);
        const originalPages = originalPdfDoc.getPages();
        // Add labels to each page and organize by problem
        for (const [pageNumStr, problemNumbers] of Object.entries(pageLabels)) {
            const pageNum = parseInt(pageNumStr);
            const problemNums = problemNumbers;
            if (pageNum <= originalPages.length && problemNums.length > 0) {
                // For each problem on this page, create a separate labeled copy
                for (const problemNumber of problemNums) {
                    if (problemNumber > 0) {
                        // Create a new PDF document for this specific problem page
                        const problemPdf = await pdf_lib_1.PDFDocument.create();
                        const helveticaFont = await problemPdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
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
                            color: (0, pdf_lib_1.rgb)(1, 0, 0), // Red color
                            opacity: 0.3, // Semi-transparent
                            rotate: (0, pdf_lib_1.degrees)(90), // Rotate the entire string 90 degrees counter-clockwise
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
        // Add some logging to track memory usage and performance
        console.log(`Processed student ${studentId} (${studentName}) - Problem pages created: ${Object.keys(pageLabels).length} pages with labels`);
        console.log(`Total problem types in session: ${Object.keys(sessionData.problemPages).length}`);
        // Suggest garbage collection for better memory management
        if (global.gc) {
            global.gc();
        }
        res.json({ success: true, message: 'Student labeled successfully' });
    }
    catch (error) {
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
            const finalPdf = await pdf_lib_1.PDFDocument.create();
            // Add all pages for this problem
            for (const page of pages) {
                const pagePdf = await pdf_lib_1.PDFDocument.load(page.pdfData);
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
    }
    catch (error) {
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
    }
    catch (error) {
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
//# sourceMappingURL=server.js.map