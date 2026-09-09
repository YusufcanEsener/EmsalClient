const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

// Modüler mimari bileşenleri
const logger = require('./src/utils/logger')
const { runMigrationIfNeeded } = require('./src/utils/migration')
const profileStore = require('./src/profiles/profile-store')
const settingsStore = require('./src/settings/settings-store')
const releaseManager = require('./src/releases/release-manager')
const updaterManager = require('./src/updater/updater-manager')
const trayManager = require('./src/tray/tray-manager')
const botManager = require('./src/bot/bot-manager')

let mainWindow = null
app.isQuitting = false

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1220,
        height: 860,
        minWidth: 980,
        minHeight: 680,
        title: 'EmsalClient',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        backgroundColor: '#080D16',
        frame: false,
        resizable: true,
        maximizable: true,
        minimizable: true,
        closable: true,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false // mineflayer & net socket gereksinimleri için sandbox: false korunur
        }
    })

    mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'))

    mainWindow.on('maximize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window:state-changed', { isMaximized: true })
        }
    })

    mainWindow.on('unmaximize', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('window:state-changed', { isMaximized: false })
        }
    })

    // Updater ve Tray için pencere referansını bağla
    updaterManager.setMainWindow(mainWindow)
    trayManager.init(mainWindow, {
        onCheckUpdates: () => updaterManager.checkForUpdates(),
        onOpenProfiles: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('app:navigate', 'profiles')
            }
        }
    })

    // Pencere kapatma davranışını ayarla (closeToTray kontrolü)
    mainWindow.on('close', (event) => {
        const settings = settingsStore.get()
        if (settings.application.closeToTray && !app.isQuitting) {
            event.preventDefault()
            mainWindow.hide()
            logger.info('APP', 'Pencere sistem tepsisine küçültüldü (arka planda çalışıyor)')
            return false
        }
    })

    mainWindow.on('minimize', (event) => {
        const settings = settingsStore.get()
        if (settings.application.minimizeToTray) {
            event.preventDefault()
            mainWindow.hide()
        }
    })

    // Pencere hazır olduğunda başlangıç verilerini ilet
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('bot:durum-guncelle', botManager.getStatus())

        // Otomatik güncelleme kontrolü açıksa arka planda kontrol et
        const settings = settingsStore.get()
        if (settings.updates.autoCheck) {
            setTimeout(() => {
                updaterManager.checkForUpdates()
            }, 3000)
        }
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

// ==========================================
// BOT OLAYLARI VE KÖPRÜLERİ
// ==========================================
botManager.on('log', (mesaj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:log', mesaj)
    }
})

botManager.on('durum', (durumBilgisi) => {
    trayManager.updateBotStatus(durumBilgisi.durum)
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:durum-guncelle', durumBilgisi)
    }
})

botManager.on('minyonlar', (minyonlar) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:minyonlar-guncelle', minyonlar)
    }
})

botManager.on('kovanlar', (kovanlar) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:kovanlar-guncelle', kovanlar)
    }
})

botManager.on('envanter', (envanter) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:envanter-guncelle', envanter)
    }
})

botManager.on('sandikGuncellendi', (konum) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:sandik-guncelle', konum)
    }
})

botManager.on('oto-bal-guncelle', (durum) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:oto-bal-guncelle', durum)
    }
})

botManager.on('ayarGuncellendi', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:durum-guncelle', botManager.getStatus())
    }
})

botManager.on('profileChanged', (profile) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('profiles:changed', profile)
        mainWindow.webContents.send('bot:durum-guncelle', botManager.getStatus())
    }
})

botManager.on('sunucuGuncellendi', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot:sunucu-guncelle', data)
    }
})

// ==========================================
// IPC HANDLERS - UYGULAMA & PENCERE
// ==========================================
ipcMain.handle('app:get-version', () => app.getVersion())
ipcMain.handle('app:get-platform', () => process.platform)
ipcMain.handle('window:is-maximized', () => (mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false))

ipcMain.on('window:minimize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    logger.info('APP', '[WINDOW] window:minimize tetiklendi')
    mainWindow.minimize()
})

ipcMain.on('window:maximize', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const wasMax = mainWindow.isMaximized()
    logger.info('APP', `[WINDOW] window:maximize tetiklendi (mevcut isMaximized: ${wasMax})`)
    if (wasMax) {
        mainWindow.unmaximize()
    } else {
        mainWindow.maximize()
    }
    const isNowMax = mainWindow.isMaximized()
    mainWindow.webContents.send('window:state-changed', { isMaximized: isNowMax })
})

ipcMain.on('window:close', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    logger.info('APP', '[WINDOW] window:close tetiklendi')
    app.isQuitting = true
    mainWindow.close()
})

// ==========================================
// IPC HANDLERS - GÜNCELLEME (UPDATER)
// ==========================================
ipcMain.handle('updater:check', async () => {
    return await updaterManager.checkForUpdates()
})

