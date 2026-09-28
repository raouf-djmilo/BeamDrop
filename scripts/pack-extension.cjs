const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function packExtension() {
  const extensionDir = path.resolve(__dirname, '../extension');
  const outputZipPath = path.resolve(__dirname, '../public/extension.zip');

  const zip = new JSZip();

  function addDirectoryToZip(dirPath, zipFolder) {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        const subFolder = zipFolder.folder(item);
        addDirectoryToZip(fullPath, subFolder);
      } else {
        const content = fs.readFileSync(fullPath);
        zipFolder.file(item, content);
      }
    }
  }

  console.log('📦 Packaging Chrome Extension files from:', extensionDir);
  addDirectoryToZip(extensionDir, zip);

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  const publicDir = path.dirname(outputZipPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log(`✅ Extension zipped successfully to ${outputZipPath} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
}

packExtension().catch((err) => {
  console.error('Failed to pack extension:', err);
  process.exit(1);
});
