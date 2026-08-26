const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');

const PRODUCT_NAME = 'HSC Portal';
const LIVE_PORTAL_URL = 'https://www.hscportal.app';
const DEVELOPMENT_URL = process.env.ELECTRON_START_URL;
const START_URL = DEVELOPMENT_URL || LIVE_PORTAL_URL;

let mainWindow;

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPortalUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') return false;
  return url.hostname === 'www.hscportal.app' || url.hostname === 'hscportal.app';
}

function isDevelopmentUrl(value) {
  const url = parseUrl(value);
  if (!url || !DEVELOPMENT_URL) return false;
  const development = parseUrl(DEVELOPMENT_URL);
  return Boolean(development && url.origin === development.origin);
}

function isGoogleAuthUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') return false;
  return url.hostname === 'accounts.google.com'
    || url.hostname.endsWith('.firebaseapp.com')
    || url.hostname.endsWith('.googleapis.com');
}

function isAllowedInAppUrl(value) {
  return isPortalUrl(value) || isDevelopmentUrl(value) || isGoogleAuthUrl(value);
}

function openInSystemBrowser(value) {
  const url = parseUrl(value);
  if (url && ['https:', 'http:', 'mailto:'].includes(url.protocol)) {
    shell.openExternal(value).catch(() => {});
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f7f7f5',
    title: PRODUCT_NAME,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: true,
    },
  });

  mainWindow.removeMenu();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Firebase authentication needs a controlled Google sign-in window. Links
    // outside the portal and its identity providers open in the default browser.
    if (isAllowedInAppUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: '#ffffff',
          webPreferences: {
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            webviewTag: false,
          },
        },
      };
    }

    openInSystemBrowser(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInAppUrl(url)) {
      event.preventDefault();
      openInSystemBrowser(url);
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(START_URL).catch(() => {
    // Chromium's built-in error page gives the student a clear retry path if
    // their internet connection is unavailable before the portal can load.
  });
}

app.setName(PRODUCT_NAME);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
