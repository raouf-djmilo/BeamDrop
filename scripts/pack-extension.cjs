const fs = require("fs");
const path = require("path");
const https = require("https");
const JSZip = require("jszip");

async function fetchLatestGitHubCommit() {
  return new Promise((resolve) => {
    const req = https.get(
      "https://api.github.com/repos/raouf-djmilo/BeamDrop/commits?per_page=1",
      { headers: { "User-Agent": "BeamDrop-Build-Script" } },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr[0] && arr[0].sha) {
              resolve({
                sha: arr[0].sha,
                shortSha: arr[0].sha.slice(0, 7),
                message: arr[0].commit && arr[0].commit.message ? arr[0].commit.message.split("\n")[0] : ""
              });
              return;
            }
          } catch (_) {}
          resolve(null);
        });
      }
    );
    req.on("error", () => resolve(null));
    req.setTimeout(3000, () => {
      req.abort();
      resolve(null);
    });
  });
}

async function packExtension() {
  const now = Math.floor(Date.now() / 1000);
  
  // Query GitHub for canonical repository commit SHA
  const gitInfo = await fetchLatestGitHubCommit();
  const commitSha = gitInfo ? gitInfo.sha : "38027b12bd5f40e8d7e97f9112125571b4ad5746";
  const shortSha = gitInfo ? gitInfo.shortSha : "38027b1";
  const commitMsg = gitInfo ? gitInfo.message : "Live WebRTC DataChannel optimizations & instant two-way handshake";

  console.log(`📌 Canonical GitHub Fingerprint: ${shortSha} ("${commitMsg}")`);

  // 1. Write to extension/buildInfo.js
  const buildInfoPath = path.resolve(__dirname, "../extension/buildInfo.js");
  const buildInfoJs = "window.BEAMDROP_BUILD = {\n" +
    '  version: "1.6.2",\n' +
    `  commitSha: "${commitSha}",\n` +
    `  shortSha: "${shortSha}",\n` +
    `  buildHash: "${shortSha}",\n` +
    `  buildTimestamp: ${now},\n` +
    `  patchNotes: ${JSON.stringify(commitMsg)}\n` +
    "};\n";
  fs.writeFileSync(buildInfoPath, buildInfoJs, "utf8");

  // Also copy to public/buildInfo.js
  const publicBuildInfoPath = path.resolve(__dirname, "../public/buildInfo.js");
  fs.writeFileSync(publicBuildInfoPath, buildInfoJs, "utf8");

  // 2. Sync to public/version.json
  const versionJsonPath = path.resolve(__dirname, "../public/version.json");
  if (fs.existsSync(versionJsonPath)) {
    try {
      const vdata = JSON.parse(fs.readFileSync(versionJsonPath, "utf8"));
      vdata.version = "1.6.2";
      vdata.latestVersion = "1.6.2";
      vdata.commitSha = commitSha;
      vdata.shortSha = shortSha;
      vdata.buildHash = shortSha;
      vdata.buildTimestamp = now;
      vdata.patchNotes = commitMsg;
      fs.writeFileSync(versionJsonPath, JSON.stringify(vdata, null, 2), "utf8");
      console.log("🔄 Synced GitHub commit " + shortSha + " into version.json");
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
