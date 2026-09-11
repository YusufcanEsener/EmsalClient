const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const { Vec3 } = require('vec3')
const fs = require('fs')
const EventEmitter = require('events')

let appPaths = null
try {
    appPaths = require('./src/utils/paths')
} catch (e) {
    appPaths = null
}

let harvestTracker = null
try {
    harvestTracker = require('./src/analytics/harvest-tracker')
} catch (e) {
    harvestTracker = null
}

// Prismarine-windows shiftClick off-by-one düzeltmesi (Sandığın son slotunun da kullanılabilmesi için)
try {
    const pWindows = require('prismarine-windows')('1.20.1')
    if (pWindows && pWindows.Window && pWindows.Window.prototype.shiftClick) {
        const origShiftClick = pWindows.Window.prototype.shiftClick
        pWindows.Window.prototype.shiftClick = function (click) {
            const { item } = click
            if (!item) return
            if (this.type !== 'minecraft:inventory' && click.slot >= this.inventoryStart) {
                this.fillAndDump(item, 0, this.inventoryStart)
                return
            }
            return origShiftClick.call(this, click)
        }
    }
} catch (e) { }

const orijinalLog = console.log
const orijinalError = console.error


// ==========================================
// 1. SABİT TANIMLAR VE YARDIMCI METOTLAR
// ==========================================
const KORUNACAK_ESYALAR = [
    'pickaxe',        // Kazmalar
    'axe',            // Baltalar
    'shovel',         // Kürekler
    'sword',          // Kılıçlar
    'hoe',            // Çapalar
    'helmet',         // Kasklar
    'chestplate',     // Zırhlar
    'leggings',       // Pantolonlar
    'boots',          // Botlar
    'bread',          // Ekmek
    'steak',          // Biftek
    'cooked_beef',    // Pişmiş et
    'apple',          // Elma
    'golden_apple',   // Altın elma
    'shield',         // Kalkan
    'totem'           // Totem
]

// ==========================================
// 2. YARDIMCI BASİT FONKSİYONLAR
// ==========================================

// Belirtilen milisaniye kadar bekletir
function bekle(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// 2 - 4 saniye arasında rastgele / güvenli bekleme (Sunucu kick/lag önleyici)
function bekleRastgele(minMs = 2000, maxMs = 4000) {
    const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    return new Promise(resolve => setTimeout(resolve, ms))
}

// Özel küçük Unicode karakterleri (Small Caps: ᴀ, ʙ, ᴄ...) standart harflere dönüştürür
const KUCUK_HARF_HARITASI = {
    'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h',
    'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p',
    'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'x': 'x',
    'ʏ': 'y', 'ᴢ': 'z', '×': 'x'
}

function unicodeKarakterleriNormallestir(str) {
    if (!str) return ''
    return str.split('').map(char => KUCUK_HARF_HARITASI[char] || char).join('')
}

// Türkçe özel karakterleri standart harflere dönüştürür (ş->s, ı->i, ğ->g vb.)
function turkceKarakterleriDuzelt(str) {
    if (!str) return ''
    return str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/Ğ/g, 'g')
        .replace(/ğ/g, 'g')
        .replace(/Ü/g, 'u')
        .replace(/ü/g, 'u')
        .replace(/Ş/g, 's')
        .replace(/ş/g, 's')
        .replace(/Ö/g, 'o')
        .replace(/ö/g, 'o')
        .replace(/Ç/g, 'c')
        .replace(/ç/g, 'c')
        .toLowerCase()
}

// Minecraft renk kodlarını (§a, &e vb.) temizler, küçük Unicode harflerini ve Türkçe harfleri düzeltir
function metniTemizle(metin) {
    if (!metin) return ''
    // 1. Renk kodlarını temizle (§a, &e vb.)
    let temiz = metin.replace(/[§&][0-9a-fk-or]/gi, '')
    // 2. Unicode Small-Caps karakterleri standart Latin harflerine çevir
    temiz = unicodeKarakterleriNormallestir(temiz)
    // 3. Türkçe karakterleri standart harflere çevir
    temiz = turkceKarakterleriDuzelt(temiz)
    return temiz
}

// Minyon isminden sade API/kod anahtarı oluşturur (Örn: "Oduncu Minyon" -> "oduncuminyon")
function minyonSlugOlustur(metin) {
    if (!metin) return ''
    const duzgun = turkceKarakterleriDuzelt(metin).toLowerCase()
    return duzgun.replace(/[^a-z0-9]/g, '')
}

// Minyon isminden alt tireli anahtar oluşturur (Örn: "Oduncu Minyon" -> "oduncu_minyon")
function minyonAltTireSlug(metin) {
    if (!metin) return ''
    const duzgun = turkceKarakterleriDuzelt(metin).toLowerCase()
    return duzgun.trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

// Minecraft'ın JSON formatındaki renkli/bileşenli yazılarını temiz düz metne çevirir
function jsonToText(obj) {
    if (!obj) return ''
    if (typeof obj === 'string') {
        try {
            // Eğer JSON string ise (Örn: '{"text":"DEPO: "}') parse et
            obj = JSON.parse(obj)
        } catch (e) {
            return obj
        }
    }
    if (typeof obj !== 'object') return String(obj)

    let metin = obj.text || ''
    if (Array.isArray(obj.extra)) {
        for (const el of obj.extra) {
            metin += jsonToText(el)
        }
    }
    return metin
}

// Bir eşyadaki tüm yazıları (isim, lore, NBT) birleştirip temiz bir metin olarak döner
function esyaninMetinleriniAl(esya) {
    if (!esya) return ''
    const satirlar = []

    // 1. Eşya görünen adı
    if (esya.displayName) {
        satirlar.push(jsonToText(esya.displayName))
    }

    // 2. Eşya Lore satırları
    if (esya.customLore && Array.isArray(esya.customLore)) {
        for (const satir of esya.customLore) {
            satirlar.push(jsonToText(satir))
        }
    }

    // 3. NBT içindeki display.Lore verisi
    if (esya.nbt) {
        try {
            const display = esya.nbt.value?.display?.value
            if (display) {
                if (display.Name?.value) {
                    satirlar.push(jsonToText(display.Name.value))
                }
                const loreList = display.Lore?.value?.value
                if (Array.isArray(loreList)) {
                    for (const satir of loreList) {
                        satirlar.push(jsonToText(satir))
                    }
                }
            }
        } catch (e) { }
    }

    return metniTemizle(satirlar.join('\n'))
}

// Bir eşyadaki tüm yazıları orijinal harf ve Türkçe karakterleriyle (sadece renk kodları temizlenmiş) döner
function esyaninHamMetinleriniAl(esya) {
    if (!esya) return ''
    const satirlar = []

    // 1. Eşya görünen adı
    if (esya.displayName) {
        satirlar.push(jsonToText(esya.displayName))
    }

    // 2. Eşya Lore satırları
    if (esya.customLore && Array.isArray(esya.customLore)) {
        for (const satir of esya.customLore) {
            satirlar.push(jsonToText(satir))
        }
    }

    // 3. NBT içindeki display.Lore verisi
    if (esya.nbt) {
        try {
            const display = esya.nbt.value?.display?.value
            if (display) {
                if (display.Name?.value) {
                    satirlar.push(jsonToText(display.Name.value))
                }
                const loreList = display.Lore?.value?.value
                if (Array.isArray(loreList)) {
                    for (const satir of loreList) {
                        satirlar.push(jsonToText(satir))
                    }
                }
            }
        } catch (e) { }
    }

    // Sadece renk kodlarını temizle, harf durumunu ve Türkçe karakterleri koru
    return satirlar.join('\n').replace(/[§&][0-9a-fk-or]/gi, '')
}

// Oyuncunun anlık 36 slotluk ana envanterini ve zırhlarını döner

// ==========================================
// 2. ÇOKLU BOT ÖRNEK FABRİKASI (BOT INSTANCE FACTORY)
// ==========================================
function createBotInstance(initialProfile = null, initialPassword = null) {
    const profileId = initialProfile ? initialProfile.id : 'default'
    const botEvents = new EventEmitter()
    let tracker = harvestTracker ? (harvestTracker.getTracker ? harvestTracker.getTracker(profileId) : harvestTracker) : null
    let ardisikAtilmaSayisi = 0

    // Profil bazlı izole AYARLAR
    const AYARLAR = {
        SUNUCU_IP: initialProfile?.server || 'oyna.aesirmc.com',
        KULLANICI_ADI: initialProfile?.username || 'huggecool',
        SIFRE: initialPassword || '',
        ADA_SAHIBI: initialProfile?.islandOwner || 'EmsalSizOFC',

        SADECE_BILGI_MODU: initialProfile?.settings?.testMode !== undefined ? Boolean(initialProfile.settings.testMode) : true,
        SOHBET_MESAJLARINI_GOSTER: initialProfile?.settings?.showChatMessages !== undefined ? Boolean(initialProfile.settings.showChatMessages) : false,

        HEDEF_DOLULUK_YUZDESI: initialProfile?.settings?.targetPercentage ? Number(initialProfile.settings.targetPercentage) : 80,
        KONTROL_ARALIGI_SANIYE: initialProfile?.settings?.checkInterval ? Number(initialProfile.settings.checkInterval) : 30,

        OTO_BAL_TOPLAMA: initialProfile?.settings?.autoHoneyHarvest !== undefined ? Boolean(initialProfile.settings.autoHoneyHarvest) : true,

        JSON_DOSYASI_KAYDET: true,
        JSON_DOSYA_YOLU: appPaths ? appPaths.getMinyonlarJsonPath(profileId) : './minyonlar.json',
        KOVAN_JSON_DOSYA_YOLU: appPaths ? appPaths.getKovanlarJsonPath(profileId) : './kovanlar.json',
        KONSOLA_JSON_YAZDIR: false,

        SANDIK_KONUMU: initialProfile?.settings?.chestLocation || {
            x: 20,
            y: 65,
            z: 16
        },

        TASMA_KORUMASI: true,
        TASMA_BOS_SLOT_ESIK: 2
    }

    // Bot örnek loglayıcısı (Lexical shadowing)
    const console = {
        ...global.console,
        log: function (...args) {
            const logStr = args.join(' ')
            if (
                logStr.includes('⛁') ||
                logStr.includes('⚗') ||
                logStr.includes('❤ Can') ||
                logStr.includes('🔥 Yetenek') ||
                (logStr.includes('Can') && logStr.includes('Mana') && logStr.includes('AP'))
            ) {
                return
            }
            const botTag = `[${AYARLAR.KULLANICI_ADI || 'Bot'}]`
            orijinalLog.call(global.console, botTag, ...args)
            botEvents.emit('log', `${botTag} ${logStr}`)
        },
        error: function (...args) {
            const logStr = args.join(' ')
            const botTag = `[${AYARLAR.KULLANICI_ADI || 'Bot'}]`
            if (orijinalError) orijinalError.call(global.console, botTag, ...args)
            botEvents.emit('log', `${botTag} [HATA] ${logStr}`)
        }
    }

    // Bot Gövdesi ve Fonksiyonları
    function envanterBilgisiAl() {
    if (!bot || !bot.inventory || !bot.inventory.slots) {
        return {
            doluSlot: 0,
            toplamSlot: 36,
            toplamEsya: 0,
            esyalar: [],
            zirhlar: { kask: null, gogusluk: null, pantolon: null, bot: null, solEl: null },
            sonGuncelleme: null
        }
    }

    const esyalar = []
    let toplamEsya = 0

    // Slot 9 - 44: Minecraft ana çanta (27 slot) + hotbar (9 slot)
    for (let s = 9; s <= 44; s++) {
        const item = bot.inventory.slots[s]
        if (item) {
            toplamEsya += item.count
            esyalar.push({
                slot: s,
                relativeSlot: s - 9, // 0 - 35
                name: item.name,
                displayName: item.displayName || item.name,
                count: item.count,
                type: item.type
            })
        }
    }

    const zirhlar = {
        kask: bot.inventory.slots[5] ? { name: bot.inventory.slots[5].name, displayName: bot.inventory.slots[5].displayName, count: 1 } : null,
        gogusluk: bot.inventory.slots[6] ? { name: bot.inventory.slots[6].name, displayName: bot.inventory.slots[6].displayName, count: 1 } : null,
        pantolon: bot.inventory.slots[7] ? { name: bot.inventory.slots[7].name, displayName: bot.inventory.slots[7].displayName, count: 1 } : null,
        bot: bot.inventory.slots[8] ? { name: bot.inventory.slots[8].name, displayName: bot.inventory.slots[8].displayName, count: 1 } : null,
        solEl: bot.inventory.slots[45] ? { name: bot.inventory.slots[45].name, displayName: bot.inventory.slots[45].displayName, count: bot.inventory.slots[45].count } : null
    }

    return {
        doluSlot: esyalar.length,
        toplamSlot: 36,
        toplamEsya: toplamEsya,
        esyalar: esyalar,
        zirhlar: zirhlar,
        sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
    }
}

// Çanta dolu mu veya boş slot sayısı eşiğin altına indi mi kontrolü
function cantaDoluMu(minBosSlot = (AYARLAR.TASMA_BOS_SLOT_ESIK ?? 2)) {
    if (!bot || !bot.inventory || !bot.inventory.slots) return false
    let bosSlotSayisi = 0
    for (let s = 9; s <= 44; s++) {
        if (!bot.inventory.slots[s]) {
            bosSlotSayisi++
        }
    }
    return bosSlotSayisi <= minBosSlot
}

// Envanterdeki eşyaların anlık miktar haritası
function envanterEsyaSayilariAl() {
    if (!bot || !bot.inventory || !bot.inventory.slots) return {}
    const sayilar = {}
    for (let s = 9; s <= 44; s++) {
        const item = bot.inventory.slots[s]
        if (item) {
            if (!sayilar[item.name]) {
                sayilar[item.name] = {
                    name: item.name,
                    displayName: item.displayName || item.name,
                    count: 0
                }
            }
            sayilar[item.name].count += item.count
        }
    }
    return sayilar
}

// İki envanter haritası arasındaki artış farkını hesaplar
function envanterFarkiHesapla(onceki, simdiki) {
    const farklar = []
    if (!simdiki) return farklar
    for (const name of Object.keys(simdiki)) {
        const oncekiAdet = onceki && onceki[name] ? onceki[name].count : 0
        const simdikiAdet = simdiki[name].count
        if (simdikiAdet > oncekiAdet) {
            farklar.push({
                name: name,
                displayName: simdiki[name].displayName,
                count: simdikiAdet - oncekiAdet
            })
        }
    }
    return farklar
}

// Taşma Koruması: Çanta doluluğunu kontrol eder, gerekirse sandığa gidip ara boşaltma yapar
async function tasmaKorumasiKontrolVeBosalt(kaynak = 'İşlem') {
    if (!AYARLAR.TASMA_KORUMASI) return false
    if (!cantaDoluMu(AYARLAR.TASMA_BOS_SLOT_ESIK ?? 2)) return false

    console.log(`\n⚠️ [TAŞMA KORUMASI] ${kaynak} sırasında çanta dolmak üzere (kalan boş slot <= ${AYARLAR.TASMA_BOS_SLOT_ESIK ?? 2})!`)
    console.log(`📦 [TAŞMA KORUMASI] Eşyaların yere saçılmasını önlemek için acil sandık boşaltması başlatılıyor...`)

    try {
        botEvents.emit('tasmaKorumasiTetiklendi', {
            kaynak: kaynak,
            zaman: new Date().toLocaleTimeString('tr-TR')
        })
    } catch (e) { }

    const bosaltildi = await sandigaEsyalariKoy()
    if (bosaltildi) {
        console.log(`✅ [TAŞMA KORUMASI] Eşyalar başarıyla sandığa aktarıldı, çantada yer açıldı. Göreve devam ediliyor...\n`)
    } else {
        console.log(`⚠️ [TAŞMA KORUMASI] Sandığa boşaltma yapılamadı!\n`)
    }
    return bosaltildi
}

// ==========================================
// 3. MİNYON SİSTEMİ, JSON & API FONKSİYONLARI
// ==========================================

let bot = null
let islemde = false            // Bot o an bir işlem yapıyorsa üst üste binmesin
let afkKonumu = null           // Botun adada durduğu başlangıç noktası
let kontrolZamanlayici = null  // Otomatik kontrol döngüsü
let inLobby = false
let inSkyblock = false
let isGoGonderildi = false
let adada = false
let isGoRetryTimeout = null
let yenidenBaglanTimer = null
let kullaniciDurdurdu = true   // Başlangıçta bot durdurulmuş durumda bekler (Electron açılınca otomatik başlamaz)
let stdinDinleniyor = false

let girisBasarili = false
let authGirisYapildi = false   // Şifre girilip Giriş sunucusu (Auth) tarafından onaylandı mı
let lobiyeGecildi = false      // Lobi sunucusuna geçiş sağlandı mı
let skyblockGecisTimer = null
let loginFallbackTimer = null
let lobiBeklemeTimer = null    // Lobiye aktarılma bekleme zamanlayıcısı
let sunucuKontrolTimer = null // 5 dakikalık periyodik sunucu kontrol zamanlayıcısı
const SUNUCU_KONTROL_ARALIGI_MS = 5 * 60 * 1000 // 5 dakika (300.000 ms)

// Sağ taraftaki tablodan (Scoreboard) anlık sunucu bilgisi takibi
let mevcutSunucu = 'Durduruldu' // 'Skyblock' | 'Lobide' | 'Bağlanıyor...' | 'Durduruldu'
let scoreboardBaslik = ''       // Tablo ilk satırı/başlığı (Örn: 'AESIR SKYBLOCK' veya 'AESIR LOBI')

function girisMesajiMi(msg, temizMsg) {
    if (!msg) return false
    const norm = (temizMsg || metniTemizle(msg).toLowerCase()).replace(/[^a-z0-9]/g, ' ')
    return (
        (norm.includes('giris') && norm.includes('basari')) ||
        (norm.includes('basari') && norm.includes('giris')) ||
        norm.includes('login success') ||
        norm.includes('successfully logged') ||
        norm.includes('succes') ||
        norm.includes('sifre dogru') ||
        norm.includes('giris yapildi') ||
        msg.includes('Giriş başarılı') ||
        msg.includes('Giriş Başarılı') ||
        msg.includes('Başarıyla') ||
        msg.includes('Başarıyla giriş yaptınız')
    )
}

function lobiMesajiMi(msg, temizMsg) {
    if (!msg) return false
    const norm = (temizMsg || metniTemizle(msg).toLowerCase()).replace(/[^a-z0-9]/g, ' ')
    return (
        norm.includes('gunlukodul') ||
        norm.includes('gunluk odul') ||
        norm.includes('aesirmc') ||
        norm.includes('aesirdc') ||
        norm.includes('lobiye aktarildin') ||
        norm.includes('lobiye aktarildiniz') ||
        norm.includes('lobiye yonlendirildin') ||
        norm.includes('lobiye yonlendirildiniz') ||
        norm.includes('ana lobi') ||
        norm.includes('lobi sunucusu') ||
        (norm.includes('hosgeldin') && norm.includes('magaza')) ||
        (norm.includes('hosgeldin') && norm.includes('discord')) ||
        (norm.includes('wiki sayfasini') && norm.includes('kontrol')) ||
        (norm.includes('magaza') && norm.includes('store aesirmc'))
    )
}

function skyblockMesajiMi(msg, temizMsg) {
    if (!msg) return false
    const norm = (temizMsg || metniTemizle(msg).toLowerCase()).replace(/[^a-z0-9]/g, ' ')
    const kullanici = (AYARLAR.KULLANICI_ADI || '').toLowerCase()
    return (
        msg.includes(`[+] ${AYARLAR.KULLANICI_ADI}`) ||
        (kullanici && norm.includes(kullanici) && norm.includes('katildi')) ||
        norm.includes('rutbe atlayabilirsin') ||
        (norm.includes('aesir skyblock') && !norm.includes('youtube')) ||
        norm.includes('skyblock sunucusuna aktarildin') ||
        norm.includes('skyblock sunucusuna baglanildi') ||
        (norm.includes('skyblock') && norm.includes('hos geldin'))
    )
}

function sifreGirisOnaylandi(kaynak = 'Bilinmiyor') {
    if (authGirisYapildi) return
    authGirisYapildi = true

    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }

    console.log(`[DURUM] Şifre doğrulandı (${kaynak}). Lobi sunucusuna aktarılma bekleniyor (Giriş sunucusunda /gir gönderilmez)...`)

    // Güvenlik zamanlayıcısı: Lobiye aktarma mesajı/respawn kaçarsa 4 saniye sonra lobiye geçildiği varsayılsın
    if (lobiBeklemeTimer) clearTimeout(lobiBeklemeTimer)
    lobiBeklemeTimer = setTimeout(() => {
        if (!lobiyeGecildi && !inSkyblock && !adada && bot && !kullaniciDurdurdu) {
            console.log('[BİLGİ] Lobi aktarım zamanlayıcısı devrede, lobi sunucusu modu etkinleştiriliyor...')
            lobiyeGirisYapildi('Zamanlayıcı (Lobi Fallback)')
        }
    }, 4000)
}

function lobiyeGirisYapildi(kaynak = 'Bilinmiyor') {
    if (lobiyeGecildi && inLobby) return
    if (inSkyblock || adada) return

    lobiyeGecildi = true
    inLobby = true
    girisBasarili = true

    if (lobiBeklemeTimer) {
        clearTimeout(lobiBeklemeTimer)
        lobiBeklemeTimer = null
    }
    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }

    mevcutSunucu = 'Lobide'
    if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('SKYBLOCK')) {
        scoreboardBaslik = 'AESIR LOBI'
    }

    console.log(`[DURUM] Lobi sunucusuna başarıyla ulaşıldı (${kaynak})! Skyblock geçiş modu başlatılıyor...`)
    try {
        botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
        if (typeof durumAl === 'function') {
            botEvents.emit('durum', durumAl())
        }
    } catch (e) { }

    // Lobiye yeni geçildiğinde lobi dünyası ve komut sisteminin oturması için 1.8 saniye bekle, sonra /gir skyblock-spawn yap
    setTimeout(() => {
        if (!inSkyblock && !adada && bot && !kullaniciDurdurdu) {
            skyblockaGecisBaslat('Lobi Girişi Doğrulandı')
        }
    }, 1800)
}

