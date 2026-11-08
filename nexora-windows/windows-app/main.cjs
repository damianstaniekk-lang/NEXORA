const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const configPath = () => path.join(app.getPath('userData'), 'config.json');
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); }
  catch { return {}; }
}
function validServerUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') && !u.username && !u.password;
  } catch { return false; }
}
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 820, minHeight: 600,
    backgroundColor: '#0b1020', title: 'NEXORA',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  const cfg = readConfig();
  if (cfg.serverUrl && validServerUrl(cfg.serverUrl)) win.loadURL(cfg.serverUrl);
  else win.loadFile(path.join(__dirname, 'setup.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    if (current.startsWith('file://') && url.startsWith('file://')) return;
    const cfgNow = readConfig();
    if (cfgNow.serverUrl && url.startsWith(cfgNow.serverUrl)) return;
    if (url.startsWith('https://')) { event.preventDefault(); shell.openExternal(url); }
  });
}
ipcMain.handle('nexora:get-config', () => ({ serverUrl: readConfig().serverUrl || '' }));
ipcMain.handle('nexora:save-server', async (_event, value) => {
  const serverUrl = String(value || '').trim().replace(/\/$/, '');
  if (!validServerUrl(serverUrl)) throw new Error('Bitte eine gültige HTTPS-Adresse deiner NEXORA-Website eingeben.');
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ serverUrl }, null, 2), { mode: 0o600 });
  await win.loadURL(serverUrl);
  return true;
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
