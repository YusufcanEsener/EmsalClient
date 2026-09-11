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
        start: (profileId) => ipcRenderer.invoke('bot:baslat', profileId),
        stop: (profileId) => ipcRenderer.invoke('bot:durdur', profileId),
        startAll: () => ipcRenderer.invoke('bot:baslat-hepsi'),
        stopAll: () => ipcRenderer.invoke('bot:durdur-hepsi'),
        select: (profileId) => ipcRenderer.invoke('bot:sec', profileId),
        list: () => ipcRenderer.invoke('bot:liste-al'),
        status: (profileId) => ipcRenderer.invoke('bot:durum-al', profileId),
        tara: (profileId) => ipcRenderer.invoke('bot:tara', profileId),
        kovanTara: (profileId) => ipcRenderer.invoke('bot:kovan-tara', profileId),
        kovanBalTest: (profileId) => ipcRenderer.invoke('bot:kovan-bal-test', profileId),
        kovanBalTopla: (hedefYuzde, profileId) => ipcRenderer.invoke('bot:kovan-bal-topla', hedefYuzde, profileId),
        tekilKovanHasat: (kovanId, profileId) => ipcRenderer.invoke('bot:tekil-kovan-hasat', kovanId, profileId),
        envanterAl: (profileId) => ipcRenderer.invoke('bot:envanter-al', profileId),
        envanterBosalt: (profileId) => ipcRenderer.invoke('bot:envanter-bosalt', profileId),
        tumunuTopla: (profileId) => ipcRenderer.invoke('bot:topla', profileId),
        tekilTopla: (isim, profileId) => ipcRenderer.invoke('bot:tekil-topla', isim, profileId),
        sandikAyarla: (profileId) => ipcRenderer.invoke('bot:sandik-ayarla', profileId),
        testModuDegistir: (durum, profileId) => ipcRenderer.invoke('bot:test-modu-degistir', durum, profileId),
        hedefYuzdeDegistir: (yuzde, profileId) => ipcRenderer.invoke('bot:hedef-yuzde-degistir', yuzde, profileId),
        otoBalDurumAl: (profileId) => ipcRenderer.invoke('bot:oto-bal-durum-al', profileId),
        otoBalDegistir: (durum, profileId) => ipcRenderer.invoke('bot:oto-bal-degistir', durum, profileId),
        sunucuKontrolEt: (profileId) => ipcRenderer.invoke('bot:sunucu-kontrol-et', profileId),
        hasatAl: (profileId) => ipcRenderer.invoke('bot:hasat-al', profileId),
        hasatSifirla: (sadeceOturum, profileId) => ipcRenderer.invoke('bot:hasat-sifirla', sadeceOturum, profileId),

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
        },
        onHasatGuncelle: (callback) => {
            ipcRenderer.removeAllListeners('bot:hasat-guncelle')
            ipcRenderer.on('bot:hasat-guncelle', (e, data) => callback(data))
        },
        onTasmaKorumasi: (callback) => {
            ipcRenderer.removeAllListeners('bot:tasma-korumasi')
            ipcRenderer.on('bot:tasma-korumasi', (e, data) => callback(data))
        },
        onBotListUpdate: (callback) => {
            ipcRenderer.removeAllListeners('bot:liste-guncelle')
            ipcRenderer.on('bot:liste-guncelle', (e, data) => callback(data))
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
    sunucuKontrolEt: () => api.bot.sunucuKontrolEt(),
    hasatAl: () => api.bot.hasatAl(),
    hasatSifirla: (sadeceOturum) => api.bot.hasatSifirla(sadeceOturum),

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
    onSunucuGuncelle: (cb) => api.bot.onSunucuGuncelle(cb),
    onHasatGuncelle: (cb) => api.bot.onHasatGuncelle(cb),
    onTasmaKorumasi: (cb) => api.bot.onTasmaKorumasi(cb)
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('electronAPI', legacyElectronAPI)
