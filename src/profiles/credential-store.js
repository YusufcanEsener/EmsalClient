const fs = require('fs')
const crypto = require('crypto')
const os = require('os')
const paths = require('../utils/paths')
const logger = require('../utils/logger')

let electron = null
try {
    electron = require('electron')
} catch (e) { }

class CredentialStore {
    constructor() {
        this.filePath = paths.getCredentialsPath()
        this.cache = null
    }

    _isSafeStorageAvailable() {
        return Boolean(electron && electron.safeStorage && electron.safeStorage.isEncryptionAvailable())
    }

    // safeStorage desteklenmeyen ortamlarda (örn. CLI testleri) makineye özel AES-256 fallback
    _getFallbackKey() {
        const seed = `mt-bot-${os.hostname()}-${os.userInfo().username}-v2-auth`
        return crypto.createHash('sha256').update(seed).digest()
    }

    _encrypt(plainText) {
        if (!plainText) return ''

        if (this._isSafeStorageAvailable()) {
            const buffer = electron.safeStorage.encryptString(plainText)
            return {
                mode: 'safeStorage',
                data: buffer.toString('hex')
            }
        }

        // Fallback AES-256-GCM
        const iv = crypto.randomBytes(12)
        const cipher = crypto.createCipheriv('aes-256-gcm', this._getFallbackKey(), iv)
        let encrypted = cipher.update(plainText, 'utf8', 'hex')
        encrypted += cipher.final('hex')
        const tag = cipher.getAuthTag().toString('hex')

        return {
            mode: 'aes-256-gcm',
            iv: iv.toString('hex'),
            tag: tag,
            data: encrypted
        }
    }

    _decrypt(record) {
        if (!record || !record.data) return ''

        try {
            if (record.mode === 'safeStorage') {
                if (this._isSafeStorageAvailable()) {
                    const buffer = Buffer.from(record.data, 'hex')
                    return electron.safeStorage.decryptString(buffer)
                } else {
                    logger.warn('CREDENTIALS', 'safeStorage mevcut değil, kimlik bilgisi çözülemedi')
                    return ''
                }
            }

            if (record.mode === 'aes-256-gcm') {
                const iv = Buffer.from(record.iv, 'hex')
                const tag = Buffer.from(record.tag, 'hex')
                const decipher = crypto.createDecipheriv('aes-256-gcm', this._getFallbackKey(), iv)
                decipher.setAuthTag(tag)
                let decrypted = decipher.update(record.data, 'hex', 'utf8')
                decrypted += decipher.final('utf8')
                return decrypted
            }
        } catch (err) {
            logger.error('CREDENTIALS', 'Şifre çözme hatası', err)
            return ''
        }

        return ''
    }

    _load() {
        if (this.cache) return this.cache
        if (fs.existsSync(this.filePath)) {
            try {
                const raw = fs.readFileSync(this.filePath, 'utf8')
                this.cache = JSON.parse(raw)
                return this.cache
            } catch (err) {
                logger.error('CREDENTIALS', 'Kimlik dosyası okunamadı', err)
            }
        }
        this.cache = {}
        return this.cache
    }

    _save() {
        try {
            paths.ensureDir(paths.getUserDataDir())
            fs.writeFileSync(this.filePath, JSON.stringify(this.cache || {}, null, 2), 'utf8')
        } catch (err) {
            logger.error('CREDENTIALS', 'Kimlik dosyası kaydedilemedi', err)
        }
    }

    savePassword(profileId, plainPassword) {
        if (!profileId) return false
        const map = this._load()
        if (!plainPassword) {
            delete map[profileId]
        } else {
            map[profileId] = this._encrypt(plainPassword)
        }
        this._save()
        logger.info('CREDENTIALS', `Profil kimlik bilgisi güvenli olarak saklandı [ID: ${profileId.substring(0, 8)}...]`)
        return true
    }

    getPassword(profileId) {
        if (!profileId) return ''
        const map = this._load()
        const record = map[profileId]
        if (!record) return ''
        return this._decrypt(record)
    }

    hasPassword(profileId) {
        if (!profileId) return false
        const map = this._load()
        return Boolean(map[profileId])
    }

    deletePassword(profileId) {
        if (!profileId) return false
        const map = this._load()
        if (map[profileId]) {
            delete map[profileId]
            this._save()
            return true
        }
        return false
    }
}

module.exports = new CredentialStore()
