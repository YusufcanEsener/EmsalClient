const { EventEmitter } = require('events')
const semver = require('semver')
const logger = require('../utils/logger')
const settingsStore = require('../settings/settings-store')
const releaseManager = require('../releases/release-manager')

let autoUpdater = null
try {
    const updaterModule = require('electron-updater')
    autoUpdater = updaterModule.autoUpdater
} catch (e) {
    logger.warn('UPDATER', 'electron-updater modülü yüklenemedi: ' + e.message)
}

class UpdaterManager extends EventEmitter {
    constructor() {
        super()
        this.status = 'idle' // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
        this.currentVersion = '1.0.0'
        this.updateInfo = null
        this.downloadProgress = null
        this.lastError = null
        this.mainWindow = null

        this._setupAutoUpdater()
    }

    setMainWindow(win) {
        this.mainWindow = win
    }

    _setupAutoUpdater() {
        if (!autoUpdater) return

        // Otomatik indirmeyi kapat; kullanıcı onaylayınca başlatılır
        autoUpdater.autoDownload = false
        autoUpdater.autoInstallOnAppQuit = true

        try {
            const electron = require('electron')
            if (electron.app && typeof electron.app.getVersion === 'function') {
                this.currentVersion = electron.app.getVersion()
            } else {
                const pkg = require('../../package.json')
                this.currentVersion = pkg.version || '1.0.8'
            }
        } catch (e) {
            try {
                const pkg = require('../../package.json')
                this.currentVersion = pkg.version || '1.0.8'
            } catch (e2) { }
        }

        // Güncelleme kanalı ayarı
        const settings = settingsStore.get()
        const channel = settings.updates.channel || 'stable'
        autoUpdater.channel = channel === 'beta' ? 'beta' : null
        autoUpdater.allowPrerelease = (channel === 'beta')

        // Loglama yönlendirmesi
        autoUpdater.logger = {
            info: (msg) => logger.updater('INFO', typeof msg === 'object' ? JSON.stringify(msg) : msg),
            warn: (msg) => logger.updater('WARN', typeof msg === 'object' ? JSON.stringify(msg) : msg),
            error: (msg) => logger.updater('ERROR', typeof msg === 'object' ? JSON.stringify(msg) : msg)
        }

        // Olay Dinleyicileri
        autoUpdater.on('checking-for-update', () => {
            this.status = 'checking'
            this.lastError = null
            this._broadcast('updater:status', this.getState())
        })

        autoUpdater.on('update-available', (info) => {
            // Geri çekilmiş (withdrawn) veya geçersiz sürüm mü kontrol et
            const version = info.version
            const releaseRecord = releaseManager.getByVersion(version)
            if (releaseRecord && releaseRecord.status === 'withdrawn') {
                logger.warn('UPDATER', `Tespit edilen sürüm (v${version}) geri çekilmiş (withdrawn)! Güncelleme engelleniyor.`)
                this.status = 'not-available'
                this.updateInfo = null
                this._broadcast('updater:status', this.getState())
                return
            }

            this.status = 'available'
            this.updateInfo = {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes,
                mandatory: releaseRecord ? releaseRecord.mandatory : false,
                channel: info.version.includes('-') ? 'beta' : 'stable',
                changes: releaseRecord ? releaseRecord.changes : []
            }
            logger.info('UPDATER', `Güncelleme mevcut: v${this.currentVersion} -> v${info.version}`)
            this._broadcast('updater:status', this.getState())
        })

        autoUpdater.on('update-not-available', (info) => {
            this.status = 'not-available'
            this.updateInfo = null
            logger.info('UPDATER', `Uygulama güncel. (v${this.currentVersion})`)
            this._broadcast('updater:status', this.getState())
        })

        autoUpdater.on('download-progress', (progressObj) => {
            this.status = 'downloading'
            this.downloadProgress = {
                bytesPerSecond: progressObj.bytesPerSecond,
                percent: Math.round(progressObj.percent || 0),
                total: progressObj.total,
                transferred: progressObj.transferred
            }
            this._broadcast('updater:progress', this.downloadProgress)
        })

        autoUpdater.on('update-downloaded', (info) => {
            this.status = 'downloaded'
            this.downloadProgress = { percent: 100 }
            logger.info('UPDATER', `Güncelleme paketi başarıyla indirildi: v${info.version}. Kuruluma hazır.`)
            this._broadcast('updater:status', this.getState())
        })

        autoUpdater.on('error', (err) => {
            this.status = 'error'
            const errorId = logger.updater('ERROR', 'Güncelleme hatası', err)
            this.lastError = {
                errorId,
                message: err.message || 'Güncelleme sunucusuna ulaşılamadı (Çevrimdışı)'
            }
            this._broadcast('updater:status', this.getState())
        })
    }

