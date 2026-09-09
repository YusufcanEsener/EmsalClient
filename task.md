# EmsalClient — Profesyonel Minecraft AFK & Ada Otomasyonu (task.md)

Bu dosya, uygulamanın adım adım profesyonelleştirilmesini ve tamamlanan adımları takip etmek için oluşturulmuştur. Tamamlanan maddelerin üzeri çizilecek (`~~madde~~`) ve `[x]` olarak işaretlenecektir.

---

## 📌 Faz 1: Altyapı, Bağımlılıklar & Build Hazırlığı
- [x] ~~`.gitignore` dosyasının oluşturulması (node_modules, dist, userData, vb.)~~
- [x] ~~Gerekli bağımlılıkların eklenmesi (`electron-updater`, `semver`)~~
- [x] ~~`package.json` build konfigürasyonunun güncellenmesi (GitHub Releases provider, NSIS installer + Portable)~~
- [x] ~~`.github/workflows/build.yml` ve `release.yml` GitHub Actions CI/CD dosyalarının oluşturulması~~

## 📌 Faz 2: Klasör Yapısı, Güvenli Veri Yolları (userData) & IPC Mimarisi
- [x] ~~`src/` modüler mimari dizin yapısının kurulması (`src/bot`, `src/profiles`, `src/settings`, `src/updater`, `src/releases`, `src/utils`, `src/tray`)~~
- [x] ~~`app.getPath('userData')` tabanlı depolama yöneticisi (`src/utils/paths.js`)~~
- [x] ~~Güvenlik sertleştirmesi (`contextIsolation: true`, `nodeIntegration: false`)~~
- [x] ~~Güvenli, ad alanlı (namespaced) Preload API (`window.api.app.*`, `api.bot.*`, `api.profiles.*`, `api.updater.*`, `api.settings.*`, `api.logs.*`, `api.admin.*`) ve geriye dönük uyumluluk (`window.electronAPI`)~~

## 📌 Faz 3: Güvenli Kimlik Depolama (`safeStorage`), Ayarlar & Yapılandırılmış Loglama
- [x] ~~Yapılandırılmış Loglama Sistemi (`src/utils/logger.js` - `application.log`, `bot.log`, `updater.log`, hassas veri maskeleme, safe error IDs)~~
- [x] ~~`SettingsStore` (`src/settings/settings-store.js` - tema, güncelleme kanalı, tepsi ayarları, oto-güncelleme)~~
- [x] ~~`CredentialStore` (`src/profiles/credential-store.js` - `electron.safeStorage` ile DPAPI şifreleme, plaintext şifreleri kaldırma)~~
- [x] ~~`ProfileStore` (`src/profiles/profile-store.js` - CRUD, kopyalama, meta veriler: `lastUsedAt`, `status`, import/export)~~

## 📌 Faz 4: Bot Motoru & BotManager Entegrasyonu (Geriye Dönük Uyumluluk)
- [x] ~~`src/bot/bot-manager.js` oluşturulması: Çalışma zamanı (runtime state) ile profil konfigürasyonunun ayrılması~~
- [x] ~~`main.js` (1901 satırlık Mineflayer motoru) entegrasyonu: Var olan hiçbir bot/kovan/minyon mantığı BOZULMADAN, dinamik profil ayarları ve güvenli şifre enjeksiyonu ile çalışabilir hale getirilmesi~~
- [x] ~~REST API ve EventEmitter köprüsünün korunması~~

## 📌 Faz 5: Güncelleme Motoru (electron-updater + GitHub Releases) & Kanallar
- [x] ~~`src/updater/updater-manager.js` (native `electron-updater` döngüsü: check -> available -> download -> downloaded -> quitAndInstall)~~
- [x] ~~Güncelleme kanalları (`stable`, `beta`) ve semver filtreleme~~
- [x] ~~Geri çekilen / iptal edilen (`withdrawn`, `deprecated`) sürüm kontrolü~~
- [x] ~~Çevrimdışı (offline) modu toleransı ve hata yakalama~~

