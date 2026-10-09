import { copyFileSync, mkdirSync } from 'node:fs';
mkdirSync('public/workers',{recursive:true});
copyFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','public/workers/pdf.worker.min.mjs');
