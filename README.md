# Exam Grader

A web application for efficiently grading exams by converting student PDFs into problem-organized PDFs.

## Quick Start

1. Install dependencies for all projects:
   ```bash
   npm run install:all
   ```

2. Start the development servers:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## How it Works

1. **Upload**: Upload a folder containing one PDF per student
2. **Sort**: Label each page of each student's PDF with problem numbers
3. **Process**: The system automatically organizes pages by problem
4. **Download**: Get one PDF per problem containing all student responses

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Material-UI + PDF.js
- **Backend**: Node.js + Express + TypeScript + pdf-lib

## Project Structure

```
├── frontend/          # React TypeScript frontend
├── backend/           # Node.js Express backend
└── package.json       # Root package.json for development
``` 