function lobiyeDusuldu(sebep = 'Bilinmiyor') {
    if (!bot || kullaniciDurdurdu) return
    console.log(`[UYARI] Botun lobide olduğu algılandı (${sebep})! Skyblock ada modu askıya alınıyor...`)

    adada = false
    inSkyblock = false
    isGoGonderildi = false

    if (isGoRetryTimeout) {
        clearTimeout(isGoRetryTimeout)
        isGoRetryTimeout = null
    }
    if (kontrolZamanlayici) {
        clearInterval(kontrolZamanlayici)
        kontrolZamanlayici = null
    }
    if (bot.pathfinder) {
        try { bot.pathfinder.stop() } catch (e) { }
    }

    mevcutSunucu = 'Lobide'
    scoreboardBaslik = 'AESIR LOBI'

    try {
        botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
        if (typeof durumAl === 'function') {
            botEvents.emit('durum', durumAl())
        }
    } catch (e) { }

    skyblockaGecisBaslat(sebep)
}

function skyblockaGecisBaslat(kaynak = 'Bilinmiyor') {
    if (!bot || kullaniciDurdurdu) return
    if (inSkyblock || adada) {
        return
    }

    girisBasarili = true
    inLobby = true
    lobiyeGecildi = true

    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }
    if (lobiBeklemeTimer) {
        clearTimeout(lobiBeklemeTimer)
        lobiBeklemeTimer = null
    }

    mevcutSunucu = 'Lobide'
    if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('SKYBLOCK')) {
        scoreboardBaslik = 'AESIR LOBI'
    }

    try {
        botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
        if (typeof durumAl === 'function') {
            botEvents.emit('durum', durumAl())
        }
    } catch (e) { }

    // Eğer zaten aktif bir geçiş döngüsü çalışıyorsa tekrar üst üste başlatma
    if (skyblockGecisTimer) {
        return
    }

    console.log(`[DURUM] Lobide Skyblock giriş modu devrede (${kaynak}). Skyblock'a bağlanana kadar deneniyor...`)

    function girisDene() {
        if (!bot || kullaniciDurdurdu) {
            skyblockGecisTimer = null
            return
        }
        if (inSkyblock || adada) {
            console.log('[BAŞARILI] Skyblock sunucusuna geçiş sağlandı, giriş döngüsü durduruluyor.')
            if (skyblockGecisTimer) {
                clearTimeout(skyblockGecisTimer)
                skyblockGecisTimer = null
            }
            return
        }

        console.log('[İŞLEM] /gir skyblock-spawn gönderiliyor...')
        try {
            bot.chat('/gir skyblock-spawn')
        } catch (e) {
            console.error('[HATA] /gir komutu gönderilemedi:', e.message)
        }

        // Eğer 8 saniye içinde Skyblock sunucusuna aktarılmazsa (bakımda/sırada ise) tekrar dene
        if (skyblockGecisTimer) clearTimeout(skyblockGecisTimer)
        skyblockGecisTimer = setTimeout(() => {
            if (!bot || kullaniciDurdurdu || inSkyblock || adada) {
                skyblockGecisTimer = null
                return
            }
            console.log('[İŞLEM] Skyblock bağlantısı henüz onaylanmadı (bakımda veya sırada olabilir), tekrar /gir skyblock-spawn deneniyor...')
            girisDene()
        }, 8000)
    }

    // İlk denemeyi 1.5 saniye sonra yap
    skyblockGecisTimer = setTimeout(girisDene, 1500)
}

function skyblockaGecildiKontrol(kaynak = 'Bilinmiyor') {
    if (inSkyblock) return
    inSkyblock = true
    inLobby = true
    girisBasarili = true

    if (skyblockGecisTimer) {
        clearTimeout(skyblockGecisTimer)
        skyblockGecisTimer = null
    }
    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }

    mevcutSunucu = 'Skyblock'
    if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('LOBI')) {
        scoreboardBaslik = 'AESIR SKYBLOCK'
    }

    console.log(`[DURUM] Skyblock sunucusuna başarıyla giriş yapıldı (${kaynak})! 3 saniye sonra adaya gidiliyor...`)
    setTimeout(adayaGit, 3000)

    try {
        botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
        if (typeof durumAl === 'function') {
            botEvents.emit('durum', durumAl())
        }
    } catch (e) { }
}

function adayaGit() {
    if (!bot || adada) return
    isGoGonderildi = true
    const adaSahibi = AYARLAR.ADA_SAHIBI || 'EmsalSizOFC'
    const adaKomutu = `/is go ${adaSahibi}`
    console.log(`[İŞLEM] ${adaKomutu} gönderiliyor...`)
    bot.chat(adaKomutu)

    // /is go gönderildikten 8 saniye sonra adaya ulaşıldığını varsayıp kontrolü başlat
    if (isGoRetryTimeout) clearTimeout(isGoRetryTimeout)
    isGoRetryTimeout = setTimeout(() => {
        if (!adada) {
            console.log('[BİLGİ] Ada geçiş süresi tamamlandı, ada modu başlatılıyor...')
            adayaUlasildi()
        }
    }, 8000)
}

function adayaUlasildi() {
    if (adada) return
    adada = true
    inSkyblock = true
    inLobby = true
    girisBasarili = true

    if (isGoRetryTimeout) {
        clearTimeout(isGoRetryTimeout)
        isGoRetryTimeout = null
    }
    if (skyblockGecisTimer) {
        clearTimeout(skyblockGecisTimer)
        skyblockGecisTimer = null
    }
    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }

    mevcutSunucu = 'Skyblock'
    if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('LOBI')) {
        scoreboardBaslik = 'AESIR SKYBLOCK'
    }

    console.log('[BAŞARILI] Bot adaya ulaştı! Mevcut Sunucu: Skyblock')
    botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
    botEvents.emit('durum', { durum: 'Adada (Hazır)', adada: true, calisiyor: true, mevcutSunucu, scoreboardBaslik })
    botEvents.emit('envanter', envanterBilgisiAl())

    // Pathfinder hareket ayarlarını yap (adalarda blok kırmasın veya blok koymasın)
    if (bot && bot.pathfinder) {
        const hareketler = new Movements(bot)
        hareketler.canDig = false           // Adadaki blokları kırmasın
        hareketler.allow1by1towers = false  // Blok koyup yukarı çıkmasın
        bot.pathfinder.setMovements(hareketler)
    }

    // Botun adadaki durduğu noktayı AFK konumu olarak kaydet
    if (bot && bot.entity) {
        afkKonumu = bot.entity.position.clone()
        console.log(`[BİLGİ] AFK konumu kaydedildi: X=${Math.round(afkKonumu.x)}, Y=${Math.round(afkKonumu.y)}, Z=${Math.round(afkKonumu.z)}`)
    }

    // İlk kontrolü 2 saniye sonra yap
    setTimeout(otomatikMinyonGorevi, 2000)

    // Sonrasında her belirtilen saniyede bir tekrarla
    if (kontrolZamanlayici) clearInterval(kontrolZamanlayici)
    kontrolZamanlayici = setInterval(otomatikMinyonGorevi, AYARLAR.KONTROL_ARALIGI_SANIYE * 1000)
    console.log(`[DÖNGÜ] Minyon kontrol sistemi aktif! Her ${AYARLAR.KONTROL_ARALIGI_SANIYE} saniyede bir kontrol edilecek. (Test Modu: ${AYARLAR.SADECE_BILGI_MODU ? 'AÇIK - Eşya alınmaz' : 'KAPALI - Toplar'})`)
    console.log(`[İPUCU] Konsolda:`)
    console.log(`  - ENTER              : Minyon kontrolünü hemen tetikler`)
    console.log(`  - json               : Tüm minyonları JSON formatında gösterir`)
    console.log(`  - bot.oduncuminyon.konum : İstediğin özelliğin anlık değerini ekrana basar`)
    console.log(`  - Oyundan '!json'    : Minyon JSON özetini verir\n`)
}

function parseScoreboardMetni(raw) {
    if (!raw) return ''
    if (typeof raw === 'object') {
        return jsonToText(raw)
    }
    return jsonToText(raw)
}

