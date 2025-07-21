import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker - this needs to be done before any PDF operations
const configureWorker = () => {
  try {
    // First try local worker file to avoid CORS issues
    const workerSrc = '/pdf.worker.min.js';
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
    
    console.log('PDF.js worker configured (local):', workerSrc);
    console.log('PDF.js version:', pdfjsLib.version);
    
    // Alternative: Disable worker completely and use main thread (slower but more reliable)
    // pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
  } catch (error) {
    console.error('Error configuring PDF.js worker:', error);
    // Fallback: disable worker entirely
    console.log('Falling back to main thread rendering...');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
  }
};

// Initialize immediately
configureWorker();

export { pdfjsLib };
export default configureWorker; 