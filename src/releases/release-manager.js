const fs = require('fs')
const crypto = require('crypto')
const semver = require('semver')
const paths = require('../utils/paths')
const logger = require('../utils/logger')

class ReleaseManager {
    constructor() {
        this.bundledReleasesPath = paths.getReleasesJsonPath()
        this.cachePath = paths.getReleasesCachePath()
        this.releases = null
    }

    _load() {
        if (this.releases) return this.releases

        let cachedReleases = []
        if (fs.existsSync(this.cachePath)) {
            try {
                const raw = fs.readFileSync(this.cachePath, 'utf8')
                const parsed = JSON.parse(raw)
                if (parsed && Array.isArray(parsed.releases)) {
                    cachedReleases = parsed.releases
                }
            } catch (err) {
                logger.error('RELEASES', 'Önbellek sürüm dosyası okunamadı', err)
            }
        }

        let bundledReleases = []
        if (fs.existsSync(this.bundledReleasesPath)) {
            try {
                const raw = fs.readFileSync(this.bundledReleasesPath, 'utf8')
                const parsed = JSON.parse(raw)
                if (parsed && Array.isArray(parsed.releases)) {
                    bundledReleases = parsed.releases
                }
            } catch (err) {
                logger.error('RELEASES', 'Paket içi releases.json okunamadı', err)
            }
        }

        // Paket içindeki ve önbellekteki sürümleri birleştir
        const map = new Map()
        for (const r of bundledReleases) {
            if (r && r.version) map.set(r.version, r)
        }
        for (const r of cachedReleases) {
            if (r && r.version) {
                if (map.has(r.version)) {
                    const bundled = map.get(r.version)
                    map.set(r.version, {
                        ...bundled,
                        ...r,
                        changes: (bundled.changes && bundled.changes.length > 0) ? bundled.changes : (r.changes || [])
                    })
                } else {
                    map.set(r.version, r)
                }
            }
        }

        this.releases = Array.from(map.values())
            .sort((a, b) => semver.rcompare(a.version, b.version))

        this._save()
        return this.releases
    }

    _save() {
        try {
            paths.ensureDir(paths.getUserDataDir())
            fs.writeFileSync(this.cachePath, JSON.stringify({ releases: this.releases || [] }, null, 2), 'utf8')
        } catch (err) {
            logger.error('RELEASES', 'Sürümler önbelleğe kaydedilemedi', err)
        }
    }

    getAll(channel = null) {
        const all = this._load()
        if (!channel) return all
        if (channel === 'stable') {
            return all.filter(r => r.channel === 'stable')
        }
        return all
    }

    getById(id) {
        return this._load().find(r => r.id === id) || null
    }

    getByVersion(version) {
        return this._load().find(r => r.version === version) || null
    }

    getLatest(channel = 'stable') {
        const list = this.getAll(channel)
            .filter(r => r.status === 'published')
            .sort((a, b) => semver.rcompare(a.version, b.version))

        return list.length > 0 ? list[0] : null
    }