// Scoreboard ve oyun ortamındaki metinleri toplar (Tablist hariç)
function tumScoreboardMetinleriniAl() {
    const satirlar = []
    if (!bot) return satirlar

    let aktifBaslik = ''
    if (bot.scoreboards) {
        for (const sb of Object.values(bot.scoreboards)) {
            if (sb && sb.title) {
                const t = parseScoreboardMetni(sb.title)
                if (t && t.trim().length > 0) {
                    satirlar.push(t.trim())
                    if (!aktifBaslik) aktifBaslik = t.trim()
                }
            }
            if (sb && sb.items) {
                for (const item of sb.items) {
                    try {
                        if (item.displayName) {
                            const dn = typeof item.displayName.toString === 'function'
                                ? item.displayName.toString()
                                : String(item.displayName)
                            if (dn && dn.trim().length > 0) {
                                satirlar.push(dn.trim())
                            }
                        }
                        if (item.name) {
                            const iname = String(item.name).trim()
                            if (iname) satirlar.push(iname)
                        }
                    } catch (e) { }
                }
            }
        }
    }

    if (aktifBaslik) {
        scoreboardBaslik = aktifBaslik
    } else if (satirlar.length === 0 && scoreboardBaslik) {
        satirlar.push(scoreboardBaslik)
    }

    return satirlar
}

// Botun şu anda Skyblock'ta mı yoksa Lobide mi olduğunu tespit eder
function sunucuKonumunuTespitEt() {
    if (!bot || kullaniciDurdurdu) {
        return 'Durduruldu'
    }

    const satirlar = tumScoreboardMetinleriniAl()
    const birlestirilmis = metniTemizle(satirlar.join(' ')).toLowerCase()
    const cleanBaslik = metniTemizle(scoreboardBaslik || '').toLowerCase()

    // SADECE Skyblock sunucusunda bulunan kesin ada göstergeleri
    const skyblockKesinAnahtarlar = [
        'ada sahibi',
        'ada seviyesi',
        'ada seviye',
        'ada uyeleri',
        'ada bankasi',
        'jenerator',
        'adadasin',
        'adadasiniz',
        'adan'
    ]

    // Lobi belirteçleri
    const lobiAnahtarlar = [
        'cakma lobi',
        'ana lobi',
        'lobi 1',
        'lobi 2',
        'lobi 3',
        'lobi 4',
        'lobi 5',
        'aesir lobi',
        'aesir network',
        'aesirmc',
        'aesirdc',
        'discord.gg/aesir',
        'sunucu secimi',
        'oyun secimi',
        'lobi'
    ]

    const skyblockKesinVar = skyblockKesinAnahtarlar.some(k => birlestirilmis.includes(k))
    const baslikSkyblock = cleanBaslik.includes('skyblock')
    const baslikLobi = cleanBaslik.includes('lobi') || cleanBaslik.includes('ana lobi') || cleanBaslik.includes('cakma lobi') || cleanBaslik.includes('aesir network')
    const lobiVar = baslikLobi || lobiAnahtarlar.some(k => birlestirilmis.includes(k))

    // 1. Kesin Lobi Tespiti: Tabloda lobi/network anahtarı varsa ve HİÇBİR Skyblock ada/başlık göstergesi yoksa
    if (lobiVar && !skyblockKesinVar && !baslikSkyblock) {
        return 'Lobide'
    }

    // 2. Kesin Skyblock Tespiti: Başlıkta Skyblock varsa veya tablosunda ada verileri varsa
    if (baslikSkyblock || skyblockKesinVar) {
        return 'Skyblock'
    }

    // 3. Tablo dolu fakat hiçbir Skyblock izi yoksa (Lobi/Fallback)
    if (satirlar.length > 0 && !skyblockKesinVar && !baslikSkyblock) {
        return 'Lobide'
    }

    // 4. Lobi belirteci varsa
    if (lobiVar) {
        return 'Lobide'
    }

    // 5. Bot adada ise ve lobi göstergesi yoksa
    if (adada) {
        return 'Skyblock'
    }

    // 6. Bot Skyblock'taysa
    if (inSkyblock) {
        return 'Skyblock'
    }

    // 7. Durum bayraklarına göre fallback
    if (lobiyeGecildi || inLobby || authGirisYapildi) {
        return 'Lobide'
    }

    return mevcutSunucu || 'Bağlanıyor...'
}

// Scoreboard güncellemelerinde anlık sunucu kontrolü (Debounced: En fazla saniyede 1 kez)
let sonScoreboardKontrolZamani = 0
function kontrolEtScoreboard(baslik, ekMaddeler = []) {
    if (!bot || kullaniciDurdurdu) return

    const simdi = Date.now()
    if (simdi - sonScoreboardKontrolZamani < 1000) {
        // En fazla saniyede 1 kez çalıştır (CPU ve Event Loop kilitlenmesini kesinlikle önler)
        return
    }
    sonScoreboardKontrolZamani = simdi

    const baslikMetin = parseScoreboardMetni(baslik)
    if (baslikMetin && baslikMetin.trim().length > 0) {
        scoreboardBaslik = baslikMetin.trim()
    }

    const yeniSunucu = sunucuKonumunuTespitEt()
    if (yeniSunucu && yeniSunucu !== 'Durduruldu' && yeniSunucu !== 'Bağlanıyor...') {
        if (yeniSunucu === 'Skyblock') {
            if (!inSkyblock) {
                skyblockaGecildiKontrol('Scoreboard')
            } else if (mevcutSunucu !== 'Skyblock') {
                mevcutSunucu = 'Skyblock'
                if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('LOBI')) {
                    scoreboardBaslik = 'AESIR SKYBLOCK'
                }
                console.log(`[SCOREBOARD] Tablodan doğrulandı: Mevcut Sunucu: Skyblock (Başlık: "${scoreboardBaslik}")`)
                botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
                if (typeof durumAl === 'function') botEvents.emit('durum', durumAl())
            }
        } else if (yeniSunucu === 'Lobide') {
            if (adada || inSkyblock) {
                lobiyeDusuldu('Scoreboard Lobi Tespiti')
            } else if (mevcutSunucu !== 'Lobide') {
                mevcutSunucu = 'Lobide'
                console.log(`[SCOREBOARD] Tablodan algılandı: Mevcut Sunucu: Lobide (Başlık: "${scoreboardBaslik}")`)
                botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
                if (typeof durumAl === 'function') botEvents.emit('durum', durumAl())
            }
        }
    }
}

// 5 Dakikalık Periyodik Sunucu Kontrol Sistemi
function sunucuDurumuPeriyodikKontrol() {
    if (!bot || kullaniciDurdurdu) return

    console.log('[PERİYODİK KONTROL] 5 dakikalık sunucu verisi kontrol ediliyor...')
    const tespit = sunucuKonumunuTespitEt()
    console.log(`[PERİYODİK KONTROL] 5 dakikalık kontrol sonucu: ${tespit}`)

    if (tespit === 'Lobide') {
        const lobiyeYeniDusmus = adada || inSkyblock || mevcutSunucu !== 'Lobide'
        if (lobiyeYeniDusmus) {
            console.log('[UYARI] 5 dakikalık kontrolde botun lobide olduğu tespit edildi (Bakım veya yeniden başlatma sonrası lobiye düşmüş olabilir)! Ada modu askıya alınıyor...')
            lobiyeDusuldu('5 Dakikalık Lobi Kontrolü')
        } else {
            mevcutSunucu = 'Lobide'
            botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
            if (typeof durumAl === 'function') botEvents.emit('durum', durumAl())
            skyblockaGecisBaslat('5 Dakikalık Lobi Kontrolü')
        }

    } else if (tespit === 'Skyblock') {
        mevcutSunucu = 'Skyblock'
        if (!scoreboardBaslik || scoreboardBaslik.toUpperCase().includes('LOBI')) {
            scoreboardBaslik = 'AESIR SKYBLOCK'
        }

        if (!inSkyblock) {
            skyblockaGecildiKontrol('5 Dakikalık Periyodik Kontrol')
        } else if (!adada) {
            console.log('[BİLGİ] Bot Skyblock sunucusunda fakat henüz adada değil, adaya gidiliyor (/is go)...')
            adayaGit()
        } else {
            console.log('[BAŞARILI] 5 dakikalık sunucu kontrolü tamamlandı: Bot Skyblock adasında aktif ve görevler devam ediyor.')
        }

        botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
        if (typeof durumAl === 'function') botEvents.emit('durum', durumAl())
    }
}

// Konsoldan veri sorgulama veya ENTER tuşu kontrolü (yalnızca 1 kez dinleyici eklenir)
function stdinBaslat() {
    if (stdinDinleniyor) return
    stdinDinleniyor = true

    process.stdin.on('data', (data) => {
        const girdi = data.toString().trim()

        if (!girdi) {
            // Sadece ENTER: Minyon kontrolünü hemen tetikle
            if (adada) {
                console.log('\n[KONSOL] ENTER tuşuna basıldı, minyon kontrolü hemen yapılıyor...')
                otomatikMinyonGorevi()
            }
            return
        }

        // 1. "json" yazıldıysa tüm minyon verilerini JSON olarak ekrana dök
        if (girdi.toLowerCase() === 'json') {
            console.log('\n📄 [MİNYON VERİLERİ (JSON FORMATI)]')
            console.log(JSON.stringify(bot?.minyonlar || {}, null, 2))
            return
        }

        // 1b. "kovan" veya "kovanlar" yazıldıysa tüm kovan verilerini JSON olarak ekrana dök
        if (girdi.toLowerCase() === 'kovan' || girdi.toLowerCase() === 'kovanlar') {
            console.log('\n🐝 [KOVAN VERİLERİ (JSON FORMATI)]')
            console.log(JSON.stringify(bot?.kovanlar || {}, null, 2))
            return
        }

        // 2. Kullanıcının istediği: "bot.oduncuminyon.konum" veya "oduncuminyon" gibi dinamik sorgular
        try {
            let yol = girdi
            if (yol.startsWith('bot.')) {
                yol = yol.slice(4)
            }

            const parcalar = yol.split('.')
            let sonuc = bot
            for (const parca of parcalar) {
                if (sonuc !== undefined && sonuc !== null) {
                    sonuc = sonuc[parca]
                } else {
                    sonuc = undefined
                    break
                }
            }

            if (sonuc !== undefined) {
                console.log(`\n🔍 [SORGU: ${girdi}] =>`)
                if (typeof sonuc === 'object') {
                    console.log(JSON.stringify(sonuc, null, 2))
                } else {
                    console.log(`   ${sonuc}`)
                }
            } else {
                const mevcutlar = Object.keys(bot?.minyonlar || {}).filter(k => !k.startsWith('_')).join(', ')
                console.log(`[UYARI] '${girdi}' bulunamadı. Mevcut minyon anahtarları: ${mevcutlar || 'Henüz taranmadı'}`)
            }
        } catch (err) {
            console.log(`[HATA] Sorgu çalıştırılamadı: ${err.message}`)
        }
    })
}

// Taranan minyonları bot nesnesine (bot.oduncuminyon.konum vb.) bağlar ve JSON dosyasına kaydeder
function minyonVerileriniKaydetVeBagla(minyonListesi) {
    if (!bot) return

    if (!bot.minyonlar) {
        bot.minyonlar = {}
    }

    const minyonHaritasi = {}

    for (const minyon of minyonListesi) {
        const sadeKey = minyon.slug || minyonSlugOlustur(minyon.isim)
        const altTireKey = minyon.altTireSlug || minyonAltTireSlug(minyon.isim)

        // 1. Doğrudan bot üzerinden erişim:
        // örn: bot.oduncuminyon.konum -> { x: 7, y: 65, z: -2 }
        if (sadeKey) {
            bot[sadeKey] = minyon
            minyonHaritasi[sadeKey] = minyon
        }
        if (altTireKey && altTireKey !== sadeKey) {
            bot[altTireKey] = minyon
            minyonHaritasi[altTireKey] = minyon
        }
    }

    // 2. bot.minyonlar altına toplu nesne
    bot.minyonlar = {
        ...minyonHaritasi,
        _liste: minyonListesi,
        _sonGuncelleme: new Date().toISOString()
    }

    // 3. minyonlar.json dosyasına kaydet
    if (AYARLAR.JSON_DOSYASI_KAYDET) {
        try {
            const jsonCikti = {
                sunucu: AYARLAR.SUNUCU_IP,
                hesap: AYARLAR.KULLANICI_ADI,
                sonGuncellemeZamani: new Date().toLocaleString('tr-TR'),
                toplamMinyon: minyonListesi.length,
                minyonlar: minyonHaritasi
            }
            fs.writeFileSync(AYARLAR.JSON_DOSYA_YOLU, JSON.stringify(jsonCikti, null, 2), 'utf8')
        } catch (dosyaHatasi) {
            console.error('[HATA] minyonlar.json dosyası kaydedilemedi:', dosyaHatasi.message)
        }
    }

    // 4. İsteğe bağlı konsola ham JSON yazdırma
    if (AYARLAR.KONSOLA_JSON_YAZDIR) {
        console.log('\n📄 [MİNYON VERİLERİ - JSON FORMATI]')
        console.log(JSON.stringify(minyonHaritasi, null, 2))
    }

    // 5. Electron GUI için minyon verilerini ilet
    botEvents.emit('minyonlar', bot.minyonlar)
}

// Taranan kovanları bot nesnesine (bot.kovan1, bot.kovan_10_66_21 vb.) bağlar ve kovanlar.json dosyasına kaydeder
function kovanVerileriniKaydetVeBagla(kovanListesi) {
    if (!bot) return

    if (!bot.kovanlar) {
        bot.kovanlar = {}
    }

    const kovanHaritasi = {}

    for (const kovan of kovanListesi) {
        const slug = kovan.slug || `kovan${kovan.id}`
        const konumSlug = kovan.konumSlug || `kovan_${kovan.konum.x}_${kovan.konum.y}_${kovan.konum.z}`

        // 1. Doğrudan bot üzerinden erişim: bot.kovan1, bot.kovan_10_66_21
        bot[slug] = kovan
        kovanHaritasi[slug] = kovan

        if (konumSlug && konumSlug !== slug) {
            bot[konumSlug] = kovan
            kovanHaritasi[konumSlug] = kovan
        }
    }

    // 2. bot.kovanlar altına toplu nesne
    bot.kovanlar = {
        ...kovanHaritasi,
        _liste: kovanListesi,
        _sonGuncelleme: new Date().toISOString()
    }

    // 3. kovanlar.json dosyasına kaydet
    if (AYARLAR.JSON_DOSYASI_KAYDET) {
        try {
            const jsonCikti = {
                sunucu: AYARLAR.SUNUCU_IP,
                hesap: AYARLAR.KULLANICI_ADI,
                sonGuncellemeZamani: new Date().toLocaleString('tr-TR'),
                toplamKovan: kovanListesi.length,
                kovanlar: kovanHaritasi
            }
            fs.writeFileSync(AYARLAR.KOVAN_JSON_DOSYA_YOLU, JSON.stringify(jsonCikti, null, 2), 'utf8')
        } catch (dosyaHatasi) {
            console.error('[HATA] kovanlar.json dosyası kaydedilemedi:', dosyaHatasi.message)
        }
    }

    // 4. İsteğe bağlı konsola ham JSON yazdırma
    if (AYARLAR.KONSOLA_JSON_YAZDIR) {
        console.log('\n🐝 [KOVAN VERİLERİ - JSON FORMATI]')
        console.log(JSON.stringify(kovanHaritasi, null, 2))
    }

    // 5. Electron GUI için kovan verilerini ilet
    botEvents.emit('kovanlar', bot.kovanlar)
}



