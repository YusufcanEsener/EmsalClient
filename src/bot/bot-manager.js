const { EventEmitter } = require('events')
const botKontrol = require('../../main.js')
const profileStore = require('../profiles/profile-store')
const credentialStore = require('../profiles/credential-store')
const settingsStore = require('../settings/settings-store')
const logger = require('../utils/logger')

class BotManager extends EventEmitter {
    constructor() {
        super()
        this.selectedProfileId = null
        this.instances = new Map() // profileId -> BotInstance
    }

    get activeProfileId() {
        return this.selectedProfileId
    }

    set activeProfileId(val) {
        this.selectedProfileId = val
    }

    init() {
        const settings = settingsStore.get()
        const profiles = profileStore.list()

        let targetId = settings.meta?.activeProfileId
        if (!targetId || !profiles.find(p => p.id === targetId)) {
            if (profiles.length > 0) {
                targetId = profiles[0].id
                settingsStore.update({ meta: { activeProfileId: targetId } })
            }
        }

        if (targetId) {
            this.selectBot(targetId)
        }
    }

    getOrCreateInstance(profileId) {
        if (!profileId) {
            profileId = this.selectedProfileId
        }
        if (!profileId) {
            const profiles = profileStore.list()
            if (profiles.length === 0) {
                throw new Error('Lütfen önce bir bot profili oluşturun!')
            }
            profileId = profiles[0].id
            this.selectedProfileId = profileId
        }

        if (this.instances.has(profileId)) {
            return this.instances.get(profileId)
        }

        const profile = profileStore.get(profileId)
        if (!profile) {
            throw new Error(`Profil bulunamadı: ${profileId}`)
        }

        const password = credentialStore.getPassword(profileId)
        const instance = botKontrol.createBotInstance
            ? botKontrol.createBotInstance(profile, password)
            : botKontrol

        this.instances.set(profileId, instance)
        this._bindInstanceEvents(profileId, instance)
        return instance
    }

    _bindInstanceEvents(profileId, instance) {
        const getProfile = () => profileStore.get(profileId)

        instance.botEvents.on('log', (logData) => {
            const rawMsg = typeof logData === 'object' ? logData.message : logData
            logger.bot(rawMsg)
            this.emit('log', {
                profileId,
                profileName: getProfile()?.name || 'Bot',
                message: rawMsg,
                raw: logData
            })
        })

        instance.botEvents.on('durum', (durumData) => {
            if (durumData && durumData.durum) {
                try {
                    profileStore.updateRuntimeMeta(profileId, {
                        status: durumData.durum,
                        lastError: durumData.detay || null
                    })
                } catch (e) { }
            }
            const fullStatus = this.getStatus(profileId)
            this.emit('durum', {
                profileId,
                ...fullStatus
            })
            this.emit('botListChanged', this.listAll())
        })

        instance.botEvents.on('minyonlar', (data) => this.emit('minyonlar', { profileId, data }))
        instance.botEvents.on('kovanlar', (data) => this.emit('kovanlar', { profileId, data }))
        instance.botEvents.on('envanter', (data) => this.emit('envanter', { profileId, data }))
        instance.botEvents.on('sandikGuncellendi', (data) => this.emit('sandikGuncellendi', { profileId, data }))
        instance.botEvents.on('oto-bal-guncelle', (data) => this.emit('oto-bal-guncelle', { profileId, data }))
        instance.botEvents.on('ayarGuncellendi', (data) => this.emit('ayarGuncellendi', { profileId, data }))
        instance.botEvents.on('sunucuGuncellendi', (data) => this.emit('sunucuGuncellendi', { profileId, data }))
        instance.botEvents.on('hasatGuncellendi', (data) => this.emit('hasatGuncellendi', { profileId, data }))
        instance.botEvents.on('tasmaKorumasiTetiklendi', (data) => this.emit('tasmaKorumasiTetiklendi', { profileId, data }))
    }

    getActiveProfile() {
        if (!this.selectedProfileId) return null
        return profileStore.get(this.selectedProfileId)
    }

    setActiveProfile(profileId) {
        return this.selectBot(profileId)
    }

    selectBot(profileId) {
        const profile = profileStore.get(profileId)
        if (!profile) {
            throw new Error(`Profil bulunamadı: ${profileId}`)
        }

        this.selectedProfileId = profileId
        settingsStore.update({ meta: { activeProfileId: profileId } })

        profileStore.updateRuntimeMeta(profileId, {
            lastUsedAt: new Date().toISOString()
        })

        logger.info('BOT_MANAGER', `Seçili bot değiştirildi: "${profile.name}" [${profile.username}]`)
        this.emit('profileChanged', profile)
        this.emit('durum', { profileId, ...this.getStatus(profileId) })
        this.emit('botListChanged', this.listAll())
        return profile
    }

