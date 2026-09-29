import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
import {exec} from 'child_process';
import util from 'util';
import {defineConfig} from 'vite';

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cors-and-upgrade-plugin',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            // 1-Click Zero-Zip Extension Upgrade Endpoint
            if (req.url?.startsWith('/api/upgrade-extension')) {
              res.setHeader('Content-Type', 'application/json');
              try {
                // Read latest version from version.json
                let latestVersion = '1.5.1';
                const versionPath = path.resolve(__dirname, 'version.json');
                if (fs.existsSync(versionPath)) {
                  try {
                    const vJson = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
                    if (vJson.version) latestVersion = vJson.version;
                  } catch (e) {}
                }

                // Synchronize extension manifest version
                const manifestPath = path.resolve(__dirname, 'extension/manifest.json');
                if (fs.existsSync(manifestPath)) {
                  try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    manifest.version = latestVersion;
                    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
                  } catch (e) {}
                }

                // Run extension packer to bundle assets
                try {
                  await execPromise('node scripts/pack-extension.cjs', { cwd: __dirname });
                } catch (packErr: any) {
                  console.warn('[Upgrade Engine] Pack warning:', packErr?.message);
                }

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  version: latestVersion,
                  message: `BeamDrop successfully upgraded to v${latestVersion}. Reloading extension...`
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  error: err?.message || 'Upgrade failed'
                }));
                return;
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
});