// ADIM 1: /minyon Menüsünü Açıp Minyonları Tara ve Bilgilerini Konsola Yazdır
async function minyonlariTara() {
    if (!bot || !adada) {
        console.log('[UYARI] Bot adada değil veya başlatılmadı!')
        return []
    }

    console.log('\n==================================================')
    console.log('  🔍 MİNYON KONTROLÜ BAŞLATILIYOR (/minyon)...')
    console.log('==================================================')
    bot.chat('/minyon')

    // Menünün açılmasını bekle (en fazla 5 saniye)
    const menu = await new Promise(resolve => {
        const handler = (pencere) => resolve(pencere)
        bot.once('windowOpen', handler)
        setTimeout(() => resolve(null), 5000)
    })

    if (!menu) {
        console.log('[UYARI] /minyon menüsü açılmadı veya zaman aşımına uğradı.')
        const anlik = sunucuKonumunuTespitEt()
        if (anlik === 'Lobide') {
            lobiyeDusuldu('/minyon komutuna yanıt alınamadı, bot lobide')
        }
        return []
    }

    // Sunucudan eşyaların (window_items paketinin) gelmesi için 1 saniye bekle
    await bekle(1000)

    const minyonListesi = []
    // Sadece üst menü slotlarını tara (oyuncunun kendi çantasını taramasın)
    const menuSlotSayisi = menu.type.startsWith('minecraft:generic_') ? menu.slots.length - 36 : menu.slots.length

    for (let i = 0; i < menuSlotSayisi; i++) {
        const esya = menu.slots[i]
        if (!esya) continue

        // Eşyadaki tüm yazıları temizlenmiş olarak al
        const tumYazi = esyaninMetinleriniAl(esya)
        if (!tumYazi) continue

        // Lore içinde "DEPO: 170 / 576" ve "KONUM: 8, 66, 7" ara
        const depoEslesme = tumYazi.match(/DEPO:\s*(\d+)\s*\/\s*(\d+)/i)
        const konumEslesme = tumYazi.match(/KONUM:\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/i)

        if (depoEslesme && konumEslesme) {
            const mevcut = parseInt(depoEslesme[1])
            const kapasite = parseInt(depoEslesme[2])
            const yuzde = Math.round((mevcut / kapasite) * 100)

            const minyonKonum = {
                x: parseInt(konumEslesme[1]),
                y: parseInt(konumEslesme[2]),
                z: parseInt(konumEslesme[3])
            }

            // Ek bilgileri de çekelim (Kademe, Yakıt, Yükseltme)
            const kademeEslesme = tumYazi.match(/kademe:\s*([^\s\n\r|]+)/i)
            const yakitEslesme = tumYazi.match(/yakit:\s*([^►\n\r|]+)/i)
            const yukseltmeEslesme = tumYazi.match(/yukseltme:\s*([^►\n\r|]+)/i)

            const kademe = kademeEslesme ? kademeEslesme[1].toUpperCase() : 'T?'
            const yakit = yakitEslesme ? yakitEslesme[1].trim() : 'Yok'
            const yukseltme = yukseltmeEslesme ? yukseltmeEslesme[1].trim() : 'Yok'

            // Minyonun adını belirle (Örn: Madenci Minyon, Oduncu Minyon)
            let minyonAdi = esya.displayName || 'Minyon'
            const isimEslesme = tumYazi.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+ minyon)/i)
            if (isimEslesme) {
                minyonAdi = isimEslesme[1]
                    .split(' ')
                    .map(kelime => kelime.charAt(0).toUpperCase() + kelime.slice(1).toLowerCase())
                    .join(' ')
            }

            const slug = minyonSlugOlustur(minyonAdi)
            const altTireSlug = minyonAltTireSlug(minyonAdi)
            const durumMetni = yuzde >= AYARLAR.HEDEF_DOLULUK_YUZDESI
                ? `%${AYARLAR.HEDEF_DOLULUK_YUZDESI} doluluk sınırını AŞTI!`
                : `Dolması bekleniyor (%${AYARLAR.HEDEF_DOLULUK_YUZDESI} altında).`

            const minyonBilgisi = {
                isim: minyonAdi,
                slug: slug,
                altTireSlug: altTireSlug,
                kademe: kademe,
                konum: minyonKonum,
                depo: {
                    mevcut: mevcut,
                    kapasite: kapasite,
                    yuzde: yuzde
                },
                mevcut: mevcut,
                kapasite: kapasite,
                yuzde: yuzde,
                yakit: yakit,
                yukseltme: yukseltme,
                durum: durumMetni,
                sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
            }

            minyonListesi.push(minyonBilgisi)

            // Konsola okunaklı ve detaylı yazdır
            console.log(`\n📌 [${minyonBilgisi.isim}] (Kademe: ${kademe})`)
            console.log(`   📍 Konum      : X: ${minyonKonum.x}, Y: ${minyonKonum.y}, Z: ${minyonKonum.z}`)
            console.log(`   📦 Sandık/Depo: ${mevcut} / ${kapasite} adet (%${yuzde} DOLU)`)
            console.log(`   ⚡ Yakıt      : ${yakit}`)
            console.log(`   ⚙️  Yükseltme  : ${yukseltme}`)

            if (yuzde >= AYARLAR.HEDEF_DOLULUK_YUZDESI) {
                console.log(`   🚨 DURUM     : %${AYARLAR.HEDEF_DOLULUK_YUZDESI} doluluk sınırını AŞTI!`)
            } else {
                console.log(`   ⏳ DURUM     : Dolması bekleniyor (%${AYARLAR.HEDEF_DOLULUK_YUZDESI} altında).`)
            }
        } else {
            // Eğer minyon tespit edilemediyse ne eşyası olduğunu görelim (Hata ayıklama için faydalı)
            if (esya.name !== 'gray_stained_glass_pane' && esya.name !== 'black_stained_glass_pane') {
                // Diğer eşyaların (saat, kitap vb.) sadece başlığını konsola çok ufak basalım
                // console.log(`   [Menü Eşyası: ${esya.name}]`)
            }
        }
    }

    if (minyonListesi.length === 0) {
        console.log('[BİLGİ] Menüde minyon tespit edilemedi. Menüdeki eşyalar inceleniyor:')
        for (let i = 0; i < menuSlotSayisi; i++) {
            const item = menu.slots[i]
            if (item && !item.name.includes('glass_pane')) {
                const metin = esyaninMetinleriniAl(item).replace(/\n/g, ' | ')
                console.log(`   Slot ${i} [${item.name}]: ${metin}`)
            }
        }
    }

    console.log('\n==================================================')
    console.log(`  📊 TOPLAM ${minyonListesi.length} ADET MİNYON TESPİT EDİLDİ`)
    console.log('==================================================\n')

    // Menüyü kapat
    bot.closeWindow(menu)
    await bekle(1000)

    // Minyon verilerini bot nesnesine (bot.oduncuminyon vb.) bağla ve JSON dosyasına kaydet
    minyonVerileriniKaydetVeBagla(minyonListesi)

    return minyonListesi
}

// ADIM 1B: /kovanlar Menüsünü Açıp Kovanları Tara ve Bilgilerini Konsola Yazdır
async function kovanlariTara() {
    if (!bot || !adada) {
        console.log('[UYARI] Bot adada değil veya başlatılmadı!')
        return []
    }

    console.log('\n==================================================')
    console.log('  🐝 KOVAN KONTROLÜ BAŞLATILIYOR (/kovanlar)...')
    console.log('==================================================')
    bot.chat('/kovanlar')

    // Menünün açılmasını bekle (en fazla 5 saniye)
    const menu = await new Promise(resolve => {
        const handler = (pencere) => resolve(pencere)
        bot.once('windowOpen', handler)
        setTimeout(() => resolve(null), 5000)
    })

    if (!menu) {
        console.log('[UYARI] /kovanlar menüsü açılmadı veya zaman aşımına uğradı.')
        const anlik = sunucuKonumunuTespitEt()
        if (anlik === 'Lobide') {
            lobiyeDusuldu('/kovanlar komutuna yanıt alınamadı, bot lobide')
        }
        return []
    }

    // Sunucudan eşyaların gelmesi için 1 saniye bekle
    await bekle(1000)

    const kovanListesi = []
    const menuSlotSayisi = menu.type.startsWith('minecraft:generic_') ? menu.slots.length - 36 : menu.slots.length
    let kovanSayac = 1

    for (let i = 0; i < menuSlotSayisi; i++) {
        const esya = menu.slots[i]
        if (!esya) continue

        const tumYazi = esyaninMetinleriniAl(esya)
        const hamYazi = esyaninHamMetinleriniAl(esya)
        if (!tumYazi) continue

        // Lore içinde "BAL: 12 / 48" ve "KONUM: 10, 66, 21" ara
        const balEslesme = tumYazi.match(/bal:\s*(\d+)\s*\/\s*(\d+)/i)
        const konumEslesme = tumYazi.match(/konum:\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/i)

        if (balEslesme && konumEslesme) {
            const mevcutBal = parseInt(balEslesme[1])
            const kapasiteBal = parseInt(balEslesme[2])
            const balYuzde = kapasiteBal > 0 ? Math.round((mevcutBal / kapasiteBal) * 100) : 0

            const kovanKonum = {
                x: parseInt(konumEslesme[1]),
                y: parseInt(konumEslesme[2]),
                z: parseInt(konumEslesme[3])
            }

            // Arı sayısı: "Arı: 0 / 3"
            const ariEslesme = tumYazi.match(/ar[iı]:\s*(\d+)\s*\/\s*(\d+)/i)
            const ariSayisi = ariEslesme ? parseInt(ariEslesme[1]) : 0
            const ariKapasite = ariEslesme ? parseInt(ariEslesme[2]) : 3

            // Arılar listesi: "ARILAR: YOSUN ARISI, GECE ARISI, GECE ARISI"
            let arilar = []
            const arilarEslesme = hamYazi.match(/ARILAR:\s*([^►\n\r|]+)/i) || tumYazi.match(/arilar:\s*([^►\n\r|]+)/i)
            if (arilarEslesme && arilarEslesme[1].trim()) {
                arilar = arilarEslesme[1].split(',')
                    .map(a => a.trim())
                    .filter(a => a.length > 0 && a.toLowerCase() !== 'yok')
            }

            // Çiçek Puanı & Çarpan: "CICEK PUANI: 15.4 (x2.2)"
            const cicekEslesme = tumYazi.match(/cicek puani:\s*([\d.]+)(?:\s*\((?:x|X)?([\d.]+)\))?/i)
            const cicekPuani = cicekEslesme ? parseFloat(cicekEslesme[1]) : 0
            const carpan = cicekEslesme && cicekEslesme[2] ? parseFloat(cicekEslesme[2]) : 1.0

            const kovanAdi = `Kovan #${kovanSayac}`
            const slug = `kovan${kovanSayac}`
            const konumSlug = `kovan_${kovanKonum.x}_${kovanKonum.y}_${kovanKonum.z}`

            const kovanBilgisi = {
                id: kovanSayac,
                isim: kovanAdi,
                slug: slug,
                konumSlug: konumSlug,
                slot: i,
                konum: kovanKonum,
                bal: {
                    mevcut: mevcutBal,
                    kapasite: kapasiteBal,
                    yuzde: balYuzde
                },
                mevcut: mevcutBal,
                kapasite: kapasiteBal,
                yuzde: balYuzde,
                ari: {
                    mevcut: ariSayisi,
                    kapasite: ariKapasite
                },
                arilar: arilar,
                cicekPuani: cicekPuani,
                carpan: carpan,
                sonGuncelleme: new Date().toLocaleTimeString('tr-TR')
            }

            kovanListesi.push(kovanBilgisi)

            // Konsola okunaklı ve detaylı yazdır
            console.log(`\n🍯 [${kovanAdi}] (Bal: %${balYuzde})`)
            console.log(`   📍 Konum      : X: ${kovanKonum.x}, Y: ${kovanKonum.y}, Z: ${kovanKonum.z}`)
            console.log(`   🍯 Bal Deposu : ${mevcutBal} / ${kapasiteBal} (%${balYuzde})`)
            console.log(`   🐝 Arı Durumu : ${ariSayisi} / ${ariKapasite} adet`)
            if (arilar.length > 0) {
                console.log(`   🐝 Arılar     : ${arilar.join(', ')}`)
            }
            console.log(`   🌸 Çiçek Puanı: ${cicekPuani} (x${carpan})`)

            kovanSayac++
        }
    }

    if (kovanListesi.length === 0) {
        console.log('[BİLGİ] Menüde kovan tespit edilemedi. Menüdeki eşyalar inceleniyor:')
        for (let i = 0; i < menuSlotSayisi; i++) {
            const item = menu.slots[i]
            if (item && !item.name.includes('glass_pane')) {
                const metin = esyaninMetinleriniAl(item).replace(/\n/g, ' | ')
                console.log(`   Slot ${i} [${item.name}]: ${metin}`)
            }
        }
    }

    console.log('\n==================================================')
    console.log(`  🐝 TOPLAM ${kovanListesi.length} ADET KOVAN TESPİT EDİLDİ`)
    console.log('==================================================\n')

    // Menüyü kapat
    bot.closeWindow(menu)
    await bekle(1000)

    // Kovan verilerini bot nesnesine bağla ve kovanlar.json dosyasına kaydet
    kovanVerileriniKaydetVeBagla(kovanListesi)

    return kovanListesi
}

