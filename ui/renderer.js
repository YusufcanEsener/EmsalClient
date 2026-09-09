// ===================================================
// EMSALCLIENT - PROFESSIONAL RENDERER LOGIC v2
// ===================================================

let guncelMinyonlar = {}
let guncelKovanlar = {}
let aktifTab = 'minyonlar'
let otoKaydirAktif = true
let aktifTerminalFiltre = 'all'
let sessionToplamToplanan = 0
const panelBaslangic = Date.now()

// DOM Elemanları (Mevcut ID'ler korunarak bağlandı)
const elBtnBotBaslat = document.getElementById('btnBotBaslat')
const elBtnBotDurdur = document.getElementById('btnBotDurdur')
const elBtnDisconnectDurdur = document.getElementById('btnDisconnectDurdur')
const elBtnTara = document.getElementById('btnTara')
const elBtnKovanTara = document.getElementById('btnKovanTara')
const elBtnToggleOtoBal = document.getElementById('btnToggleOtoBal')
const elBtnKovanTopla = document.getElementById('btnKovanTopla')
const elBtnTopla = document.getElementById('btnTopla')
const elBtnSandik = document.getElementById('btnSandik')
const elBtnEmptyTara = document.getElementById('btnEmptyTara')
const elBtnEmptyKovanTara = document.getElementById('btnEmptyKovanTara')
const elChkTestModu = document.getElementById('chkTestModu')
const elNumHedefYuzde = document.getElementById('numHedefYuzde')

const elBotDurumText = document.getElementById('botDurumText')
const elBotStatusDot = document.getElementById('botStatusDot')
const elConnectionDot = document.getElementById('connectionDot')
const elToplamMinyon = document.getElementById('toplamMinyonSayisi')
const elToplamKovan = document.getElementById('toplamKovanSayisi')
const elDoluMinyon = document.getElementById('doluMinyonSayisi')
const elEnvanterDolulukText = document.getElementById('envanterDolulukText')
const elSandikKonum = document.getElementById('sandikKonumText')
const elServerInfo = document.getElementById('serverInfo')
const elBotUsername = document.getElementById('botUsername')

const elCurrentServerPill = document.getElementById('currentServerPill')
const elCurrentServerVal = document.getElementById('currentServerVal')
const elCurrentServerDot = document.getElementById('currentServerDot')

const elMinyonlarGrid = document.getElementById('minyonlarGrid')
const elKovanlarGrid = document.getElementById('kovanlarGrid')
const elEnvanterGrid = document.getElementById('envanterGrid')
const elMinyonBadge = document.getElementById('minyonBadge')
const elKovanBadge = document.getElementById('kovanBadge')
const elEnvanterBadge = document.getElementById('envanterBadge')
const elTabMinyonlar = document.getElementById('tabMinyonlar')
const elTabKovanlar = document.getElementById('tabKovanlar')
const elTabEnvanter = document.getElementById('tabEnvanter')

// Canlı Envanter Bileşenleri
const elMcMainInventoryGrid = document.getElementById('mcMainInventoryGrid')
const elMcHotbarInventoryGrid = document.getElementById('mcHotbarInventoryGrid')
const elInvItemsList = document.getElementById('invItemsList')
const elInvEmptyMsg = document.getElementById('invEmptyMsg')
const elInvMainSlotsBadge = document.getElementById('invMainSlotsBadge')
const elInvHotbarSlotsBadge = document.getElementById('invHotbarSlotsBadge')
const elInvTotalCountBadge = document.getElementById('invTotalCountBadge')
let guncelEnvanter = null

const elSonGuncelleme = document.getElementById('sonGuncellemeText')
const elTerminalLog = document.getElementById('terminalLog')
const elChkAutoScroll = document.getElementById('chkAutoScroll')
const elBtnTemizle = document.getElementById('btnTerminalTemizle')

const elSelectSirala = document.getElementById('selectSirala')
const elToplamToplanan = document.getElementById('toplamToplanan')
const elOrtDoluluk = document.getElementById('ortDoluluk')
const elUptimeText = document.getElementById('uptimeText')
const elDisconnectOverlay = document.getElementById('disconnectOverlay')
const elToastContainer = document.getElementById('toastContainer')

// Modal Elemanları
const elModal = document.getElementById('jsonModal')
const elBtnJsonAc = document.getElementById('btnJsonAc')
const elBtnJsonKapat = document.getElementById('btnJsonKapat')
const elBtnJsonKopyala = document.getElementById('btnJsonKopyala')
const elTxtKopyala = document.getElementById('txtKopyala')
const elJsonCode = document.getElementById('jsonGoruntuleyici')
const elModalTabMinyon = document.getElementById('btnModalTabMinyon')
const elModalTabKovan = document.getElementById('btnModalTabKovan')
let aktifModalJsonTab = 'minyonlar'

// Window Controls
const elBtnMinimize = document.getElementById('btnMinimize')
const elBtnMaximize = document.getElementById('btnMaximize')
const elBtnClose = document.getElementById('btnClose')
const elIconMaximize = document.getElementById('iconMaximize')

function setMaximizeButtonVisual(isMax) {
    if (!elIconMaximize) return
    if (isMax) {
        elIconMaximize.innerHTML = '<rect x="6" y="6" width="14" height="14" rx="2"></rect><path d="M4 14V4h10"></path>'
        if (elBtnMaximize) elBtnMaximize.title = 'Önceki Boyuta Dön'
    } else {
        elIconMaximize.innerHTML = '<rect x="3" y="3" width="18" height="18" rx="2"></rect>'
        if (elBtnMaximize) elBtnMaximize.title = 'Büyüt / Tam Ekran'
    }
}

window.minimizeApp = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (window.api?.app?.minimize) window.api.app.minimize()
    else if (window.electronAPI?.windowMinimize) window.electronAPI.windowMinimize()
}

window.maximizeApp = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (window.api?.app?.maximize) window.api.app.maximize()
    else if (window.electronAPI?.windowMaximize) window.electronAPI.windowMaximize()
}

window.closeApp = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (window.api?.app?.close) window.api.app.close()
    else if (window.electronAPI?.windowClose) window.electronAPI.windowClose()
}

if (elBtnMinimize) {
    elBtnMinimize.onclick = window.minimizeApp
    elBtnMinimize.addEventListener('click', window.minimizeApp)
}

if (elBtnMaximize) {
    elBtnMaximize.onclick = window.maximizeApp
    elBtnMaximize.addEventListener('click', window.maximizeApp)
}

if (elBtnClose) {
    elBtnClose.onclick = window.closeApp
    elBtnClose.addEventListener('click', window.closeApp)
}

// Başlık çubuğuna çift tıklayarak tam ekran / önceki boyut geçişi
const elAppTopbar = document.querySelector('.app-topbar')
if (elAppTopbar) {
    elAppTopbar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.window-controls') || e.target.closest('button') || e.target.closest('input')) return
        window.maximizeApp(e)
    })
}

if (window.api?.app?.onWindowState) {
    window.api.app.onWindowState((state) => {
        if (state && typeof state.isMaximized === 'boolean') {
            setMaximizeButtonVisual(state.isMaximized)
        }
    })
}

if (window.api?.app?.isMaximized) {
    window.api.app.isMaximized().then(isMax => setMaximizeButtonVisual(isMax)).catch(() => {})
}

// ===================================================
// LUCIDE ICONS HELPER (INLINE SVG - DIFFERENTIATED)
// ===================================================
const ICONS = {
    // Oduncu - Balta (farklı SVG)
    axe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9"></path><path d="M15 13 9 7l4-4 6 6h3l-3 3v3l-4 4Z"></path></svg>`,
    // Madenci - Kazma (farklı SVG)
    pickaxe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912"></path><path d="M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393"></path><path d="M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4Z"></path></svg>`,
    // Çiftçi - Yaprak
    farm: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 1 8-1 1.8-4 3.5-6.7 4-.6.1-1.2.6-1.3 1.2V20h0Z"></path><path d="M10.2 13.6a7 7 0 0 0-6.6 4.4"></path></svg>`,
    // Balıkçı - Balık
    fish: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6-3.56 0-7.56-2.54-8.5-6Z"></path><path d="M18 12v.5"></path><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"></path><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5 .23 6.5C5.58 18.03 7 16 7 13.33"></path></svg>`,
    // Varsayılan - Bot
    bot: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="6" rx="2"></rect><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M12 2v4"></path></svg>`,
    // Utility Icons
    package: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><path d="m3.3 7 8.7 5 8.7-5"></path><path d="M12 22V12"></path></svg>`,
    mapPin: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    clock: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    sliders: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="4" y1="21" y2="14"></line><line x1="4" x2="4" y1="10" y2="3"></line><line x1="12" x2="12" y1="21" y2="12"></line><line x1="12" x2="12" y1="8" y2="3"></line><line x1="20" x2="20" y1="21" y2="16"></line><line x1="20" x2="20" y1="12" y2="3"></line><line x1="2" x2="6" y1="14" y2="14"></line><line x1="10" x2="14" y1="8" y2="8"></line><line x1="18" x2="22" y1="16" y2="16"></line></svg>`,
    collect: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`,
    bee: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    flower: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 2a3 3 0 0 0-3 3 3 3 0 0 0 6 0 3 3 0 0 0-3-3z"></path><path d="M12 16a3 3 0 0 0-3 3 3 3 0 0 0 6 0 3 3 0 0 0-3-3z"></path><path d="M2 12a3 3 0 0 0 3-3 3 3 0 0 0 0 6 3 3 0 0 0-3-3z"></path><path d="M16 12a3 3 0 0 0 3-3 3 3 0 0 0 0 6 3 3 0 0 0-3-3z"></path></svg>`
}

function getMinionIcon(name = '') {
    const n = name.toLowerCase()
    if (n.includes('oduncu') || n.includes('wood') || n.includes('tree') || n.includes('lumber'))
        return { svg: ICONS.axe, cls: 'avatar-wood' }
    if (n.includes('maden') || n.includes('miner') || n.includes('iron') || n.includes('gold') || n.includes('komur') || n.includes('coal') || n.includes('diamond'))
        return { svg: ICONS.pickaxe, cls: 'avatar-mine' }
    if (n.includes('çiftçi') || n.includes('farm') || n.includes('wheat') || n.includes('buğday') || n.includes('cactus') || n.includes('melon'))
        return { svg: ICONS.farm, cls: 'avatar-farm' }
    if (n.includes('balık') || n.includes('fish'))
        return { svg: ICONS.fish, cls: 'avatar-fish' }
    return { svg: ICONS.bot, cls: 'avatar-default' }
}

// ===================================================
// TOAST NOTIFICATION SYSTEM
// ===================================================
const TOAST_ICONS = {
    success: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
    warning: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>`,
    error: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" x2="9" y1="9" y2="15"></line><line x1="9" x2="15" y1="9" y2="15"></line></svg>`,
    info: `<svg class="toast-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>`
}

function showToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div')
    toast.className = `toast-item toast-${type}`
    toast.innerHTML = `${TOAST_ICONS[type] || TOAST_ICONS.info}<span>${message}</span>`
    elToastContainer.appendChild(toast)

    setTimeout(() => {
        toast.classList.add('toast-removing')
        toast.addEventListener('animationend', () => toast.remove())
    }, duration)
}

// ===================================================
// WINDOW CONTROLS (CUSTOM TITLE BAR)
// ===================================================
elBtnMinimize.addEventListener('click', () => window.electronAPI.windowMinimize())
elBtnMaximize.addEventListener('click', () => window.electronAPI.windowMaximize())
elBtnClose.addEventListener('click', () => window.electronAPI.windowClose())

// ===================================================
// 1. BUTON VE GİRDİ ETKİLEŞİMLERİ
// ===================================================