    _broadcast(channel, data) {
        this.emit(channel, data)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send(channel, data)
        }
    }

    getState() {
        return {
            status: this.status,
            currentVersion: this.currentVersion,
            updateInfo: this.updateInfo,
            downloadProgress: this.downloadProgress,
            lastError: this.lastError
        }
    }

    async checkForUpdates() {
        const settings = settingsStore.get()
        const channel = settings.updates.channel || 'stable'

        let isPackaged = false
        try {
            const electron = require('electron')
            isPackaged = Boolean(electron.app && electron.app.isPackaged)
        } catch (e) { }

        this.status = 'checking'
        this.lastError = null
        this._broadcast('updater:status', this.getState())

        if (autoUpdater && isPackaged) {
            autoUpdater.channel = channel === 'beta' ? 'beta' : null
            autoUpdater.allowPrerelease = (channel === 'beta')
            try {
                const result = await autoUpdater.checkForUpdates()
                return { success: true, result }
            } catch (err) {
                // Offline fallback kontrolü
                this.status = 'error'
                const errorId = logger.updater('ERROR', 'Güncelleme kontrolü başarısız', err)
                this.lastError = {
                    errorId,
                    message: 'Güncelleme sunucusuna bağlanılamadı. Çevrimdışı olarak devam edebilirsiniz.'
                }
                this._broadcast('updater:status', this.getState())
                return { success: false, error: this.lastError }
            }
        }

        // Geliştirme modu fallback (paketli değilken autoUpdater atlar)
        logger.info('UPDATER', 'Geliştirme / test modu: yerel sürüm kontrolü yapılıyor.')
        await new Promise(r => setTimeout(r, 600))
        const latest = releaseManager.getLatest(channel)
        if (latest && semver.gt(latest.version, this.currentVersion) && latest.status === 'published') {
            this.status = 'available'
            this.updateInfo = latest
        } else {
            this.status = 'not-available'
        }
        this._broadcast('updater:status', this.getState())
        return { success: true }
    }

    async downloadUpdate() {
        let isPackaged = false
        try {
            const electron = require('electron')
            isPackaged = Boolean(electron.app && electron.app.isPackaged)
        } catch (e) { }

        // Geliştirme modu veya autoUpdater olmayan ortamda simüle et
        if (!autoUpdater || !isPackaged) {
            logger.warn('UPDATER', 'Geliştirme / test ortamında güncelleme indirmesi simüle ediliyor...')
            this.status = 'downloading'
            this._broadcast('updater:status', this.getState())
            let p = 0
            const interval = setInterval(() => {
                p += 25
                this.downloadProgress = { percent: p, transferred: p * 1000, total: 100000, bytesPerSecond: 256000 }
                this._broadcast('updater:progress', this.downloadProgress)
                if (p >= 100) {
                    clearInterval(interval)
                    this.status = 'downloaded'
                    this._broadcast('updater:status', this.getState())
                }
            }, 250)
            return { success: true }
        }

        try {
            this.status = 'downloading'
            this._broadcast('updater:status', this.getState())
            await autoUpdater.downloadUpdate()
            return { success: true }
        } catch (err) {
            // Eğer "Please check update first" hatası alınırsa, önce kontrol yapmayı dene
            if (err.message && err.message.includes('Please check update first')) {
                try {
                    logger.info('UPDATER', 'İndirme öncesi zorunlu güncelleme kontrolü yapılıyor...')
                    await autoUpdater.checkForUpdates()
                    await autoUpdater.downloadUpdate()
                    return { success: true }
                } catch (retryErr) {
                    this.status = 'error'
                    const errorId = logger.updater('ERROR', 'Güncelleme indirme hatası (yeniden deneme)', retryErr)
                    this.lastError = { errorId, message: retryErr.message }
                    this._broadcast('updater:status', this.getState())
                    return { success: false, error: this.lastError }
                }
            }

            this.status = 'error'
            const errorId = logger.updater('ERROR', 'Güncelleme indirme hatası', err)
            this.lastError = { errorId, message: err.message }
            this._broadcast('updater:status', this.getState())
            return { success: false, error: this.lastError }
        }
    }

    quitAndInstall() {
        let isPackaged = false
        try {
            const electron = require('electron')
            isPackaged = Boolean(electron.app && electron.app.isPackaged)
        } catch (e) { }

        if (autoUpdater && isPackaged && this.status === 'downloaded') {
            logger.info('UPDATER', 'Uygulama yeniden başlatılıyor ve güncelleme kuruluyor (Sessiz mod)...')
            autoUpdater.quitAndInstall(true, true)
        } else if (this.status === 'downloaded') {
            logger.info('UPDATER', 'Geliştirme modunda güncelleme kurulumu tamamlandı sayıldı.')
            this.status = 'idle'
            this._broadcast('updater:status', this.getState())
        } else {
            logger.warn('UPDATER', 'Kuruluma hazır güncelleme bulunmuyor.')
        }
    }
}

module.exports = new UpdaterManager()
