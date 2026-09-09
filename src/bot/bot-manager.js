const { EventEmitter } = require('events')
const botKontrol = require('../../main.js')
const profileStore = require('../profiles/profile-store')
const credentialStore = require('../profiles/credential-store')
const settingsStore = require('../settings/settings-store')
const logger = require('../utils/logger')

class BotManager extends EventEmitter {
    constructor() {
        super()
        this.activeProfileId = null
        this.runtime = {
            status: 'Durduruldu',
            startedAt: null,
            totalHarvested: 0,
            lastError: null
        }
        this._bindBotEvents()
    }

    init() {
        const settings = settingsStore.get()
        const profiles = profileStore.list()

        // Tercih edilen profil veya ilk profili aktif yap
        let targetId = settings.meta.activeProfileId
        if (!targetId || !profiles.find(p => p.id === targetId)) {
            if (profiles.length > 0) {
                targetId = profiles[0].id
                settingsStore.update({ meta: { activeProfileId: targetId } })
            }
        }

        if (targetId) {
            this.setActiveProfile(targetId)
        }
    }

    _bindBotEvents() {
        botKontrol.botEvents.on('log', (msg) => {
            logger.bot(msg)
            this.emit('log', msg)
        })

        botKontrol.botEvents.on('durum', (data) => {
            if (data && data.durum) {
                this.runtime.status = data.durum
                if (this.activeProfileId) {
                    profileStore.updateRuntimeMeta(this.activeProfileId, {
                        status: data.durum,
                        lastError: data.detay || null
                    })
                }
            }
            this.emit('durum', this.getStatus())
        })

        botKontrol.botEvents.on('minyonlar', (data) => this.emit('minyonlar', data))
        botKontrol.botEvents.on('kovanlar', (data) => this.emit('kovanlar', data))
        botKontrol.botEvents.on('envanter', (data) => this.emit('envanter', data))
        botKontrol.botEvents.on('sandikGuncellendi', (data) => this.emit('sandikGuncellendi', data))
        botKontrol.botEvents.on('oto-bal-guncelle', (data) => this.emit('oto-bal-guncelle', data))
        botKontrol.botEvents.on('ayarGuncellendi', (data) => this.emit('ayarGuncellendi', data))
        botKontrol.botEvents.on('sunucuGuncellendi', (data) => this.emit('sunucuGuncellendi', data))
    }

    getActiveProfile() {
        if (!this.activeProfileId) return null
        return profileStore.get(this.activeProfileId)
    }

    setActiveProfile(profileId) {
        const profile = profileStore.get(profileId)
        if (!profile) {
            throw new Error(`Profil bulunamadı: ${profileId}`)
        }

        this.activeProfileId = profileId
        settingsStore.update({ meta: { activeProfileId: profileId } })

        // Güvenli kasadan şifreyi çöz (yalnızca main process içinde tutulur)
        const password = credentialStore.getPassword(profileId)
        botKontrol.profilYukle(profile, password)

        profileStore.updateRuntimeMeta(profileId, {
            lastUsedAt: new Date().toISOString()
        })

        logger.info('BOT_MANAGER', `Aktif profil değiştirildi: "${profile.name}" [${profile.username}]`)
        this.emit('profileChanged', profile)
        return profile
    }

    async start() {
        if (!this.activeProfileId) {
            const profiles = profileStore.list()
            if (profiles.length === 0) {
                throw new Error('Lütfen önce bir bot profili oluşturun!')
            }
            this.setActiveProfile(profiles[0].id)
        }

        const profile = this.getActiveProfile()
        const password = credentialStore.getPassword(this.activeProfileId)

        // Bot motoruna ayarları ve şifreyi son haliyle enjekte et
        botKontrol.profilYukle(profile, password)

        logger.info('BOT_MANAGER', `Bot başlatılıyor: ${profile.username}@${profile.server}`)
        this.runtime.startedAt = Date.now()

        profileStore.updateRuntimeMeta(this.activeProfileId, {
            lastStartedAt: new Date().toISOString(),
            status: 'Bağlanıyor...'
        })

        return botKontrol.baslat()
    }

    async stop() {
        logger.info('BOT_MANAGER', 'Bot durduruluyor...')
        if (this.activeProfileId) {
            profileStore.updateRuntimeMeta(this.activeProfileId, {
                lastStoppedAt: new Date().toISOString(),
                status: 'Durduruldu'
            })
        }
        return botKontrol.durdur()
    }

    getStatus() {
        const botState = botKontrol.durumAl()
        const profile = this.getActiveProfile()

        return {
            ...botState,
            activeProfile: profile ? {
                id: profile.id,
                name: profile.name,
                username: profile.username,
                server: profile.server
            } : null
        }
    }

    // Bot Eylem Köprüleri (Mevcut mantık aynen korunur)
    tara() {
        return botKontrol.tara()
    }

    kovanTara() {
        return botKontrol.kovanTara()
    }

    kovanBalTest() {
        return botKontrol.kovanBalTest()
    }

    kovanBalTopla(hedefYuzde) {
        return botKontrol.kovanBalTopla(hedefYuzde)
    }

    tekilKovanHasat(kovanId) {
        return botKontrol.tekilKovanHasat(kovanId)
    }

    envanterAl() {
        return botKontrol.envanterAl()
    }

    envanterBosalt() {
        return typeof botKontrol.envanterBosalt === 'function'
            ? botKontrol.envanterBosalt()
            : { basarili: false, mesaj: 'Desteklenmiyor' }
    }

    tumunuTopla() {
        return botKontrol.topla()
    }

    tekilTopla(minyonIsmi) {
        return typeof botKontrol.tekilTopla === 'function'
            ? botKontrol.tekilTopla(minyonIsmi)
            : { basarili: false, mesaj: 'Desteklenmiyor' }
    }

    sandikAyarla() {
        const res = botKontrol.sandikAyarla()
        if (res && res.basarili && this.activeProfileId) {
            const profile = this.getActiveProfile()
            if (profile) {
                profileStore.update(this.activeProfileId, {
                    settings: { ...profile.settings, chestLocation: res.konum }
                })
            }
        }
        return res
    }

    testModuDegistir(yeniDurum) {
        const res = botKontrol.testModuDegistir(yeniDurum)
        if (this.activeProfileId) {
            const profile = this.getActiveProfile()
            if (profile) {
                profileStore.update(this.activeProfileId, {
                    settings: { ...profile.settings, testMode: Boolean(yeniDurum) }
                })
            }
        }
        return res
    }

    hedefYuzdeDegistir(yeniYuzde) {
        const res = botKontrol.hedefDolulukDegistir(yeniYuzde)
        if (this.activeProfileId) {
            const profile = this.getActiveProfile()
            if (profile) {
                profileStore.update(this.activeProfileId, {
                    settings: { ...profile.settings, targetPercentage: Number(yeniYuzde) }
                })
            }
        }
        return res
    }

    otoBalDurumAl() {
        return botKontrol.otoBalDurumAl ? botKontrol.otoBalDurumAl() : true
    }

    otoBalDegistir(durum) {
        const res = botKontrol.otoBalAyarla ? botKontrol.otoBalAyarla(durum) : { basarili: false }
        if (this.activeProfileId) {
            const profile = this.getActiveProfile()
            if (profile) {
                profileStore.update(this.activeProfileId, {
                    settings: { ...profile.settings, autoHoneyHarvest: Boolean(durum) }
                })
            }
        }
        return res
    }
}

module.exports = new BotManager()