// Botu Başlat
if (elBtnBotBaslat) {
    elBtnBotBaslat.addEventListener('click', async () => {
        elBtnBotBaslat.disabled = true
        const originalHTML = elBtnBotBaslat.innerHTML
        elBtnBotBaslat.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Başlatılıyor...</span>`

        try {
            const sonuc = await window.electronAPI.botBaslat()
            if (sonuc && sonuc.basarili) {
                showToast('Bot başlatılıyor, sunucuya bağlanıyor...', 'info')
                elBotDurumText.textContent = 'Bağlanıyor...'
                elBotStatusDot.className = 'metric-dot dot-yellow'
                if (elBtnBotDurdur) elBtnBotDurdur.disabled = false
            } else {
                showToast(sonuc?.mesaj || 'Bot başlatılamadı!', 'warning')
                elBtnBotBaslat.disabled = false
                elBtnBotBaslat.innerHTML = originalHTML
            }
        } catch (err) {
            console.error('Başlatma hatası:', err)
            showToast('Bot başlatma hatası: ' + err.message, 'error')
            elBtnBotBaslat.disabled = false
            elBtnBotBaslat.innerHTML = originalHTML
        }
    })
}

// Botu Durdur
async function botuDurdur() {
    if (elBtnBotDurdur) elBtnBotDurdur.disabled = true
    const originalHTML = elBtnBotDurdur ? elBtnBotDurdur.innerHTML : ''
    if (elBtnBotDurdur) {
        elBtnBotDurdur.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Durduruluyor...</span>`
    }

    try {
        await window.electronAPI.botDurdur()
        showToast('Bot durduruldu.', 'warning')
        elDisconnectOverlay.classList.remove('active')
        elBotDurumText.textContent = 'Durduruldu'
        elBotStatusDot.className = 'metric-dot dot-gray'
        elConnectionDot.className = 'status-indicator'
        if (elBtnBotBaslat) {
            elBtnBotBaslat.disabled = false
            elBtnBotBaslat.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Başlat</span>`
        }
        if (elBtnTara) elBtnTara.disabled = true
        if (elBtnTopla) elBtnTopla.disabled = true
        if (elBtnSandik) elBtnSandik.disabled = true
    } catch (err) {
        console.error('Durdurma hatası:', err)
        showToast('Bot durdurma hatası: ' + err.message, 'error')
    } finally {
        if (elBtnBotDurdur) {
            elBtnBotDurdur.innerHTML = originalHTML || `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"></rect></svg><span>Durdur</span>`
        }
    }
}

if (elBtnBotDurdur) {
    elBtnBotDurdur.addEventListener('click', botuDurdur)
}

if (elBtnDisconnectDurdur) {
    elBtnDisconnectDurdur.addEventListener('click', botuDurdur)
}

// Minyonları Tara
elBtnTara.addEventListener('click', async () => {
    elBtnTara.disabled = true
    const originalHTML = elBtnTara.innerHTML
    elBtnTara.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Taranıyor...</span>`

    // Show skeleton cards during scan
    showSkeletonCards()

    try {
        await window.electronAPI.minyonlariTara()
        showToast('Minyonlar başarıyla tarandı!', 'success')
    } catch (err) {
        console.error('Tarama hatası:', err)
        showToast('Tarama sırasında hata oluştu.', 'error')
    } finally {
        setTimeout(() => {
            elBtnTara.disabled = false
            elBtnTara.innerHTML = originalHTML
        }, 1200)
    }
})

// Boş Durumdaki Tara Butonu
if (elBtnEmptyTara) {
    elBtnEmptyTara.addEventListener('click', () => {
        if (elBtnTara && !elBtnTara.disabled) {
            elBtnTara.click()
        } else {
            showToast('Minyonları taramak için önce botu başlatmalısınız!', 'warning')
        }
    })
}

// Kovanları Tara
if (elBtnKovanTara) {
    elBtnKovanTara.addEventListener('click', async () => {
        elBtnKovanTara.disabled = true
        const originalHTML = elBtnKovanTara.innerHTML
        elBtnKovanTara.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Taranıyor...</span>`

        // Otomatik kovan sekmesine geç
        switchTab('kovanlar')
        showSkeletonKovanCards()

        try {
            const sonuc = await window.electronAPI.kovanlariTara()
            if (sonuc && sonuc.basarili) {
                showToast('Kovanlar başarıyla tarandı!', 'success')
            } else {
                showToast(sonuc?.mesaj || 'Kovanlar taranamadı.', 'warning')
            }
        } catch (err) {
            console.error('Kovan tarama hatası:', err)
            showToast('Kovan tarama sırasında hata oluştu.', 'error')
        } finally {
            setTimeout(() => {
                elBtnKovanTara.disabled = false
                elBtnKovanTara.innerHTML = originalHTML
            }, 1200)
        }
    })
}

// Boş Durumdaki Kovan Tara Butonu
if (elBtnEmptyKovanTara) {
    elBtnEmptyKovanTara.addEventListener('click', () => {
        if (elBtnKovanTara && !elBtnKovanTara.disabled) {
            elBtnKovanTara.click()
        } else {
            showToast('Kovanları taramak için önce botu başlatmalısınız!', 'warning')
        }
    })
}

// Otomatik Bal Toplama Aç/Kapat Butonu
let otoBalAktif = true

function otoBalArayuzGuncelle(aktif) {
    otoBalAktif = Boolean(aktif)
    if (!elBtnToggleOtoBal) return
    if (otoBalAktif) {
        elBtnToggleOtoBal.classList.add('active')
        elBtnToggleOtoBal.classList.remove('disabled-mode')
        elBtnToggleOtoBal.innerHTML = `
            <span class="honey-pulse-dot"></span>
            <span>🍯 Oto Bal: <strong class="oto-bal-status">AÇIK</strong></span>
        `
        elBtnToggleOtoBal.title = "Otomatik Bal Toplama: AÇIK (%80 dolan kovanlar otomatik hasat edilip sandığa koyulur. Tıklayarak kapatabilirsiniz)"
    } else {
        elBtnToggleOtoBal.classList.remove('active')
        elBtnToggleOtoBal.classList.add('disabled-mode')
        elBtnToggleOtoBal.innerHTML = `
            <span class="honey-pulse-dot off"></span>
            <span>🍯 Oto Bal: <strong class="oto-bal-status" style="color: var(--text-muted)">KAPALI</strong></span>
        `
        elBtnToggleOtoBal.title = "Otomatik Bal Toplama: KAPALI (Tıklayarak açabilirsiniz)"
    }
}

if (elBtnToggleOtoBal) {
    elBtnToggleOtoBal.addEventListener('click', async () => {
        const yeniDurum = !otoBalAktif
        try {
            if (window.electronAPI.otoBalDegistir) {
                await window.electronAPI.otoBalDegistir(yeniDurum)
            }
            otoBalArayuzGuncelle(yeniDurum)
            if (yeniDurum) {
                showToast('🍯 Otomatik bal toplama AÇILDI (%80+ kovanlar otomatik toplanır)', 'success')
            } else {
                showToast('🍯 Otomatik bal toplama KAPATILDI', 'info')
            }
        } catch (err) {
            console.error('Oto bal değiştirme hatası:', err)
            showToast('Hata: ' + err.message, 'error')
        }
    })
}

// Backend'den ilk oto bal durumunu al
if (window.electronAPI.otoBalDurumAl) {
    window.electronAPI.otoBalDurumAl().then(durum => {
        otoBalArayuzGuncelle(durum)
    }).catch(() => {})
}

// Backend oto bal değişiklik olayını dinle
if (window.electronAPI.onOtoBalGuncelle) {
    window.electronAPI.onOtoBalGuncelle((durum) => {
        otoBalArayuzGuncelle(durum)
    })
}

// Dolan Kovanların Ballarını Topla
if (elBtnKovanTopla) {
    elBtnKovanTopla.addEventListener('click', async () => {
        elBtnKovanTopla.disabled = true
        const originalHTML = elBtnKovanTopla.innerHTML
        elBtnKovanTopla.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Toplanıyor...</span>`

        const hedef = parseInt(elNumHedefYuzde.value) || 80
        showToast(`%${hedef}+ doluluk oranındaki kovanların balı toplanıyor...`, 'info')

        try {
            const sonuc = await window.electronAPI.kovanBalTopla(hedef)
            if (sonuc && sonuc.basarili) {
                showToast(`Kovan balı toplama tamamlandı! (${sonuc.toplanan || 0} kovan)`, 'success')
                switchTab('envanter')
            } else {
                showToast(sonuc?.mesaj || 'Hasat edilecek kovan bulunamadı.', 'warning')
            }
        } catch (err) {
            console.error('Kovan toplu bal hatası:', err)
            showToast('Kovan toplama hatası: ' + err.message, 'error')
        } finally {
            setTimeout(() => {
                elBtnKovanTopla.disabled = false
                elBtnKovanTopla.innerHTML = originalHTML
            }, 1200)
        }
    })
}

// Tümünü Topla
elBtnTopla.addEventListener('click', async () => {
    elBtnTopla.disabled = true
    const originalHTML = elBtnTopla.innerHTML
    elBtnTopla.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg><span>Toplanıyor...</span>`

    try {
        await window.electronAPI.tumunuTopla()
        showToast('Tüm hazır minyonlar toplandı!', 'success')
    } catch (err) {
        console.error('Toplama hatası:', err)
        showToast('Toplama sırasında hata oluştu.', 'error')
    } finally {
        setTimeout(() => {
            elBtnTopla.disabled = false
            elBtnTopla.innerHTML = originalHTML
        }, 1200)
    }
})

// Sandığı Ayarla
elBtnSandik.addEventListener('click', async () => {
    const sonuc = await window.electronAPI.sandikAyarla()
    if (sonuc && sonuc.basarili) {
        elSandikKonum.textContent = `X:${sonuc.konum.x} Y:${sonuc.konum.y} Z:${sonuc.konum.z}`
        elSandikKonum.classList.remove('text-dim')
        showToast(`Sandık konumu ayarlandı: X:${sonuc.konum.x} Z:${sonuc.konum.z}`, 'success')
    } else {
        showToast(sonuc?.mesaj || '8 blok yakınında sandık bulunamadı!', 'warning')
    }
})

// Tekil Minyon Toplama
async function tekilMinyonTopla(minyonIsmi) {
    showToast(`${minyonIsmi} toplanıyor...`, 'info', 2000)
    try {
        const sonuc = await window.electronAPI.tekilTopla(minyonIsmi)
        if (sonuc && sonuc.basarili) {
            showToast(`${minyonIsmi} başarıyla toplandı!`, 'success')
        } else {
            showToast(sonuc?.mesaj || `${minyonIsmi} toplanamadı.`, 'warning')
        }
    } catch (err) {
        showToast(`${minyonIsmi} toplama hatası.`, 'error')
    }
}

// Test / Bilgi Modu Switch
elChkTestModu.addEventListener('change', async () => {
    await window.electronAPI.testModuDegistir(elChkTestModu.checked)
    showToast(`Test modu: ${elChkTestModu.checked ? 'Açık' : 'Kapalı'}`, 'info', 2000)
})

// Hedef Yüzde Input
elNumHedefYuzde.addEventListener('change', async () => {
    let deger = parseInt(elNumHedefYuzde.value)
    if (isNaN(deger) || deger < 1) deger = 10
    if (deger > 100) deger = 100
    elNumHedefYuzde.value = deger
    await window.electronAPI.hedefYuzdeDegistir(deger)
    if (guncelMinyonlar) renderMinyonlar(guncelMinyonlar)
})

// Sıralama Dropdown
elSelectSirala.addEventListener('change', () => {
    if (guncelMinyonlar) renderMinyonlar(guncelMinyonlar)
})

// Oto-kaydır
elChkAutoScroll.addEventListener('change', () => {
    otoKaydirAktif = elChkAutoScroll.checked
})

// Terminal Temizle
elBtnTemizle.addEventListener('click', () => {
    elTerminalLog.innerHTML = ''
    ekleTerminalSatiri('Terminal temizlendi.', 'badge-system', 'SYS')
})

// Tab Değiştirme (Minyonlar vs. Kovanlar vs. Envanter)
function switchTab(tab) {
    aktifTab = tab

    if (elTabMinyonlar) elTabMinyonlar.classList.remove('active')
    if (elTabKovanlar) elTabKovanlar.classList.remove('active')
    if (elTabEnvanter) elTabEnvanter.classList.remove('active')

    if (elMinyonlarGrid) elMinyonlarGrid.style.display = 'none'
    if (elKovanlarGrid) elKovanlarGrid.style.display = 'none'
    if (elEnvanterGrid) elEnvanterGrid.style.display = 'none'

    if (tab === 'kovanlar') {
        if (elTabKovanlar) elTabKovanlar.classList.add('active')
        if (elKovanlarGrid) elKovanlarGrid.style.display = 'grid'
    } else if (tab === 'envanter') {
        if (elTabEnvanter) elTabEnvanter.classList.add('active')
        if (elEnvanterGrid) elEnvanterGrid.style.display = 'block'
        if (guncelEnvanter) {
            renderEnvanter(guncelEnvanter)
        }
    } else {
        if (elTabMinyonlar) elTabMinyonlar.classList.add('active')
        if (elMinyonlarGrid) elMinyonlarGrid.style.display = 'grid'
    }
}

if (elTabMinyonlar) {
    elTabMinyonlar.addEventListener('click', () => switchTab('minyonlar'))
}

if (elTabKovanlar) {
    elTabKovanlar.addEventListener('click', () => switchTab('kovanlar'))
}

if (elTabEnvanter) {
    elTabEnvanter.addEventListener('click', () => switchTab('envanter'))
}

// JSON Modal İçerik Güncelleme
function guncelleModalJson() {
    if (aktifModalJsonTab === 'kovanlar') {
        elJsonCode.textContent = JSON.stringify(guncelKovanlar, null, 2)
        if (elModalTabKovan) elModalTabKovan.classList.add('active')
        if (elModalTabMinyon) elModalTabMinyon.classList.remove('active')
    } else {
        elJsonCode.textContent = JSON.stringify(guncelMinyonlar, null, 2)
        if (elModalTabMinyon) elModalTabMinyon.classList.add('active')
        if (elModalTabKovan) elModalTabKovan.classList.remove('active')
    }
}

if (elModalTabMinyon) {
    elModalTabMinyon.addEventListener('click', () => {
        aktifModalJsonTab = 'minyonlar'
        guncelleModalJson()
    })
}

if (elModalTabKovan) {
    elModalTabKovan.addEventListener('click', () => {
        aktifModalJsonTab = 'kovanlar'
        guncelleModalJson()
    })
}

// JSON Modal Aç / Kapat / Kopyala
elBtnJsonAc.addEventListener('click', () => {
    aktifModalJsonTab = aktifTab === 'kovanlar' ? 'kovanlar' : 'minyonlar'
    guncelleModalJson()
    elModal.classList.add('active')
})

elBtnJsonKapat.addEventListener('click', () => {
    elModal.classList.remove('active')
})

elModal.addEventListener('click', (e) => {
    if (e.target === elModal) elModal.classList.remove('active')
})

elBtnJsonKopyala.addEventListener('click', () => {
    const veri = aktifModalJsonTab === 'kovanlar' ? guncelKovanlar : guncelMinyonlar
    navigator.clipboard.writeText(JSON.stringify(veri, null, 2))
    elTxtKopyala.textContent = 'Kopyalandı!'
    showToast(`${aktifModalJsonTab === 'kovanlar' ? 'Kovan' : 'Minyon'} JSON panoya kopyalandı.`, 'success', 2000)
    setTimeout(() => { elTxtKopyala.textContent = 'Kopyala' }, 1500)
})

// ===================================================
// TERMINAL FILTER SYSTEM
// ===================================================
const terminalFilterBtns = document.querySelectorAll('.filter-btn')
terminalFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        terminalFilterBtns.forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        aktifTerminalFiltre = btn.dataset.filter

        const rows = elTerminalLog.querySelectorAll('.terminal-row')
        rows.forEach(row => {
            if (aktifTerminalFiltre === 'all') {
                row.classList.remove('filtered-out')
            } else {
                const matchMap = {
                    'error': 'row-error',
                    'warn': 'row-warn',
                    'success': 'row-success'
                }
                const targetClass = matchMap[aktifTerminalFiltre]
                if (targetClass && row.classList.contains(targetClass)) {
                    row.classList.remove('filtered-out')
                } else if (targetClass) {
                    row.classList.add('filtered-out')
                } else {
                    row.classList.remove('filtered-out')
                }
            }
        })
    })
})