    validate(releaseData, existingId = null) {
        const errors = []

        // 1. Sürüm kontrolü
        if (!releaseData.version || !semver.valid(releaseData.version)) {
            errors.push('Geçersiz SemVer sürüm formatı (Örn: 1.0.1 veya 1.1.0-beta.1)')
        } else {
            // Sürüm çakışması kontrolü
            const duplicate = this._load().find(r => r.version === releaseData.version && r.id !== existingId)
            if (duplicate) {
                errors.push(`"${releaseData.version}" sürümü zaten mevcut!`)
            }
        }

        // 2. Başlık kontrolü
        if (!releaseData.title || releaseData.title.trim().length === 0) {
            errors.push('Sürüm başlığı boş bırakılamaz.')
        }

        // 3. Değişiklikler kontrolü
        if (!Array.isArray(releaseData.changes) || releaseData.changes.length === 0) {
            errors.push('En az bir değişiklik maddesi eklenmelidir.')
        } else {
            for (let i = 0; i < releaseData.changes.length; i++) {
                const c = releaseData.changes[i]
                if (!c.description || c.description.trim().length === 0) {
                    errors.push(`${i + 1}. değişiklik açıklaması boş olamaz.`)
                }
            }
        }

        // 4. Kanal kontrolü
        const validChannels = ['stable', 'beta']
        if (releaseData.channel && !validChannels.includes(releaseData.channel)) {
            errors.push('Kanal sadece "stable" veya "beta" olabilir.')
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    create(data) {
        const validation = this.validate(data)
        if (!validation.isValid) {
            throw new Error(`Sürüm doğrulama başarısız: ${validation.errors.join(', ')}`)
        }

        const id = `rel-${crypto.randomUUID().substring(0, 8)}`
        const now = new Date().toISOString()

        const newRelease = {
            id,
            version: semver.clean(data.version) || data.version,
            title: data.title.trim(),
            releaseType: data.releaseType || 'patch',
            releaseDate: data.releaseDate || now.split('T')[0],
            status: data.status || 'draft', // 'draft' | 'published' | 'withdrawn' | 'deprecated'
            mandatory: Boolean(data.mandatory),
            channel: data.channel || 'stable',
            changes: data.changes.map(c => ({
                type: c.type || 'improvement',
                description: c.description.trim()
            })),
            withdrawReason: null,
            githubReleaseId: data.githubReleaseId || null,
            githubReleaseUrl: data.githubReleaseUrl || null,
            createdAt: now,
            updatedAt: now
        }

        this._load().unshift(newRelease)
        this._save()
        logger.info('RELEASES', `Yeni sürüm kaydı oluşturuldu: ${newRelease.version} (${newRelease.status})`)
        return newRelease
    }

    update(id, data) {
        const validation = this.validate(data, id)
        if (!validation.isValid) {
            throw new Error(`Sürüm güncelleme hatası: ${validation.errors.join(', ')}`)
        }

        const list = this._load()
        const index = list.findIndex(r => r.id === id)
        if (index === -1) throw new Error(`Sürüm bulunamadı: ${id}`)

        const existing = list[index]
        const updated = {
            ...existing,
            version: semver.clean(data.version) || data.version,
            title: data.title !== undefined ? data.title.trim() : existing.title,
            releaseType: data.releaseType || existing.releaseType,
            status: data.status || existing.status,
            mandatory: data.mandatory !== undefined ? Boolean(data.mandatory) : existing.mandatory,
            channel: data.channel || existing.channel,
            changes: data.changes || existing.changes,
            updatedAt: new Date().toISOString()
        }

        list[index] = updated
        this._save()
        logger.info('RELEASES', `Sürüm kaydı güncellendi: ${updated.version}`)
        return updated
    }

    publish(id) {
        const release = this.getById(id)
        if (!release) throw new Error(`Sürüm bulunamadı: ${id}`)

        if (release.status === 'withdrawn') {
            throw new Error('Geri çekilmiş bir sürüm doğrudan yayınlanamaz, yeni bir sürüm oluşturun.')
        }

        release.status = 'published'
        release.updatedAt = new Date().toISOString()
        this._save()
        logger.info('RELEASES', `Sürüm yayınlandı: v${release.version}`)
        return release
    }

    withdraw(id, reason = 'Kritik hata tespit edildi') {
        const release = this.getById(id)
        if (!release) throw new Error(`Sürüm bulunamadı: ${id}`)

        release.status = 'withdrawn'
        release.withdrawReason = reason
        release.updatedAt = new Date().toISOString()
        this._save()
        logger.warn('RELEASES', `Sürüm GERİ ÇEKİLDİ: v${release.version} - Neden: ${reason}`)
        return release
    }

    deleteDraft(id) {
        const list = this._load()
        const index = list.findIndex(r => r.id === id)
        if (index === -1) return false

        if (list[index].status === 'published') {
            throw new Error('Yayınlanmış sürüm silinemez, gerekirse geri çekilebilir.')
        }

        const removed = list.splice(index, 1)[0]
        this._save()
        logger.info('RELEASES', `Taslak sürüm silindi: ${removed.version}`)
        return true
    }

    mergeRemoteReleases(remoteList) {
        if (!Array.isArray(remoteList)) return
        const current = this._load()
        let added = 0
        for (const remote of remoteList) {
            if (!remote || !remote.version) continue
            const exists = current.find(c => c.version === remote.version)
            if (!exists && semver.valid(remote.version)) {
                current.push({
                    id: remote.id || `rel-${crypto.randomUUID().substring(0, 8)}`,
                    version: semver.clean(remote.version) || remote.version,
                    title: remote.title || `Sürüm ${remote.version}`,
                    releaseType: remote.releaseType || 'patch',
                    releaseDate: remote.releaseDate || new Date().toISOString().split('T')[0],
                    status: remote.status || 'published',
                    mandatory: Boolean(remote.mandatory),
                    channel: remote.channel || (remote.version.includes('-') ? 'beta' : 'stable'),
                    changes: Array.isArray(remote.changes) ? remote.changes : [{ type: 'feature', description: 'Güncelleme yayınlandı' }],
                    githubReleaseUrl: remote.githubReleaseUrl || null,
                    createdAt: remote.createdAt || new Date().toISOString(),
                    updatedAt: remote.updatedAt || new Date().toISOString()
                })
                added++
            } else if (exists && Array.isArray(remote.changes) && remote.changes.length > (exists.changes?.length || 0)) {
                exists.title = remote.title || exists.title
                exists.changes = remote.changes
                added++
            }
        }
        if (added > 0) {
            this.releases.sort((a, b) => semver.rcompare(a.version, b.version))
            this._save()
            logger.info('RELEASES', `${added} adet uzak sürüm güncellendi/listeye eklendi`)
        }
    }

    async syncWithRemote() {
        const https = require('https')
        const fetchUrl = (url, headers = {}) => {
            return new Promise((resolve, reject) => {
                const req = https.get(url, { headers: { 'User-Agent': 'EmsalClient', ...headers } }, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return fetchUrl(res.headers.location, headers).then(resolve).catch(reject)
                    }
                    if (res.statusCode !== 200) {
                        return reject(new Error(`HTTP ${res.statusCode}`))
                    }
                    let body = ''
                    res.on('data', chunk => body += chunk)
                    res.on('end', () => resolve(body))
                })
                req.on('error', reject)
                req.setTimeout(8000, () => {
                    req.destroy()
                    reject(new Error('Zaman aşımı (timeout)'))
                })
            })
        }

        try {
            logger.info('RELEASES', 'Uzak sürüm kataloğu senkronize ediliyor...')
            // 1. Doğrudan raw repository releases.json'ı dene
            try {
                const rawJson = await fetchUrl('https://raw.githubusercontent.com/YusufcanEsener/EmsalClient/main/releases.json')
                const parsed = JSON.parse(rawJson)
                if (parsed && Array.isArray(parsed.releases)) {
                    this.mergeRemoteReleases(parsed.releases)
                }
            } catch (e1) {
                logger.warn('RELEASES', 'Raw releases.json alınamadı: ' + e1.message)
            }

            // 2. Fallback: GitHub Releases API
            const ghRaw = await fetchUrl('https://api.github.com/repos/YusufcanEsener/EmsalClient/releases')
            const ghReleases = JSON.parse(ghRaw)
            if (Array.isArray(ghReleases)) {
                const remoteList = ghReleases.map(r => {
                    const cleanVer = semver.clean(r.tag_name) || r.tag_name.replace(/^v/, '')
                    const changes = []
                    if (r.body) {
                        r.body.split('\n').forEach(line => {
                            const trimmed = line.trim().replace(/^[-*•]\s*/, '')
                            if (trimmed) changes.push({ type: 'improvement', description: trimmed })
                        })
                    }
                    return {
                        version: cleanVer,
                        title: r.name || `EmsalClient v${cleanVer}`,
                        releaseDate: r.published_at ? r.published_at.split('T')[0] : new Date().toISOString().split('T')[0],
                        status: 'published',
                        channel: r.prerelease ? 'beta' : 'stable',
                        changes: changes.length > 0 ? changes : [{ type: 'feature', description: 'GitHub sürümü yayınlandı' }],
                        githubReleaseUrl: r.html_url || null
                    }
                })
                this.mergeRemoteReleases(remoteList)
            }
        } catch (err) {
            logger.warn('RELEASES', 'Uzak sürüm senkronizasyonu başarısız: ' + err.message)
        }

        return this.getAll()
    }
}

module.exports = new ReleaseManager()
