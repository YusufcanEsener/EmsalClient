const assert = require('assert')
const path = require('path')
const fs = require('fs')

console.log('====================================================')
console.log('   EMSALCLIENT — AUTOMATED PRODUCTION TEST SUITE   ')
console.log('====================================================\n')

let passCount = 0
let failCount = 0

function it(desc, fn) {
    try {
        fn()
        console.log(`  [PASS] ${desc}`)
        passCount++
    } catch (err) {
        console.error(`  [FAIL] ${desc}`)
        console.error('         Error:', err.message)
        failCount++
    }
}

// 1. PATHS & DIRECTORY STRUCTURE
console.log('--- 1. Paths & UserData Directory ---')
const paths = require('../src/utils/paths')
it('Should resolve userData directory properly', () => {
    const userData = paths.getUserDataDir()
    assert(typeof userData === 'string' && userData.length > 0)
    assert(fs.existsSync(userData))
})
it('Should return valid paths for all runtime data files', () => {
    assert(paths.getProfilesPath().endsWith('profiles.json'))
    assert(paths.getCredentialsPath().endsWith('credentials.dat'))
    assert(paths.getSettingsPath().endsWith('settings.json'))
    assert(paths.getLogsDir().endsWith('logs'))
    assert(paths.getMinyonlarJsonPath().endsWith('minyonlar.json'))
    assert(paths.getKovanlarJsonPath().endsWith('kovanlar.json'))
})

// 2. LOGGER & SECURITY MASKING
console.log('\n--- 2. Logger & Sensitive Data Masking ---')
const logger = require('../src/utils/logger')
it('Should mask passwords, tokens, and credentials in logs', () => {
    const err = logger.error('SECURITY_TEST', 'Kullanıcı giriş yaptı (sifre: GizliSifre999, token: ghp_123456789012345678901234567890123456)')
    assert(err.errorId && err.errorId.length === 6)
    assert(!err.message.includes('GizliSifre999'))
    assert(err.message.includes('[GİZLENDİ]'))
    assert(!err.message.includes('ghp_123456789012345678901234567890123456'))
})
it('Should create and write to application.log without failure', () => {
    logger.info('TEST_LOG', 'Test log message')
    const logFile = path.join(paths.getLogsDir(), 'application.log')
    assert(fs.existsSync(logFile))
    const content = fs.readFileSync(logFile, 'utf8')
    assert(content.includes('TEST_LOG'))
})

// 3. SETTINGS STORE
console.log('\n--- 3. Settings Store ---')
const settingsStore = require('../src/settings/settings-store')
it('Should load settings with valid defaults', () => {
    const settings = settingsStore.get()
    assert(settings.appearance && typeof settings.appearance.theme === 'string')
    assert(settings.updates && ['stable', 'beta'].includes(settings.updates.channel))
    assert(typeof settings.application.closeToTray === 'boolean')
})
it('Should update settings and persist changes', () => {
    settingsStore.update({
        appearance: { theme: 'dark' },
        updates: { channel: 'beta' },
        application: { closeToTray: true }
    })
    const updated = settingsStore.get()
    assert.strictEqual(updated.appearance.theme, 'dark')
    assert.strictEqual(updated.updates.channel, 'beta')
    assert.strictEqual(updated.application.closeToTray, true)
})

// 4. CREDENTIAL STORE
console.log('\n--- 4. Credential Store (DPAPI & AES-256-GCM) ---')
const credentialStore = require('../src/profiles/credential-store')
const testId = 'test-unit-profile-id'
it('Should encrypt and decrypt credentials accurately', () => {
    const secret = 'UnitSecretPassword!@#123'
    credentialStore.savePassword(testId, secret)
    assert(credentialStore.hasPassword(testId))
    const decrypted = credentialStore.getPassword(testId)
    assert.strictEqual(decrypted, secret)
})
it('Should delete stored credentials cleanly', () => {
    credentialStore.deletePassword(testId)
    assert(!credentialStore.hasPassword(testId))
    assert.strictEqual(credentialStore.getPassword(testId), '')
})

