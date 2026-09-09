const fs = require('fs')
const path = require('path')
const paths = require('../utils/paths')

// Minecraft eşya ID'lerini Türkçe isim, kategori ve simge ile eşleyen sözlük
const ESYA_SOZLUK = {
    'honey_bottle': { isim: 'Bal Şişesi', kategori: 'Kovan', ikon: '🍯', renk: '#f59e0b' },
    'honeycomb': { isim: 'Bal Peteği', kategori: 'Kovan', ikon: '🐝', renk: '#fbbf24' },
    'diamond': { isim: 'Elmas', kategori: 'Maden', ikon: '💎', renk: '#38bdf8' },
    'diamond_block': { isim: 'Elmas Bloğu', kategori: 'Maden', ikon: '🔷', renk: '#0ea5e9' },
    'iron_ingot': { isim: 'Demir Külçesi', kategori: 'Maden', ikon: '⛓️', renk: '#cbd5e1' },
    'iron_block': { isim: 'Demir Bloğu', kategori: 'Maden', ikon: '🛡️', renk: '#94a3b8' },
    'gold_ingot': { isim: 'Altın Külçesi', kategori: 'Maden', ikon: '🪙', renk: '#eab308' },
    'gold_block': { isim: 'Altın Bloğu', kategori: 'Maden', ikon: '👑', renk: '#ca8a04' },
    'emerald': { isim: 'Zümrüt', kategori: 'Maden', ikon: '🟢', renk: '#10b981' },
    'emerald_block': { isim: 'Zümrüt Bloğu', kategori: 'Maden', ikon: '🟩', renk: '#059669' },
    'coal': { isim: 'Kömür', kategori: 'Maden', ikon: '⚫', renk: '#475569' },
    'lapis_lazuli': { isim: 'Lapis Lazuli', kategori: 'Maden', ikon: '🔷', renk: '#2563eb' },
    'redstone': { isim: 'Kızıltaş', kategori: 'Maden', ikon: '🔴', renk: '#ef4444' },
    'cobblestone': { isim: 'Kırıktaş', kategori: 'Maden', ikon: '🪨', renk: '#64748b' },
    'stone': { isim: 'Taş', kategori: 'Maden', ikon: '🧱', renk: '#94a3b8' },
    'obsidian': { isim: 'Obsidyen', kategori: 'Maden', ikon: '🟣', renk: '#7c3aed' },
    'ancient_debris': { isim: 'Antik Kalıntı', kategori: 'Maden', ikon: '🟫', renk: '#78350f' },
    'netherite_scrap': { isim: 'Netherite Parçası', kategori: 'Maden', ikon: '🔩', renk: '#451a03' },
    'oak_log': { isim: 'Meşe Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#b45309' },
    'birch_log': { isim: 'Huş Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#fde68a' },
    'spruce_log': { isim: 'Ladin Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#78350f' },
    'jungle_log': { isim: 'Orman Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#92400e' },
    'acacia_log': { isim: 'Akasya Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#ea580c' },
    'dark_oak_log': { isim: 'Koyu Meşe Kütüğü', kategori: 'Odun', ikon: '🪵', renk: '#451a03' },
    'wheat': { isim: 'Buğday', kategori: 'Tarım', ikon: '🌾', renk: '#eab308' },
    'hay_block': { isim: 'Saman Balyası', kategori: 'Tarım', ikon: '🌾', renk: '#ca8a04' },
    'carrot': { isim: 'Havuç', kategori: 'Tarım', ikon: '🥕', renk: '#f97316' },
    'potato': { isim: 'Patates', kategori: 'Tarım', ikon: '🥔', renk: '#d97706' },
    'baked_potato': { isim: 'Pişmiş Patates', kategori: 'Tarım', ikon: '🥔', renk: '#b45309' },
    'melon_slice': { isim: 'Karpuz Dilimi', kategori: 'Tarım', ikon: '🍉', renk: '#ec4899' },
    'pumpkin': { isim: 'Balkabağı', kategori: 'Tarım', ikon: '🎃', renk: '#f97316' },
    'sugar_cane': { isim: 'Şeker Kamışı', kategori: 'Tarım', ikon: '🎋', renk: '#84cc16' },
    'cactus': { isim: 'Kaktüs', kategori: 'Tarım', ikon: '🌵', renk: '#16a34a' },
    'nether_wart': { isim: 'Nether Yumrusu', kategori: 'Tarım', ikon: '🍄', renk: '#991b1b' },
    'bone': { isim: 'Kemik', kategori: 'Canavar', ikon: '🦴', renk: '#f1f5f9' },
    'rotten_flesh': { isim: 'Çürük Et', kategori: 'Canavar', ikon: '🥩', renk: '#854d0e' },
    'string': { isim: 'İp', kategori: 'Canavar', ikon: '🕸️', renk: '#cbd5e1' },
    'spider_eye': { isim: 'Örümcek Gözü', kategori: 'Canavar', ikon: '👁️', renk: '#7f1d1d' },
    'gunpowder': { isim: 'Barut', kategori: 'Canavar', ikon: '🧨', renk: '#475569' },
    'ender_pearl': { isim: 'Ender İncisi', kategori: 'Canavar', ikon: '🔮', renk: '#0d9488' },
    'blaze_rod': { isim: 'Blaze Çubuğu', kategori: 'Canavar', ikon: '🔥', renk: '#ea580c' },
    'slime_ball': { isim: 'Balçık Topu', kategori: 'Canavar', ikon: '🟢', renk: '#22c55e' },
    'magma_cream': { isim: 'Magma Kremi', kategori: 'Canavar', ikon: '🟠', renk: '#c2410c' },
    'clay_ball': { isim: 'Kil Topu', kategori: 'Toprak', ikon: '🧱', renk: '#94a3b8' },
    'gravel': { isim: 'Çakıl', kategori: 'Toprak', ikon: '🪨', renk: '#64748b' },
    'sand': { isim: 'Kum', kategori: 'Toprak', ikon: '⏳', renk: '#fde047' }
}

