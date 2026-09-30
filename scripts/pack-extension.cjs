const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

async function packExtension() {
  const now = Math.floor(Date.now() / 1000);
  const hash = "git-" + now.toString(16);

  // 1. Write to extension/buildInfo.js
  const buildInfoPath = path.resolve(__dirname, "../extension/buildInfo.js");
  const buildInfoJs = "window.BEAMDROP_BUILD = {\n" +
    "  version: \x221.6.2\x22,\n" +
    "  buildHash: \x22" + hash + "\x22,\n" +
    "  buildTimestamp: " + now + ",\n" +
    "  patchNotes: \x22Live WebRTC DataChannel optimizations & instant two-way handshake\x22\n" +
    "};\n";
  fs.writeFileSync(buildInfoPath, buildInfoJs, "utf8");

  // 2. Sync to public/version.json
  const versionJsonPath = path.resolve(__dirname, "../public/version.json");
  if (fs.existsSync(versionJsonPath)) {
    try {
      const vdata = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
      vdata.version = "1.6.2";
      vdata.latestVersion = "1.6.2";
      vdata.buildHash = hash;
      vdata.buildTimestamp = now;
      vdata.patchNotes = "Live WebRTC DataChannel optimizations & instant two-way handshake";
      fs.writeFileSync(versionJsonPath, JSON.stringify(vdata, null, 2), "utf8");
      console.log("🔄 Synced buildHash: " + hash + " into version.json");
    } catch (_) {}
  }

  const extensionDir = path.resolve(__dirname, "../extension");
  const outputZipPath = path.resolve(__dirname, "../public/extension.zip");
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

  console.log("📦 Packaging Chrome Extension files from:", extensionDir);
  addDirectoryToZip(extensionDir, zip);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });

  const publicDir = path.dirname(outputZipPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  fs.writeFileSync(outputZipPath, zipBuffer);
  console.log("✅ Extension zipped successfully to " + outputZipPath + " (" + (zipBuffer.length / 1024).toFixed(1) + " KB)");
}

packExtension().catch((err) => {
  console.error("Failed to pack extension:", err);
  process.exit(1);
});
