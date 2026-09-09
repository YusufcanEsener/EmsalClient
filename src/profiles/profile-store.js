const fs = require('fs')
const crypto = require('crypto')
const paths = require('../utils/paths')
const logger = require('../utils/logger')
const credentialStore = require('./credential-store')

const VARSAYILAN_AYARLAR = {
    testMode: true,
    showChatMessages: false,
    targetPercentage: 80,
    checkInterval: 30,
    autoHoneyHarvest: true,
    saveJson: true,
    apiActive: true,
    apiPort: 3000,
    chestLocation: { x: 20, y: 65, z: 16 },
    protectedItems: [
        'pickaxe', 'axe', 'shovel', 'sword', 'hoe',
        'helmet', 'chestplate', 'leggings', 'boots',
        'bread', 'steak', 'cooked_beef', 'apple', 'golden_apple', 'shield', 'totem'
    ]
}

class ProfileStore {
    constructor() {
        this.filePath = paths.getProfilesPath()
        this.cache = null
    }

    _load() {
        if (this.cache) return this.cache
        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf8')
                this.cache = JSON.parse(raw)
                if (Array.isArray(this.cache)) {
                    return this.cache
                }
            } catch (err) {
                logger.error('PROFILES', 'Profiller dosyası okunamadı', err)
            }
        }
        this.cache = []
        return this.cache
    }

    _save() {
        try {
            paths.ensureDir(paths.getUserDataDir())
            fs.writeFileSync(this.filePath, JSON.stringify(this.cache || [], null, 2), 'utf8')
        } catch (err) {
            logger.error('PROFILES', 'Profiller dosyası kaydedilemedi', err)
        }
    }

    list() {
        const profiles = this._load()
        return profiles.map(p => ({
            ...p,
            hasPassword: credentialStore.hasPassword(p.id)
        }))
    }

    get(id) {
        if (!id) return null
        const profiles = this._load()
        const found = profiles.find(p => p.id === id)
        if (!found) return null
        return {
            ...found,
            hasPassword: credentialStore.hasPassword(found.id)
        }
    }

    create(profileData, password = null) {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        const newProfile = {
            id,
            name: (profileData.name || 'Yeni Bot Profili').trim(),
            server: (profileData.server || 'oyna.aesirmc.com').trim(),
            username: (profileData.username || 'bot').trim(),
            minecraftVersion: (profileData.minecraftVersion || '1.20.1').trim(),
            islandOwner: (profileData.islandOwner || '').trim(),
            settings: {
                ...VARSAYILAN_AYARLAR,
                ...(profileData.settings || {})
            },
            meta: {
                createdAt: now,
                updatedAt: now,
                lastUsedAt: null,
                lastStartedAt: null,
                lastStoppedAt: null,
                runtimeSeconds: 0,
                status: 'idle',
                lastError: null
            }
        }

        const profiles = this._load()
        profiles.push(newProfile)
        this._save()

        if (password) {
            credentialStore.savePassword(id, password)
        }

        logger.info('PROFILES', `Yeni profil oluşturuldu: "${newProfile.name}" [${id}]`)
        return {
            ...newProfile,
            hasPassword: Boolean(password)
        }
    }

    update(id, profileData, newPassword = null) {
        const profiles = this._load()
        const index = profiles.findIndex(p => p.id === id)
        if (index === -1) {
            throw new Error(`Profil bulunamadı: ${id}`)
        }

        const existing = profiles[index]
        const now = new Date().toISOString()

        const updated = {
            ...existing,
            name: profileData.name !== undefined ? profileData.name.trim() : existing.name,
            server: profileData.server !== undefined ? profileData.server.trim() : existing.server,
            username: profileData.username !== undefined ? profileData.username.trim() : existing.username,
            minecraftVersion: profileData.minecraftVersion !== undefined ? profileData.minecraftVersion.trim() : existing.minecraftVersion,
            islandOwner: profileData.islandOwner !== undefined ? profileData.islandOwner.trim() : existing.islandOwner,
            settings: {
                ...existing.settings,
                ...(profileData.settings || {})
            },
            meta: {
                ...existing.meta,
                updatedAt: now
            }
        }

        profiles[index] = updated
        this._save()

        if (newPassword !== null && newPassword !== undefined && newPassword !== '') {
            credentialStore.savePassword(id, newPassword)
        }

        logger.info('PROFILES', `Profil güncellendi: "${updated.name}" [${id}]`)
        return {
            ...updated,
            hasPassword: credentialStore.hasPassword(id)
        }
    }

    delete(id) {
        const profiles = this._load()
        const index = profiles.findIndex(p => p.id === id)
        if (index === -1) return false

        const removed = profiles.splice(index, 1)[0]
        this._save()
        credentialStore.deletePassword(id)

        logger.info('PROFILES', `Profil silindi: "${removed.name}" [${id}]`)
        return true
    }

    duplicate(id) {
        const existing = this.get(id)
        if (!existing) throw new Error('Kopyalanacak profil bulunamadı')

        const originalPassword = credentialStore.getPassword(id)
        const dupData = {
            name: `${existing.name} (Kopya)`,
            server: existing.server,
            username: `${existing.username}_2`,
            minecraftVersion: existing.minecraftVersion,
            islandOwner: existing.islandOwner,
            settings: { ...existing.settings }
        }

        return this.create(dupData, originalPassword)
    }

    updateRuntimeMeta(id, metaUpdates) {
        const profiles = this._load()
        const profile = profiles.find(p => p.id === id)
        if (!profile) return

        let degisti = false
        if (!profile.meta) profile.meta = {}
        for (const [key, val] of Object.entries(metaUpdates)) {
            if (profile.meta[key] !== val) {
                profile.meta[key] = val
                degisti = true
            }
        }
        if (degisti) {
            this._save()
        }
    }

    exportProfiles(profileIds = null) {
        const profiles = this._load()
        const toExport = profileIds && profileIds.length > 0
            ? profiles.filter(p => profileIds.includes(p.id))
            : profiles

        // Güvenlik gereği: Dışa aktarılan dosyalarda ASLA şifre yer almaz (config-only export)
        const safeProfiles = toExport.map(p => ({
            name: p.name,
            server: p.server,
            username: p.username,
            minecraftVersion: p.minecraftVersion,
            islandOwner: p.islandOwner,
            settings: p.settings
        }))

        return JSON.stringify({
            app: 'EmsalClient',
            version: '2.0.0',
            exportedAt: new Date().toISOString(),
            profiles: safeProfiles
        }, null, 2)
    }

    importProfiles(jsonString) {
        try {
            const data = JSON.parse(jsonString)
            const list = Array.isArray(data) ? data : data.profiles
            if (!Array.isArray(list)) {
                return { success: false, message: 'Geçersiz profil dosya formatı' }
            }

            let importedCount = 0
            for (const item of list) {
                if (item.name && item.server && item.username) {
                    this.create({
                        name: `${item.name} (İçe Aktarılan)`,
                        server: item.server,
                        username: item.username,
                        minecraftVersion: item.minecraftVersion || '1.20.1',
                        islandOwner: item.islandOwner || '',
                        settings: item.settings || VARSAYILAN_AYARLAR
                    }, null)
                    importedCount++
                }
            }

            logger.info('PROFILES', `${importedCount} adet profil başarıyla içe aktarıldı`)
            return { success: true, count: importedCount }
        } catch (err) {
            logger.error('PROFILES', 'Profil içe aktarma hatası', err)
            return { success: false, message: err.message }
        }
    }
}

module.exports = new ProfileStore()
