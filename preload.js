const { contextBridge, ipcRenderer } = require('electron')

// 1. Yeni Profesyonel Ad Alanlı (Namespaced) Güvenli API
const api = {
    app: {
        getVersion: () => ipcRenderer.invoke('app:get-version'),
        getPlatform: () => ipcRenderer.invoke('app:get-platform'),
        isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        onWindowState: (callback) => {
            ipcRenderer.removeAllListeners('window:state-changed')
            ipcRenderer.on('window:state-changed', (e, state) => callback(state))
        },
        onNavigate: (callback) => {
            ipcRenderer.removeAllListeners('app:navigate')
            ipcRenderer.on('app:navigate', (e, view) => callback(view))
        }
    },
    updater: {
        check: () => ipcRenderer.invoke('updater:check'),
        download: () => ipcRenderer.invoke('updater:download'),
        install: () => ipcRenderer.send('updater:install'),
        getState: () => ipcRenderer.invoke('updater:get-state'),
        onStatus: (callback) => {
            ipcRenderer.removeAllListeners('updater:status')
            ipcRenderer.on('updater:status', (e, state) => callback(state))
        },
        onProgress: (callback) => {
            ipcRenderer.removeAllListeners('updater:progress')
            ipcRenderer.on('updater:progress', (e, progress) => callback(progress))
        }
    },
    profiles: {
        list: () => ipcRenderer.invoke('profiles:list'),
        get: (id) => ipcRenderer.invoke('profiles:get', id),
        create: (data, password) => ipcRenderer.invoke('profiles:create', data, password),
        update: (id, data, password) => ipcRenderer.invoke('profiles:update', id, data, password),
        delete: (id) => ipcRenderer.invoke('profiles:delete', id),
        duplicate: (id) => ipcRenderer.invoke('profiles:duplicate', id),
        launch: (id) => ipcRenderer.invoke('profiles:launch', id),
        export: (ids) => ipcRenderer.invoke('profiles:export', ids),
        import: (jsonString) => ipcRenderer.invoke('profiles:import', jsonString),
        onProfileChanged: (callback) => {
            ipcRenderer.removeAllListeners('profiles:changed')
            ipcRenderer.on('profiles:changed', (e, profile) => callback(profile))
        }
    },
    bot: {
        start: () => ipcRenderer.invoke('bot:baslat'),
        stop: () => ipcRenderer.invoke('bot:durdur'),
        status: () => ipcRenderer.invoke('bot:durum-al'),
        tara: () => ipcRenderer.invoke('bot:tara'),
        kovanTara: () => ipcRenderer.invoke('bot:kovan-tara'),
        kovanBalTest: () => ipcRenderer.invoke('bot:kovan-bal-test'),
        kovanBalTopla: (hedefYuzde) => ipcRenderer.invoke('bot:kovan-bal-topla', hedefYuzde),
        tekilKovanHasat: (kovanId) => ipcRenderer.invoke('bot:tekil-kovan-hasat', kovanId),
        envanterAl: () => ipcRenderer.invoke('bot:envanter-al'),
        envanterBosalt: () => ipcRenderer.invoke('bot:envanter-bosalt'),
        tumunuTopla: () => ipcRenderer.invoke('bot:topla'),
        tekilTopla: (isim) => ipcRenderer.invoke('bot:tekil-topla', isim),
        sandikAyarla: () => ipcRenderer.invoke('bot:sandik-ayarla'),
        testModuDegistir: (durum) => ipcRenderer.invoke('bot:test-modu-degistir', durum),
        hedefYuzdeDegistir: (yuzde) => ipcRenderer.invoke('bot:hedef-yuzde-degistir', yuzde),
        otoBalDurumAl: () => ipcRenderer.invoke('bot:oto-bal-durum-al'),
        otoBalDegistir: (durum) => ipcRenderer.invoke('bot:oto-bal-degistir', durum),

        onLog: (callback) => {
            ipcRenderer.removeAllListeners('bot:log')
            ipcRenderer.on('bot:log', (e, msg) => callback(msg))
        },
        onMinyonlar: (callback) => {
            ipcRenderer.removeAllListeners('bot:minyonlar-guncelle')
            ipcRenderer.on('bot:minyonlar-guncelle', (e, data) => callback(data))
        },
        onKovanlar: (callback) => {
            ipcRenderer.removeAllListeners('bot:kovanlar-guncelle')
            ipcRenderer.on('bot:kovanlar-guncelle', (e, data) => callback(data))
        },
        onEnvanter: (callback) => {
            ipcRenderer.removeAllListeners('bot:envanter-guncelle')
            ipcRenderer.on('bot:envanter-guncelle', (e, data) => callback(data))
        },
        onDurum: (callback) => {
            ipcRenderer.removeAllListeners('bot:durum-guncelle')
            ipcRenderer.on('bot:durum-guncelle', (e, data) => callback(data))
        },
        onSandik: (callback) => {
            ipcRenderer.removeAllListeners('bot:sandik-guncelle')
            ipcRenderer.on('bot:sandik-guncelle', (e, data) => callback(data))
        },
        onOtoBal: (callback) => {
            ipcRenderer.removeAllListeners('bot:oto-bal-guncelle')
            ipcRenderer.on('bot:oto-bal-guncelle', (e, data) => callback(data))
        },
        onSunucuGuncelle: (callback) => {
            ipcRenderer.removeAllListeners('bot:sunucu-guncelle')
            ipcRenderer.on('bot:sunucu-guncelle', (e, data) => callback(data))
        }
    },
    settings: {
        get: () => ipcRenderer.invoke('settings:get'),
        update: (partial) => ipcRenderer.invoke('settings:update', partial)
    },
    logs: {
        openFolder: () => ipcRenderer.invoke('logs:open-folder')
    },
    releases: {
        list: (channel) => ipcRenderer.invoke('releases:list', channel),
        sync: () => ipcRenderer.invoke('releases:sync'),
        getLatest: (channel) => ipcRenderer.invoke('releases:get-latest', channel),
        validate: (data) => ipcRenderer.invoke('releases:validate', data),
        create: (data) => ipcRenderer.invoke('releases:create', data),
        update: (id, data) => ipcRenderer.invoke('releases:update', id, data),
        publish: (id) => ipcRenderer.invoke('releases:publish', id),
        withdraw: (id, reason) => ipcRenderer.invoke('releases:withdraw', id, reason),
        deleteDraft: (id) => ipcRenderer.invoke('releases:delete-draft', id)
    }
}

