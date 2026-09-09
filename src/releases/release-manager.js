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

        // 1. Önce varsa userData içindeki önbelleğe bak (en güncel sürüm listesi burada tutulur)
        if (fs.existsSync(this.cachePath)) {
            try {
                const raw = fs.readFileSync(this.cachePath, 'utf8')
                const parsed = JSON.parse(raw)
                if (parsed && Array.isArray(parsed.releases)) {
                    this.releases = parsed.releases
                    return this.releases
                }
            } catch (err) {
                logger.error('RELEASES', 'Önbellek sürüm dosyası okunamadı', err)
            }
        }

        // 2. Yoksa paket içindeki bundled releases.json'a bak
        if (fs.existsSync(this.bundledReleasesPath)) {
            try {
                const raw = fs.readFileSync(this.bundledReleasesPath, 'utf8')
                const parsed = JSON.parse(raw)
                if (parsed && Array.isArray(parsed.releases)) {
                    this.releases = parsed.releases
                    this._save()
                    return this.releases
                }
            } catch (err) {
                logger.error('RELEASES', 'Paket içi releases.json okunamadı', err)
            }
        }

        this.releases = []
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
            const exists = current.find(c => c.version === remote.version)
            if (!exists && semver.valid(remote.version)) {
                current.push({
                    id: `rel-${crypto.randomUUID().substring(0, 8)}`,
                    version: remote.version,
                    title: remote.title || `Sürüm ${remote.version}`,
                    releaseType: 'patch',
                    releaseDate: remote.releaseDate || new Date().toISOString().split('T')[0],
                    status: remote.status || 'published',
                    mandatory: Boolean(remote.mandatory),
                    channel: remote.channel || (remote.version.includes('-') ? 'beta' : 'stable'),
                    changes: remote.changes || [{ type: 'feature', description: 'Güncelleme yayınlandı' }],
                    githubReleaseUrl: remote.githubReleaseUrl || null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                added++
            }
        }
        if (added > 0) {
            this._save()
            logger.info('RELEASES', `${added} adet uzak sürüm listeye eklendi`)
        }
    }
}

module.exports = new ReleaseManager()