// ADIM 1C: Belirtilen bir kovandan bal hasadı yapar
async function kovandanBalHasatEt(kovanHedef) {
    if (!bot || !adada) {
        console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
        return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
    }

    let kovan = kovanHedef
    // Eğer sadece ID veya slug verildiyse bot.kovanlar içinden bul
    if (typeof kovanHedef === 'number' || typeof kovanHedef === 'string') {
        const liste = bot?.kovanlar?._liste || []
        kovan = liste.find(k => k.id === Number(kovanHedef) || k.slug === String(kovanHedef) || k.slot === Number(kovanHedef))
    }

    if (!kovan || kovan.slot === undefined) {
        console.log('[BİLGİ] Kovan slot bilgisi bulunamadı, kovanlar taranıyor...')
        const liste = await kovanlariTara()
        kovan = liste[0]
    }

    if (!kovan || kovan.slot === undefined) {
        return { basarili: false, mesaj: 'Hasat edilecek kovan bulunamadı!' }
    }

    console.log('\n==================================================')
    console.log(`  🍯 [${kovan.isim || 'Kovan'}] BAL HASADI BAŞLATILIYOR...`)
    console.log('==================================================')
    console.log(`[İŞLEM] /kovanlar menüsü açılıyor...`)
    bot.chat('/kovanlar')

    const kovanlarMenu = await new Promise(resolve => {
        const handler = (p) => resolve(p)
        bot.once('windowOpen', handler)
        setTimeout(() => resolve(null), 5000)
    })

    if (!kovanlarMenu) {
        console.log('[UYARI] /kovanlar menüsü açılmadı veya zaman aşımına uğradı!')
        return { basarili: false, mesaj: '/kovanlar menüsü açılamadı.' }
    }

    // İşlem arası 2 - 3.5 saniye bekle
    await bekleRastgele(2000, 3500)

    console.log(`[İŞLEM] ${kovan.isim} seçiliyor (Slot: ${kovan.slot})...`)

    // Kovanın içine girmek için slotuna tıkla
    const kovanMenuPromise = new Promise(resolve => {
        const handler = (p) => resolve(p)
        bot.once('windowOpen', handler)
        setTimeout(() => resolve(null), 4000)
    })

    await bot.clickWindow(kovan.slot, 0, 0)
    let kovanPenceresi = await kovanMenuPromise

    if (!kovanPenceresi) {
        // Sunucu pencereyi yerinde yenilemiş olabilir
        await bekleRastgele(1500, 2500)
        kovanPenceresi = bot.currentWindow
    }

    if (!kovanPenceresi) {
        console.log('[UYARI] Kovan içi detay menüsü açılmadı!')
        return { basarili: false, mesaj: 'Kovan menüsü açılamadı.' }
    }

    // İşlem arası 2 - 3.5 saniye bekle
    await bekleRastgele(2000, 3500)

    // Kovan menüsü içinde "honey_bottle" veya "HASAT ET" olan slotu bul
    let balSlot = -1
    const menuSlotSayisi = kovanPenceresi.type && kovanPenceresi.type.startsWith('minecraft:generic_')
        ? kovanPenceresi.slots.length - 36
        : kovanPenceresi.slots.length

    for (let s = 0; s < menuSlotSayisi; s++) {
        const esya = kovanPenceresi.slots[s]
        if (!esya) continue
        const raw = esyaninHamMetinleriniAl(esya).toLowerCase()
        const clean = esyaninMetinleriniAl(esya).toLowerCase()

        if (esya.name === 'honey_bottle' || clean.includes('hasat et') || raw.includes('hasat et') || (clean.includes('bal:') && clean.includes('birim'))) {
            balSlot = s
            break
        }
    }

    if (balSlot === -1) {
        console.log('[UYARI] Kovan menüsünde bal hasat butonu bulunamadı! Menüdeki eşyalar:')
        for (let s = 0; s < menuSlotSayisi; s++) {
            const it = kovanPenceresi.slots[s]
            if (it && !it.name.includes('glass_pane')) {
                console.log(`   Slot ${s} [${it.name}]: ${esyaninHamMetinleriniAl(it).replace(/\n/g, ' | ')}`)
            }
        }
        bot.closeWindow(kovanPenceresi)
        return { basarili: false, mesaj: 'Bal hasat butonu bulunamadı!' }
    }

    console.log(`[İŞLEM] Bal butonuna tıklanıyor (Slot ${balSlot})...`)
    const oncekiEnvanter = envanterEsyaSayilariAl()
    await bot.clickWindow(balSlot, 0, 0)
    // Balın envantere aktarılması için 2 - 3.5 saniye bekle
    await bekleRastgele(2000, 3500)

    const simdikiEnvanter = envanterEsyaSayilariAl()
    const farklar = envanterFarkiHesapla(oncekiEnvanter, simdikiEnvanter)

    if (tracker) {
        if (farklar.length > 0) {
            for (const f of farklar) {
                tracker.hasatEkle(f.name, f.displayName, f.count, kovan?.isim || 'Kovan')
            }
        } else {
            // Varsayılan bal şişesi kaydı (garantiye al)
            tracker.hasatEkle('honey_bottle', 'Bal Şişesi', 1, kovan?.isim || 'Kovan')
        }
        try {
            botEvents.emit('hasatGuncellendi', tracker.getAnalitik())
        } catch (e) { }
    }

    console.log(`[BAŞARILI] ${kovan.isim} içindeki bal başarıyla envantere alındı!`)
    bot.closeWindow(kovanPenceresi)
    // Pencerenin kapanması için 2 - 3 saniye bekle
    await bekleRastgele(2000, 3000)

    // Envanter güncellemesini ilet
    botEvents.emit('envanter', envanterBilgisiAl())

    return { basarili: true, mesaj: `${kovan.isim} balı başarıyla hasat edildi!` }
}

// ADIM 1D: Test Butonu İçin: Tüm kovanlardan balı toplar ve sandığa koyar (İşlemler arası 2-4 sn bekleme)
async function tumKovanlariHasatEtVeSandigaKoy() {
    if (!bot || !adada) {
        console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
        return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
    }

    console.log('\n==================================================')
    console.log('  🧪 TÜM KOVANLARDAN BAL HASADI & SANDIK İŞLEMİ BAŞLATILIYOR...')
    console.log('==================================================')

    let liste = bot?.kovanlar?._liste || []
    if (liste.length === 0) {
        console.log('[BİLGİ] Kovanlar taranmamış, önce /kovanlar taranıyor...')
        liste = await kovanlariTara()
    }

    if (liste.length === 0) {
        return { basarili: false, mesaj: 'Kovan bulunamadı!' }
    }

    console.log(`[BİLGİ] Toplam ${liste.length} adet kovan sırayla hasat edilecek. (İşlemler arası 2-4 sn bekleniyor)`)
    let basariliSayisi = 0

    // 1. Sırayla tüm kovanlardan bal al (doluluk şartı olmadan test amaçlı)
    for (let i = 0; i < liste.length; i++) {
        const k = liste[i]
        // Çanta doluluk taşma koruması
        await tasmaKorumasiKontrolVeBosalt(`Kovan Hasadı (${k.isim})`)

        console.log(`\n[İŞLEM] (${i + 1}/${liste.length}) ${k.isim} balı hasat ediliyor...`)
        const sonuc = await kovandanBalHasatEt(k)
        if (sonuc && sonuc.basarili) {
            basariliSayisi++
        }
        // Kovanlar arası 2 - 4 saniye bekleme
        await bekleRastgele(2500, 4000)
    }

    console.log(`\n[BAŞARILI] Toplam ${basariliSayisi} / ${liste.length} kovandan bal envantere alındı!`)
    botEvents.emit('envanter', envanterBilgisiAl())

    // 2. Sandığa git ve toplanan balları sandığa koy
    if (basariliSayisi > 0) {
        console.log('\n[İŞLEM] Toplanan ballar sandığa aktarılıyor...')
        await bekleRastgele(2000, 3000)
        await sandigaEsyalariKoy()
    }

    // 3. AFK konumuna geri dön
    if (afkKonumu) {
        console.log(`[YÜRÜME] Başlangıç AFK konumuna geri dönülüyor...`)
        try {
            await bot.pathfinder.goto(new goals.GoalNear(afkKonumu.x, afkKonumu.y, afkKonumu.z, 1))
            console.log('[DURUM] Bot tekrar AFK konumunda beklemeye geçti.')
        } catch (e) { }
    }

    // Son durumu güncelle
    await bekleRastgele(2000, 3000)
    await kovanlariTara()
    botEvents.emit('envanter', envanterBilgisiAl())

    return {
        basarili: true,
        toplanan: basariliSayisi,
        toplam: liste.length,
        mesaj: `Tüm kovanlardan (${basariliSayisi}/${liste.length}) bal alındı ve sandığa koyuldu!`
    }
}

// ADIM 1E: %80 veya belirtilen doluluk oranına ulaşan tüm kovanlardan sırayla bal toplar ve sandığa koyar
async function tumKovanlardanBalTopla(hedefYuzde = AYARLAR.HEDEF_DOLULUK_YUZDESI) {
    if (!bot || !adada) {
        console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
        return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
    }

    console.log('\n==================================================')
    console.log(`  🍯 DOLAN KOVANLARIN BALI HASAT EDİLİYOR (%${hedefYuzde}+)...`)
    console.log('==================================================')

    // Önce kovanları tara ve güncel dolulukları al
    const liste = await kovanlariTara()
    if (liste.length === 0) {
        return { basarili: false, mesaj: 'Kovan bulunamadı!' }
    }

    const toplanacaklar = liste.filter(k => (k.bal?.yuzde ?? k.yuzde ?? 0) >= hedefYuzde)

    if (toplanacaklar.length === 0) {
        console.log(`[BİLGİ] %${hedefYuzde} ve üzeri dolulukta kovan bulunamadı.`)
        return { basarili: true, toplanan: 0, mesaj: `%${hedefYuzde} ve üzeri kovan bulunamadı.` }
    }

    console.log(`[BİLGİ] Toplam ${toplanacaklar.length} adet kovandan bal toplanacak! (İşlemler arası 2-4 sn bekleme)`)
    let basariliSayisi = 0

    for (let i = 0; i < toplanacaklar.length; i++) {
        const k = toplanacaklar[i]
        // Çanta doluluk taşma koruması
        await tasmaKorumasiKontrolVeBosalt(`Kovan Hasadı (${k.isim})`)

        const sonuc = await kovandanBalHasatEt(k)
        if (sonuc && sonuc.basarili) {
            basariliSayisi++
        }
        // Kovanlar arası 2.5 - 4 saniye bekleme
        await bekleRastgele(2500, 4000)
    }

    console.log(`\n[BAŞARILI] Toplam ${basariliSayisi} / ${toplanacaklar.length} kovandan bal hasat edildi!\n`)

    // Sandığa koyma işlemi
    if (basariliSayisi > 0) {
        console.log('\n[İŞLEM] Dolan kovanlardan toplanan ballar sandığa aktarılıyor...')
        await bekleRastgele(2000, 3000)
        await sandigaEsyalariKoy()
        if (afkKonumu) {
            try {
                await bot.pathfinder.goto(new goals.GoalNear(afkKonumu.x, afkKonumu.y, afkKonumu.z, 1))
            } catch (e) { }
        }
    }

    // İşlem sonrası kovanları tekrar tara ve envanteri güncelle
    await bekleRastgele(2000, 3000)
    await kovanlariTara()
    botEvents.emit('envanter', envanterBilgisiAl())

    return { basarili: true, toplanan: basariliSayisi, toplam: toplanacaklar.length }
}

// ADIM 2: Minyona Yürü ve Eşyaları Al (Test modunda devre dışı)
async function minyondanEsyalariTopla(minyon) {
    console.log(`\n[YÜRÜME] ${minyon.isim} yanına gidiliyor: X=${minyon.konum.x}, Y=${minyon.konum.y}, Z=${minyon.konum.z}`)

    try {
        const hedef = new goals.GoalNear(minyon.konum.x, minyon.konum.y, minyon.konum.z, 2)
        await bot.pathfinder.goto(hedef)
    } catch (err) {
        console.log(`[HATA] Minyona yürünürken hata oluştu: ${err.message}`)
        return false
    }

    await bekle(1000)

    const minyonVarligi = bot.nearestEntity(varlik => {
        if (!varlik.position) return false
        const mesafe = varlik.position.distanceTo(new Vec3(minyon.konum.x, minyon.konum.y, minyon.konum.z))
        return mesafe <= 3.5
    })

    if (!minyonVarligi) {
        console.log('[HATA] Minyon varlığı (zombie) bulunamadı!')
        return false
    }

    // Minyona gitmeden önce çanta doluluk taşma koruması
    await tasmaKorumasiKontrolVeBosalt(`Minyon Hasadı (${minyon?.isim || 'Bilinmeyen'})`)

    console.log('[İŞLEM] Minyona sağ tıklanıyor...')

    const menuBekle = new Promise(resolve => {
        const handler = (pencere) => resolve(pencere)
        bot.once('windowOpen', handler)
        setTimeout(() => resolve(null), 5000)
    })

    await bot.activateEntity(minyonVarligi)
    const minyonMenusu = await menuBekle

    if (!minyonMenusu) {
        console.log('[HATA] Minyon menüsü açılmadı!')
        return false
    }

    console.log('[İŞLEM] Minyon menüsü açıldı. Slot 13 (DEPO) tıklanarak toplanıyor...')
    await bekle(1200)

    const oncekiEnvanter = envanterEsyaSayilariAl()
    // Slot 13: Depo (Hepsini Topla)
    await bot.clickWindow(13, 0, 0)
    await bekle(1200)

    const simdikiEnvanter = envanterEsyaSayilariAl()
    const farklar = envanterFarkiHesapla(oncekiEnvanter, simdikiEnvanter)
    if (tracker && farklar.length > 0) {
        for (const f of farklar) {
            tracker.hasatEkle(f.name, f.displayName, f.count, minyon?.isim || 'Minyon')
        }
        try {
            botEvents.emit('hasatGuncellendi', tracker.getAnalitik())
        } catch (e) { }
    }

    bot.closeWindow(minyonMenusu)
    console.log('[BAŞARILI] Eşyalar çantaya aktarıldı!')
    await bekle(1000)

    // Minyondan eşyalar alındıktan sonra çanta dolduysa ara boşaltma kontrolü
    await tasmaKorumasiKontrolVeBosalt(`Minyon Hasadı Sonrası (${minyon?.isim || 'Bilinmeyen'})`)

    return true
}