// ===================================================
// 2. TERMINAL LOG FORMATTER & RENDERER
// ===================================================

function formatZaman(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function ekleTerminalSatiri(mesaj, badgeClass = 'badge-info', badgeText = 'INFO', rowClass = '') {
    const row = document.createElement('div')
    row.className = `terminal-row ${rowClass}`

    const timeSpan = document.createElement('span')
    timeSpan.className = 'log-time'
    timeSpan.textContent = formatZaman()

    const badgeSpan = document.createElement('span')
    badgeSpan.className = `log-badge ${badgeClass}`
    badgeSpan.textContent = badgeText

    const msgSpan = document.createElement('span')
    msgSpan.className = 'log-msg'
    msgSpan.textContent = mesaj

    row.appendChild(timeSpan)
    row.appendChild(badgeSpan)
    row.appendChild(msgSpan)

    // Apply current filter
    if (aktifTerminalFiltre !== 'all') {
        const matchMap = { 'error': 'row-error', 'warn': 'row-warn', 'success': 'row-success' }
        const targetClass = matchMap[aktifTerminalFiltre]
        if (targetClass && !row.classList.contains(targetClass)) {
            row.classList.add('filtered-out')
        }
    }

    elTerminalLog.appendChild(row)

    if (otoKaydirAktif) {
        elTerminalLog.scrollTop = elTerminalLog.scrollHeight
    }

    if (elTerminalLog.children.length > 500) {
        elTerminalLog.removeChild(elTerminalLog.firstChild)
    }
}

// Bot Log Olayı
window.electronAPI.onLog((mesaj) => {
    if (!mesaj) return
    const text = String(mesaj).trim()
    if (!text) return

    const lower = text.toLowerCase()

    // Actionbar / HUD durum çubuğu filtreleme (Can, Mana, AP, Yetenek vb.)
    if (
        (lower.includes('mana') && lower.includes('can')) ||
        (lower.includes('ap') && lower.includes('yetenek')) ||
        text.includes('❤') || text.includes('♨') || text.includes('☕') || text.includes('🔥') ||
        /\b\d+\/\d+\s*(?:can|mana|yetenek|ap)\b/i.test(text)
    ) {
        return
    }

    let badgeClass = 'badge-info'
    let badgeText = 'INFO'
    let rowClass = ''

    if (lower.includes('[hata]') || lower.includes('atildi') || lower.includes('error')) {
        badgeClass = 'badge-err'
        badgeText = 'ERR'
        rowClass = 'row-error'
    } else if (lower.includes('[basarili]') || lower.includes('ulaştı') || lower.includes('aktarıldı')) {
        badgeClass = 'badge-success'
        badgeText = 'OK'
        rowClass = 'row-success'
    } else if (lower.includes('[uyari]') || lower.includes('sınırını aştı') || lower.includes('bekleniyor')) {
        badgeClass = 'badge-warn'
        badgeText = 'WARN'
        rowClass = 'row-warn'
    } else if (lower.includes('[sunucu]')) {
        badgeClass = 'badge-srv'
        badgeText = 'SRV'
        rowClass = 'row-srv'
    } else if (lower.includes('[sistem]') || lower.includes('[durum]')) {
        badgeClass = 'badge-system'
        badgeText = 'SYS'
        rowClass = 'row-system'
    }

    // Başlıktaki [SUNUCU] veya [BİLGİ] etiketlerini temizleyerek sun
    const temizMesaj = text.replace(/^\[(SUNUCU|DURUM|İŞLEM|BİLGİ|UYARI|HATA|BAŞARILI|SİSTEM)\]\s*/i, '')
    ekleTerminalSatiri(temizMesaj, badgeClass, badgeText, rowClass)
})

// ===================================================
// SKELETON / LOADING CARDS
// ===================================================
function showSkeletonCards() {
    elMinyonlarGrid.innerHTML = ''
    for (let i = 0; i < 4; i++) {
        const sk = document.createElement('div')
        sk.className = 'skeleton-card'
        sk.style.animationDelay = `${i * 0.15}s`
        elMinyonlarGrid.appendChild(sk)
    }
}

function showSkeletonKovanCards() {
    if (!elKovanlarGrid) return
    elKovanlarGrid.innerHTML = ''
    for (let i = 0; i < 4; i++) {
        const sk = document.createElement('div')
        sk.className = 'skeleton-card'
        sk.style.animationDelay = `${i * 0.15}s`
        elKovanlarGrid.appendChild(sk)
    }
}

// ===================================================
// 3. MİNYON KARTLARINI RENDER ETME
// ===================================================

function sortMinyonlar(liste) {
    const kriter = elSelectSirala.value
    return [...liste].sort((a, b) => {
        if (kriter === 'doluluk') {
            const ya = a.depo?.yuzde ?? a.yuzde ?? 0
            const yb = b.depo?.yuzde ?? b.yuzde ?? 0
            return yb - ya // Yüksekten düşüğe
        }
        if (kriter === 'kademe') {
            const ka = parseInt(String(a.kademe || '').replace(/\D/g, '')) || 0
            const kb = parseInt(String(b.kademe || '').replace(/\D/g, '')) || 0
            return kb - ka
        }
        // İsim (varsayılan)
        return (a.isim || '').localeCompare(b.isim || '', 'tr')
    })
}

function renderMinyonlar(minyonlarObj) {
    if (!minyonlarObj) return

    const anahtarlar = Object.keys(minyonlarObj).filter(k => !k.startsWith('_') && !k.includes('_'))
    let minyonListesi = anahtarlar.map(k => minyonlarObj[k])

    const hedefLimit = parseInt(elNumHedefYuzde.value) || 80
    let doluSayisi = 0
    let toplamYuzde = 0

    elToplamMinyon.textContent = minyonListesi.length
    elMinyonBadge.textContent = `${minyonListesi.length} aktif`
    elSonGuncelleme.textContent = `Son tarama: ${formatZaman()}`

    if (minyonListesi.length === 0) {
        elMinyonlarGrid.innerHTML = `
            <div class="empty-minions-state">
                <div class="empty-icon-wrap">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2"></rect>
                        <path d="m9 8 6 4-6 4Z"></path>
                    </svg>
                </div>
                <div class="empty-text-wrap">
                    <h4>Minyon Bulunamadı</h4>
                    <p>Minyonları listelemek için "Minyonları Tara" butonunu kullanın.</p>
                </div>
            </div>
        `
        elDoluMinyon.textContent = '0'
        elOrtDoluluk.textContent = '%0'
        return
    }

    // Sort
    minyonListesi = sortMinyonlar(minyonListesi)

    elMinyonlarGrid.innerHTML = ''

    minyonListesi.forEach((m, idx) => {
        const yuzde = m.depo?.yuzde ?? m.yuzde ?? 0
        const mevcut = m.depo?.mevcut ?? m.mevcut ?? 0
        const kapasite = m.depo?.kapasite ?? m.kapasite ?? 0
        const isReady = yuzde >= hedefLimit
        if (isReady) doluSayisi++
        toplamYuzde += yuzde

        const card = document.createElement('div')
        card.className = `minion-item-card ${isReady ? 'is-ready' : ''}`
        card.style.animationDelay = `${idx * 0.06}s`

        const iconData = getMinionIcon(m.isim)
        const konumStr = m.konum ? `X:${m.konum.x} Y:${m.konum.y} Z:${m.konum.z}` : 'Bilinmiyor'
        const yakitStr = m.yakit || 'Yok'
        const yukseltmeStr = m.yukseltme || 'Yok'

        const collectBtnHTML = isReady
            ? `<button class="btn btn-collect" data-minyon="${m.isim || ''}" title="Bu minyonu topla">${ICONS.collect}<span>Topla</span></button>`
            : ''

        card.innerHTML = `
            <div class="card-header-row">
                <div class="card-title-wrap">
                    <span class="minion-avatar ${iconData.cls}">${iconData.svg}</span>
                    <span class="minion-name">${m.isim || 'Minyon'}</span>
                </div>
                <span class="tier-badge">${m.kademe || 'T?'}</span>
            </div>

            <div class="storage-box">
                <div class="storage-labels">
                    <span class="storage-current">${mevcut} / ${kapasite} adet</span>
                    <span class="storage-percent ${isReady ? 'text-ready' : ''}">%${yuzde}</span>
                </div>
                <div class="track-bar">
                    <div class="fill-bar ${isReady ? 'fill-ready' : ''}" style="width: 0%;"></div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-row" title="Konum">
                    ${ICONS.mapPin}
                    <span class="meta-val">${konumStr}</span>
                </div>
                <div class="meta-row" title="Yakıt">
                    ${ICONS.clock}
                    <span class="meta-val meta-text-truncate">${yakitStr}</span>
                </div>
                <div class="meta-row" title="Yükseltme">
                    ${ICONS.sliders}
                    <span class="meta-val meta-text-truncate">${yukseltmeStr}</span>
                </div>
            </div>

            <div class="card-footer-row">
                <div class="card-status-strip ${isReady ? 'status-alert' : 'status-waiting'}">
                    <span class="status-indicator-dot"></span>
                    <span>${isReady ? `Hazır (%${hedefLimit} aşıldı)` : 'Dolması bekleniyor'}</span>
                </div>
                ${collectBtnHTML}
            </div>
        `

        elMinyonlarGrid.appendChild(card)

        // Animate fill bar after card enters DOM
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fillBar = card.querySelector('.fill-bar')
                if (fillBar) fillBar.style.width = `${Math.min(yuzde, 100)}%`
            })
        })

        // Bind individual collect button
        const collectBtn = card.querySelector('.btn-collect')
        if (collectBtn) {
            collectBtn.addEventListener('click', (e) => {
                e.stopPropagation()
                tekilMinyonTopla(collectBtn.dataset.minyon)
            })
        }
    })

    elDoluMinyon.textContent = doluSayisi

    // Update statistics
    const ortYuzde = minyonListesi.length > 0 ? Math.round(toplamYuzde / minyonListesi.length) : 0
    elOrtDoluluk.textContent = `%${ortYuzde}`
}

// Minyonlar Güncellendiğinde
window.electronAPI.onMinyonlarGuncelle((minyonlar) => {
    guncelMinyonlar = minyonlar || {}
    renderMinyonlar(minyonlar)
})

// ===================================================
// 3B. KOVAN KARTLARINI RENDER ETME
// ===================================================