    async start(profileId = null) {
        const targetId = profileId || this.selectedProfileId
        const instance = this.getOrCreateInstance(targetId)
        const profile = profileStore.get(targetId)
        const password = credentialStore.getPassword(targetId)

        if (typeof instance.profilYukle === 'function') {
            instance.profilYukle(profile, password)
        }

        logger.info('BOT_MANAGER', `Bot başlatılıyor: ${profile.username}@${profile.server} (ID: ${targetId})`)
        profileStore.updateRuntimeMeta(targetId, {
            lastStartedAt: new Date().toISOString(),
            status: 'Bağlanıyor...'
        })

        const res = await instance.baslat()
        this.emit('botListChanged', this.listAll())
        return res
    }

    async stop(profileId = null) {
        const targetId = profileId || this.selectedProfileId
        logger.info('BOT_MANAGER', `Bot durduruluyor: (ID: ${targetId})`)

        if (this.instances.has(targetId)) {
            const instance = this.instances.get(targetId)
            profileStore.updateRuntimeMeta(targetId, {
                lastStoppedAt: new Date().toISOString(),
                status: 'Durduruldu'
            })
            const res = await instance.durdur()
            this.emit('botListChanged', this.listAll())
            return res
        }

        profileStore.updateRuntimeMeta(targetId, {
            status: 'Durduruldu'
        })
        this.emit('botListChanged', this.listAll())
        return { basarili: true, mesaj: 'Bot zaten durdurulmuş.' }
    }

    async startAll() {
        const profiles = profileStore.list()
        logger.info('BOT_MANAGER', `Tüm botlar başlatılıyor (Toplam: ${profiles.length})...`)
        const results = []

        for (let i = 0; i < profiles.length; i++) {
            const p = profiles[i]
            try {
                if (i > 0) {
                    // Sunucu anti-bot ve bağlantı hız limiti koruması (2.5 saniye aralık)
                    await new Promise(r => setTimeout(r, 2500))
                }
                const res = await this.start(p.id)
                results.push({ id: p.id, name: p.name, success: true, res })
            } catch (err) {
                logger.error('BOT_MANAGER', `Bot başlatılamadı (${p.name}): ${err.message}`)
                results.push({ id: p.id, name: p.name, success: false, error: err.message })
            }
        }

        this.emit('botListChanged', this.listAll())
        return results
    }

    async stopAll() {
        logger.info('BOT_MANAGER', 'Tüm botlar durduruluyor...')
        const results = []

        for (const [id, instance] of this.instances.entries()) {
            try {
                await instance.durdur()
                profileStore.updateRuntimeMeta(id, {
                    lastStoppedAt: new Date().toISOString(),
                    status: 'Durduruldu'
                })
                results.push({ id, success: true })
            } catch (err) {
                results.push({ id, success: false, error: err.message })
            }
        }

        this.emit('botListChanged', this.listAll())
        return results
    }

    getStatus(profileId = null) {
        const targetId = profileId || this.selectedProfileId
        const profile = targetId ? profileStore.get(targetId) : null

        if (targetId && this.instances.has(targetId)) {
            const instance = this.instances.get(targetId)
            const botState = instance.durumAl()
            return {
                ...botState,
                profileId: targetId,
                activeProfile: profile ? {
                    id: profile.id,
                    name: profile.name,
                    username: profile.username,
                    server: profile.server
                } : null
            }
        }

        return {
            profileId: targetId,
            botAdi: profile ? profile.username : 'Bot',
            sunucu: profile ? profile.server : '',
            mevcutSunucu: 'Durduruldu',
            scoreboardBaslik: '',
            testModu: profile?.settings?.testMode ?? true,
            hedefYuzde: profile?.settings?.targetPercentage ?? 80,
            kontrolAraligi: profile?.settings?.checkInterval ?? 30,
            sandikKonumu: profile?.settings?.chestLocation || { x: 20, y: 65, z: 16 },
            minyonlar: {},
            kovanlar: {},
            envanter: { doluSlot: 0, toplamSlot: 36, toplamEsya: 0, esyalar: [], zirhlar: {}, sonGuncelleme: null },
            hasat: null,
            islemde: false,
            calisiyor: false,
            adada: false,
            durum: profile?.meta?.status || 'Durduruldu',
            activeProfile: profile ? {
                id: profile.id,
                name: profile.name,
                username: profile.username,
                server: profile.server
            } : null
        }
    }