## 📌 Faz 6: Açılış Deneyimi & Startup Güncelleme / Duyuru Merkezi
- [x] ~~Açılış akışı (Splash / Startup Check modalı)~~
- [x] ~~Güncelleme durumları UI (Kontrol ediliyor, Güncelsiniz, Güncelleme Var, İndiriliyor %, Yeniden Başlat, Çevrimdışı)~~
- [x] ~~Sürüm notları / Değişiklik listesi (Changelog) gösterimi~~

## 📌 Faz 7: Sürüm Geçmişi & Güncelleme Sonrası "Yenilikler" (What's New)
- [x] ~~`releases.json` yerel sürüm kataloğu ve `src/releases/release-manager.js`~~
- [x] ~~Tek seferlik "Neler Yeni?" (What's New) modalı~~
- [x] ~~Sürüm geçmişi (Release History) paneli~~
- [x] ~~Arayüzde bildirim rozeti (Update badge)~~

## 📌 Faz 8: Windows Sistem Tepsisi (System Tray) & Bildirimler
- [x] ~~`src/tray/tray-manager.js` (Tepsi ikonu, durum göstergesi, Dashboard Aç, Profiller, Güncellemeleri Denetle, Çıkış)~~
- [x] ~~Tepsiye küçültme / Kapatınca tepsiye gönderme mantığı~~

## 📌 Faz 9: Hata Yönetimi & Log Arayüzü
- [x] ~~Benzersiz Hata Kodu (Error ID) üretici ve güvenli hata raporlama~~
- [x] ~~UI: "Log Klasörünü Aç" ve "Hatayı Kopyala" işlevleri~~

## 📌 Faz 10: Admin Sürüm Yönetim Paneli
- [x] ~~Admin arayüzü: Sürüm Oluşturma, Düzenleme, Taslak Kaydetme, Yayınlama, Geri Çekme (Withdraw)~~
- [x] ~~Katı semver ve sürüm doğrulama motoru (Validation Engine)~~
- [x] ~~Değişiklik tipleri (Feature, Fix, Improvement, Security, Breaking)~~

## 📌 Faz 11: GitHub Actions CI/CD İş Akışları
- [x] ~~`.github/workflows/build.yml` (Windows x64 derleme ve test doğrulama)~~
- [x] ~~`.github/workflows/release.yml` (Tag veya sürüm tetiklendiğinde installer + portable build + GitHub Release + latest.yml yayınlama)~~

## 📌 Faz 12: Otomatik Migrasyon (Migration) & İlk Açılış Rehberi (Onboarding)
- [x] ~~Eski `main.js` içindeki sabit `AYARLAR` bilgilerini tespit edip otomatik olarak ilk "Varsayılan" profile güvenli dönüştürme~~
- [x] ~~Eski şifreyi `safeStorage` içine alıp açık metin şifreyi temizleme~~
- [x] ~~İlk açılışta profil yoksa hoş geldin / profil sihirbazı~~

## 📌 Faz 13: Dashboard UI/UX Entegrasyonu & Profesyonel Cila
- [x] ~~Profil Değiştirici / Yönetici ekranı UI~~
- [x] ~~Ayarlar (Settings) modalı UI~~
- [x] ~~Güncelleme Merkezi & Admin paneli UI~~
- [x] ~~Linear/Raycast karanlık tema uyumu, mikro animasyonlar ve boş durumlar (Empty States)~~

## 📌 Faz 14: Testler, Doğrulama & Derleme Kontrolü
- [x] ~~Profil CRUD testleri~~
- [x] ~~Bot başlatma / durdurma / kovan / minyon geriye dönük uyumluluk testi~~
- [x] ~~Updater döngüsü simülasyonu~~
- [x] ~~Electron syntax, modül ve paketleme doğrulaması~~