function renderKovanlar(kovanlarObj) {
    if (!elKovanlarGrid) return

    let kovanListesi = []
    if (Array.isArray(kovanlarObj)) {
        kovanListesi = kovanlarObj
    } else if (kovanlarObj && typeof kovanlarObj === 'object') {
        if (Array.isArray(kovanlarObj._liste)) {
            kovanListesi = kovanlarObj._liste
        } else {
            // Konuma göre tekilleştir
            const gorulenler = new Set()
            kovanListesi = Object.values(kovanlarObj).filter(item => {
                if (!item || typeof item !== 'object' || !item.konum) return false
                const anahtar = `${item.konum.x}_${item.konum.y}_${item.konum.z}`
                if (gorulenler.has(anahtar)) return false
                gorulenler.add(anahtar)
                return true
            })
        }
    }

    if (elToplamKovan) elToplamKovan.textContent = kovanListesi.length
    if (elKovanBadge) elKovanBadge.textContent = `${kovanListesi.length}`
    if (elSonGuncelleme && kovanListesi.length > 0) {
        elSonGuncelleme.textContent = `Son tarama: ${new Date().toLocaleTimeString('tr-TR')}`
    }

    if (kovanListesi.length === 0) {
        elKovanlarGrid.innerHTML = `
            <div class="empty-minions-state" id="emptyKovanState">
                <div class="empty-icon-wrap empty-icon-honey">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </div>
                <div class="empty-text-wrap">
                    <h4>Kovan Bulunamadı</h4>
                    <p>Ada kovanlarınızı tespit etmek için yukarıdaki "Kovanları Tara" butonuna basın.</p>
                </div>
                <button class="btn btn-secondary btn-sm" id="btnEmptyKovanTara">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span>Şimdi Tara</span>
                </button>
            </div>
        `
        const btnEmptyKovan = document.getElementById('btnEmptyKovanTara')
        if (btnEmptyKovan) {
            btnEmptyKovan.addEventListener('click', () => {
                if (elBtnKovanTara && !elBtnKovanTara.disabled) elBtnKovanTara.click()
            })
        }
        return
    }

    elKovanlarGrid.innerHTML = ''

    kovanListesi.forEach((k, idx) => {
        const balMevcut = k.bal?.mevcut ?? k.mevcut ?? 0
        const balKapasite = k.bal?.kapasite ?? k.kapasite ?? 48
        const balYuzde = k.bal?.yuzde ?? k.yuzde ?? (balKapasite > 0 ? Math.round((balMevcut / balKapasite) * 100) : 0)
        const isFull = balYuzde >= 80

        const ariMevcut = k.ari?.mevcut ?? 0
        const ariKapasite = k.ari?.kapasite ?? 3

        const konumStr = k.konum ? `X:${k.konum.x} Y:${k.konum.y} Z:${k.konum.z}` : 'Bilinmiyor'
        const cicekPuani = k.cicekPuani !== undefined ? k.cicekPuani : 0
        const carpan = k.carpan !== undefined ? k.carpan : 1.0

        // Arı listesi etiketleri
        let arilarHTML = ''
        if (Array.isArray(k.arilar) && k.arilar.length > 0) {
            arilarHTML = k.arilar.map(ari => `<span class="bee-chip"><span class="bee-chip-icon">🐝</span>${ari}</span>`).join('')
        } else {
            arilarHTML = `<span class="meta-val text-dim" style="font-size: 10px;">Arı bulunmuyor</span>`
        }

        const card = document.createElement('div')
        card.className = `kovan-item-card ${isFull ? 'is-full' : ''}`
        card.style.animationDelay = `${idx * 0.06}s`

        card.innerHTML = `
            <div class="card-header-row">
                <div class="card-title-wrap">
                    <span class="minion-avatar avatar-bee">${ICONS.bee}</span>
                    <span class="minion-name">${k.isim || `Kovan #${idx + 1}`}</span>
                </div>
                <div class="flower-score-badge" title="Çiçek Puanı & Çarpan">
                    ${ICONS.flower}
                    <span>${cicekPuani}</span>
                    <span class="flower-multiplier">(x${carpan})</span>
                </div>
            </div>

            <div class="storage-box">
                <div class="storage-labels">
                    <span class="storage-current">🍯 ${balMevcut} / ${balKapasite} bal</span>
                    <span class="storage-percent ${isFull ? 'text-ready' : ''}">%${balYuzde}</span>
                </div>
                <div class="track-bar">
                    <div class="fill-bar fill-honey ${isFull ? 'fill-ready' : ''}" style="width: 0%;"></div>
                </div>
            </div>

            <div class="meta-grid">
                <div class="meta-row" title="Kovan Konumu">
                    ${ICONS.mapPin}
                    <span class="meta-val">${konumStr}</span>
                </div>
                <div class="meta-row" title="Arı Kapasitesi">
                    ${ICONS.bee}
                    <span class="meta-val">${ariMevcut} / ${ariKapasite} Arı</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 3px; margin-top: 2px;">
                    <span style="font-size: 9.5px; color: var(--text-dim); font-weight: 600;">ARILAR:</span>
                    <div class="bee-chip-list">
                        ${arilarHTML}
                    </div>
                </div>
            </div>

            <div class="card-footer-row">
                <div class="card-status-strip ${isFull ? 'status-alert' : 'status-waiting'}">
                    <span class="status-indicator-dot"></span>
                    <span>${isFull ? 'Bal doldu (%80+)' : 'Bal üretiliyor'}</span>
                </div>
                <button class="btn-harvest" data-slot="${k.slot !== undefined ? k.slot : idx}" title="${k.isim || `Kovan #${idx + 1}`} balını hemen topla">
                    🍯 Hasat Et
                </button>
            </div>
        `

        // Tekil kovan bal hasadı butonu
        const harvestBtn = card.querySelector('.btn-harvest')
        if (harvestBtn) {
            harvestBtn.addEventListener('click', async (e) => {
                e.stopPropagation()
                harvestBtn.disabled = true
                harvestBtn.textContent = '⏳...'
                showToast(`${k.isim || 'Kovan'} balı hasat ediliyor...`, 'info')

                try {
                    const res = await window.electronAPI.tekilKovanHasat(k.slot !== undefined ? k.slot : idx)
                    if (res && res.basarili) {
                        showToast(res.mesaj || 'Bal hasat edildi!', 'success')
                        switchTab('envanter')
                    } else {
                        showToast(res?.mesaj || 'Hasat yapılamadı.', 'warning')
                    }
                } catch (err) {
                    showToast('Hasat hatası: ' + err.message, 'error')
                } finally {
                    setTimeout(() => {
                        harvestBtn.disabled = false
                        harvestBtn.textContent = '🍯 Hasat Et'
                    }, 1200)
                }
            })
        }

        elKovanlarGrid.appendChild(card)

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fillBar = card.querySelector('.fill-bar')
                if (fillBar) fillBar.style.width = `${Math.min(balYuzde, 100)}%`
            })
        })
    })
}

// Kovanlar Güncellendiğinde
window.electronAPI.onKovanlarGuncelle((kovanlar) => {
    guncelKovanlar = kovanlar || {}
    renderKovanlar(kovanlar)
})

// ===================================================
// 3C. CANLI ENVANTER GÖRÜNÜMÜ VE RENDER
// ===================================================

function getMinecraftItemIcon(name = '') {
    const n = name.toLowerCase()
    if (n.includes('honey_bottle') || n.includes('honey')) return '🍯'
    if (n.includes('honeycomb')) return '🐝'
    if (n.includes('sword')) return '🗡️'
    if (n.includes('pickaxe')) return '⛏️'
    if (n.includes('axe')) return '🪓'
    if (n.includes('shovel')) return '🥄'
    if (n.includes('hoe')) return '🌾'
    if (n.includes('helmet')) return '🪖'
    if (n.includes('chestplate')) return '👕'
    if (n.includes('leggings')) return '👖'
    if (n.includes('boots')) return '👢'
    if (n.includes('shield')) return '🛡️'
    if (n.includes('totem')) return '🗿'
    if (n.includes('bread') || n.includes('wheat')) return '🌾'
    if (n.includes('carrot')) return '🥕'
    if (n.includes('potato')) return '🥔'
    if (n.includes('beef') || n.includes('steak') || n.includes('meat')) return '🥩'
    if (n.includes('apple')) return '🍎'
    if (n.includes('iron')) return '⛓️'
    if (n.includes('gold')) return '🪙'
    if (n.includes('diamond')) return '💎'
    if (n.includes('emerald')) return '❇️'
    if (n.includes('coal') || n.includes('charcoal')) return '⬛'
    if (n.includes('log') || n.includes('wood') || n.includes('plank')) return '🪵'
    if (n.includes('stone') || n.includes('cobble')) return '🪨'
    if (n.includes('book')) return '📖'
    if (n.includes('chest')) return '📦'
    if (n.includes('potion')) return '🧪'
    if (n.includes('bow') || n.includes('arrow')) return '🏹'
    return '📦'
}

function renderZirhSlot(elementId, item, placeholderEmoji, titlePrefix) {
    const el = document.getElementById(elementId)
    if (!el) return

    if (item && item.name) {
        el.className = 'mc-slot has-item'
        el.setAttribute('title', `${titlePrefix}: ${item.displayName || item.name}`)
        el.innerHTML = `
            <span class="mc-item-icon">${getMinecraftItemIcon(item.name)}</span>
            ${item.count > 1 ? `<span class="mc-item-count">${item.count}</span>` : ''}
        `
    } else {
        el.className = 'mc-slot'
        el.setAttribute('title', `${titlePrefix} (Boş)`)
        el.innerHTML = `<span class="slot-placeholder">${placeholderEmoji}</span>`
    }
}

function renderEnvanter(envanter) {
    if (!envanter) return
    guncelEnvanter = envanter

    const dolu = envanter.doluSlot ?? 0
    const toplam = envanter.toplamSlot ?? 36
    const toplamEsya = envanter.toplamEsya ?? 0

    // Üst ve Sekme Rozetleri Güncelle
    if (elEnvanterBadge) elEnvanterBadge.textContent = `${dolu}/${toplam}`
    if (elEnvanterDolulukText) elEnvanterDolulukText.textContent = `${dolu}/${toplam}`
    if (elInvTotalCountBadge) elInvTotalCountBadge.textContent = `${toplamEsya} Eşya`

    // Slot Haritası (relativeSlot 0..35)
    const slotMap = {}
    if (Array.isArray(envanter.esyalar)) {
        envanter.esyalar.forEach(it => {
            if (it.relativeSlot !== undefined) {
                slotMap[it.relativeSlot] = it
            }
        })
    }

    // 1. Ana Çanta (27 Slot: relativeSlot 0 to 26)
    if (elMcMainInventoryGrid) {
        elMcMainInventoryGrid.innerHTML = ''
        let mainDolu = 0
        for (let rel = 0; rel < 27; rel++) {
            const item = slotMap[rel]
            const slotEl = document.createElement('div')
            slotEl.className = 'mc-slot'

            if (item) {
                mainDolu++
                const isHoney = item.name.includes('honey')
                slotEl.classList.add('has-item')
                if (isHoney) slotEl.classList.add('is-honey')

                const icon = getMinecraftItemIcon(item.name)
                slotEl.setAttribute('title', `${item.displayName || item.name} (${item.count} adet) [Slot: ${rel + 9}]`)

                slotEl.innerHTML = `
                    <span class="mc-item-icon">${icon}</span>
                    ${item.count > 1 ? `<span class="mc-item-count">${item.count}</span>` : ''}
                `
            } else {
                slotEl.setAttribute('title', `Boş Slot [Slot: ${rel + 9}]`)
            }

            elMcMainInventoryGrid.appendChild(slotEl)
        }
        if (elInvMainSlotsBadge) elInvMainSlotsBadge.textContent = `${mainDolu} / 27`
    }

    // 2. Hotbar (9 Slot: relativeSlot 27 to 35)
    if (elMcHotbarInventoryGrid) {
        elMcHotbarInventoryGrid.innerHTML = ''
        let hotbarDolu = 0
        for (let rel = 27; rel <= 35; rel++) {
            const item = slotMap[rel]
            const slotEl = document.createElement('div')
            slotEl.className = 'mc-slot'

            if (item) {
                hotbarDolu++
                const isHoney = item.name.includes('honey')
                slotEl.classList.add('has-item')
                if (isHoney) slotEl.classList.add('is-honey')

                const icon = getMinecraftItemIcon(item.name)
                slotEl.setAttribute('title', `${item.displayName || item.name} (${item.count} adet) [Hotbar ${rel - 26}]`)

                slotEl.innerHTML = `
                    <span class="mc-item-icon">${icon}</span>
                    ${item.count > 1 ? `<span class="mc-item-count">${item.count}</span>` : ''}
                `
            } else {
                slotEl.setAttribute('title', `Boş Hotbar Yuvası ${rel - 26}`)
            }

            elMcHotbarInventoryGrid.appendChild(slotEl)
        }
        if (elInvHotbarSlotsBadge) elInvHotbarSlotsBadge.textContent = `${hotbarDolu} / 9`
    }

    // 3. Kuşanılan Zırhlar ve Sol El
    const zirhlar = envanter.zirhlar || {}
    renderZirhSlot('slotKask', zirhlar.kask, '🪖', 'Kask')
    renderZirhSlot('slotGogusluk', zirhlar.gogusluk, '👕', 'Göğüslük')
    renderZirhSlot('slotPantolon', zirhlar.pantolon, '👖', 'Pantolon')
    renderZirhSlot('slotBot', zirhlar.bot, '👢', 'Bot')
    renderZirhSlot('slotSolEl', zirhlar.solEl, '🛡️', 'Sol El')

    // 4. Çantadaki Eşyaların Gruplanmış Döküm Listesi
    if (elInvItemsList && elInvEmptyMsg) {
        const itemAgg = {}
        if (Array.isArray(envanter.esyalar)) {
            envanter.esyalar.forEach(it => {
                const key = it.displayName || it.name
                if (!itemAgg[key]) {
                    itemAgg[key] = {
                        name: it.name,
                        displayName: it.displayName || it.name,
                        count: 0
                    }
                }
                itemAgg[key].count += it.count
            })
        }

        const keys = Object.keys(itemAgg)
        if (keys.length === 0) {
            elInvEmptyMsg.style.display = 'block'
            elInvItemsList.innerHTML = ''
        } else {
            elInvEmptyMsg.style.display = 'none'
            elInvItemsList.innerHTML = ''

            keys.sort((a, b) => itemAgg[b].count - itemAgg[a].count)

            keys.forEach(k => {
                const item = itemAgg[k]
                const isHoney = item.name.includes('honey')
                const chip = document.createElement('div')
                chip.className = `inv-item-chip ${isHoney ? 'inv-item-chip-honey' : ''}`
                chip.innerHTML = `
                    <span class="chip-icon">${getMinecraftItemIcon(item.name)}</span>
                    <span class="chip-name">${item.displayName}</span>
                    <span class="inv-item-chip-count">x${item.count}</span>
                `
                elInvItemsList.appendChild(chip)
            })
        }
    }
}

// Envanter Güncellendiğinde
window.electronAPI.onEnvanterGuncelle((envanter) => {
    renderEnvanter(envanter)
})

// ===================================================
// 4. DURUM VE VERİ SENKRONİZASYONU
// ===================================================

let oncekiAdaDurumu = null

function syncDurum(durum) {
    if (!durum) return

    if (durum.botAdi) elBotUsername.textContent = durum.botAdi
    if (durum.sunucu) elServerInfo.textContent = durum.sunucu

    if (durum.testModu !== undefined) {
        elChkTestModu.checked = durum.testModu
    }

    if (durum.hedefYuzde !== undefined) {
        elNumHedefYuzde.value = durum.hedefYuzde
    }

    if (durum.sandikKonumu && durum.sandikKonumu.x !== null) {
        elSandikKonum.textContent = `X:${durum.sandikKonumu.x} Y:${durum.sandikKonumu.y} Z:${durum.sandikKonumu.z}`
        elSandikKonum.classList.remove('text-dim')
    }

    // Sağ taraftaki tablodan (Scoreboard) okunan anlık sunucu konumu
    const sunucuKonumu = durum.mevcutSunucu || (durum.calisiyor ? (durum.adada ? 'Skyblock' : 'Bağlanıyor...') : 'Durduruldu')
    if (elCurrentServerVal) {
        elCurrentServerVal.textContent = sunucuKonumu
    }
    if (elCurrentServerPill) {
        elCurrentServerPill.className = 'current-server-pill'
        if (sunucuKonumu === 'Skyblock') {
            elCurrentServerPill.classList.add('skyblock')
        } else if (sunucuKonumu.toLowerCase().includes('lobi')) {
            elCurrentServerPill.classList.add('lobi')
        } else {
            elCurrentServerPill.classList.add('durduruldu')
        }
        if (durum.scoreboardBaslik) {
            elCurrentServerPill.title = `Scoreboard Tablo Başlığı: ${durum.scoreboardBaslik}`
        }
    }

    const calisiyor = durum.calisiyor ?? false

    if (!calisiyor) {
        elBotDurumText.textContent = 'Durduruldu'
        elBotStatusDot.className = 'metric-dot dot-gray'
        elConnectionDot.className = 'status-indicator'
        elDisconnectOverlay.classList.remove('active')

        if (elBtnBotBaslat) {
            elBtnBotBaslat.disabled = false
            elBtnBotBaslat.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Başlat</span>`
        }
        if (elBtnBotDurdur) elBtnBotDurdur.disabled = true
        if (elBtnTara) elBtnTara.disabled = true
        if (elBtnKovanTara) elBtnKovanTara.disabled = true
        if (elBtnKovanTopla) elBtnKovanTopla.disabled = true
        if (elBtnTopla) elBtnTopla.disabled = true
        if (elBtnSandik) elBtnSandik.disabled = true
    } else if (durum.adada) {
        elBotDurumText.textContent = durum.islemde ? 'İşlem Yapıyor' : 'Adada (Hazır)'
        elBotStatusDot.className = 'metric-dot dot-green'
        elConnectionDot.className = 'status-indicator connected'
        elDisconnectOverlay.classList.remove('active')

        if (elBtnBotBaslat) elBtnBotBaslat.disabled = true
        if (elBtnBotDurdur) elBtnBotDurdur.disabled = false
        if (elBtnTara) elBtnTara.disabled = false
        if (elBtnKovanTara) elBtnKovanTara.disabled = false
        if (elBtnKovanTopla) elBtnKovanTopla.disabled = false
        if (elBtnTopla) elBtnTopla.disabled = false
        if (elBtnSandik) elBtnSandik.disabled = false

        // Bağlantı yeniden kuruldu toast
        if (oncekiAdaDurumu === false) {
            showToast('Sunucuya yeniden bağlanıldı!', 'success')
        }
    } else {
        elBotDurumText.textContent = durum.durum || 'Bağlanıyor...'
        elBotStatusDot.className = 'metric-dot dot-yellow'
        elConnectionDot.className = 'status-indicator'

        if (elBtnBotBaslat) elBtnBotBaslat.disabled = true
        if (elBtnBotDurdur) elBtnBotDurdur.disabled = false
        if (elBtnTara) elBtnTara.disabled = true
        if (elBtnKovanTara) elBtnKovanTara.disabled = true
        if (elBtnKovanTopla) elBtnKovanTopla.disabled = true
        if (elBtnTopla) elBtnTopla.disabled = true
        if (elBtnSandik) elBtnSandik.disabled = true

        // Bağlantı koptu overlay
        if (oncekiAdaDurumu === true) {
            elDisconnectOverlay.classList.add('active')
            showToast('Sunucu bağlantısı kesildi!', 'error')
        }
    }

    oncekiAdaDurumu = calisiyor ? (durum.adada ?? false) : null

    if (durum.minyonlar && Object.keys(durum.minyonlar).length > 0) {
        guncelMinyonlar = durum.minyonlar
        renderMinyonlar(durum.minyonlar)
    }

    if (durum.kovanlar && Object.keys(durum.kovanlar).length > 0) {
        guncelKovanlar = durum.kovanlar
        renderKovanlar(durum.kovanlar)
    }

    if (durum.envanter) {
        guncelEnvanter = durum.envanter
        renderEnvanter(durum.envanter)
    }
}