    listAll() {
        const profiles = profileStore.list()
        return profiles.map(p => {
            const inst = this.instances.get(p.id)
            const st = inst ? inst.durumAl() : null
            return {
                id: p.id,
                name: p.name,
                username: p.username,
                server: p.server,
                status: st ? st.durum : (p.meta?.status || 'Durduruldu'),
                calisiyor: Boolean(st && st.calisiyor),
                adada: Boolean(st && st.adada),
                islemde: Boolean(st && st.islemde),
                isSelected: p.id === this.selectedProfileId,
                minyonCount: st?.minyonlar?._liste?.length || 0,
                kovanCount: st?.kovanlar?._liste?.length || 0,
                toplamEsya: st?.envanter?.toplamEsya || 0
            }
        })
    }

    getRunningCount() {
        let count = 0
        for (const inst of this.instances.values()) {
            const st = inst.durumAl()
            if (st && st.calisiyor) count++
        }
        return count
    }

    _getTargetInstance(profileId) {
        const targetId = profileId || this.selectedProfileId
        if (!targetId) throw new Error('Seçili bir bot bulunamadı.')
        return { targetId, instance: this.getOrCreateInstance(targetId) }
    }

    sunucuKontrolEt(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        if (typeof instance.sunucuKontrolEt === 'function') {
            instance.sunucuKontrolEt()
        }
        return this.getStatus(profileId)
    }

    tara(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.tara()
    }

    kovanTara(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.kovanTara()
    }

    kovanBalTest(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.kovanBalTest()
    }

    kovanBalTopla(hedefYuzde, profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.kovanBalTopla(hedefYuzde)
    }

    tekilKovanHasat(kovanId, profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.tekilKovanHasat(kovanId)
    }

    envanterAl(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.envanterAl()
    }

    envanterBosalt(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return typeof instance.envanterBosalt === 'function'
            ? instance.envanterBosalt()
            : { basarili: false, mesaj: 'Desteklenmiyor' }
    }

    tumunuTopla(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.topla()
    }

    tekilTopla(minyonIsmi, profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return typeof instance.tekilTopla === 'function'
            ? instance.tekilTopla(minyonIsmi)
            : { basarili: false, mesaj: 'Desteklenmiyor' }
    }

    sandikAyarla(profileId = null) {
        const { targetId, instance } = this._getTargetInstance(profileId)
        const res = instance.sandikAyarla()
        if (res && res.basarili && targetId) {
            const profile = profileStore.get(targetId)
            if (profile) {
                profileStore.update(targetId, {
                    settings: { ...profile.settings, chestLocation: res.konum }
                })
            }
        }
        return res
    }

    testModuDegistir(yeniDurum, profileId = null) {
        const { targetId, instance } = this._getTargetInstance(profileId)
        const res = instance.testModuDegistir(yeniDurum)
        if (targetId) {
            const profile = profileStore.get(targetId)
            if (profile) {
                profileStore.update(targetId, {
                    settings: { ...profile.settings, testMode: Boolean(yeniDurum) }
                })
            }
        }
        return res
    }

    hedefYuzdeDegistir(yeniYuzde, profileId = null) {
        const { targetId, instance } = this._getTargetInstance(profileId)
        const res = instance.hedefDolulukDegistir(yeniYuzde)
        if (targetId) {
            const profile = profileStore.get(targetId)
            if (profile) {
                profileStore.update(targetId, {
                    settings: { ...profile.settings, targetPercentage: Number(yeniYuzde) }
                })
            }
        }
        return res
    }

    otoBalDurumAl(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.otoBalDurumAl ? instance.otoBalDurumAl() : true
    }

    otoBalDegistir(durum, profileId = null) {
        const { targetId, instance } = this._getTargetInstance(profileId)
        const res = instance.otoBalAyarla ? instance.otoBalAyarla(durum) : { basarili: false }
        if (targetId) {
            const profile = profileStore.get(targetId)
            if (profile) {
                profileStore.update(targetId, {
                    settings: { ...profile.settings, autoHoneyHarvest: Boolean(durum) }
                })
            }
        }
        return res
    }

    hasatAnalitigiAl(profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.hasatAnalitigiAl ? instance.hasatAnalitigiAl() : null
    }

    hasatAnalitigiSifirla(sadeceOturum = true, profileId = null) {
        const { instance } = this._getTargetInstance(profileId)
        return instance.hasatAnalitigiSifirla ? instance.hasatAnalitigiSifirla(sadeceOturum) : null
    }
}

module.exports = new BotManager()
