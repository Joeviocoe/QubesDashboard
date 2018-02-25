const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const url = require('url')
const Store = require('./store.js');
let mainWindow

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    windowBounds: { width: 800, height: 600 }
  }
});

function createWindow () {
  let { width, height } = store.get('windowBounds');
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width, height,
    fullscreen: false,
    autoHideMenuBar: false,
    icon: 'images/qubes.png',
    transparent: false,
    frame: true,
    toolbar: true
  })

  // Load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  mainWindow.webContents.openDevTools()

  mainWindow.on('resize', () => {
    let { width, height } = mainWindow.getBounds();
    store.set('windowBounds', { width, height });
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