class HarvestTracker {
    constructor() {
        this.jsonPath = null
        this.kaydetmeTimer = null
        this.oturumBaslangic = Date.now()
        this.data = {
            toplamHasatAdet: 0,
            oturumHasatAdet: 0,
            toplamBosaltmaSayisi: 0,
            tasmaKorumasiSayisi: 0,
            sonHasatZamani: null,
            esyalar: {},
            hasatGecmisi: []
        }

        this.init()
    }

    init() {
        try {
            this.jsonPath = paths.getHasatAnalitigiJsonPath()
            this.yukle()
        } catch (e) {
            console.error('[ANALİTİK] Hasat takipçisi başlatılırken hata:', e.message)
        }
    }

    yukle() {
        if (!this.jsonPath || !fs.existsSync(this.jsonPath)) return

        try {
            const raw = fs.readFileSync(this.jsonPath, 'utf8')
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') {
                this.data.toplamHasatAdet = parsed.toplamHasatAdet || 0
                this.data.toplamBosaltmaSayisi = parsed.toplamBosaltmaSayisi || 0
                this.data.tasmaKorumasiSayisi = parsed.tasmaKorumasiSayisi || 0
                this.data.sonHasatZamani = parsed.sonHasatZamani || null
                this.data.esyalar = parsed.esyalar || {}
                this.data.hasatGecmisi = Array.isArray(parsed.hasatGecmisi) ? parsed.hasatGecmisi.slice(0, 30) : []

                // Oturum sayılarını sıfırla (yeni başlatma oturumu)
                for (const key of Object.keys(this.data.esyalar)) {
                    this.data.esyalar[key].oturumAdet = 0
                }
                this.data.oturumHasatAdet = 0
                this.oturumBaslangic = Date.now()
            }
        } catch (e) {
            console.error('[ANALİTİK] JSON yüklenirken hata:', e.message)
        }
    }

    kaydetDebounced() {
        if (this.kaydetmeTimer) clearTimeout(this.kaydetmeTimer)
        this.kaydetmeTimer = setTimeout(() => {
            try {
                if (!this.jsonPath) this.jsonPath = paths.getHasatAnalitigiJsonPath()
                const dir = path.dirname(this.jsonPath)
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                fs.writeFileSync(this.jsonPath, JSON.stringify(this.data, null, 2), 'utf8')
            } catch (e) {
                console.error('[ANALİTİK] Dosyaya kaydetme hatası:', e.message)
            }
        }, 800)
    }

    esyaMetaAl(esyaId, hamIsim) {
        const idLower = String(esyaId || '').toLowerCase().replace(/[^a-z0-9_]/g, '')
        if (ESYA_SOZLUK[idLower]) {
            return {
                id: idLower,
                isim: ESYA_SOZLUK[idLower].isim,
                kategori: ESYA_SOZLUK[idLower].kategori,
                ikon: ESYA_SOZLUK[idLower].ikon,
                renk: ESYA_SOZLUK[idLower].renk
            }
        }

        // Bilinmeyen eşyalar için akıllı adlandırma
        let temizIsim = hamIsim || esyaId
        if (typeof temizIsim === 'string') {
            temizIsim = temizIsim.replace(/[§&][0-9a-fk-or]/gi, '')
                .replace(/_/g, ' ')
                .split(' ')
                .map(k => k.charAt(0).toUpperCase() + k.slice(1).toLowerCase())
                .join(' ')
        }

        let kategori = 'Diğer'
        let ikon = '📦'
        let renk = '#94a3b8'

        if (idLower.includes('honey') || idLower.includes('bal')) {
            kategori = 'Kovan'; ikon = '🍯'; renk = '#f59e0b';
        } else if (idLower.includes('log') || idLower.includes('wood') || idLower.includes('odun')) {
            kategori = 'Odun'; ikon = '🪵'; renk = '#b45309';
        } else if (idLower.includes('ore') || idLower.includes('ingot') || idLower.includes('diamond') || idLower.includes('iron') || idLower.includes('gold')) {
            kategori = 'Maden'; ikon = '⛏️'; renk = '#38bdf8';
        }

        return { id: idLower || 'esya', isim: temizIsim, kategori, ikon, renk }
    }

    // Hasat kaydı ekle (kovan, minyon veya sandığa aktarım)
    hasatEkle(esyaId, esyaGörünenAd, adet, kaynak = 'Bilinmiyor') {
        const sayi = Number(adet) || 1
        if (sayi <= 0) return

        const meta = this.esyaMetaAl(esyaId, esyaGörünenAd)
        const id = meta.id

        if (!this.data.esyalar[id]) {
            this.data.esyalar[id] = {
                id: id,
                name: id,
                isim: meta.isim,
                displayName: meta.isim,
                kategori: meta.kategori,
                ikon: meta.ikon,
                icon: meta.ikon,
                renk: meta.renk,
                toplamAdet: 0,
                oturumAdet: 0,
                sonHasat: null,
                sonHasatZamani: null
            }
        }

        const simdi = new Date()
        const saatMetni = simdi.toLocaleTimeString('tr-TR')

        this.data.esyalar[id].toplamAdet += sayi
        this.data.esyalar[id].oturumAdet += sayi
        this.data.esyalar[id].sonHasat = saatMetni
        this.data.esyalar[id].sonHasatZamani = saatMetni

        this.data.toplamHasatAdet += sayi
        this.data.oturumHasatAdet += sayi
        this.data.sonHasatZamani = saatMetni

        // Son hareketler akışına ekle (en fazla 30 kayıt)
        this.data.hasatGecmisi.unshift({
            id: Date.now() + Math.random().toString(36).substr(2, 4),
            zaman: saatMetni,
            esya: meta.isim,
            esyaId: id,
            adet: sayi,
            mesaj: `+${sayi} ${meta.isim}`,
            kaynak: kaynak,
            ikon: meta.ikon,
            icon: meta.ikon,
            renk: meta.renk
        })

        if (this.data.hasatGecmisi.length > 30) {
            this.data.hasatGecmisi.pop()
        }

        this.kaydetDebounced()
        return this.data.esyalar[id]
    }

    // Sandığa boşaltma seferi kaydet
    bosaltmaSeferiKaydet(aktarilanSayisi = 0) {
        this.data.toplamBosaltmaSayisi = (this.data.toplamBosaltmaSayisi || 0) + 1
        this.data.bosaltilanToplamEsya = (this.data.bosaltilanToplamEsya || 0) + aktarilanSayisi
        this.data.hasatGecmisi.unshift({
            id: Date.now() + Math.random().toString(36).substr(2, 4),
            tip: 'bosaltma',
            zaman: new Date().toLocaleTimeString('tr-TR'),
            mesaj: `${aktarilanSayisi > 0 ? aktarilanSayisi + ' adet eşya' : 'Çanta'} sandığa boşaltıldı`,
            kaynak: 'Sandık Aktarımı',
            icon: '📦',
            ikon: '📦'
        })
        if (this.data.hasatGecmisi.length > 30) {
            this.data.hasatGecmisi.pop()
        }
        this.kaydetDebounced()
    }

    // Taşma koruması tetiklenme sayacı
    tasmaKorumasiTetiklendi() {
        this.data.tasmaKorumasiSayisi++
        this.kaydetDebounced()
    }

    // Özet istatistikler ve veri göstergesi
    getAnalitik() {
        const esyaListesi = Object.values(this.data.esyalar).sort((a, b) => b.toplamAdet - a.toplamAdet)
        
        let enCokToplanan = null
        if (esyaListesi.length > 0) {
            enCokToplanan = {
                isim: esyaListesi[0].isim || esyaListesi[0].displayName,
                adet: esyaListesi[0].toplamAdet,
                ikon: esyaListesi[0].ikon || esyaListesi[0].icon
            }
        }

        // Kategori bazlı dağılım
        const kategoriDagilimi = {}
        for (const esya of esyaListesi) {
            const kat = esya.kategori || 'Diğer'
            kategoriDagilimi[kat] = (kategoriDagilimi[kat] || 0) + esya.toplamAdet
        }

        return {
            toplamHasatAdet: this.data.toplamHasatAdet,
            oturumHasatAdet: this.data.oturumHasatAdet,
            toplamBosaltmaSayisi: this.data.toplamBosaltmaSayisi,
            bosaltilanToplamEsya: this.data.bosaltilanToplamEsya || 0,
            tasmaKorumasiSayisi: this.data.tasmaKorumasiSayisi,
            sonHasatZamani: this.data.sonHasatZamani,
            oturumSuresiDakika: Math.round((Date.now() - this.oturumBaslangic) / 60000),
            enCokToplanan: enCokToplanan,
            kategoriDagilimi: kategoriDagilimi,
            esyalar: this.data.esyalar,
            esyaListesi: esyaListesi,
            hasatGecmisi: this.data.hasatGecmisi,

            // UI Kolaylığı için Ozet, Items, Feed eşleştirmesi
            ozet: {
                toplamAdet: this.data.toplamHasatAdet,
                oturumAdet: this.data.oturumHasatAdet,
                cesitSayisi: esyaListesi.length,
                bosaltmaSeferSayisi: this.data.toplamBosaltmaSayisi,
                bosaltilanToplamEsya: this.data.bosaltilanToplamEsya || 0,
                tasmaKorumasiSayisi: this.data.tasmaKorumasiSayisi,
                enCokEsya: enCokToplanan?.isim || '-',
                enCokAdet: enCokToplanan?.adet || 0,
                oturumBaslangic: new Date(this.oturumBaslangic).toLocaleTimeString('tr-TR')
            },
            items: this.data.esyalar,
            feed: this.data.hasatGecmisi
        }
    }

    // Analitik verilerini sıfırla
    sifirla(sadeceOturum = false) {
        if (sadeceOturum) {
            this.data.oturumHasatAdet = 0
            for (const key of Object.keys(this.data.esyalar)) {
                this.data.esyalar[key].oturumAdet = 0
            }
            this.oturumBaslangic = Date.now()
        } else {
            this.data = {
                toplamHasatAdet: 0,
                oturumHasatAdet: 0,
                toplamBosaltmaSayisi: 0,
                bosaltilanToplamEsya: 0,
                tasmaKorumasiSayisi: 0,
                sonHasatZamani: null,
                esyalar: {},
                hasatGecmisi: []
            }
            this.oturumBaslangic = Date.now()
        }
        this.kaydetDebounced()
        return this.getAnalitik()
    }
}

const harvestTracker = new HarvestTracker()
module.exports = harvestTracker