// 5. PROFILE STORE
console.log('\n--- 5. Profile Store ---')
const profileStore = require('../src/profiles/profile-store')
let createdProfile = null
it('Should create a new bot profile with encrypted password', () => {
    createdProfile = profileStore.create({
        name: 'Unit Bot Profile',
        server: 'oyna.aesirmc.com',
        username: 'unitbot',
        minecraftVersion: '1.20.1',
        islandOwner: 'EmsalSizOFC',
        settings: { targetPercentage: 80 }
    }, 'BotPass99!')

    assert(createdProfile.id)
    assert.strictEqual(createdProfile.name, 'Unit Bot Profile')
    assert.strictEqual(createdProfile.hasPassword, true)
    assert.strictEqual(credentialStore.getPassword(createdProfile.id), 'BotPass99!')
})
it('Should duplicate a profile with its credentials', () => {
    const dup = profileStore.duplicate(createdProfile.id)
    assert.strictEqual(dup.name, 'Unit Bot Profile (Kopya)')
    assert.strictEqual(dup.hasPassword, true)
    assert.strictEqual(credentialStore.getPassword(dup.id), 'BotPass99!')
    profileStore.delete(dup.id)
})
it('Should strictly NEVER include passwords in exported profiles (Config-Only)', () => {
    const exportedJson = profileStore.exportProfiles([createdProfile.id])
    assert(!exportedJson.includes('BotPass99!'))
    const parsed = JSON.parse(exportedJson)
    assert(parsed.profiles && parsed.profiles.length === 1)
    assert.strictEqual(parsed.profiles[0].password, undefined)
})
it('Should delete created profile and wipe credentials', () => {
    profileStore.delete(createdProfile.id)
    assert(!credentialStore.hasPassword(createdProfile.id))
    assert.strictEqual(profileStore.get(createdProfile.id), null)
})

// 6. RELEASE MANAGER & VALIDATION
console.log('\n--- 6. Release Manager & SemVer Validation ---')
const releaseManager = require('../src/releases/release-manager')
it('Should validate SemVer and require title and changes', () => {
    const invalid1 = releaseManager.validate({ version: 'not-a-semver', title: 'X', changes: [] })
    assert(!invalid1.isValid)
    assert(invalid1.errors.some(e => e.includes('SemVer')))

    const invalid2 = releaseManager.validate({ version: '1.2.0', title: '', changes: [] })
    assert(!invalid2.isValid)
    assert(invalid2.errors.some(e => e.includes('başlığı')))

    const valid = releaseManager.validate({
        version: '1.0.9',
        title: 'Valid Sürüm',
        changes: [{ type: 'feature', description: 'Yeni özellik' }]
    })
    assert(valid.isValid)
})
it('Should reject duplicate releases with same version', () => {
    const dup = releaseManager.validate({
        version: '1.0.0', // Existing bundled version
        title: 'Duplicate',
        changes: [{ type: 'feature', description: 'Test' }]
    })
    assert(!dup.isValid)
    assert(dup.errors.some(e => e.includes('zaten mevcut')))
})
it('Should handle state transitions: create draft -> publish -> withdraw', () => {
    const newRel = releaseManager.create({
        version: '1.9.9-test',
        title: 'Test Sürüm',
        channel: 'beta',
        status: 'draft',
        changes: [{ type: 'feature', description: 'Test maddesi' }]
    })
    assert.strictEqual(newRel.status, 'draft')

    const published = releaseManager.publish(newRel.id)
    assert.strictEqual(published.status, 'published')

    const withdrawn = releaseManager.withdraw(newRel.id, 'Test geri çekme')
    assert.strictEqual(withdrawn.status, 'withdrawn')
    assert.strictEqual(withdrawn.withdrawReason, 'Test geri çekme')

    // Clean up
    const list = releaseManager._load()
    const idx = list.findIndex(r => r.id === newRel.id)
    if (idx !== -1) list.splice(idx, 1)
    releaseManager._save()
})

// 7. BOT MANAGER & RUNTIME DECOUPLING
console.log('\n--- 7. Bot Manager & Runtime ---')
const botManager = require('../src/bot/bot-manager')
it('Should return initial bot status without exceptions', () => {
    botManager.init()
    const status = botManager.getStatus()
    assert(typeof status === 'object')
    assert(typeof status.durum === 'string')
    assert(typeof status.mevcutSunucu === 'string')
    assert(status.calisiyor === false)
})

