# Tamir Masası — doğrulama kaydı

25 Ekim 2026, Windows / PowerShell; Node.js 24.12.0 ve npm 10.9.1. Tamamen yerel çalışma. Önceki günlük proje klasörleri değiştirilmedi; push, uzak depo, yayın veya deployment yapılmadı.

| Kontrol | Sonuç |
| --- | --- |
| Bağımlılık kurulumu | npm kurulumları başarılı, kesin sürümler ve package-lock hazır |
| `npm run lint` | ESLint 0 hata, 0 uyarı |
| `npm run typecheck` | İstemci, backend, paylaşılan tipler ve testler başarılı |
| `npm test` | 13 backend/API testi geçti |
| `npm run build` | Vite production React build ve Node backend derlemesi başarılı |
| `npx playwright install chromium` | Chromium hazır |
| `npm run test:e2e` | Production Fastify + React üzerinde 6 test geçti |
| Mobil ekran görüntüsü düzeltmesi sonrası odaklı test | Mobil/klavye/axe testi yeniden geçti; yalnızca screenshot fullPage ayarı değişti |
| `npm audit --omit=dev` | Bilinen production bağımlılığı açığı: 0 |
| Geliştirme smoke kontrolü | `npm run dev`; Vite `/` HTTP 200; proxy `/api/repairs` boş seed kapalı DB'den doğru yanıt verdi |
| Otomatik erişilebilirlik | Masaüstü, mobil, kabul ve detay dialog: axe WCAG 2 A/AA + 2.1 AA 0 ihlal |
| Görsel inceleme | 1440×1000 masaüstü ve 390×844 mobil görüntüler incelendi; mobil sayfa taşması yok |

## Test kapsamı

Backend/API: seed'in tekilliği ve boş başlangıcın yeniden açılışta boş kalması, kalıcılık, gizli request fingerprint'inin API'de gösterilmemesi, kabulde güvenli tekrar ve farklı içerik çatışması; geçerli/geçersiz durum geçişleri, onarılamadı dalı, kapalı kaydın tekrar açılmaması; not/sürüm/geçmiş bütünlüğü; eski sürüm ve iki ayrı bağlantının eşzamanlı yazması; trim/parametrik SQL, alan/ID/tip/sınır doğrulaması; origin, JSON, 8 KB ve bulunamayan yol sözleşmeleri.

Tarayıcı: gerçek seed kayıtları ve hesaplanan sayaçlar; Türkçe arama ve boş sonuç; durum filtreleri; kabulden teslimata tüm akış ve reload ile kalıcılık; başka istemcinin yaptığı güncelleme sonrası 409, güncel kaydı yükleme ve devam; yanıt kaybından sonra formun korunması ve duplicate oluşmadan retry; ilk yükleme ve bağlantı hatası / tekrar deneme; yenileme hatasında son verinin korunması; modal Tab döngüsü / Escape / odak iadesi; mobil taşma; production güvenlik başlıkları ve API retleri.

## Düzeltilen bulgular

- ESLint'in render sırasında zaman okuma bulgusu lazy state initializer ile giderildi.
- libSQL senkron busy wait, iki bağlantı aynı anda yazarken Node event loop'unu bekletiyordu. Busy wait kapatılıp sınırlı asenkron retry eklendi; yarış testinde bir yazma commit, diğeri güncel sürümden 409 alıyor.
- Windows native SQLite tanıtıcıları GC öncesi silinemeyebiliyor; test cleanup'ının asıl assertion sonucunu maskelemesi önlendi. Test dosyaları OS temp içinde izole tutuluyor, çalışma verisi kullanılmıyor.
- Axe'ın bulduğu ikincil metin kontrastları artırıldı.
- Mobil taşma, yatay kaydırılan tablodaki absolute gizli başlığın viewport'a bağlanmasından kaynaklandı. Kaydırma alanı relative yapılarak erişilebilir başlık korunup gerçek neden giderildi; body taşması gizlenmedi.
- Veri ilk kez alınamadığında iş sayaçları sıfır yerine çizgi ve liste açık yükleme hatası gösteriyor.
- Geliştirme API'si statik build gerektirmiyor; `npm start` açık `--static` bayrağıyla production dosyalarını sunuyor.

## Çıktılar ve sınırlar

`docs/tamir-desktop.png`, `docs/tamir-mobile.png`, `docs/tamir-detail-mobile.png` incelendi. Tam E2E koşumundaki teslim edilen sayaç, akış testinin eklediği izole örnek yüzünden başlangıç seed'inden bir fazla olabilir. Son odaklı mobil ekranlar taze seed kullanır. Bütün test/preview süreçleri kapatıldı.

Playwright yalnızca NO_COLOR / FORCE_COLOR ortam uyarısı veriyor; uygulama/test hatası değil. Otomatik axe taraması tam manuel erişilebilirlik incelemesinin yerine geçmez. Uygulama tek yerel operatör içindir; kimlik/yetki, mesaj gönderimi ve çoklu atölye kapsam dışı. Kişisel veriler ve gelecekteki hosting gereklilikleri README'de açıklanmıştır.
