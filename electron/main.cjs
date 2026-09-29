const { app, BrowserWindow } = require('electron');
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');

const PORT = process.env.PORT || 5173;
const URL = `http://localhost:${PORT}`;
let server;

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Server did not start on ${URL}`);
}

function stopServer() {
  if (!server || server.exitCode !== null) return;
  // With shell:true on Windows, kill() only ends the shell; take down the whole tree.
  if (process.platform === 'win32') {
    try { execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ }
  } else {
    server.kill();
  }
}

app.whenReady().then(async () => {
  server = spawn('npx', ['tsx', 'src/server.ts'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, PORT: String(PORT) },
  });
  await waitForServer();
  const win = new BrowserWindow({ width: 1280, height: 860, title: 'Auto Apply' });
  await win.loadURL(URL);
});

app.on('window-all-closed', () => {
  stopServer();
  app.quit();
});
app.on('quit', stopServer);