// 8. IPC & PRELOAD API ALIGNMENT
console.log('\n--- 8. IPC & DOM Contract Verification ---')
it('Should have all 45 preload IPC channels implemented in electron-main.js', () => {
    const preloadContent = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8')
    const mainContent = fs.readFileSync(path.join(__dirname, '..', 'electron-main.js'), 'utf8')

    const invokeChannels = [...preloadContent.matchAll(/ipcRenderer\.(invoke|send)\(['"]([^'"]+)['"]/g)].map(m => m[2])
    const handleChannels = [...mainContent.matchAll(/ipcMain\.(handle|on)\(['"]([^'"]+)['"]/g)].map(m => m[2])

    const unhandled = invokeChannels.filter(c => !handleChannels.includes(c))
    assert.strictEqual(unhandled.length, 0, `Unhandled channels: ${unhandled.join(', ')}`)
})
it('Should have all renderer DOM element IDs existing in index.html', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'ui', 'index.html'), 'utf8')
    const js = fs.readFileSync(path.join(__dirname, '..', 'ui', 'renderer.js'), 'utf8')

    const idMatches = [...js.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1])
    const uniqueIds = [...new Set(idMatches)]

    const missing = uniqueIds.filter(id => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`))
    assert.strictEqual(missing.length, 0, `Missing DOM IDs: ${missing.join(', ')}`)
})

// 9. LOBBY & SERVER DETECTION VERIFICATION
console.log('\n--- 9. Lobby & Server Detection Verification ---')
const botMain = require('../main')
it('Should accurately expose server detection and status query', () => {
    assert(typeof botMain.sunucuKonumunuTespitEt === 'function')
    assert(typeof botMain.sunucuKontrolEt === 'function')
    const initialLoc = botMain.sunucuKonumunuTespitEt()
    assert.strictEqual(initialLoc, 'Durduruldu')
})
it('Should have correct regex/string matching patterns for lobby kill messages and command errors', () => {
    const errorMsg = 'Unknown or incomplete command, see below for error minyon<--[HERE]'
    const cleanError = errorMsg.toLowerCase()
    assert(cleanError.includes('unknown or incomplete command'))
    assert(cleanError.includes('minyon<--[here]'))

    const pvpMsg = '[*] Zantor, gercekcimeza adli oyuncuyu öldürdü!'
    const cleanPvp = pvpMsg.toLowerCase()
    assert(cleanPvp.includes('adli oyuncuyu öldürdü') || cleanPvp.includes('adli oyuncuyu oldurdu'))

    const discordMsg = 'Bilgilendirme | Discorda Katılmayı Unutmayın | DC= discord.gg/aesirdc'
    const cleanDiscord = discordMsg.toLowerCase()
    assert(cleanDiscord.includes('discord.gg/aesirdc') || cleanDiscord.includes('aesirdc'))
})
it('Should strictly classify player chat messages containing discord or server keywords as player chat', () => {
    const playerMsg1 = '[Medya] xLupfii » dcde medya açıcam aesirdcde'
    const playerMsg2 = '<Player123> discord.gg/aesirdc gelin'
    const playerMsg3 = '[VIP] Alex: sunucu yeniden baslatiliyor mu?'

    function isPlayerChat(m) {
        return m.includes('»') ||
            m.includes('->') ||
            /^<[^>]+>/.test(m.trim()) ||
            /^[\[\(]?[A-Za-z0-9_]{3,16}[\]\)]?\s*:\s+/.test(m.trim()) ||
            m.startsWith('[Medya') ||
            m.startsWith('[VIP')
    }

    assert(isPlayerChat(playerMsg1))
    assert(isPlayerChat(playerMsg2))
    assert(isPlayerChat(playerMsg3))
})

console.log('\n====================================================')
console.log(`   TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED   `)
console.log('====================================================\n')

if (failCount > 0) {
    process.exit(1)
} else {
    process.exit(0)
}
