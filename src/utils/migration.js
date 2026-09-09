const fs = require('fs')
const path = require('path')
const paths = require('./paths')
const logger = require('./logger')
const profileStore = require('../profiles/profile-store')
const credentialStore = require('../profiles/credential-store')
const settingsStore = require('../settings/settings-store')

function runMigrationIfNeeded() {
    try {
        const existingProfiles = profileStore.list()

        // Eğer sistemde zaten en az 1 profil varsa, migrasyona gerek yok
        if (existingProfiles && existingProfiles.length > 0) {
            return { migrated: false, profilesCount: existingProfiles.length }
        }

        logger.info('MIGRATION', 'Mevcut profil bulunamadı. Eski yapılandırmadan otomatik migrasyon başlatılıyor...')

        // 1. Mevcut main.js veya eski sabit ayarları tespit et
        let sunucuIp = 'oyna.aesirmc.com'
        let kullaniciAdi = 'huggecool'
        let sifre = ''
        let adaSahibi = 'EmsalSizOFC'
        let hedefDoluluk = 80
        let kontrolAraligi = 30
        let otoBal = true
        let sandikKonumu = { x: 20, y: 65, z: 16 }

        // main.js dosyasından dinamik olarak eski ayarları okumayı dene
        const mainJsPath = path.join(__dirname, '..', '..', 'main.js')
        if (fs.existsSync(mainJsPath)) {
            try {
                const content = fs.readFileSync(mainJsPath, 'utf8')
                const ipMatch = content.match(/SUNUCU_IP:\s*['"]([^'"]+)['"]/)
                const userMatch = content.match(/KULLANICI_ADI:\s*['"]([^'"]+)['"]/)
                const passMatch = content.match(/SIFRE:\s*['"]([^'"]+)['"]/)
                const adaMatch = content.match(/ADA_SAHIBI:\s*['"]([^'"]+)['"]/)
                const hedefMatch = content.match(/HEDEF_DOLULUK_YUZDESI:\s*(\d+)/)

                if (ipMatch) sunucuIp = ipMatch[1]
                if (userMatch) kullaniciAdi = userMatch[1]
                if (passMatch) sifre = passMatch[1]
                if (adaMatch) adaSahibi = adaMatch[1]
                if (hedefMatch) hedefDoluluk = parseInt(hedefMatch[1], 10)
            } catch (e) {
                logger.warn('MIGRATION', 'main.js ayrıştırma uyarısı: ' + e.message)
            }
        }

        // 2. İlk Varsayılan Profili Oluştur
        const defaultProfile = profileStore.create({
            name: 'Varsayılan Bot (AesirMC)',
            server: sunucuIp,
            username: kullaniciAdi,
            minecraftVersion: '1.20.1',
            islandOwner: adaSahibi,
            settings: {
                testMode: true,
                showChatMessages: false,
                targetPercentage: hedefDoluluk,
                checkInterval: kontrolAraligi,
                autoHoneyHarvest: otoBal,
                saveJson: true,
                apiActive: true,
                apiPort: 3000,
                chestLocation: sandikKonumu
            }
        }, sifre)

        // 3. Şifreyi CredentialStore'a kaydet (safeStorage / DPAPI ile güvenli şifreleme)
        credentialStore.savePassword(defaultProfile.id, sifre)

        // 4. SettingsStore içinde aktif profil olarak işaretle
        settingsStore.update({
            meta: {
                activeProfileId: defaultProfile.id,
                onboardingCompleted: true
            }
        })

        // 5. Kök dizindeki eski minyonlar.json & kovanlar.json dosyalarını userData'ya kopyala (veri kaybını önleme)
        const oldMinyonlar = path.join(__dirname, '..', '..', 'minyonlar.json')
        const newMinyonlar = paths.getMinyonlarJsonPath()
        if (fs.existsSync(oldMinyonlar) && !fs.existsSync(newMinyonlar)) {
            try {
                fs.copyFileSync(oldMinyonlar, newMinyonlar)
                logger.info('MIGRATION', 'Eski minyonlar.json başarıyla userData dizinine taşındı')
            } catch (e) { }
        }

        const oldKovanlar = path.join(__dirname, '..', '..', 'kovanlar.json')
        const newKovanlar = paths.getKovanlarJsonPath()
        if (fs.existsSync(oldKovanlar) && !fs.existsSync(newKovanlar)) {
            try {
                fs.copyFileSync(oldKovanlar, newKovanlar)
                logger.info('MIGRATION', 'Eski kovanlar.json başarıyla userData dizinine taşındı')
            } catch (e) { }
        }

        logger.info('MIGRATION', `Başarılı! İlk profil oluşturuldu ve şifre donanım seviyesinde şifrelendi [ID: ${defaultProfile.id}]`)
        return { migrated: true, profile: defaultProfile }
    } catch (err) {
        logger.error('MIGRATION', 'Migrasyon sırasında hata oluştu', err)
        return { migrated: false, error: err.message }
    }
}

module.exports = {
    runMigrationIfNeeded
}