ipcMain.handle('updater:download', async () => {
    return await updaterManager.downloadUpdate()
})

ipcMain.on('updater:install', () => {
    updaterManager.quitAndInstall()
})

ipcMain.handle('updater:get-state', () => {
    return updaterManager.getState()
})

// ==========================================
// IPC HANDLERS - PROFİLLER (PROFILES)
// ==========================================
ipcMain.handle('profiles:list', () => profileStore.list())
ipcMain.handle('profiles:get', (e, id) => profileStore.get(id))
ipcMain.handle('profiles:create', (e, data, password) => profileStore.create(data, password))
ipcMain.handle('profiles:update', (e, id, data, password) => profileStore.update(id, data, password))
ipcMain.handle('profiles:delete', (e, id) => profileStore.delete(id))
ipcMain.handle('profiles:duplicate', (e, id) => profileStore.duplicate(id))
ipcMain.handle('profiles:launch', (e, id) => {
    botManager.setActiveProfile(id)
    return botManager.start()
})
ipcMain.handle('profiles:export', (e, ids) => profileStore.exportProfiles(ids))
ipcMain.handle('profiles:import', (e, jsonString) => profileStore.importProfiles(jsonString))

// ==========================================
// IPC HANDLERS - BOT KONTROL (GERİYE DÖNÜK UYUMLU)
// ==========================================
ipcMain.handle('bot:durum-al', () => botManager.getStatus())
ipcMain.handle('bot:baslat', () => botManager.start())
ipcMain.handle('bot:durdur', () => botManager.stop())
ipcMain.handle('bot:tara', () => botManager.tara())
ipcMain.handle('bot:kovan-tara', () => botManager.kovanTara())
ipcMain.handle('bot:kovan-bal-test', () => botManager.kovanBalTest())
ipcMain.handle('bot:kovan-bal-topla', (e, hedefYuzde) => botManager.kovanBalTopla(hedefYuzde))
ipcMain.handle('bot:tekil-kovan-hasat', (e, kovanId) => botManager.tekilKovanHasat(kovanId))
ipcMain.handle('bot:envanter-al', () => botManager.envanterAl())
ipcMain.handle('bot:topla', () => botManager.tumunuTopla())
ipcMain.handle('bot:tekil-topla', (e, minyonIsmi) => botManager.tekilTopla(minyonIsmi))
ipcMain.handle('bot:sandik-ayarla', () => botManager.sandikAyarla())
ipcMain.handle('bot:test-modu-degistir', (e, durum) => botManager.testModuDegistir(durum))
ipcMain.handle('bot:hedef-yuzde-degistir', (e, yuzde) => botManager.hedefYuzdeDegistir(yuzde))
ipcMain.handle('bot:oto-bal-durum-al', () => botManager.otoBalDurumAl())
ipcMain.handle('bot:oto-bal-degistir', (e, durum) => botManager.otoBalDegistir(durum))

// ==========================================
// IPC HANDLERS - AYARLAR (SETTINGS) & LOGLAR
// ==========================================
ipcMain.handle('settings:get', () => settingsStore.get())
ipcMain.handle('settings:update', (e, partial) => settingsStore.update(partial))
ipcMain.handle('logs:open-folder', () => logger.openLogsFolder())

// ==========================================
// IPC HANDLERS - SÜRÜMLER (RELEASES & ADMIN)
// ==========================================
ipcMain.handle('releases:list', (e, channel) => releaseManager.getAll(channel))
ipcMain.handle('releases:get-latest', (e, channel) => releaseManager.getLatest(channel))
ipcMain.handle('releases:validate', (e, data) => releaseManager.validate(data))
ipcMain.handle('releases:create', (e, data) => releaseManager.create(data))
ipcMain.handle('releases:update', (e, id, data) => releaseManager.update(id, data))
ipcMain.handle('releases:publish', (e, id) => releaseManager.publish(id))
ipcMain.handle('releases:withdraw', (e, id, reason) => releaseManager.withdraw(id, reason))
ipcMain.handle('releases:delete-draft', (e, id) => releaseManager.deleteDraft(id))

// ==========================================
// UYGULAMA YAŞAM DÖNGÜSÜ
// ==========================================
app.whenReady().then(() => {
    logger.info('APP', `EmsalClient v${app.getVersion()} başlatılıyor...`)

    // 1. Gerekliyse eski verilerden otomatik migrasyon çalıştır
    runMigrationIfNeeded()

    // 2. Bot yöneticisini aktif profil ile hazırla
    botManager.init()

    // 3. Ana pencereyi oluştur
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('before-quit', () => {
    app.isQuitting = true
    logger.info('APP', 'Uygulama kapatılıyor, kaynaklar temizleniyor...')
    try {
        botManager.stop()
    } catch (e) { }
    trayManager.destroy()
})

app.on('window-all-closed', () => {
    const settings = settingsStore.get()
    if (!settings.application.closeToTray || app.isQuitting) {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    }
})