// ADIM 3: Hedef Sandığa Git ve Eşyaları Boşalt
async function sandigaEsyalariKoy() {
    if (!bot || !bot.entity) {
        console.log('[UYARI] Bot oyunda değil!')
        return false
    }

    const sandikIds = [
        bot.registry.blocksByName.chest?.id,
        bot.registry.blocksByName.trapped_chest?.id,
        bot.registry.blocksByName.barrel?.id
    ].filter(Boolean)

    let sandikX = AYARLAR.SANDIK_KONUMU?.x ?? null
    let sandikY = AYARLAR.SANDIK_KONUMU?.y ?? null
    let sandikZ = AYARLAR.SANDIK_KONUMU?.z ?? null

    // Kayıtlı koordinattaki bloğu kontrol et (gerçekten sandık/varil mi?)
    let hedefBlok = null
    if (sandikX !== null && sandikY !== null && sandikZ !== null) {
        const blok = bot.blockAt(new Vec3(sandikX, sandikY, sandikZ))
        if (blok && sandikIds.includes(blok.type)) {
            hedefBlok = blok
        }
    }

    // Eğer koordinat tanımlı değilse veya o koordinatta sandık yoksa etrafta ara (25 blok)
    if (!hedefBlok) {
        console.log('[BİLGİ] Kayıtlı koordinatta geçerli bir sandık bulunamadı, etraftaki sandık taranıyor...')
        const sandikBlok = bot.findBlock({
            matching: sandikIds,
            maxDistance: 25
        })

        if (!sandikBlok) {
            console.log('[UYARI] Yakında hiç sandık bulunamadı! Lütfen ayarlardan koordinat girin ya da chatten !sandik yazın.')
            return false
        }

        hedefBlok = sandikBlok
        sandikX = sandikBlok.position.x
        sandikY = sandikBlok.position.y
        sandikZ = sandikBlok.position.z

        // Otomatik bulunan geçerli sandığı kaydet
        AYARLAR.SANDIK_KONUMU = { x: sandikX, y: sandikY, z: sandikZ }
        console.log(`[AYAR] Geçerli sandık konumu otomatik güncellendi: X:${sandikX}, Y:${sandikY}, Z:${sandikZ}`)
        try {
            botEvents.emit('sandikGuncellendi', AYARLAR.SANDIK_KONUMU)
        } catch (e) { }
    }

    console.log(`\n[YÜRÜME] Sandığa gidiliyor: X=${sandikX}, Y=${sandikY}, Z=${sandikZ}`)
    try {
        const botMesafe = bot.entity.position.distanceTo(new Vec3(sandikX, sandikY, sandikZ))
        if (botMesafe > 3.2) {
            const hedef = new goals.GoalNear(sandikX, sandikY, sandikZ, 2)
            await bot.pathfinder.goto(hedef)
            await bekle(1000)
        }
    } catch (err) {
        console.log(`[HATA] Sandığa yürünürken hata oluştu: ${err.message}`)
        return false
    }

    // Sandık bloğunu tekrar doğrula
    const blok = bot.blockAt(new Vec3(sandikX, sandikY, sandikZ))
    if (!blok || !sandikIds.includes(blok.type)) {
        console.log('[HATA] Sandık bloğu okunamadı veya geçerli bir sandık değil!')
        return false
    }

    console.log('[İŞLEM] Sandık açılıyor...')
    let sandikPenceresi = null
    try {
        sandikPenceresi = await bot.openChest(blok)
    } catch (err) {
        console.log(`[HATA] Sandık açılamadı: ${err.message}`)
        return false
    }

    await bekle(1200)

    let aktarilanSayisi = 0
    let sandikDolu = false

    try {
        const invStart = sandikPenceresi.inventoryStart
        const invEnd = sandikPenceresi.inventoryEnd || sandikPenceresi.slots.length

        function sandikTamamenDoluMu() {
            for (let s = 0; s < invStart; s++) {
                const chestItem = sandikPenceresi.slots[s]
                if (!chestItem) return false
                if (chestItem.count < chestItem.stackSize) return false
            }
            return true
        }

        function sandiktaYerVarMi(item) {
            for (let s = 0; s < invStart; s++) {
                const chestItem = sandikPenceresi.slots[s]
                if (!chestItem) return true
                if (chestItem.type === item.type && chestItem.count < chestItem.stackSize) return true
            }
            return false
        }

        let aktarimYapildi = true
        let turSayaci = 0

        while (aktarimYapildi && turSayaci < 3 && !sandikTamamenDoluMu()) {
            turSayaci++
            aktarimYapildi = false

            for (let slot = invStart; slot < invEnd; slot++) {
                if (!sandikPenceresi || !bot.currentWindow) {
                    console.log('[UYARI] Sandık penceresi beklenmedik şekilde kapandı!')
                    break
                }

                const item = sandikPenceresi.slots[slot]
                if (!item) continue

                const esyaAdi = (item.name || '').toLowerCase()
                if (KORUNACAK_ESYALAR.some(k => esyaAdi.includes(k))) continue

                if (!sandiktaYerVarMi(item)) {
                    continue
                }

                console.log(`  -> [HIZLI AKTARIM] ${item.count} adet ${item.name} sandığa aktarılıyor...`)
                try {
                    // Shift + Sol Tık (Mode 1, Button 0) -> Sunucu tarafında eşyayı anında sandığa aktarır
                    await bot.clickWindow(slot, 0, 1)
                    aktarilanSayisi += (item.count || 1)
                    aktarimYapildi = true
                    await bekle(250) // Anti-cheat ve paket senkronizasyonu için bekleme
                } catch (hata) {
                    console.log(`  [UYARI] Slot ${slot} (${item.name}) aktarılamadı: ${hata.message}`)
                    const errLower = (hata.message || '').toLowerCase()
                    if (errLower.includes('full') || errLower.includes('dolu') || errLower.includes('closed') || errLower.includes('kapandı')) {
                        sandikDolu = true
                        break
                    }
                }
            }

            if (sandikDolu) break
        }

        if (sandikTamamenDoluMu()) {
            console.log(`[UYARI] Sandık tamamen dolu! Bazı eşyalar sandığa sığmadı.`)
        }
        console.log(`[BAŞARILI] Sandığa aktarım tamamlandı! (${aktarilanSayisi} adet eşya aktarıldı)`)
        if (tracker && aktarilanSayisi > 0) {
            tracker.bosaltmaSeferiKaydet(aktarilanSayisi)
            try {
                botEvents.emit('hasatGuncellendi', tracker.getAnalitik())
            } catch (e) { }
        }
    } catch (döngüHatasi) {
        console.log(`[HATA] Aktarım sırasında hata oluştu: ${döngüHatasi.message}`)
    } finally {
        if (sandikPenceresi) {
            try {
                sandikPenceresi.close()
            } catch (e) { }
        }
    }

    await bekle(800)
    try {
        botEvents.emit('envanter', envanterBilgisiAl())
    } catch (e) { }
    return true
}

// ADIM 4: Tüm Aşamaları Birleştiren Ana Görev
async function otomatikMinyonGorevi() {
    if (!bot || !adada || !inSkyblock || mevcutSunucu !== 'Skyblock') {
        return
    }

    if (islemde) {
        console.log('[BİLGİ] Bot şu anda başka bir işlem yapıyor (meşgul), minyon/kovan kontrolü bu döngüde ertelendi.')
        return
    }

    islemde = true

    try {
        // 1. Minyonları kontrol et ve bilgileri konsola yazdır
        const bulunanMinyonlar = await minyonlariTara()
        if (!bot || !adada || !inSkyblock || mevcutSunucu !== 'Skyblock') return

        // 1b. Kovanları kontrol et ve bilgileri konsola yazdır
        await bekle(1500)
        const bulunanKovanlar = await kovanlariTara()
        if (!bot || !adada || !inSkyblock || mevcutSunucu !== 'Skyblock') return

        // 2. OTOMATİK KOVAN BAL HASADI: Eğer Oto Bal açıksa %80+ olan kovanları topla ve sandığa koy
        if (AYARLAR.OTO_BAL_TOPLAMA) {
            try {
                const kovanlar = (bulunanKovanlar && bulunanKovanlar.length > 0) ? bulunanKovanlar : (bot?.kovanlar?._liste || [])
                const dolanKovanlar = kovanlar.filter(k => (k.bal?.yuzde ?? k.yuzde ?? 0) >= AYARLAR.HEDEF_DOLULUK_YUZDESI)
                if (dolanKovanlar.length > 0) {
                    console.log(`\n🍯 [OTO BAL] %${AYARLAR.HEDEF_DOLULUK_YUZDESI} doluluğu aşan ${dolanKovanlar.length} adet kovan tespit edildi! Otomatik hasat ve sandık aktarımı başlatılıyor...`)
                    await tumKovanlardanBalTopla(AYARLAR.HEDEF_DOLULUK_YUZDESI)
                } else if (bulunanKovanlar && bulunanKovanlar.length > 0) {
                    console.log(`🍯 [OTO BAL] Kovanlar kontrol edildi: Henüz %${AYARLAR.HEDEF_DOLULUK_YUZDESI} doluluğa ulaşan kovan yok.`)
                }
            } catch (e) {
                console.log(`[HATA] Otomatik kovan bal toplama hatası: ${e.message}`)
            }
        }

        // 3. MİNYON BİLGİ MODU: Minyonlar sadece otomatik taranır (Eşya toplama devre dışı)
        if (bulunanMinyonlar && bulunanMinyonlar.length > 0) {
            console.log("[MİNYONLAR] Minyon bilgileri otomatik olarak güncellendi (Bilgi alma modu aktif).\n");
        }
    } catch (hata) {
        console.log(`[HATA] Görev sırasında beklenmeyen bir hata oluştu: ${hata.message}`)
    } finally {
        islemde = false
    }
}

// ==========================================
// 4. BOT OLUŞTURMA VE SUNUCU BAĞLANTISI
// ==========================================

