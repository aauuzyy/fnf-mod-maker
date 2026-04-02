const { app, BrowserWindow } = require('electron')
const path = require('path')

const isDev = process.env.NODE_ENV !== 'production'

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        frame: false,
        backgroundColor: '#0d0620',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hidden',
        icon: path.join(__dirname, '../../public/icon.png'),
    })

    if (isDev) {
        win.loadURL('http://localhost:5173')
        win.webContents.openDevTools({ mode: 'detach' })
    } else {
        win.loadFile(path.join(__dirname, '../../dist/index.html'))
    }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })