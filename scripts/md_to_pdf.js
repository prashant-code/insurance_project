import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { mdToPdf } from 'md-to-pdf';

/**
 * Kroki Encoder: Deflate + Base64 (URL Safe)
 */
function encodeKroki(diagram) {
  const data = Buffer.from(diagram, 'utf8');
  const compressed = zlib.deflateSync(data, { level: 9 });
  return compressed.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Replace Mermaid blocks with Kroki <img> tags
 */
function replaceMermaidWithKroki(md) {
  const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
  return md.replace(mermaidRegex, (match, diagram) => {
    const encoded = encodeKroki(diagram.trim());
    const krokiUrl = `https://kroki.io/mermaid/svg/${encoded}`;
    return `<div align="center"><img src="${krokiUrl}" alt="Mermaid Diagram" /></div>`;
  });
}

import { fileURLToPath } from 'url';

async function convertDocs() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, '..');
  
  const docDir = path.join(rootDir, 'documents');
  const outputDir = path.join(rootDir, 'pdfs');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  if (!fs.existsSync(docDir)) {
    console.error(`❌ Error: Documents directory not found at ${docDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(docDir).filter(f => f.endsWith('.md'));

  for (const file of files) {
    console.log(`📄 Processing: ${file}...`);
    const inputPath = path.join(docDir, file);
    const outputPath = path.join(outputDir, file.replace('.md', '.pdf'));

    let content = fs.readFileSync(inputPath, 'utf8');
    
    // 1. Resolve Mermaid diagrams via Kroki
    content = replaceMermaidWithKroki(content);

    // 2. Convert to PDF via md-to-pdf
    try {
      const pdf = await mdToPdf({ content }, { 
        dest: outputPath,
        pdf_options: {
          format: 'A4',
          margin: { top: '2cm', bottom: '2cm', left: '2cm', right: '2cm' },
          printBackground: true
        },
        launch_options: { args: ['--no-sandbox'] } // Essential for Linux/Container environments
      });

      if (pdf) {
        console.log(`✅ Success: Generated ${outputPath}`);
      }
    } catch (err) {
      console.error(`❌ Error converting ${file}:`, err.message);
    }
  }
}

// Check dependencies and run
console.log('🚀 Starting PDF Conversion with Kroki...');
convertDocs().then(() => {
  console.log('✨ All documents converted to PDF!');
}).catch(err => {
  console.error('💥 Fatal error:', err);
});