function createBot() {
    if (kullaniciDurdurdu) {
        console.log('[KONTROL] Bot durdurulmuş durumda, başlatılmadı.')
        return
    }

    if (yenidenBaglanTimer) {
        clearTimeout(yenidenBaglanTimer)
        yenidenBaglanTimer = null
    }
    if (isGoRetryTimeout) {
        clearTimeout(isGoRetryTimeout)
        isGoRetryTimeout = null
    }
    if (skyblockGecisTimer) {
        clearTimeout(skyblockGecisTimer)
        skyblockGecisTimer = null
    }
    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }
    if (lobiBeklemeTimer) {
        clearTimeout(lobiBeklemeTimer)
        lobiBeklemeTimer = null
    }
    if (kontrolZamanlayici) {
        clearInterval(kontrolZamanlayici)
        kontrolZamanlayici = null
    }
    if (sunucuKontrolTimer) {
        clearInterval(sunucuKontrolTimer)
        sunucuKontrolTimer = null
    }

    inLobby = false
    inSkyblock = false
    authGirisYapildi = false
    lobiyeGecildi = false
    isGoGonderildi = false
    adada = false
    islemde = false
    girisBasarili = false

    stdinBaslat()

    // Eğer önceki bir bot örneği varsa temizle
    if (bot) {
        try {
            bot.removeAllListeners()
            bot.end()
        } catch (e) { }
        bot = null
    }

    inLobby = false
    inSkyblock = false
    authGirisYapildi = false
    lobiyeGecildi = false
    isGoGonderildi = false
    adada = false
    girisBasarili = false
    mevcutSunucu = 'Bağlanıyor...'
    scoreboardBaslik = ''

    console.log(`[BAĞLANTI] ${AYARLAR.SUNUCU_IP} sunucusuna bağlanılıyor (${AYARLAR.KULLANICI_ADI})...`)
    botEvents.emit('durum', { durum: 'Bağlanıyor...', calisiyor: true, adada: false, mevcutSunucu, scoreboardBaslik })

    bot = mineflayer.createBot({
        host: AYARLAR.SUNUCU_IP,
        username: AYARLAR.KULLANICI_ADI,
        version: "1.20.1",
        hideErrors: true
    })

    // 5 Dakikalık periyodik sunucu kontrol döngüsünü başlat
    if (sunucuKontrolTimer) clearInterval(sunucuKontrolTimer)
    sunucuKontrolTimer = setInterval(sunucuDurumuPeriyodikKontrol, SUNUCU_KONTROL_ARALIGI_MS)

    // Scoreboard (Sağ Taraftaki Tablo) Dinleyicileri
    if (bot._client) {
        bot._client.on('scoreboard_objective', (packet) => {
            if (packet && packet.displayText) {
                const hamBaslik = jsonToText(packet.displayText)
                if (hamBaslik && hamBaslik.trim().length > 0) {
                    scoreboardBaslik = hamBaslik.trim()
                }
                kontrolEtScoreboard(packet.displayText)
            }
        })
    }

    bot.on('scoreboardTitleChanged', (sb) => {
        if (sb && sb.title) {
            const hamBaslik = jsonToText(sb.title)
            if (hamBaslik && hamBaslik.trim().length > 0) {
                scoreboardBaslik = hamBaslik.trim()
            }
            kontrolEtScoreboard(sb.title)
        }
    })

    bot.on('scoreboardPosition', (position, sb) => {
        if (position === '1' || position === 1 || position === 'sidebar') {
            if (sb && sb.title) {
                const hamBaslik = jsonToText(sb.title)
                if (hamBaslik && hamBaslik.trim().length > 0) {
                    scoreboardBaslik = hamBaslik.trim()
                }
                kontrolEtScoreboard(sb.title)
            }
        }
    })

    // Pathfinder eklentisini yükle
    bot.loadPlugin(pathfinder)

    // Envanter değişikliklerini arayüze anında bildirme
    function envanterDinleyicileriniBagla() {
        if (bot && bot.inventory && typeof bot.inventory.on === 'function') {
            try {
                bot.inventory.removeAllListeners('updateSlot')
                bot.inventory.on('updateSlot', () => {
                    botEvents.emit('envanter', envanterBilgisiAl())
                })
            } catch (e) { }
        }
    }

    bot.once('inject_allowed', envanterDinleyicileriniBagla)
    bot.on('windowOpen', () => {
        botEvents.emit('envanter', envanterBilgisiAl())
    })
    bot.on('windowClose', () => {
        botEvents.emit('envanter', envanterBilgisiAl())
    })
    bot.on('playerCollect', () => {
        botEvents.emit('envanter', envanterBilgisiAl())
    })

    bot.once('spawn', () => {
        console.log('[DURUM] Giriş sunucusuna bağlanıldı.')
        envanterDinleyicileriniBagla()
        botEvents.emit('envanter', envanterBilgisiAl())
        setTimeout(() => {
            if (AYARLAR.SIFRE && AYARLAR.SIFRE.trim() !== '') {
                console.log('[İŞLEM] Şifre giriliyor...')
                bot.chat(`/login ${AYARLAR.SIFRE}`)

                // Güvenlik zamanlayıcısı: 4.5 saniye içinde giriş mesajı algılanamazsa
                // veya paket kaçırılırsa şifrenin kabul edildiğini varsay ve lobiye geçişi bekle
                if (loginFallbackTimer) clearTimeout(loginFallbackTimer)
                loginFallbackTimer = setTimeout(() => {
                    if (!authGirisYapildi && !lobiyeGecildi && !inSkyblock && !adada) {
                        console.log('[BİLGİ] Giriş zamanlayıcısı devrede: Lobiye aktarılma bekleniyor...')
                        sifreGirisOnaylandi('Zamanlayıcı (Fallback)')
                    }
                }, 4500)
            } else {
                console.log('[BİLGİ] Şifre tanımlanmadığı için /login adımı atlandı.')
                lobiyeGirisYapildi('Şifresiz')
            }
        }, 1200)
    })

    bot.on('message', (message, position) => {
        const msg = message.toString().trim()
        if (!msg) return

        const temizMsg = metniTemizle(msg).toLowerCase()

        // Can, Mana, AP, Yetenek gibi saniyede bir gelen HUD / Actionbar durum çubuklarını konsola yazdırma
        const isHudMesaji = position === 'game_info' ||
            msg.includes('❤') || msg.includes('♨') || msg.includes('☕') || msg.includes('🔥') || msg.includes('⛁') || msg.includes('⚗') ||
            (temizMsg.includes('can') && (temizMsg.includes('mana') || temizMsg.includes('ap'))) ||
            (temizMsg.includes('ap') && temizMsg.includes('yetenek')) ||
            /\b\d+\/\d+\s*(?:can|mana|yetenek|ap)\b/i.test(msg) ||
            /(?:❤|⚗|🔥|⛁)/.test(msg)

        // Sadece oyuncu sohbetlerini ve HUD spamlarını filtrele, gerçek sunucu bildirimlerini göster
        const oyuncuMesaji =
            msg.includes('»') ||
            msg.includes('->') ||
            /^<[^>]+>/.test(msg.trim()) ||
            /^[\[\(]?[A-Za-z0-9_]{3,16}[\]\)]?\s*:\s+/.test(msg.trim()) ||
            msg.startsWith('[Sv.') ||
            msg.startsWith('[Lvl') ||
            msg.startsWith('[VIP') ||
            msg.startsWith('[Oyuncu') ||
            msg.startsWith('[Medya') ||
            msg.startsWith('[Rehber') ||
            msg.startsWith('[Mod') ||
            msg.startsWith('[Yönetici') ||
            msg.startsWith('[Admin') ||
            msg.startsWith('[Kurucu') ||
            temizMsg.includes('ihale') ||
            msg.includes('SİPARİŞ')

        if (oyuncuMesaji) {
            if (AYARLAR.SOHBET_MESAJLARINI_GOSTER) {
                console.log(`[SOHBET] ${msg}`)
            }
            return // Oyuncu sohbetleri kesinlikle sunucu kontrolü veya lobiye düşme tetiklemez!
        }

        if (!isHudMesaji) {
            console.log(`[SUNUCU] ${msg}`)
        }

        // 1. Şifre doğrulandı mesajı (Auth Sunucusu): Lobiye geçişi bekle, HEMEN /gir skyblock ATMA!
        if (!authGirisYapildi && !inSkyblock && girisMesajiMi(msg, temizMsg)) {
            sifreGirisOnaylandi('Mesaj: ' + msg)
        }

        // 2. Lobi karşılama / duyuru mesajları: Lobiye ulaşıldığını onayla
        if (!lobiyeGecildi && !inSkyblock && lobiMesajiMi(msg, temizMsg)) {
            lobiyeGirisYapildi('Lobi Mesajı: ' + msg)
        }

        // 3. Skyblock sunucusuna bağlanıldığını algıla ve adaya git
        if (!inSkyblock && skyblockMesajiMi(msg, temizMsg)) {
            skyblockaGecildiKontrol('Mesaj: ' + msg)
        }

        // 4. Adaya aktarılma durumu mesajı gelirse (/is go gönderildikten sonra)
        if (isGoGonderildi && !adada && (
            temizMsg.includes('adana') ||
            temizMsg.includes('adadasin') ||
            temizMsg.includes('isinlandin') ||
            temizMsg.includes('adadasiniz')
        )) {
            if (isGoRetryTimeout) clearTimeout(isGoRetryTimeout)
            console.log('[DURUM] Adaya ışınlanma mesajı alındı, ada modu başlatılıyor...')
            setTimeout(adayaUlasildi, 2000)
        }

        // 5. Bilinmeyen komut hatası algılanırsa (Örn: /minyon, /kovanlar veya /is lobide çalışmaz)
        const bilinmeyenKomut =
            temizMsg.includes('unknown or incomplete command') ||
            temizMsg.includes('minyon<--[here]') ||
            temizMsg.includes('kovanlar<--[here]') ||
            temizMsg.includes('is<--[here]') ||
            temizMsg.includes('unknown command') ||
            temizMsg.includes('bilinmeyen komut') ||
            temizMsg.includes('bu komut bulunamadi')

        if (bilinmeyenKomut && (inSkyblock || adada || mevcutSunucu === 'Skyblock')) {
            console.log(`[UYARI] Skyblock komutu bu sunucuda bulunamadı ("${msg}")! Botun lobide olduğu algılandı.`)
            lobiyeDusuldu('Bilinmeyen Komut Hatası (/minyon veya /kovanlar lobide mevcut değil)')
            return
        }

        // 5b. Lobi PvP Arenası ölüm mesajları algılanırsa (Sadece scoreboard da lobi olduğunu onaylıyorsa)
        const lobiPvpMesaji =
            temizMsg.includes('adli oyuncuyu oldurdu') ||
            temizMsg.includes('adli oyuncuyu öldürdü') ||
            temizMsg.includes('adlı oyuncuyu öldürdü') ||
            temizMsg.includes('adlı oyuncuyu oldurdu') ||
            temizMsg.includes('adli oyuncuyu katletti') ||
            temizMsg.includes('adli oyuncuyu vurdu')

        if (lobiPvpMesaji && (inSkyblock || adada)) {
            const anlikKonum = sunucuKonumunuTespitEt()
            if (anlikKonum === 'Lobide') {
                console.log(`[UYARI] Lobi PvP arenası mesajı algılandı ("${msg}")! Bot lobide bulunuyor.`)
                lobiyeDusuldu('Lobi PvP Arenası Ölüm Mesajı Algılandı')
                return
            }
        }

        // 6. Adaya aktarılamadı (unable to connect, sunucu dolu, vb.) mesajı gelirse tekrar /is go dene
        const adayaGirisBasarisiz =
            temizMsg.includes('unable to connect') ||
            temizMsg.includes('please try again later') ||
            temizMsg.includes('server is full') ||
            temizMsg.includes('sunucu dolu') ||
            temizMsg.includes('adana baglanilamadi') ||
            temizMsg.includes('sunucuya baglanilamadi') ||
            temizMsg.includes('/minyon [liste')

        if (adayaGirisBasarisiz) {
            const adaSahibi = AYARLAR.ADA_SAHIBI || 'EmsalSizOFC'
            const adaKomutu = `/is go ${adaSahibi}`
            console.log(`[UYARI] Adaya bağlanılamadı ("${msg}")! 5 saniye sonra tekrar ${adaKomutu} gönderilecek...`)
            if (isGoRetryTimeout) {
                clearTimeout(isGoRetryTimeout)
                isGoRetryTimeout = null
            }
            if (kontrolZamanlayici) {
                clearInterval(kontrolZamanlayici)
                kontrolZamanlayici = null
            }
            adada = false
            isGoGonderildi = false
            setTimeout(() => {
                if (!adada && bot) {
                    adayaGit()
                }
            }, 5000)
        }

        // 7. Sunucudan lobiye düşme / aktarılma mesajı gelirse
        const lobiyeAktarildi =
            temizMsg.includes('lobiye aktarildiniz') ||
            temizMsg.includes('lobiye aktarildin') ||
            temizMsg.includes('lobiye yonlendirildiniz') ||
            temizMsg.includes('lobiye yonlendirildin') ||
            temizMsg.includes('lobiye gonderildiniz') ||
            temizMsg.includes('lobiye gonderildin') ||
            temizMsg.includes('sunucu yeniden baslatiliyor') ||
            temizMsg.includes('sunucu kapaniyor') ||
            temizMsg.includes('kicked whilst connecting') ||
            temizMsg.includes('fallback server') ||
            temizMsg.includes('the server you were previously on went down') ||
            temizMsg.includes('lost connection to server') ||
            temizMsg.includes('server closed')

        if (lobiyeAktarildi) {
            console.log(`[UYARI] Sunucudan lobiye düşme mesajı alındı ("${msg}")! Ada modu askıya alınıyor...`)
            lobiyeDusuldu('Lobiye Düşme Mesajı: ' + msg)
            return
        }

        // 8. Skyblock giriş engeli / bakım / dolu mesajı
        const girisEngellendi =
            temizMsg.includes('bakim') ||
            temizMsg.includes('bakımda') ||
            temizMsg.includes('maintenance') ||
            temizMsg.includes('kapali') ||
            temizMsg.includes('could not connect') ||
            temizMsg.includes('baglanilamadi') ||
            temizMsg.includes('daha sonra tekrar') ||
            temizMsg.includes('bekleyiniz')

        if (girisEngellendi && !inSkyblock && !adada) {
            console.log(`[BİLGİ] Sunucu geçiş yanıtı: "${msg}". Giriş deneme döngüsü devrede, sunucu açılana kadar denenmeye devam edilecek.`)
        }
    })

    bot.on('title', (rawTitle) => {
        try {
            const metin = metniTemizle(typeof rawTitle === 'string' ? rawTitle : jsonToText(rawTitle))
            if (!authGirisYapildi && !inSkyblock && girisMesajiMi(metin)) {
                sifreGirisOnaylandi('Title: ' + metin)
            }
            if (!lobiyeGecildi && !inSkyblock && lobiMesajiMi(metin)) {
                lobiyeGirisYapildi('Title: ' + metin)
            }
        } catch (e) { }
    })

    bot.on('respawn', () => {
        envanterDinleyicileriniBagla()

        // Durum 1: Şifre girilmişti, sunucu bizi Lobiye aktardı
        if (authGirisYapildi && !lobiyeGecildi && !inSkyblock) {
            console.log('[DURUM] BungeeCord sunucu aktarımı algılandı (Giriş -> Lobi).')
            lobiyeGirisYapildi('Respawn (Lobi Sunucusu)')
            return
        }

        // Durum 2: Lobideydik ve /gir skyblock gönderdik, sunucu bizi Skyblock'a aktardı
        if (lobiyeGecildi && !inSkyblock) {
            console.log('[DURUM] BungeeCord sunucu aktarımı algılandı (Lobi -> Skyblock). Sunucu kontrol ediliyor...')
            setTimeout(() => {
                if (!inSkyblock && bot) {
                    const konum = sunucuKonumunuTespitEt()
                    if (konum === 'Skyblock') {
                        skyblockaGecildiKontrol('Respawn (Skyblock Sunucusu)')
                    }
                }
            }, 1500)
            return
        }

        // Durum 3: Skyblock'taydık ve /is go gönderdik -> Ada dünyasına geçiş
        if (girisBasarili && inSkyblock && isGoGonderildi && !adada) {
            console.log('[DURUM] Ada dünyasına geçiş algılandı (Respawn/BungeeCord). Ada modu başlatılıyor...')
            if (isGoRetryTimeout) {
                clearTimeout(isGoRetryTimeout)
                isGoRetryTimeout = null
            }
            setTimeout(adayaUlasildi, 2500)
            return
        }

        // Durum 4: Bot Skyblock'taydı veya adadaydı fakat sunucu respawn paketi yolladı (BungeeCord lobiye aktarmış veya bot ölmüş olabilir)
        if (inSkyblock || adada) {
            console.log('[DURUM] Bot Skyblock veya adadayken Respawn algılandı! Konum kontrol ediliyor...')
            adada = false
            isGoGonderildi = false
            if (isGoRetryTimeout) {
                clearTimeout(isGoRetryTimeout)
                isGoRetryTimeout = null
            }
            if (kontrolZamanlayici) {
                clearInterval(kontrolZamanlayici)
                kontrolZamanlayici = null
            }
            if (bot.pathfinder) {
                try { bot.pathfinder.stop() } catch (e) { }
            }

            setTimeout(() => {
                if (!bot || kullaniciDurdurdu) return
                const konum = sunucuKonumunuTespitEt()
                console.log(`[DURUM] Respawn sonrası sunucu tespiti: ${konum}`)
                if (konum === 'Lobide') {
                    lobiyeDusuldu('Respawn Sonrası Lobi Tespiti')
                } else if (konum === 'Skyblock') {
                    console.log('[BİLGİ] Hala Skyblock sunucusundayız, adaya geri gidiliyor (/is go)...')
                    inSkyblock = true
                    adayaGit()
                } else {
                    lobiyeDusuldu('Respawn Sonrası Bilinmeyen Konum Tespiti')
                }
            }, 1500)
            return
        }
    })

    bot.on('kicked', (reason) => {
        ardisikAtilmaSayisi++
        console.log('[ATILDI]:', reason)
        const reasonStr = typeof reason === 'object' ? JSON.stringify(reason) : String(reason)
        const lowerReason = reasonStr.toLowerCase()

        // Kalıcı/Kritik atılma nedenleri (Şifre hatası, ban, bakım, whitelist)
        const kritikNedenler = ['sifre', 'şifre', 'password', 'ban', 'yasak', 'whitelist', 'bakim', 'kayit', 'register']
        const isKritik = kritikNedenler.some(k => lowerReason.includes(k))

        if (isKritik || ardisikAtilmaSayisi >= 5) {
            kullaniciDurdurdu = true // Otomatik yeniden bağlanmayı engelle
            console.log(`[UYARI] Kritik atılma nedeni algılandı veya ardışık 5 kez atıldı. Tekrar bağlanma durduruldu: ${reasonStr}`)
            botEvents.emit('durum', { durum: 'Sunucudan Atıldı (Durduruldu)', detay: reasonStr, calisiyor: false })
        } else {
            botEvents.emit('durum', { durum: 'Sunucudan Atıldı', detay: reasonStr, calisiyor: true })
        }
    })

    bot.on('error', (err) => {
        console.error('[HATA]:', err)
        botEvents.emit('durum', { durum: 'Hata Oluştu', detay: err.message })
    })

    bot.on('end', (reason) => {
        if (isGoRetryTimeout) {
            clearTimeout(isGoRetryTimeout)
            isGoRetryTimeout = null
        }
        if (skyblockGecisTimer) {
            clearTimeout(skyblockGecisTimer)
            skyblockGecisTimer = null
        }
        if (loginFallbackTimer) {
            clearTimeout(loginFallbackTimer)
            loginFallbackTimer = null
        }
        if (lobiBeklemeTimer) {
            clearTimeout(lobiBeklemeTimer)
            lobiBeklemeTimer = null
        }
        if (kontrolZamanlayici) {
            clearInterval(kontrolZamanlayici)
            kontrolZamanlayici = null
        }
        if (sunucuKontrolTimer) {
            clearInterval(sunucuKontrolTimer)
            sunucuKontrolTimer = null
        }
        adada = false
        islemde = false
        girisBasarili = false
        authGirisYapildi = false
        lobiyeGecildi = false
        inSkyblock = false
        inLobby = false
        isGoGonderildi = false

        if (kullaniciDurdurdu) {
            bot = null
            console.log('[BİLGİ] Bot bağlantısı kapatıldı (Durduruldu).')
            botEvents.emit('durum', { durum: 'Durduruldu', adada: false, calisiyor: false })
            return
        }

        const beklemeSuresi = 5000 + Math.floor(Math.random() * 3000)
        console.log(`[BİLGİ] Bağlantı koptu, ${(beklemeSuresi / 1000).toFixed(1)} saniye sonra yeniden bağlanılıyor...`)
        botEvents.emit('durum', { durum: 'Bağlantı Koptu', adada: false, calisiyor: true })
        yenidenBaglanTimer = setTimeout(createBot, beklemeSuresi)
    })
}

// Bot Başlat & Durdur Metotları
function botBaslat() {
    if (bot && !kullaniciDurdurdu) {
        console.log('[UYARI] Bot zaten çalışıyor.')
        return { basarili: false, mesaj: 'Bot zaten çalışıyor.' }
    }
    kullaniciDurdurdu = false
    console.log('[KONTROL] Bot kullanıcı tarafından başlatılıyor...')
    botEvents.emit('durum', { durum: 'Başlatılıyor...', calisiyor: true, adada: false })
    createBot()
    return { basarili: true, mesaj: 'Bot başlatıldı.' }
}

function botDurdur() {
    kullaniciDurdurdu = true

    if (yenidenBaglanTimer) {
        clearTimeout(yenidenBaglanTimer)
        yenidenBaglanTimer = null
    }
    if (isGoRetryTimeout) {
        clearTimeout(isGoRetryTimeout)
        isGoRetryTimeout = null
    }
    if (skyblockGecisTimer) {
        clearTimeout(skyblockGecisTimer)
        skyblockGecisTimer = null
    }
    if (loginFallbackTimer) {
        clearTimeout(loginFallbackTimer)
        loginFallbackTimer = null
    }
    if (lobiBeklemeTimer) {
        clearTimeout(lobiBeklemeTimer)
        lobiBeklemeTimer = null
    }
    if (kontrolZamanlayici) {
        clearInterval(kontrolZamanlayici)
        kontrolZamanlayici = null
    }
    if (sunucuKontrolTimer) {
        clearInterval(sunucuKontrolTimer)
        sunucuKontrolTimer = null
    }

    inLobby = false
    inSkyblock = false
    authGirisYapildi = false
    lobiyeGecildi = false
    isGoGonderildi = false
    adada = false
    islemde = false
    girisBasarili = false
    mevcutSunucu = 'Durduruldu'
    scoreboardBaslik = ''

    if (bot) {
        try {
            if (bot.pathfinder) {
                bot.pathfinder.stop()
            }
        } catch (e) { }
        try {
            console.log('[KONTROL] Bot bağlantısı sonlandırılıyor...')
            bot.quit('Kullanıcı botu durdurdu')
        } catch (e) {
            try {
                bot.end()
            } catch (e2) { }
        }
        bot = null
    }

    console.log('[KONTROL] Bot durduruldu.')
    botEvents.emit('sunucuGuncellendi', { mevcutSunucu, scoreboardBaslik })
    botEvents.emit('durum', { durum: 'Durduruldu', adada: false, calisiyor: false, mevcutSunucu, scoreboardBaslik })
    return { basarili: true, mesaj: 'Bot durduruldu.' }
}

