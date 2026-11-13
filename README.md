# Tamir Masası

Küçük tamir atölyeleri için kabulden teslime iş takip defteri. “Bu eşya kimin, hangi aşamada, en son ne yapıldı?” sorularını tek çalışma alanında yanıtlar. 25 Ekim 2026 günlük portfolyo MVP'si. Moda Tamir Atölyesi, müşteriler ve kayıtlar kurgusaldır.

## Özellikler

- Müşteri, isteğe bağlı iletişim, eşya/model, kategori ve bildirilen sorunla yeni kabul.
- Sırada → işlemde → parça bekliyor / teslime hazır / onarılamadı → teslim edildi akışları. Parça geldikten sonra tekrar işleme alınabilir.
- Her değişiklikte zorunlu not, değiştirilmeyen işlem geçmişi; teslim edilen iş tekrar açılamaz.
- İki sekmenin aynı sürümü değiştirmesini önleyen optimistic concurrency; eski sürüm 409 döndürür.
- Yanıtı kaybolan kabul isteğini aynı UUID ile tekrarlama; çift kayıt oluşmaz. Aynı anahtarla farklı içerik 409 döndürür.
- Türkçe arama (eşya, müşteri, kayıt no, sorun), durum filtreleri, açık iş özetleri, teslim rafı, 5+ gündür açık işler.
- Responsive arayüz, erişilebilir formlar ve dialog, odak döngüsü / Escape / odak iadesi; yükleme, boş ve hata durumları. Başarısız yenilemede son veriler, başarısız kayıtta form girdileri korunur.
- Yerel SQLite kalıcılığı, tek seferlik 6 örnek kayıt. Dış servis, hesap veya anahtar gerekmez.

## Teknoloji

React 19.3.1, TypeScript 6.0.3, Vite 8.3.5; Node.js 24+, Fastify 5.12.7, Drizzle ORM 0.45.4, @libsql/client 0.18.0 ve yerel SQLite. Zod 4 ile paylaşılan doğrulama, Lucide simgeleri ve uygulamaya özel CSS. ESLint, Node test runner / tsx, Playwright / Chromium, axe-core. Kesin sürümler `package.json` ve `package-lock.json` içinde.

Önceki projelerden farklı olarak bu çalışma Next.js yerine React/Vite ile ayrı bir Fastify API ve Drizzle veri katmanı kullanır. Önceki klasörler değiştirilmez.

## Kurulum ve çalıştırma

Node.js **24 veya üzeri** ve npm gerekir (doğrulanan: Node 24.12.0, npm 10.9.1). Go, Python, Docker veya harici veritabanı kurulumu gerekmez.

```powershell
cd C:\Users\busen\Documents\Playground\daily-fullstack-projects\2026-10-25-tamir-masasi
npm ci
Copy-Item .env.example .env
npm run dev
```