// 2. Geriye Dönük Uyumluluk (Legacy window.electronAPI Alias'ı)
const legacyElectronAPI = {
    botBaslat: () => api.bot.start(),
    botDurdur: () => api.bot.stop(),
    minyonlariTara: () => api.bot.tara(),
    kovanlariTara: () => api.bot.kovanTara(),
    kovanBalTest: () => api.bot.kovanBalTest(),
    kovanBalTopla: (yuzde) => api.bot.kovanBalTopla(yuzde),
    tekilKovanHasat: (id) => api.bot.tekilKovanHasat(id),
    envanterAl: () => api.bot.envanterAl(),
    envanterBosalt: () => api.bot.envanterBosalt(),
    tumunuTopla: () => api.bot.tumunuTopla(),
    tekilTopla: (isim) => api.bot.tekilTopla(isim),
    sandikAyarla: () => api.bot.sandikAyarla(),
    testModuDegistir: (durum) => api.bot.testModuDegistir(durum),
    hedefYuzdeDegistir: (yuzde) => api.bot.hedefYuzdeDegistir(yuzde),
    otoBalDurumAl: () => api.bot.otoBalDurumAl(),
    otoBalDegistir: (durum) => api.bot.otoBalDegistir(durum),
    durumAl: () => api.bot.status(),

    windowMinimize: () => api.app.minimize(),
    windowMaximize: () => api.app.maximize(),
    windowClose: () => api.app.close(),

    onLog: (cb) => api.bot.onLog(cb),
    onMinyonlarGuncelle: (cb) => api.bot.onMinyonlar(cb),
    onKovanlarGuncelle: (cb) => api.bot.onKovanlar(cb),
    onEnvanterGuncelle: (cb) => api.bot.onEnvanter(cb),
    onDurumGuncelle: (cb) => api.bot.onDurum(cb),
    onSandikGuncelle: (cb) => api.bot.onSandik(cb),
    onOtoBalGuncelle: (cb) => api.bot.onOtoBal(cb),
    onSunucuGuncelle: (cb) => api.bot.onSunucuGuncelle(cb)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electronAPI', legacyElectronAPI)