// Tekil Minyon Toplama Fonksiyonu
async function tekilMinyonTopla(minyonIsmi) {
    if (!bot || !adada) {
        return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı.' }
    }
    if (islemde) {
        return { basarili: false, mesaj: 'Bot şu an başka bir işlem yapıyor.' }
    }

    const minyonlar = bot.minyonlar || {}
    let hedefMinyon = null
    const aranan = String(minyonIsmi || '').toLowerCase()

    for (const k of Object.keys(minyonlar)) {
        if (k.startsWith('_')) continue
        const m = minyonlar[k]
        if (m.isim && (m.isim.toLowerCase().includes(aranan) || aranan.includes(m.isim.toLowerCase()))) {
            hedefMinyon = m
            break
        }
    }

    if (!hedefMinyon) {
        return { basarili: false, mesaj: `'${minyonIsmi}' adlı minyon bulunamadı.` }
    }

    islemde = true
    try {
        console.log(`[KONTROL] Tekil toplama başlatıldı: ${hedefMinyon.isim}`)
        await tasmaKorumasiKontrolVeBosalt(`Tekil Minyon (${hedefMinyon.isim})`)
        const sonuc = await minyondanEsyalariTopla(hedefMinyon)
        if (sonuc) {
            await sandigaEsyalariKoy()
            if (afkKonumu) {
                try {
                    await bot.pathfinder.goto(new goals.GoalNear(afkKonumu.x, afkKonumu.y, afkKonumu.z, 1))
                } catch (e) { }
            }
            return { basarili: true, mesaj: `${hedefMinyon.isim} başarıyla toplandı!` }
        }
        return { basarili: false, mesaj: 'Eşyalar toplanamadı.' }
    } catch (e) {
        return { basarili: false, mesaj: e.message }
    } finally {
        islemde = false
    }
}

// ==========================================
// 5. ELECTRON VE DIŞ KONTROL FONKSİYONLARI
// ==========================================
function durumAl() {
    let minyonlar = bot?.minyonlar || {}
    if (Object.keys(minyonlar).length === 0 && fs.existsSync(AYARLAR.JSON_DOSYA_YOLU)) {
        try {
            const dosya = JSON.parse(fs.readFileSync(AYARLAR.JSON_DOSYA_YOLU, 'utf8'))
            if (dosya && dosya.minyonlar) minyonlar = dosya.minyonlar
        } catch (e) { }
    }
    let kovanlar = bot?.kovanlar || {}
    if (Object.keys(kovanlar).length === 0 && fs.existsSync(AYARLAR.KOVAN_JSON_DOSYA_YOLU)) {
        try {
            const dosya = JSON.parse(fs.readFileSync(AYARLAR.KOVAN_JSON_DOSYA_YOLU, 'utf8'))
            if (dosya && dosya.kovanlar) kovanlar = dosya.kovanlar
        } catch (e) { }
    }
    // Güvenli konum kontrolü: Eğer bot adada ise sunucu kesinlikle Skyblock'tur
    if (adada) {
        mevcutSunucu = 'Skyblock'
    } else if (inSkyblock && mevcutSunucu !== 'Skyblock') {
        mevcutSunucu = 'Skyblock'
    }
    const calisiyor = Boolean(bot && !kullaniciDurdurdu)
    let durumMetni = 'Durduruldu'
    if (calisiyor) {
        if (adada) {
            durumMetni = islemde ? 'İşlem Yapıyor' : 'Adada (Hazır)'
        } else if (mevcutSunucu === 'Lobide') {
            durumMetni = 'Lobide'
        } else if (mevcutSunucu === 'Skyblock') {
            durumMetni = 'Skyblock (Bağlandı)'
        } else {
            durumMetni = 'Bağlanıyor...'
        }
    }
    return {
        botAdi: AYARLAR.KULLANICI_ADI,
        sunucu: AYARLAR.SUNUCU_IP,
        mevcutSunucu: mevcutSunucu,
        scoreboardBaslik: scoreboardBaslik,
        testModu: AYARLAR.SADECE_BILGI_MODU,
        hedefYuzde: AYARLAR.HEDEF_DOLULUK_YUZDESI,
        kontrolAraligi: AYARLAR.KONTROL_ARALIGI_SANIYE,
        sandikKonumu: AYARLAR.SANDIK_KONUMU,
        minyonlar: minyonlar,
        kovanlar: kovanlar,
        envanter: envanterBilgisiAl(),
        hasat: tracker ? tracker.getAnalitik() : null,
        islemde: islemde,
        calisiyor: calisiyor,
        adada: Boolean(adada),
        durum: durumMetni
    }
}

const botKontrol = {
    createBot,
    baslat: botBaslat,
    durdur: botDurdur,
    tekilTopla: tekilMinyonTopla,
    botEvents,
    AYARLAR,
    getBot: () => bot,
    profilYukle: (profil, sifre) => {
        if (!profil) return false
        if (profil.server) AYARLAR.SUNUCU_IP = profil.server
        if (profil.username) AYARLAR.KULLANICI_ADI = profil.username
        if (sifre) AYARLAR.SIFRE = sifre
        if (profil.islandOwner !== undefined) AYARLAR.ADA_SAHIBI = profil.islandOwner
        if (profil.settings) {
            if (profil.settings.testMode !== undefined) AYARLAR.SADECE_BILGI_MODU = Boolean(profil.settings.testMode)
            if (profil.settings.showChatMessages !== undefined) AYARLAR.SOHBET_MESAJLARINI_GOSTER = Boolean(profil.settings.showChatMessages)
            if (profil.settings.targetPercentage !== undefined) AYARLAR.HEDEF_DOLULUK_YUZDESI = Number(profil.settings.targetPercentage)
            if (profil.settings.checkInterval !== undefined) AYARLAR.KONTROL_ARALIGI_SANIYE = Number(profil.settings.checkInterval)
            if (profil.settings.autoHoneyHarvest !== undefined) AYARLAR.OTO_BAL_TOPLAMA = Boolean(profil.settings.autoHoneyHarvest)
            if (profil.settings.chestLocation) AYARLAR.SANDIK_KONUMU = profil.settings.chestLocation
        }
        if (appPaths) {
            AYARLAR.JSON_DOSYA_YOLU = appPaths.getMinyonlarJsonPath(profil.id)
            AYARLAR.KOVAN_JSON_DOSYA_YOLU = appPaths.getKovanlarJsonPath(profil.id)
        }
        if (harvestTracker && harvestTracker.getTracker) {
            tracker = harvestTracker.getTracker(profil.id)
        }
        botEvents.emit('ayarGuncellendi', AYARLAR)
        return true
    },
    tara: async () => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        console.log('[KONTROL] Minyonları tara isteği alındı...')
        return await otomatikMinyonGorevi()
    },
    kovanTara: async () => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        islemde = true
        try {
            console.log('[KONTROL] Kovanları tara isteği alındı...')
            const sonuc = await kovanlariTara()
            return { basarili: true, kovanlar: sonuc }
        } catch (err) {
            console.log(`[HATA] Kovan tarama hatası: ${err.message}`)
            return { basarili: false, mesaj: err.message }
        } finally {
            islemde = false
        }
    },
    otoBalDurumAl: () => {
        return AYARLAR.OTO_BAL_TOPLAMA
    },
    otoBalAyarla: (durum) => {
        AYARLAR.OTO_BAL_TOPLAMA = Boolean(durum)
        console.log(`[AYAR] Otomatik bal toplama: ${AYARLAR.OTO_BAL_TOPLAMA ? 'AÇIK (%' + AYARLAR.HEDEF_DOLULUK_YUZDESI + '+ dolunca toplanır)' : 'KAPALI'}`)
        botEvents.emit('oto-bal-guncelle', AYARLAR.OTO_BAL_TOPLAMA)
        return { basarili: true, otoBal: AYARLAR.OTO_BAL_TOPLAMA }
    },
    kovanBalTest: async () => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        islemde = true
        try {
            return await tumKovanlariHasatEtVeSandigaKoy()
        } catch (err) {
            console.log(`[HATA] Kovan bal testi hatası: ${err.message}`)
            return { basarili: false, mesaj: err.message }
        } finally {
            islemde = false
        }
    },
    kovanBalTopla: async (hedefYuzde) => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        islemde = true
        try {
            return await tumKovanlardanBalTopla(hedefYuzde || AYARLAR.HEDEF_DOLULUK_YUZDESI)
        } catch (err) {
            console.log(`[HATA] Kovan bal toplama hatası: ${err.message}`)
            return { basarili: false, mesaj: err.message }
        } finally {
            islemde = false
        }
    },
    tekilKovanHasat: async (kovanId) => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        islemde = true
        try {
            await tasmaKorumasiKontrolVeBosalt('Tekil Kovan Hasadı')
            return await kovandanBalHasatEt(kovanId)
        } catch (err) {
            console.log(`[HATA] Tekil kovan hasat hatası: ${err.message}`)
            return { basarili: false, mesaj: err.message }
        } finally {
            islemde = false
        }
    },
    envanterAl: () => {
        return envanterBilgisiAl()
    },
    envanterBosalt: async () => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul! Lütfen mevcut işlemin bitmesini bekleyin.' }
        }
        islemde = true
        try {
            console.log('\n[İŞLEM] Envanteri boşalt (sandığa aktarım) başlatılıyor...')
            const sonuc = await sandigaEsyalariKoy()
            if (afkKonumu) {
                try {
                    await bot.pathfinder.goto(new goals.GoalNear(afkKonumu.x, afkKonumu.y, afkKonumu.z, 1))
                } catch (e) { }
            }
            botEvents.emit('envanter', envanterBilgisiAl())
            if (sonuc) {
                console.log('[BAŞARILI] Envanterdeki eşyalar başarıyla sandığa aktarıldı.')
                return { basarili: true, mesaj: 'Envanter başarıyla sandığa boşaltıldı!' }
            } else {
                return { basarili: false, mesaj: 'Sandığa aktarım yapılamadı! (Sandık bulunamadı veya ulaşılamadı)' }
            }
        } catch (err) {
            console.log(`[HATA] Envanter boşaltma hatası: ${err.message}`)
            return { basarili: false, mesaj: `Hata: ${err.message}` }
        } finally {
            islemde = false
        }
    },
    topla: async () => {
        if (!bot || !adada) {
            console.log('[UYARI] Bot adada değil veya henüz başlatılmadı!')
            return { basarili: false, mesaj: 'Bot adada değil veya henüz başlatılmadı!' }
        }
        if (islemde) {
            console.log('[UYARI] Bot şu anda başka bir işlem yapıyor, lütfen bekleyin.')
            return { basarili: false, mesaj: 'Bot şu anda meşgul!' }
        }
        console.log('[KONTROL] Tümünü topla isteği alındı...')
        const eskiMod = AYARLAR.SADECE_BILGI_MODU
        AYARLAR.SADECE_BILGI_MODU = false
        const sonuc = await otomatikMinyonGorevi()
        AYARLAR.SADECE_BILGI_MODU = eskiMod
        return sonuc
    },
    sandikAyarla: () => {
        if (!bot || !bot.entity) {
            console.log('[UYARI] Bot oyunda değil, sandık aranamaz.')
            return { basarili: false, mesaj: 'Bot henüz oyunda değil.' }
        }
        const sandikIds = [
            bot.registry.blocksByName.chest?.id,
            bot.registry.blocksByName.trapped_chest?.id,
            bot.registry.blocksByName.barrel?.id
        ].filter(Boolean)

        const yakinSandik = bot.findBlock({
            matching: sandikIds,
            maxDistance: 12
        })
        if (yakinSandik) {
            AYARLAR.SANDIK_KONUMU = {
                x: Math.round(yakinSandik.position.x),
                y: Math.round(yakinSandik.position.y),
                z: Math.round(yakinSandik.position.z)
            }
            console.log(`[AYAR] Hedef sandık kaydedildi: X:${AYARLAR.SANDIK_KONUMU.x}, Y:${AYARLAR.SANDIK_KONUMU.y}, Z:${AYARLAR.SANDIK_KONUMU.z}`)
            botEvents.emit('sandikGuncellendi', AYARLAR.SANDIK_KONUMU)
            return { basarili: true, konum: AYARLAR.SANDIK_KONUMU }
        } else {
            console.log('[UYARI] 12 blok yakınında sandık veya varil bulunamadı!')
            return { basarili: false, mesaj: '12 blok yakınında sandık bulunamadı!' }
        }
    },
    testModuDegistir: (yeniDurum) => {
        AYARLAR.SADECE_BILGI_MODU = Boolean(yeniDurum)
        console.log(`[AYAR] Test/Bilgi Modu: ${AYARLAR.SADECE_BILGI_MODU ? 'AÇIK (Sadece Bilgi Alma)' : 'KAPALI (Toplama Aktif)'}`)
        botEvents.emit('ayarGuncellendi', AYARLAR)
        return AYARLAR.SADECE_BILGI_MODU
    },
    hedefDolulukDegistir: (yeniYuzde) => {
        const sayi = Number(yeniYuzde)
        if (!isNaN(sayi) && sayi >= 1 && sayi <= 100) {
            AYARLAR.HEDEF_DOLULUK_YUZDESI = sayi
            console.log(`[AYAR] Hedef doluluk yüzdesi güncellendi: %${AYARLAR.HEDEF_DOLULUK_YUZDESI}`)
            botEvents.emit('ayarGuncellendi', AYARLAR)
            return AYARLAR.HEDEF_DOLULUK_YUZDESI
        }
        return AYARLAR.HEDEF_DOLULUK_YUZDESI
    },
    durumAl: durumAl,
    sunucuKontrolEt: sunucuDurumuPeriyodikKontrol,
    sunucuKonumunuTespitEt: sunucuKonumunuTespitEt,
    hasatAnalitigiAl: () => tracker ? tracker.getAnalitik() : null,
    hasatAnalitigiSifirla: (sadeceOturum = true) => {
        if (tracker) {
            tracker.sifirla(sadeceOturum)
            try {
                botEvents.emit('hasatGuncellendi', tracker.getAnalitik())
            } catch (e) { }
            return tracker.getAnalitik()
        }
        return null
    },
    mesajGonder: (mesaj) => {
        if (!bot || !bot.entity) {
            console.log('[UYARI] Bot oyunda değil, mesaj gönderilemedi.')
            return { basarili: false, mesaj: 'Bot henüz oyunda değil.' }
        }
        if (!mesaj || typeof mesaj !== 'string' || !mesaj.trim()) {
            return { basarili: false, mesaj: 'Boş mesaj gönderilemez.' }
        }
        const temizMesaj = mesaj.trim()
        try {
            bot.chat(temizMesaj)
            console.log(`[MESAJ] ${temizMesaj}`)
            return { basarili: true, gonderilen: temizMesaj }
        } catch (err) {
            console.error('[HATA] Mesaj gönderilirken hata oluştu:', err.message)
            return { basarili: false, mesaj: err.message }
        }
    },
    cantaDoluMu: (minBosSlot) => cantaDoluMu(minBosSlot),
    tasmaKorumasiKontrolVeBosalt: (kaynak) => tasmaKorumasiKontrolVeBosalt(kaynak)
}

    botKontrol.profileId = profileId
    botKontrol.profile = initialProfile
    return botKontrol
}

// Varsayılan bot örneği (geriye dönük tam uyumluluk)
const defaultInstance = createBotInstance()

const botKontrol = {
    createBotInstance,
    ...defaultInstance,
    botEvents: defaultInstance.botEvents
}

if (require.main === module) {
    defaultInstance.baslat()
}

module.exports = botKontrol
