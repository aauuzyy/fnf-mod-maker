const { contextBridge } = require('electron')
// Expose safe APIs to renderer here if needed
contextBridge.exposeInMainWorld('electron', {
    platform: process.platform,
})