window.electronAPI.onDurumGuncelle((durum) => {
    syncDurum(durum)
})

window.electronAPI.onSandikGuncelle((konum) => {
    if (konum && konum.x !== null) {
        elSandikKonum.textContent = `X:${konum.x} Y:${konum.y} Z:${konum.z}`
        elSandikKonum.classList.remove('text-dim')
    }
})

if (window.electronAPI && typeof window.electronAPI.onSunucuGuncelle === 'function') {
    window.electronAPI.onSunucuGuncelle((data) => {
        if (!data) return
        if (elCurrentServerVal) elCurrentServerVal.textContent = data.mevcutSunucu
        if (elCurrentServerPill) {
            elCurrentServerPill.className = 'current-server-pill'
            if (data.mevcutSunucu === 'Skyblock') {
                elCurrentServerPill.classList.add('skyblock')
            } else if (data.mevcutSunucu && data.mevcutSunucu.toLowerCase().includes('lobi')) {
                elCurrentServerPill.classList.add('lobi')
            } else {
                elCurrentServerPill.classList.add('durduruldu')
            }
            if (data.scoreboardBaslik) {
                elCurrentServerPill.title = `Scoreboard Tablo Başlığı: ${data.scoreboardBaslik}`
            }
        }
    })
}

// ===================================================
// 5. KEYBOARD SHORTCUTS
// ===================================================
document.addEventListener('keydown', (e) => {
    // Ctrl+S → Botu Başlat
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (elBtnBotBaslat && !elBtnBotBaslat.disabled) elBtnBotBaslat.click()
    }
    // Ctrl+X → Botu Durdur
    if (e.ctrlKey && e.key === 'x') {
        e.preventDefault()
        if (elBtnBotDurdur && !elBtnBotDurdur.disabled) elBtnBotDurdur.click()
    }
    // Ctrl+R → Minyonları Tara
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        if (elBtnTara && !elBtnTara.disabled) elBtnTara.click()
    }
    // Ctrl+K → Kovanları Tara
    if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        if (elBtnKovanTara && !elBtnKovanTara.disabled) elBtnKovanTara.click()
    }
    // Ctrl+T → Tümünü Topla
    if (e.ctrlKey && e.key === 't') {
        e.preventDefault()
        if (elBtnTopla && !elBtnTopla.disabled) elBtnTopla.click()
    }
    // Ctrl+J → JSON Modal
    if (e.ctrlKey && e.key === 'j') {
        e.preventDefault()
        if (elModal.classList.contains('active')) {
            elModal.classList.remove('active')
        } else {
            elBtnJsonAc.click()
        }
    }
    // Ctrl+L → Terminal Temizle
    if (e.ctrlKey && e.key === 'l') {
        e.preventDefault()
        elBtnTemizle.click()
    }
    // Escape → Modal kapat
    if (e.key === 'Escape') {
        elModal.classList.remove('active')
    }
})

// ===================================================
// 6. UPTIME TIMER (Saat, Dakika, Saniye)
// ===================================================
function gunceleUptime() {
    if (!elUptimeText) return
    const gecenMs = Date.now() - panelBaslangic
    const toplamSaniye = Math.floor(gecenMs / 1000)
    const saat = Math.floor(toplamSaniye / 3600)
    const dakika = Math.floor((toplamSaniye % 3600) / 60)
    const saniye = toplamSaniye % 60

    elUptimeText.textContent = `${saat}s ${dakika}dk ${saniye}sn`
    const parent = elUptimeText.closest('.uptime-pill')
    if (parent) {
        parent.title = `Panel açık kalma süresi: ${saat} saat, ${dakika} dakika, ${saniye} saniye`
    }
}

setInterval(gunceleUptime, 1000)
gunceleUptime()

// ===================================================
// SPINNING ICON CSS (inline for scan/collect buttons)
// ===================================================
const spinStyle = document.createElement('style')
spinStyle.textContent = `
    .spin-icon {
        animation: spinIcon 0.8s linear infinite;
    }
    @keyframes spinIcon {
        to { transform: rotate(360deg); }
    }
`
document.head.appendChild(spinStyle)

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const ilkDurum = await window.electronAPI.durumAl()
        if (ilkDurum) {
            syncDurum(ilkDurum)
        }
    } catch (e) {
        console.error('İlk durum yüklenemedi:', e)
    }

    // Profesyonel sistem bileşenlerini başlat
    if (window.api) {
        initProfessionalExtension()
    }
})

// ===================================================
// EMSALCLIENT — PROFESYONEL SİSTEM YÖNETİCİSİ (v2.0)
// Modüller: Splash, Güncelleme, Profiller, Ayarlar, Sürümler, Admin
// ===================================================

