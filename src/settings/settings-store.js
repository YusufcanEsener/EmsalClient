const fs = require('fs')
const paths = require('../utils/paths')
const logger = require('../utils/logger')

const VARSAYILAN_AYARLAR = {
    appearance: {
        theme: 'dark' // 'dark' | 'light' | 'system'
    },
    updates: {
        autoCheck: true,
        channel: 'stable', // 'stable' | 'beta'
        checkFrequencyHours: 4
    },
    application: {
        startWithWindows: false,
        minimizeToTray: false,
        closeToTray: false
    },
    notifications: {
        enableNotifications: true,
        updateNotifications: true
    },
    meta: {
        activeProfileId: null,
        lastSeenRelease: null,
        onboardingCompleted: false
    }
}

class SettingsStore {
    constructor() {
        this.cache = null
        this.filePath = paths.getSettingsPath()
    }

    get() {
        if (this.cache) return this.cache

        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf8')
                const parsed = JSON.parse(raw)
                // Derin birleştirme ile eksik alanları varsayılanlarla tamamla
                this.cache = {
                    appearance: { ...VARSAYILAN_AYARLAR.appearance, ...(parsed.appearance || {}) },
                    updates: { ...VARSAYILAN_AYARLAR.updates, ...(parsed.updates || {}) },
                    application: { ...VARSAYILAN_AYARLAR.application, ...(parsed.application || {}) },
                    notifications: { ...VARSAYILAN_AYARLAR.notifications, ...(parsed.notifications || {}) },
                    meta: { ...VARSAYILAN_AYARLAR.meta, ...(parsed.meta || {}) }
                }
                return this.cache
            } catch (err) {
                logger.error('SETTINGS', 'Ayarlar dosyası okunamadı, varsayılanlar yükleniyor', err)
            }
        }

        this.cache = JSON.parse(JSON.stringify(VARSAYILAN_AYARLAR))
        this.save()
        return this.cache
    }

    update(partialSettings) {
        const current = this.get()
        if (partialSettings.appearance) {
            current.appearance = { ...current.appearance, ...partialSettings.appearance }
        }
        if (partialSettings.updates) {
            current.updates = { ...current.updates, ...partialSettings.updates }
        }
        if (partialSettings.application) {
            current.application = { ...current.application, ...partialSettings.application }
        }
        if (partialSettings.notifications) {
            current.notifications = { ...current.notifications, ...partialSettings.notifications }
        }
        if (partialSettings.meta) {
            current.meta = { ...current.meta, ...partialSettings.meta }
        }
        this.save()
        logger.info('SETTINGS', 'Uygulama ayarları güncellendi')
        return current
    }

    save() {
        try {
            paths.ensureDir(paths.getUserDataDir())
            fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8')
        } catch (err) {
            logger.error('SETTINGS', 'Ayarlar kaydedilemedi', err)
        }
    }
}

module.exports = new SettingsStore()
