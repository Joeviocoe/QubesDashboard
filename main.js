const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
const Store = require('./store.js')
let mainWindow

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    windowBounds: { width: 800, height: 600 }
  }
});

function createWindow () {
  var resourcePath = process.resourcesPath;
  var imgPath = resourcePath + '/imgfiles/';

  let { x, y, width, height } = store.get('windowBounds');
  // Create the browser window.
  mainWindow = new BrowserWindow({
    x, y, width, height,
    fullscreen: false,
    autoHideMenuBar: false,
    icon: imgPath+'qubes_small.png',
    transparent: false,
    frame: true,
    toolbar: true,
    webPreferences: { nodeIntegrationInWorker: true }
  })

  // Load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.webContents.openDevTools()

  mainWindow.on('resize', () => {
    let { x, y, width, height } = mainWindow.getBounds();
    store.set('windowBounds', { x, y, width, height });
  });

  mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));

  mainWindow.on('closed', function () {
    mainWindow = null
  })
}

app.on('ready', function () {
  createWindow()
})

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow()
  }
})