function initProfessionalExtension() {
    const api = window.api

    // DOM Referansları
    const elSplashModal = document.getElementById('splashModal')
    const elSplashSpinner = document.getElementById('splashSpinner')
    const elSplashIcon = document.getElementById('splashIcon')
    const elSplashTitle = document.getElementById('splashTitle')
    const elSplashDesc = document.getElementById('splashDesc')
    const elSplashUpdateDetails = document.getElementById('splashUpdateDetails')
    const elSplashNewVersionBadge = document.getElementById('splashNewVersionBadge')
    const elSplashMandatoryBadge = document.getElementById('splashMandatoryBadge')
    const elSplashChannelBadge = document.getElementById('splashChannelBadge')
    const elSplashUpdateTitle = document.getElementById('splashUpdateTitle')
    const elSplashChangelogList = document.getElementById('splashChangelogList')
    const elSplashProgressBox = document.getElementById('splashProgressBox')
    const elSplashProgressFill = document.getElementById('splashProgressFill')
    const elSplashProgressText = document.getElementById('splashProgressText')
    const elSplashProgressSpeed = document.getElementById('splashProgressSpeed')
    const elBtnSplashUpdateNow = document.getElementById('btnSplashUpdateNow')
    const elBtnSplashInstallNow = document.getElementById('btnSplashInstallNow')
    const elBtnSplashContinue = document.getElementById('btnSplashContinue')
    const elBtnSplashRetry = document.getElementById('btnSplashRetry')
    const elSplashCurrentVersion = document.getElementById('splashCurrentVersion')

    const elTopbarProfileName = document.getElementById('topbarProfileName')
    const elBtnTopbarProfile = document.getElementById('btnTopbarProfile')
    const elTopbarUpdateBadge = document.getElementById('topbarUpdateBadge')
    const elTopbarUpdateText = document.getElementById('topbarUpdateText')

    const elBtnProfiller = document.getElementById('btnProfiller')
    const elProfilesModal = document.getElementById('profilesModal')
    const elBtnProfilesKapat = document.getElementById('btnProfilesKapat')
    const elProfilesCountBadge = document.getElementById('profilesCountBadge')
    const elBtnYeniProfilAc = document.getElementById('btnYeniProfilAc')
    const elBtnProfilExport = document.getElementById('btnProfilExport')
    const elBtnProfilImport = document.getElementById('btnProfilImport')
    const elInputProfilImportFile = document.getElementById('inputProfilImportFile')
    const elProfilesListGrid = document.getElementById('profilesListGrid')

    // Launcher / Ana Karşılama Ekranı Elemanları
    const elLauncherAppVersion = document.getElementById('launcherAppVersion')
    const elLauncherUpdateIcon = document.getElementById('launcherUpdateIcon')
    const elLauncherUpdateText = document.getElementById('launcherUpdateText')
    const elLauncherUpdateAlert = document.getElementById('launcherUpdateAlert')
    const elLauncherNewVersionBadge = document.getElementById('launcherNewVersionBadge')
    const elLauncherAlertTitle = document.getElementById('launcherAlertTitle')
    const elBtnLauncherUpdateNow = document.getElementById('btnLauncherUpdateNow')
    const elBtnLauncherContinue = document.getElementById('btnLauncherContinue')
    const elBtnLauncherSettings = document.getElementById('btnLauncherSettings')
    const elBtnLauncherReleases = document.getElementById('btnLauncherReleases')

    const elProfileEditModal = document.getElementById('profileEditModal')
    const elBtnProfileEditKapat = document.getElementById('btnProfileEditKapat')
    const elProfileEditModalTitle = document.getElementById('profileEditModalTitle')
    const elEditProfileId = document.getElementById('editProfileId')
    const elFormProfName = document.getElementById('formProfName')
    const elFormProfServer = document.getElementById('formProfServer')
    const elFormProfUsername = document.getElementById('formProfUsername')
    const elFormProfPassword = document.getElementById('formProfPassword')
    const elBtnTogglePasswordEye = document.getElementById('btnTogglePasswordEye')
    const elFormProfIslandOwner = document.getElementById('formProfIslandOwner')
    const elFormProfVersion = document.getElementById('formProfVersion')
    const elFormProfTargetPercent = document.getElementById('formProfTargetPercent')
    const elFormProfInterval = document.getElementById('formProfInterval')
    const elFormProfTestMode = document.getElementById('formProfTestMode')
    const elFormProfAutoHoney = document.getElementById('formProfAutoHoney')
    const elBtnProfileEditCancel = document.getElementById('btnProfileEditCancel')
    const elBtnProfileEditSave = document.getElementById('btnProfileEditSave')

    const elBtnSettings = document.getElementById('btnSettings')
    const elSettingsModal = document.getElementById('settingsModal')
    const elBtnSettingsKapat = document.getElementById('btnSettingsKapat')
    const elSettingUpdateChannel = document.getElementById('settingUpdateChannel')
    const elSettingAutoCheck = document.getElementById('settingAutoCheck')
    const elSettingMinimizeToTray = document.getElementById('settingMinimizeToTray')
    const elSettingCloseToTray = document.getElementById('settingCloseToTray')
    const elBtnManualUpdateCheck = document.getElementById('btnManualUpdateCheck')
    const elManualUpdateCheckResult = document.getElementById('manualUpdateCheckResult')
    const elBtnOpenLogsFolder = document.getElementById('btnOpenLogsFolder')
    const elBtnSaveSettings = document.getElementById('btnSaveSettings')

    const elBtnReleaseHistory = document.getElementById('btnReleaseHistory')
    const elReleasesModal = document.getElementById('releasesModal')
    const elBtnReleasesKapat = document.getElementById('btnReleasesKapat')
    const elReleasesFilterTabs = document.getElementById('releasesFilterTabs')
    const elReleasesTimelineContainer = document.getElementById('releasesTimelineContainer')

    const elBtnAdminRelease = document.getElementById('btnAdminRelease')
    const elAdminReleaseModal = document.getElementById('adminReleaseModal')
    const elBtnAdminReleaseKapat = document.getElementById('btnAdminReleaseKapat')
    const elAdminFormVersion = document.getElementById('adminFormVersion')
    const elAdminFormTitle = document.getElementById('adminFormTitle')
    const elAdminFormChannel = document.getElementById('adminFormChannel')
    const elAdminFormMandatory = document.getElementById('adminFormMandatory')
    const elBtnAdminAddChange = document.getElementById('btnAdminAddChange')
    const elAdminChangesContainer = document.getElementById('adminChangesContainer')
    const elAdminValidationBox = document.getElementById('adminValidationBox')
    const elAdminReleasesTableBody = document.getElementById('adminReleasesTableBody')
    const elBtnAdminSaveDraft = document.getElementById('btnAdminSaveDraft')
    const elBtnAdminPublish = document.getElementById('btnAdminPublish')

    const elWhatsNewModal = document.getElementById('whatsNewModal')
    const elWhatsNewTitle = document.getElementById('whatsNewTitle')
    const elWhatsNewSubtitle = document.getElementById('whatsNewSubtitle')
    const elWhatsNewChangelogList = document.getElementById('whatsNewChangelogList')
    const elBtnWhatsNewGotIt = document.getElementById('btnWhatsNewGotIt')

    let currentAppVersion = '1.0.0'
    let currentAdminChanges = []

    // ---------------------------------------------------
    // 1. SÜRÜM & BAŞLANGIÇ YÜKLEMESİ
    // ---------------------------------------------------
    async function initVersionInfo() {
        try {
            currentAppVersion = await api.app.getVersion()
            if (elSplashCurrentVersion) elSplashCurrentVersion.textContent = `v${currentAppVersion}`
            if (elLauncherAppVersion) elLauncherAppVersion.textContent = `v${currentAppVersion}`
        } catch (e) { }

        // Aktif profili yükle ve göster
        try {
            const status = await api.bot.status()
            if (status && status.activeProfile) {
                if (elTopbarProfileName) elTopbarProfileName.textContent = status.activeProfile.name || 'Varsayılan Bot'
            }
        } catch (e) { }

        // "What's New" (Yenilikler) kontrolü
        checkWhatsNewScreen()
    }
    initVersionInfo()

    // ---------------------------------------------------
    // 2. STARTUP / UPDATE CENTER (SPLASH)
    // ---------------------------------------------------
    function openSplash(initialState = 'checking') {
        if (!elSplashModal) return
        elSplashModal.classList.add('active')
        updateSplashState(initialState)
    }

    function closeSplash() {
        if (elSplashModal) elSplashModal.classList.remove('active')
    }

    function updateSplashState(state, data = null) {
        if (!elSplashModal) return

        elSplashSpinner.style.display = 'none'
        elSplashIcon.classList.add('hidden')
        elSplashUpdateDetails.classList.add('hidden')
        elSplashProgressBox.classList.add('hidden')
        elBtnSplashUpdateNow.style.display = 'none'
        elBtnSplashInstallNow.style.display = 'none'
        elBtnSplashContinue.style.display = 'inline-flex'
        elBtnSplashRetry.style.display = 'none'

        if (state === 'checking') {
            elSplashSpinner.style.display = 'block'
            elSplashTitle.textContent = 'Güncellemeler Denetleniyor...'
            elSplashDesc.textContent = 'GitHub sunucusu ile sürüm doğrulaması yapılıyor'
        } else if (state === 'not-available') {
            elSplashIcon.classList.remove('hidden')
            elSplashIcon.textContent = '✓'
            elSplashIcon.style.color = '#22c55e'
            elSplashTitle.textContent = 'Uygulamanız Güncel'
            elSplashDesc.textContent = `En son kararlı sürümü kullanıyorsunuz (v${currentAppVersion})`
            // 1.5 saniye sonra otomatik kapat
            setTimeout(() => {
                closeSplash()
            }, 1500)
        } else if (state === 'available') {
            elSplashUpdateDetails.classList.remove('hidden')
            const info = data || {}
            elSplashTitle.textContent = 'Yeni Güncelleme Mevcut!'
            elSplashDesc.textContent = `v${currentAppVersion} → v${info.version || 'Yeni'}`
            elSplashNewVersionBadge.textContent = `v${info.version}`
            elSplashChannelBadge.textContent = info.channel === 'beta' ? 'Beta' : 'Kararlı'
            if (info.mandatory) {
                elSplashMandatoryBadge.classList.remove('hidden')
                elBtnSplashContinue.style.display = 'none' // Zorunlu ise atlama yok
            }

            if (info.title) elSplashUpdateTitle.textContent = info.title
            renderChangelogItems(elSplashChangelogList, info.changes || [], info.releaseNotes)

            elBtnSplashUpdateNow.style.display = 'inline-flex'
            if (elTopbarUpdateBadge) {
                elTopbarUpdateBadge.classList.remove('hidden')
                if (elTopbarUpdateText) elTopbarUpdateText.textContent = `v${info.version} Mevcut`
            }
        } else if (state === 'downloading') {
            elSplashTitle.textContent = 'Güncelleme İndiriliyor...'
            elSplashDesc.textContent = 'Lütfen indirme işlemi tamamlanana kadar bekleyin'
            elSplashProgressBox.classList.remove('hidden')
            elBtnSplashContinue.style.display = 'none'
        } else if (state === 'downloaded') {
            elSplashIcon.classList.remove('hidden')
            elSplashIcon.textContent = '✓'
            elSplashIcon.style.color = '#22c55e'
            elSplashTitle.textContent = 'Güncelleme Kuruluma Hazır!'
            elSplashDesc.textContent = 'Yeni sürümü yüklemek için uygulamayı yeniden başlatın.'
            elBtnSplashInstallNow.style.display = 'inline-flex'
        } else if (state === 'error') {
            elSplashIcon.classList.remove('hidden')
            elSplashIcon.textContent = '⚠️'
            elSplashIcon.style.color = '#f59e0b'
            elSplashTitle.textContent = 'Güncelleme Kontrol Edilemedi'
            elSplashDesc.textContent = (data && data.message) || 'Sunucuya bağlanılamadı. Çevrimdışı olarak devam edebilirsiniz.'
            elBtnSplashRetry.style.display = 'inline-flex'
        }
    }

    function renderChangelogItems(container, changes, releaseNotes) {
        if (!container) return
        container.innerHTML = ''

        if (Array.isArray(changes) && changes.length > 0) {
            changes.forEach(c => {
                const row = document.createElement('div')
                row.className = 'release-change-row'
                let tagClass = 'badge-cyan'
                let tagText = 'İyileştirme'

                if (c.type === 'feature') { tagClass = 'badge-success'; tagText = 'Özellik' }
                else if (c.type === 'fix') { tagClass = 'badge-danger'; tagText = 'Düzeltme' }
                else if (c.type === 'security') { tagClass = 'badge-amber'; tagText = 'Güvenlik' }
                else if (c.type === 'breaking') { tagClass = 'badge-danger'; tagText = 'Kritik' }

                row.innerHTML = `<span class="badge ${tagClass}" style="flex-shrink:0;">${tagText}</span> <span>${c.description}</span>`
                container.appendChild(row)
            })
            return
        }

        if (releaseNotes) {
            const raw = typeof releaseNotes === 'string'
                ? releaseNotes
                : (Array.isArray(releaseNotes) ? releaseNotes.map(n => n.note || n).join('\n') : '')
            const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0)

            if (lines.length > 0) {
                lines.forEach(line => {
                    const clean = line.replace(/^[*\-#0-9.)\s]+/, '').trim()
                    if (!clean) return
                    const row = document.createElement('div')
                    row.className = 'release-change-row'
                    let tagClass = 'badge-success'
                    let tagText = 'Yenilik'
                    if (/fix|düzeltme|hata|bug/i.test(line)) { tagClass = 'badge-danger'; tagText = 'Düzeltme' }
                    else if (/güvenlik|security/i.test(line)) { tagClass = 'badge-amber'; tagText = 'Güvenlik' }
                    else if (/performans|hız/i.test(line)) { tagClass = 'badge-cyan'; tagText = 'Performans' }

                    row.innerHTML = `<span class="badge ${tagClass}" style="flex-shrink:0;">${tagText}</span> <span>${clean}</span>`
                    container.appendChild(row)
                })
                return
            }
        }

        container.innerHTML = '<div style="color: var(--text-dim);">Ayrıntılı sürüm notu bulunmuyor.</div>'
    }

    // Updater Dinleyicileri
    api.updater.onStatus((state) => {
        updateSplashState(state.status, state.updateInfo || state.lastError)
        if (state.status === 'available' && elTopbarUpdateBadge) {
            elTopbarUpdateBadge.classList.remove('hidden')
            if (elTopbarUpdateText && state.updateInfo) elTopbarUpdateText.textContent = `v${state.updateInfo.version} Mevcut`
        }

        // Launcher / Ana Karşılama Ekranı Güncelleme Bildirimi
        if (state.status === 'checking') {
            if (elLauncherUpdateIcon) elLauncherUpdateIcon.textContent = '🔍'
            if (elLauncherUpdateText) elLauncherUpdateText.textContent = 'Güncellemeler denetleniyor...'
            if (elLauncherUpdateAlert) elLauncherUpdateAlert.classList.add('hidden')
        } else if (state.status === 'not-available') {
            if (elLauncherUpdateIcon) elLauncherUpdateIcon.textContent = '✓'
            if (elLauncherUpdateText) elLauncherUpdateText.innerHTML = '<span style="color: #22c55e; font-weight: 600;">Sürümünüz Güncel</span> <span style="color: var(--text-dim);">(En son sürüm)</span>'
            if (elLauncherUpdateAlert) elLauncherUpdateAlert.classList.add('hidden')
        } else if (state.status === 'available') {
            const info = state.updateInfo || {}
            if (elLauncherUpdateIcon) elLauncherUpdateIcon.textContent = '🚀'
            if (elLauncherUpdateText) elLauncherUpdateText.innerHTML = `<strong style="color: #38bdf8;">Yeni Sürüm: v${info.version}</strong>`
            if (elLauncherUpdateAlert) {
                elLauncherUpdateAlert.classList.remove('hidden')
                if (elLauncherNewVersionBadge) elLauncherNewVersionBadge.textContent = `v${info.version}`
                if (elLauncherAlertTitle) elLauncherAlertTitle.textContent = info.title || 'Yeni sürüm yayınlandı!'
            }
        } else if (state.status === 'error') {
            if (elLauncherUpdateIcon) elLauncherUpdateIcon.textContent = '⚠️'
            if (elLauncherUpdateText) elLauncherUpdateText.textContent = 'Güncelleme sunucusuna bağlanılamadı (Çevrimdışı)'
        }
    })

    api.updater.onProgress((progress) => {
        if (elSplashProgressFill) elSplashProgressFill.style.width = `${progress.percent}%`
        if (elSplashProgressText) elSplashProgressText.textContent = `İndiriliyor: %${progress.percent}`
        if (elSplashProgressSpeed) {
            const kb = Math.round((progress.bytesPerSecond || 0) / 1024)
            elSplashProgressSpeed.textContent = `${kb} KB/s`
        }
    })

    // Splash Buton Olayları
    if (elBtnSplashUpdateNow) elBtnSplashUpdateNow.onclick = () => api.updater.download()
    if (elBtnSplashInstallNow) elBtnSplashInstallNow.onclick = () => api.updater.install()
    if (elBtnSplashContinue) elBtnSplashContinue.onclick = () => closeSplash()
    if (elBtnSplashRetry) elBtnSplashRetry.onclick = () => api.updater.check()
    if (elTopbarUpdateBadge) elTopbarUpdateBadge.onclick = () => openSplash('available')

    // Launcher Buton Olayları
    if (elBtnLauncherContinue) elBtnLauncherContinue.onclick = () => closeModal(elProfilesModal)
    if (elBtnLauncherUpdateNow) elBtnLauncherUpdateNow.onclick = () => api.updater.download()
    if (elBtnLauncherSettings) elBtnLauncherSettings.onclick = () => { loadSettings(); openModal(elSettingsModal); }
    if (elBtnLauncherReleases) elBtnLauncherReleases.onclick = () => { loadReleasesTimeline(); openModal(elReleasesModal); }

    // Başlangıç Açılış Deneyimi (Ana Karşılama ve Bot Hesap Seçim Ekranı - Launcher)
    loadProfilesList()
    openModal(elProfilesModal)
    setTimeout(() => {
        api.updater.check().catch(() => {})
    }, 250)

    // ---------------------------------------------------
    // 3. WHAT'S NEW (YENİLİKLER) EKRANI
    // ---------------------------------------------------
    async function checkWhatsNewScreen() {
        try {
            const settings = await api.settings.get()
            const lastSeen = settings.meta ? settings.meta.lastSeenRelease : null

            if (lastSeen !== currentAppVersion) {
                // Güncelleme sonrası ilk açılış: Yenilikleri göster
                const release = await api.releases.getLatest(settings.updates ? settings.updates.channel : 'stable')
                if (release && release.version === currentAppVersion && elWhatsNewModal) {
                    if (elWhatsNewTitle) elWhatsNewTitle.textContent = `🎉 EmsalClient v${currentAppVersion}`
                    if (elWhatsNewSubtitle) elWhatsNewSubtitle.textContent = release.title || 'Uygulama başarıyla güncellendi.'
                    renderChangelogItems(elWhatsNewChangelogList, release.changes || [])
                    elWhatsNewModal.classList.add('active')
                }
            }
        } catch (e) { }
    }

    if (elBtnWhatsNewGotIt) {
        elBtnWhatsNewGotIt.onclick = async () => {
            if (elWhatsNewModal) elWhatsNewModal.classList.remove('active')
            try {
                await api.settings.update({ meta: { lastSeenRelease: currentAppVersion } })
            } catch (e) { }
        }
    }

    // ---------------------------------------------------
    // 4. BOT PROFİLLERİ (PROFILES) YÖNETİMİ
    // ---------------------------------------------------
    async function loadProfilesList() {
        if (!elProfilesListGrid) return
        try {
            const profiles = await api.profiles.list()
            const activeStatus = await api.bot.status()
            const activeId = activeStatus.activeProfile ? activeStatus.activeProfile.id : null

            if (elProfilesCountBadge) elProfilesCountBadge.textContent = profiles.length
            elProfilesListGrid.innerHTML = ''

            if (profiles.length === 0) {
                elProfilesListGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
                        <div style="font-size: 32px; margin-bottom: 8px;">👤</div>
                        <div style="font-size: 14px; font-weight: 600; color: var(--text-muted);">Kayıtlı Profil Yok</div>
                        <p style="font-size: 12px; margin-top: 4px;">Başlamak için "Yeni Profil" butonuna tıklayarak ilk botunuzu tanımlayın.</p>
                    </div>
                `
                return
            }

            profiles.forEach(p => {
                const isActive = p.id === activeId
                const card = document.createElement('div')
                card.className = `profile-card ${isActive ? 'active-profile' : ''}`

                const statusTag = isActive
                    ? `<span class="badge badge-success">● Aktif Profil</span>`
                    : `<span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-dim);">Boşta</span>`

                const lockTag = p.hasPassword
                    ? `<span class="badge badge-primary" title="Şifre donanım seviyesinde şifreli">🔒 Korumalı</span>`
                    : `<span class="badge badge-amber" title="Şifre tanımlanmamış">⚠️ Şifresiz</span>`

                const honeyTag = p.settings && p.settings.autoHoneyHarvest
                    ? `<span class="badge badge-amber">🐝 Oto Bal</span>`
                    : ''

                card.innerHTML = `
                    <div class="profile-card-header">
                        <div>
                            <div class="profile-card-title">${p.name}</div>
                            <div class="profile-card-server">${p.username}@${p.server}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${statusTag}
                        </div>
                    </div>

                    <div class="profile-card-meta">
                        ${lockTag}
                        <span class="badge badge-cyan">Doluluk: %${p.settings?.targetPercentage || 80}</span>
                        <span class="badge badge-cyan">Kontrol: ${p.settings?.checkInterval || 30}sn</span>
                        ${honeyTag}
                    </div>

                    <div class="profile-card-actions">
                        ${!isActive ? `<button class="btn btn-success btn-sm btn-prof-launch" data-id="${p.id}">Başlat / Seç</button>` : `<button class="btn btn-primary btn-sm btn-prof-continue" data-id="${p.id}">Panele Geç (Aktif)</button>`}
                        <button class="btn btn-secondary btn-sm btn-prof-edit" data-id="${p.id}">Düzenle</button>
                        <button class="btn btn-secondary btn-sm btn-prof-duplicate" data-id="${p.id}">Kopyala</button>
                        ${!isActive ? `<button class="btn btn-danger btn-sm btn-prof-delete" data-id="${p.id}">Sil</button>` : ''}
                    </div>
                `

                card.onclick = (e) => {
                    if (e.target.closest('button') || e.target.closest('input')) return
                    if (isActive) {
                        closeModal(elProfilesModal)
                    }
                }

                elProfilesListGrid.appendChild(card)
            })

            // Buton Olayları Bağlama
            elProfilesListGrid.querySelectorAll('.btn-prof-continue').forEach(b => {
                b.onclick = () => closeModal(elProfilesModal)
            })

            elProfilesListGrid.querySelectorAll('.btn-prof-launch').forEach(b => {
                b.onclick = async () => {
                    const id = b.getAttribute('data-id')
                    try {
                        b.disabled = true
                        b.textContent = 'Başlatılıyor...'
                        await api.profiles.launch(id)
                        showToast('Profil başarıyla seçildi ve bot başlatıldı!', 'success')
                        closeModal(elProfilesModal)
                    } catch (err) {
                        showToast(`Başlatma hatası: ${err.message}`, 'danger')
                    }
                }
            })

            elProfilesListGrid.querySelectorAll('.btn-prof-edit').forEach(b => {
                b.onclick = () => openEditProfileModal(b.getAttribute('data-id'))
            })

            elProfilesListGrid.querySelectorAll('.btn-prof-duplicate').forEach(b => {
                b.onclick = async () => {
                    try {
                        await api.profiles.duplicate(b.getAttribute('data-id'))
                        showToast('Profil kopyalandı.', 'success')
                        loadProfilesList()
                    } catch (err) {
                        showToast(`Kopyalama hatası: ${err.message}`, 'danger')
                    }
                }
            })

            elProfilesListGrid.querySelectorAll('.btn-prof-delete').forEach(b => {
                b.onclick = async () => {
                    if (confirm('Bu profili silmek istediğinize emin misiniz?')) {
                        try {
                            await api.profiles.delete(b.getAttribute('data-id'))
                            showToast('Profil silindi.', 'warning')
                            loadProfilesList()
                        } catch (err) {
                            showToast(`Silme hatası: ${err.message}`, 'danger')
                        }
                    }
                }
            })
        } catch (e) {
            console.error('Profiller yüklenirken hata:', e)
        }
    }

    async function openEditProfileModal(profileId = null) {
        if (!elProfileEditModal) return
        if (profileId) {
            // Düzenleme modu
            try {
                const p = await api.profiles.get(profileId)
                if (!p) return
                elProfileEditModalTitle.textContent = 'Profili Düzenle'
                elEditProfileId.value = p.id
                elFormProfName.value = p.name || ''
                elFormProfServer.value = p.server || ''
                elFormProfUsername.value = p.username || ''
                elFormProfPassword.value = ''
                elFormProfPassword.placeholder = p.hasPassword ? '●●●●●● (Mevcut şifre korunur, değiştirmek için yazın)' : 'Şifre girin'
                elFormProfIslandOwner.value = p.islandOwner || ''
                elFormProfTargetPercent.value = p.settings?.targetPercentage || 80
                elFormProfInterval.value = p.settings?.checkInterval || 30
                elFormProfTestMode.checked = Boolean(p.settings?.testMode)
                elFormProfAutoHoney.checked = Boolean(p.settings?.autoHoneyHarvest)
            } catch (e) { }
        } else {
            // Yeni oluşturma modu
            elProfileEditModalTitle.textContent = 'Yeni Bot Profili'
            elEditProfileId.value = ''
            elFormProfName.value = ''
            elFormProfServer.value = 'oyna.aesirmc.com'
            elFormProfUsername.value = ''
            elFormProfPassword.value = ''
            elFormProfPassword.placeholder = 'Giriş şifresi'
            elFormProfIslandOwner.value = ''
            elFormProfTargetPercent.value = 80
            elFormProfInterval.value = 30
            elFormProfTestMode.checked = true
            elFormProfAutoHoney.checked = true
        }
        elProfileEditModal.classList.add('active')
    }

    // Şifre Göster/Gizle Butonu
    if (elBtnTogglePasswordEye) {
        elBtnTogglePasswordEye.onclick = () => {
            if (elFormProfPassword.type === 'password') {
                elFormProfPassword.type = 'text'
                elBtnTogglePasswordEye.textContent = '🙈'
            } else {
                elFormProfPassword.type = 'password'
                elBtnTogglePasswordEye.textContent = '👁️'
            }
        }
    }

    // Profil Kaydetme
    if (elBtnProfileEditSave) {
        elBtnProfileEditSave.onclick = async () => {
            const name = elFormProfName.value.trim()
            const server = elFormProfServer.value.trim()
            const username = elFormProfUsername.value.trim()
            const password = elFormProfPassword.value
            const id = elEditProfileId.value

            if (!name || !server || !username) {
                showToast('Lütfen Profil Adı, Sunucu IP ve Kullanıcı Adı alanlarını doldurun!', 'warning')
                return
            }

            const profileData = {
                name,
                server,
                username,
                islandOwner: elFormProfIslandOwner.value.trim(),
                settings: {
                    targetPercentage: Number(elFormProfTargetPercent.value) || 80,
                    checkInterval: Number(elFormProfInterval.value) || 30,
                    testMode: elFormProfTestMode.checked,
                    autoHoneyHarvest: elFormProfAutoHoney.checked
                }
            }

            try {
                if (id) {
                    await api.profiles.update(id, profileData, password || null)
                    showToast('Profil başarıyla güncellendi.', 'success')
                } else {
                    await api.profiles.create(profileData, password || null)
                    showToast('Yeni profil oluşturuldu.', 'success')
                }
                closeModal(elProfileEditModal)
                loadProfilesList()
            } catch (err) {
                showToast(`Kaydetme hatası: ${err.message}`, 'danger')
            }
        }
    }

    // Dışa & İçe Aktarma
    if (elBtnProfilExport) {
        elBtnProfilExport.onclick = async () => {
            try {
                const jsonStr = await api.profiles.export()
                const blob = new Blob([jsonStr], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `emsalclient-profiles-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                URL.revokeObjectURL(url)
                showToast('Profiller JSON dosyası olarak indirildi.', 'success')
            } catch (err) {
                showToast(`Dışa aktarma hatası: ${err.message}`, 'danger')
            }
        }
    }

    if (elBtnProfilImport && elInputProfilImportFile) {
        elBtnProfilImport.onclick = () => elInputProfilImportFile.click()
        elInputProfilImportFile.onchange = (e) => {
            const file = e.target.files[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = async (event) => {
                try {
                    const result = await api.profiles.import(event.target.result)
                    if (result.success) {
                        showToast(`${result.count} adet profil içe aktarıldı.`, 'success')
                        loadProfilesList()
                    } else {
                        showToast(`İçe aktarma hatası: ${result.message}`, 'danger')
                    }
                } catch (err) {
                    showToast('Geçersiz JSON dosyası.', 'danger')
                }
            }
            reader.readAsText(file)
            elInputProfilImportFile.value = ''
        }
    }

    if (elBtnProfiller) {
        elBtnProfiller.onclick = () => {
            loadProfilesList()
            openModal(elProfilesModal)
        }
    }
    if (elBtnTopbarProfile) {
        elBtnTopbarProfile.onclick = () => {
            loadProfilesList()
            openModal(elProfilesModal)
        }
    }
    if (elBtnProfilesKapat) elBtnProfilesKapat.onclick = () => closeModal(elProfilesModal)
    if (elBtnProfileEditKapat) elBtnProfileEditKapat.onclick = () => closeModal(elProfileEditModal)
    if (elBtnProfileEditCancel) elBtnProfileEditCancel.onclick = () => closeModal(elProfileEditModal)
    if (elBtnYeniProfilAc) elBtnYeniProfilAc.onclick = () => openEditProfileModal()

    // ---------------------------------------------------
    // 5. UYGULAMA AYARLARI (SETTINGS)
    // ---------------------------------------------------
    async function loadSettings() {
        try {
            const s = await api.settings.get()
            if (!s) return
            if (elSettingUpdateChannel) elSettingUpdateChannel.value = s.updates?.channel || 'stable'
            if (elSettingAutoCheck) elSettingAutoCheck.checked = Boolean(s.updates?.autoCheck)
            if (elSettingMinimizeToTray) elSettingMinimizeToTray.checked = Boolean(s.application?.minimizeToTray)
            if (elSettingCloseToTray) elSettingCloseToTray.checked = Boolean(s.application?.closeToTray)
        } catch (e) { }
    }

    if (elBtnSettings) {
        elBtnSettings.onclick = () => {
            loadSettings()
            if (elManualUpdateCheckResult) elManualUpdateCheckResult.textContent = ''
            openModal(elSettingsModal)
        }
    }
    if (elBtnSettingsKapat) elBtnSettingsKapat.onclick = () => closeModal(elSettingsModal)

    if (elBtnOpenLogsFolder) {
        elBtnOpenLogsFolder.onclick = () => api.logs.openFolder()
    }

    if (elBtnManualUpdateCheck) {
        elBtnManualUpdateCheck.onclick = async () => {
            if (elManualUpdateCheckResult) elManualUpdateCheckResult.textContent = 'Kontrol ediliyor...'
            try {
                await api.updater.check()
                if (elManualUpdateCheckResult) elManualUpdateCheckResult.textContent = 'Kontrol başlatıldı.'
            } catch (e) {
                if (elManualUpdateCheckResult) elManualUpdateCheckResult.textContent = 'Hata oluştu.'
            }
        }
    }

    if (elBtnSaveSettings) {
        elBtnSaveSettings.onclick = async () => {
            const updates = {
                updates: {
                    channel: elSettingUpdateChannel.value,
                    autoCheck: elSettingAutoCheck.checked
                },
                application: {
                    minimizeToTray: elSettingMinimizeToTray.checked,
                    closeToTray: elSettingCloseToTray.checked
                }
            }
            try {
                await api.settings.update(updates)
                showToast('Ayarlar başarıyla kaydedildi.', 'success')
                closeModal(elSettingsModal)
            } catch (err) {
                showToast(`Ayar kaydetme hatası: ${err.message}`, 'danger')
            }
        }
    }

    // ---------------------------------------------------
    // 6. SÜRÜM GEÇMİŞİ (RELEASES HISTORY)
    // ---------------------------------------------------
    async function loadReleasesTimeline(channel = 'all') {
        if (!elReleasesTimelineContainer) return
        elReleasesTimelineContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Sürümler yükleniyor...</div>'

        try {
            const targetChannel = channel === 'all' ? null : channel
            const list = await api.releases.list(targetChannel)
            elReleasesTimelineContainer.innerHTML = ''

            if (!list || list.length === 0) {
                elReleasesTimelineContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Kayıtlı sürüm bulunamadı.</div>'
                return
            }

            list.forEach(r => {
                const card = document.createElement('div')
                card.className = 'release-card'

                let statusBadge = ''
                if (r.status === 'published') {
                    statusBadge = '<span class="badge badge-success">Yayınlandı</span>'
                } else if (r.status === 'withdrawn') {
                    statusBadge = '<span class="badge badge-danger">⚠️ Geri Çekildi</span>'
                } else {
                    statusBadge = '<span class="badge" style="background: rgba(255,255,255,0.1); color: var(--text-muted);">Taslak</span>'
                }

                const channelBadge = r.channel === 'beta'
                    ? '<span class="badge badge-amber">Beta</span>'
                    : '<span class="badge badge-cyan">Kararlı</span>'

                const mandatoryBadge = r.mandatory ? '<span class="badge badge-danger">Zorunlu</span>' : ''

                card.innerHTML = `
                    <div class="release-card-header">
                        <div>
                            <span class="release-card-title">v${r.version} — ${r.title}</span>
                            <span style="font-size: 11px; color: var(--text-dim); margin-left: 8px;">${r.releaseDate}</span>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            ${channelBadge}
                            ${statusBadge}
                            ${mandatoryBadge}
                        </div>
                    </div>
                    ${r.withdrawReason ? `<div style="font-size: 11px; color: #f87171; background: rgba(239,68,68,0.1); padding: 4px 8px; border-radius: 4px;">Geri Çekme Nedeni: ${r.withdrawReason}</div>` : ''}
                    <div class="splash-changelog-box" style="max-height: none; margin-top: 4px;"></div>
                `
                const box = card.querySelector('.splash-changelog-box')
                renderChangelogItems(box, r.changes || [])
                elReleasesTimelineContainer.appendChild(card)
            })
        } catch (e) {
            elReleasesTimelineContainer.innerHTML = '<div style="color: #f87171; text-align: center; padding: 20px;">Sürümler yüklenemedi.</div>'
        }
    }

    if (elBtnReleaseHistory) {
        elBtnReleaseHistory.onclick = () => {
            loadReleasesTimeline('all')
            openModal(elReleasesModal)
        }
    }
    if (elBtnReleasesKapat) elBtnReleasesKapat.onclick = () => closeModal(elReleasesModal)

    if (elReleasesFilterTabs) {
        elReleasesFilterTabs.querySelectorAll('.segmented-tab-btn').forEach(btn => {
            btn.onclick = () => {
                elReleasesFilterTabs.querySelectorAll('.segmented-tab-btn').forEach(b => b.classList.remove('active'))
                btn.classList.add('active')
                loadReleasesTimeline(btn.getAttribute('data-channel'))
            }
        })
    }

    // ---------------------------------------------------
    // 7. ADMIN SÜRÜM YÖNETİM PANELİ
    // ---------------------------------------------------
    function renderAdminChangesList() {
        if (!elAdminChangesContainer) return
        elAdminChangesContainer.innerHTML = ''

        if (currentAdminChanges.length === 0) {
            elAdminChangesContainer.innerHTML = '<div style="font-size: 11.5px; color: var(--text-dim); font-style: italic;">Henüz değişiklik maddesi eklenmedi. "+ Madde Ekle" butonunu kullanın.</div>'
            return
        }

        currentAdminChanges.forEach((item, index) => {
            const row = document.createElement('div')
            row.className = 'admin-change-row'
            row.innerHTML = `
                <select class="sort-select change-type-select" data-index="${index}">
                    <option value="feature" ${item.type === 'feature' ? 'selected' : ''}>✨ Yeni Özellik</option>
                    <option value="fix" ${item.type === 'fix' ? 'selected' : ''}>🐛 Hata Çözümü</option>
                    <option value="improvement" ${item.type === 'improvement' ? 'selected' : ''}>⚡ İyileştirme</option>
                    <option value="security" ${item.type === 'security' ? 'selected' : ''}>🔒 Güvenlik</option>
                    <option value="breaking" ${item.type === 'breaking' ? 'selected' : ''}>⚠️ Kritik Değişiklik</option>
                </select>
                <input type="text" class="change-desc-input" data-index="${index}" placeholder="Değişiklik açıklaması..." value="${item.description}">
                <button type="button" class="btn btn-danger btn-sm btn-remove-change" data-index="${index}" style="padding: 6px;">✕</button>
            `
            elAdminChangesContainer.appendChild(row)
        })

        elAdminChangesContainer.querySelectorAll('.change-type-select').forEach(s => {
            s.onchange = () => {
                currentAdminChanges[s.getAttribute('data-index')].type = s.value
            }
        })

        elAdminChangesContainer.querySelectorAll('.change-desc-input').forEach(inp => {
            inp.oninput = () => {
                currentAdminChanges[inp.getAttribute('data-index')].description = inp.value
            }
        })

        elAdminChangesContainer.querySelectorAll('.btn-remove-change').forEach(b => {
            b.onclick = () => {
                currentAdminChanges.splice(b.getAttribute('data-index'), 1)
                renderAdminChangesList()
            }
        })
    }

    if (elBtnAdminAddChange) {
        elBtnAdminAddChange.onclick = () => {
            currentAdminChanges.push({ type: 'feature', description: '' })
            renderAdminChangesList()
        }
    }

    async function loadAdminReleasesTable() {
        if (!elAdminReleasesTableBody) return
        try {
            const list = await api.releases.list()
            elAdminReleasesTableBody.innerHTML = ''

            list.forEach(r => {
                const tr = document.createElement('tr')
                let statusBadge = ''
                if (r.status === 'published') statusBadge = '<span class="badge badge-success">Yayınlandı</span>'
                else if (r.status === 'withdrawn') statusBadge = '<span class="badge badge-danger">Geri Çekildi</span>'
                else statusBadge = '<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-dim);">Taslak</span>'

                let actions = ''
                if (r.status === 'draft') {
                    actions = `
                        <button class="btn btn-success btn-sm btn-admin-table-pub" data-id="${r.id}">Yayınla</button>
                        <button class="btn btn-danger btn-sm btn-admin-table-del" data-id="${r.id}">Sil</button>
                    `
                } else if (r.status === 'published') {
                    actions = `<button class="btn btn-danger btn-sm btn-admin-table-with" data-id="${r.id}">Geri Çek</button>`
                }

                tr.innerHTML = `
                    <td><strong>v${r.version}</strong></td>
                    <td>${r.title}</td>
                    <td>${r.channel}</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                `
                elAdminReleasesTableBody.appendChild(tr)
            })

            elAdminReleasesTableBody.querySelectorAll('.btn-admin-table-pub').forEach(b => {
                b.onclick = async () => {
                    try {
                        await api.releases.publish(b.getAttribute('data-id'))
                        showToast('Sürüm yayınlandı!', 'success')
                        loadAdminReleasesTable()
                    } catch (err) {
                        showToast(`Yayınlama hatası: ${err.message}`, 'danger')
                    }
                }
            })

            elAdminReleasesTableBody.querySelectorAll('.btn-admin-table-with').forEach(b => {
                b.onclick = async () => {
                    const reason = prompt('Lütfen geri çekme nedenini yazın:', 'Kritik hata tespit edildi')
                    if (reason) {
                        try {
                            await api.releases.withdraw(b.getAttribute('data-id'), reason)
                            showToast('Sürüm geri çekildi!', 'warning')
                            loadAdminReleasesTable()
                        } catch (err) {
                            showToast(`Hata: ${err.message}`, 'danger')
                        }
                    }
                }
            })

            elAdminReleasesTableBody.querySelectorAll('.btn-admin-table-del').forEach(b => {
                b.onclick = async () => {
                    if (confirm('Bu taslağı silmek istediğinize emin misiniz?')) {
                        try {
                            await api.releases.deleteDraft(b.getAttribute('data-id'))
                            showToast('Taslak silindi.', 'success')
                            loadAdminReleasesTable()
                        } catch (err) {
                            showToast(`Hata: ${err.message}`, 'danger')
                        }
                    }
                }
            })
        } catch (e) { }
    }

    if (elBtnAdminRelease) {
        elBtnAdminRelease.onclick = () => {
            currentAdminChanges = [{ type: 'feature', description: '' }]
            renderAdminChangesList()
            loadAdminReleasesTable()
            if (elAdminValidationBox) elAdminValidationBox.classList.add('hidden')
            openModal(elAdminReleaseModal)
        }
    }
    if (elBtnAdminReleaseKapat) elBtnAdminReleaseKapat.onclick = () => closeModal(elAdminReleaseModal)

    async function submitAdminRelease(publishNow = false) {
        const version = elAdminFormVersion.value.trim()
        const title = elAdminFormTitle.value.trim()
        const channel = elAdminFormChannel.value
        const mandatory = elAdminFormMandatory.checked

        const releaseData = {
            version,
            title,
            channel,
            mandatory,
            changes: currentAdminChanges,
            status: publishNow ? 'published' : 'draft'
        }

        const val = await api.releases.validate(releaseData)
        if (!val.isValid) {
            if (elAdminValidationBox) {
                elAdminValidationBox.classList.remove('hidden')
                elAdminValidationBox.innerHTML = `<strong>Doğrulama Hatası:</strong><br>${val.errors.join('<br>')}`
            }
            return
        }

        if (elAdminValidationBox) elAdminValidationBox.classList.add('hidden')

        try {
            await api.releases.create(releaseData)
            showToast(publishNow ? 'Yeni sürüm yayınlandı!' : 'Sürüm taslağı kaydedildi.', 'success')
            elAdminFormVersion.value = ''
            elAdminFormTitle.value = ''
            currentAdminChanges = [{ type: 'feature', description: '' }]
            renderAdminChangesList()
            loadAdminReleasesTable()
        } catch (err) {
            showToast(`Hata: ${err.message}`, 'danger')
        }
    }

    if (elBtnAdminSaveDraft) elBtnAdminSaveDraft.onclick = () => submitAdminRelease(false)
    if (elBtnAdminPublish) elBtnAdminPublish.onclick = () => submitAdminRelease(true)

    // ---------------------------------------------------
    // 8. TRAY & KLAVYE KISAYOLLARI (SHORTCUTS)
    // ---------------------------------------------------
    api.app.onNavigate((view) => {
        if (view === 'profiles') {
            loadProfilesList()
            openModal(elProfilesModal)
        } else if (view === 'dashboard') {
            closeModal(elProfilesModal)
            closeModal(elSettingsModal)
            closeModal(elReleasesModal)
            closeModal(elAdminReleaseModal)
        }
    })

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key.toLowerCase() === 'p') {
            e.preventDefault()
            loadProfilesList()
            openModal(elProfilesModal)
        } else if (e.ctrlKey && e.key === ',') {
            e.preventDefault()
            loadSettings()
            openModal(elSettingsModal)
        }
    })

    // Modal Açma/Kapama Yardımcıları
    function openModal(modalEl) {
        if (modalEl) modalEl.classList.add('active')
    }
    function closeModal(modalEl) {
        if (modalEl) modalEl.classList.remove('active')
    }
}

