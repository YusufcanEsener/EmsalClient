const path = require('path')
const fs = require('fs')

let electronApp = null
try {
    const electron = require('electron')
    electronApp = electron.app
} catch (e) {
    electronApp = null
}

function getUserDataDir() {
    if (electronApp && typeof electronApp.getPath === 'function') {
        return electronApp.getPath('userData')
    }
    // Fallback if running outside full Electron environment (e.g. CLI/tests)
    const fallbackDir = path.join(process.cwd(), 'data')
    if (!fs.existsSync(fallbackDir)) {
        try {
            fs.mkdirSync(fallbackDir, { recursive: true })
        } catch (e) { }
    }
    return fallbackDir
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        try {
            fs.mkdirSync(dirPath, { recursive: true })
        } catch (e) { }
    }
    return dirPath
}

const paths = {
    getUserDataDir,
    getProfilesPath: () => path.join(getUserDataDir(), 'profiles.json'),
    getCredentialsPath: () => path.join(getUserDataDir(), 'credentials.dat'),
    getSettingsPath: () => path.join(getUserDataDir(), 'settings.json'),
    getReleasesCachePath: () => path.join(getUserDataDir(), 'releases-cache.json'),
    getReleasesJsonPath: () => path.join(__dirname, '..', '..', 'releases.json'),
    getLogsDir: () => ensureDir(path.join(getUserDataDir(), 'logs')),
    getMinyonlarJsonPath: () => path.join(getUserDataDir(), 'minyonlar.json'),
    getKovanlarJsonPath: () => path.join(getUserDataDir(), 'kovanlar.json'),
    ensureDir
}

module.exports = paths
