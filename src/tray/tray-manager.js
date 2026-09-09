const { Tray, Menu, app } = require('electron')
const path = require('path')
const logger = require('../utils/logger')
const settingsStore = require('../settings/settings-store')

class TrayManager {
    constructor() {
        this.tray = null
        this.mainWindow = null
        this.botStatus = 'Durduruldu'
        this.onCheckUpdates = null
        this.onOpenProfiles = null
    }

    init(mainWindow, callbacks = {}) {
        this.mainWindow = mainWindow
        this.onCheckUpdates = callbacks.onCheckUpdates || null
        this.onOpenProfiles = callbacks.onOpenProfiles || null

        const iconPath = process.platform === 'win32'
            ? path.join(__dirname, '..', '..', 'assets', 'icon.ico')
            : path.join(__dirname, '..', '..', 'assets', 'icon.png')

        try {
            this.tray = new Tray(iconPath)
            this.tray.setToolTip('MinerTower AFK')
            this.updateMenu()

            this.tray.on('click', () => {
                this.toggleWindow()
            })
            this.tray.on('double-click', () => {
                this.showWindow()
            })
            logger.info('TRAY', 'Sistem tepsisi (Tray) başarıyla başlatıldı')
        } catch (err) {
            logger.error('TRAY', 'Sistem tepsisi başlatılamadı', err)
        }
    }

    updateBotStatus(statusText) {
        this.botStatus = statusText || 'Durduruldu'
        if (this.tray) {
            this.tray.setToolTip(`MinerTower AFK - ${this.botStatus}`)
            this.updateMenu()
        }
    }

    updateMenu() {
        if (!this.tray) return

        const isRunning = this.botStatus.toLowerCase().includes('hazır') || this.botStatus.toLowerCase().includes('çalışıyor') || this.botStatus.toLowerCase().includes('işlem')
        const statusIndicator = isRunning ? '🟢' : '⚪'

        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'MinerTower AFK v2.0',
                enabled: false
            },
            { type: 'separator' },
            {
                label: `${statusIndicator} Bot Durumu: ${this.botStatus}`,
                enabled: false
            },
            { type: 'separator' },
            {
                label: '📊 Dashboard\'u Aç',
                click: () => this.showWindow('dashboard')
            },
            {
                label: '👤 Bot Profilleri',
                click: () => {
                    this.showWindow('profiles')
                    if (this.onOpenProfiles) this.onOpenProfiles()
                }
            },
            { type: 'separator' },
            {
                label: '🔄 Güncellemeleri Denetle',
                click: () => {
                    if (this.onCheckUpdates) this.onCheckUpdates()
                }
            },
            { type: 'separator' },
            {
                label: '❌ Çıkış',
                click: () => {
                    app.isQuitting = true
                    app.quit()
                }
            }
        ])

        this.tray.setContextMenu(contextMenu)
    }

    toggleWindow() {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return
        if (this.mainWindow.isVisible()) {
            this.mainWindow.hide()
        } else {
            this.mainWindow.show()
            this.mainWindow.focus()
        }
    }

    showWindow(targetView = null) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) return
        if (this.mainWindow.isMinimized()) this.mainWindow.restore()
        this.mainWindow.show()
        this.mainWindow.focus()

        if (targetView) {
            this.mainWindow.webContents.send('app:navigate', targetView)
        }
    }

    destroy() {
        if (this.tray) {
            try {
                this.tray.destroy()
            } catch (e) { }
            this.tray = null
        }
    }
}

module.exports = new TrayManager()
