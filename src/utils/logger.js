const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const paths = require('./paths')

let shell = null
try {
    shell = require('electron').shell
} catch (e) { }

// Hassas verileri maskeleme fonksiyonu (şifreler, tokenlar vb.)
function maskSensitiveData(str) {
    if (!str || typeof str !== 'string') return str
    return str
        .replace(/(password|sifre|token|secret|key)["']?\s*[:=]\s*["']?([^"'\s,]+)/gi, '$1: [GİZLENDİ]')
        .replace(/\/login\s+([^\s]+)/gi, '/login [ŞİFRE GİZLENDİ]')
        .replace(/ghp_[A-Za-z0-9_]{36,}/gi, 'ghp_[TOKEN GİZLENDİ]')
        .replace(/github_pat_[A-Za-z0-9_]{50,}/gi, 'github_pat_[TOKEN GİZLENDİ]')
}

// 6 karakterlik güvenli Hata Kodu (Error ID) üretici: Örn: 8F3A21
function generateErrorId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase()
}

function getTimestamp() {
    return new Date().toISOString()
}

function appendToLog(fileName, line) {
    try {
        const logsDir = paths.getLogsDir()
        const filePath = path.join(logsDir, fileName)
        fs.appendFileSync(filePath, line + '\n', 'utf8')
    } catch (e) {
        // Log yazma hatası durumunda sessizce konsola bas
        console.error('[LOGGER HATA]', e.message)
    }
}

class Logger {
    info(moduleName, message) {
        const cleanMsg = maskSensitiveData(message)
        const line = `[${getTimestamp()}] [INFO] [${moduleName}] ${cleanMsg}`
        console.log(line)
        appendToLog('application.log', line)
    }

    warn(moduleName, message) {
        const cleanMsg = maskSensitiveData(message)
        const line = `[${getTimestamp()}] [WARN] [${moduleName}] ${cleanMsg}`
        console.warn(line)
        appendToLog('application.log', line)
    }

    error(moduleName, message, err = null) {
        const errorId = generateErrorId()
        const cleanMsg = maskSensitiveData(message)
        let errDetails = ''
        if (err) {
            errDetails = err.stack ? ` | Stack: ${maskSensitiveData(err.stack)}` : ` | Detay: ${maskSensitiveData(err.message || String(err))}`
        }
        const line = `[${getTimestamp()}] [ERROR] [${moduleName}] [ID:${errorId}] ${cleanMsg}${errDetails}`
        console.error(line)
        appendToLog('application.log', line)
        return { errorId, message: cleanMsg }
    }

    bot(message) {
        const cleanMsg = maskSensitiveData(message)
        const line = `[${getTimestamp()}] [BOT] ${cleanMsg}`
        appendToLog('bot.log', line)
    }

    updater(level, message, err = null) {
        const cleanMsg = maskSensitiveData(message)
        let extra = ''
        let errorId = null
        if (err) {
            errorId = generateErrorId()
            extra = ` [ID:${errorId}] - ${maskSensitiveData(err.message || String(err))}`
        }
        const line = `[${getTimestamp()}] [UPDATER] [${level.toUpperCase()}] ${cleanMsg}${extra}`
        console.log(line)
        appendToLog('updater.log', line)
        return errorId
    }

    openLogsFolder() {
        const logsDir = paths.getLogsDir()
        if (shell && typeof shell.openPath === 'function') {
            shell.openPath(logsDir)
            return true
        }
        return false
    }

    getLogsPath() {
        return paths.getLogsDir()
    }
}

module.exports = new Logger()