Geliştirme arayüzü: [http://127.0.0.1:5175](http://127.0.0.1:5175). Vite `/api` isteklerini `127.0.0.1:3025` Fastify sunucusuna geçirir; iki süreç tek komutla başlar. macOS/Linux ortam dosyasını `cp .env.example .env` ile kopyalayın. Her iki sistemde de çalışma dizini proje kökü olmalı. API portunu değiştirirseniz `vite.config.ts` proxy hedefini de değiştirin.

Production derlemesini **yerelde** çalıştırmak için:

```powershell
npm run build
npm start
```

[http://127.0.0.1:3025](http://127.0.0.1:3025) adresinde Fastify hem derlenmiş React dosyalarını hem API'yi sunar. `vite preview` uygulamanın API sunucusu değildir. `Ctrl+C` süreçleri kapatır. Varsayılan sunucular yalnızca loopback arayüzünü dinler.

## Veri ve ortam

`.env` Node tarafından okunur; mevcut shell değişkenleri önceliklidir. Varsayılanlar:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `PORT` | `3025` | Fastify portu |
| `DATABASE_URL` | `file:./data/tamir.sqlite` | Yerel SQLite dosyası; yalnızca `file:` kabul edilir |
| `SEED_DEMO` | `true` | Yalnızca ilk açılışta 6 örnek kayıt ekler |
| `APP_ORIGIN` | istek protokolü + Host | İsteğe bağlı sabit mutation origin kontrolü |

Veritabanı klasörü, şema sürümü 1 ve indeksler otomatik oluşturulur. SQL şema kurulumu `server/store.ts`, Drizzle tip eşlemesi `server/schema.ts` içindedir. İleride şema değişirse sürümlü migration eklenmelidir; uygulama kendisinden daha yeni veritabanını açmayı reddeder. Örnek kayıtların kabul tarihleri ilk açılışta göreli oluşturulur, sonraki günlerde ileri taşınmaz. Boş kullanım için **ilk çalıştırmadan önce** `SEED_DEMO=false` belirleyin. Var olan dosyada seed ayarı içerikleri değiştirmez.

Farklı, boş bir yerel defter:

```powershell
$env:DATABASE_URL = 'file:./data/atolye.sqlite'
$env:SEED_DEMO = 'false'
npm start
```

Çalışma verisi, `.env`, derlemeler ve test raporları `.gitignore` kapsamındadır. Gerçek gizli bilgi yoktur. İletişim bilgisi zorunlu değildir; örnek kayıtlarda boş bırakılır. Kullanılacak gerçek veriler yerel dosyaya düz metin yazılır.

## Mimari ve API

```text
src/main.tsx          İş defteri, filtreler, özet ve öncelik alanları
src/forms.tsx         Kabul formu, detay, durum değişikliği ve geçmiş
src/modal.tsx         Native dialog ve klavye/odak davranışı
src/api.ts            Hata sözleşmesi ve ağ istemcisi
shared/domain.ts     Zod şemaları, durum geçişleri ve paylaşılan tipler
server/schema.ts     Drizzle tablo eşlemeleri
server/store.ts      Şema kurulumu, seed ve transaction içeren veri katmanı
server/app.ts        Fastify API, origin/boyut denetimi ve statik sunucu
server/index.ts      Yerel süreç ve kapanış
tests/api.test.ts    İzole SQLite dosyalarında API ve bütünlük testleri
tests/e2e/           Production sunucusunda gerçek tarayıcı testleri
```

| Yöntem | Yol | İşlev |
| --- | --- | --- |
| GET | `/api/health` | Süreç sağlık kontrolü |
| GET | `/api/repairs` | `{repairs, now}`; bütün kayıtlar ve sunucu zamanı |
| GET | `/api/repairs/:id` | `{repair, events}` |
| POST | `/api/repairs` | `{customer, contact?, item, category, issue, requestId}` |
| PATCH | `/api/repairs/:id` | `{status, note, version}` |

`status`: `received`, `working`, `parts`, `ready`, `unrepairable`, `collected`. Sunucu geçiş listesini doğrular. `ready` ve `unrepairable` teslim rafında bekler; yalnızca `collected` kapanmış sayılır. Teslime hazır özeti yalnızca onarılan `ready` kayıtlarını sayar. Süre gerçek geçen 24 saat bloklarıdır; tarih gösterimleri `Europe/Istanbul` kullanır. Liste yeni kabulden eskiye sıralanır.

Drizzle sorguları parametrelidir. Yazma transaction'ları `BEGIN IMMEDIATE` kullanır; durum/sürüm ve olay kaydı birlikte commit edilir. Yerel libSQL sürücüsünün senkron kilit beklemesi Node event loop'unu durdurmasın diye `busy_timeout=0` ve toplam yaklaşık 1 saniyelik sınırlı asenkron retry uygulanır. Her retry güncel sürümü yeniden okur; kilit devam ederse 503 döner. Tekrarlanan PATCH eski sürüm nedeniyle 409 döndürür; güncel kaydı yüklemek işin sonucunu gösterir.

Hatalar `{error, fields?}` biçiminde Türkçedir: JSON/ID 400, yabancı Origin 403, kayıt/yol 404, geçiş/sürüm/anahtar çatışması 409, 8 KB üstü 413, içerik türü 415, alan doğrulama 422, kilit yoğunluğu 503. API yanıtları cache edilmez; production sunucusunda CSP ve temel yanıt başlıkları vardır. İstemci hem native alan doğrulaması hem sunucu hatalarını gösterir.

## Doğrulama

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

E2E için önce build gereklidir. Testler 3125 portunda kendi production sunucusunu başlatır ve kapatır; mevcut sunucuyu yeniden kullanmaz. Backend ve E2E testleri OS geçici klasöründe ayrı SQLite dosyaları kullanır, gerçek çalışma verisine dokunmaz. Windows'ta native SQLite dosya tanıtıcıları GC sonrasına kadar tutulabildiğinden geçici test klasörleri korunur. Görseller `docs/tamir-desktop.png`, `docs/tamir-mobile.png`, `docs/tamir-detail-mobile.png` olarak kaydedilir. Sonuçlar `VALIDATION.md` içindedir.

## İleride canlıya alma

Bu çalışma tamamen yereldir; uzak depo, push, yayın veya deployment yapılmadı.

1. Node.js 24+ çalıştıran, kalıcı diskli bir VM/container seçin. `npm ci` ve `npm run build` çalıştırın. `DATABASE_URL=file:/kalici-disk/tamir.sqlite`, `SEED_DEMO=false` ve sabit HTTPS `APP_ORIGIN` yapılandırın. Geçici diskli serverless veya salt statik hosting bu veri modeline uygun değildir.
2. Genel erişimden önce kullanıcı kimliği, atölye/tenant ayrımı, rol ve kayda erişim yetkileri ekleyin. Mevcut MVP tek operatör içindir; API'ye erişen kişi bütün müşteri kayıtlarını görebilir ve değiştirebilir. Origin kontrolü kimlik doğrulama sağlamaz.
3. `server/index.ts` bind adresini uygun özel ağa alın; HTTPS reverse proxy, istek hız/boyut sınırları ve süreç gözetimi ekleyin. `trustProxy` açılacaksa yalnızca bilinen proxy'leri kabul edin.
4. Kişisel veriler için erişim, saklama/silme politikası ve şifreli disk/yedek düzeni oluşturun. Çalışan WAL veritabanını yalnızca ana dosyayı kopyalayarak yedeklemeyin; SQLite backup API veya tutarlı snapshot kullanın ve restore deneyin.
5. Çoklu sunucuya geçişte PostgreSQL ve sürümlü migration ekleyin; atomic sürüm kontrolünü, unique istek anahtarını ve işlem geçmişini koruyun.

Kapsam dışında: SMS/e-posta gönderimi, ödeme/ücretlendirme, stok, müşteri portalı ve çoklu kullanıcı. Teslim rafı müşteriye bildirim **göndermez**; operatöre öncelik listesi sunar.

Resmî başvurular: [Drizzle libSQL](https://orm.drizzle.team/docs/get-started/libsql-new), [Fastify doğrulama](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [Vite backend entegrasyonu](https://vite.dev/guide/backend-integration).
