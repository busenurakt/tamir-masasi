# Tamir Masası — ürün ve tasarım kararları

**Problem:** Küçük tamir atölyelerinde kâğıt etiketler ve mesajlar eşyanın durumunu birlikte taşıyamıyor. Kabul kaydı, parça bekleme notu ve teslim aynı defterde birleşmeli. Bir operatörün tek atölyede çalıştığı yerel MVP.

Ana akış: yeni kabul → sıradaki işi aç → kontrolü başlat → gerekiyorsa parça bekle → yeniden işlem → hazır veya onarılamadı → müşteriye teslim. İşlem geçmişi saklanır, geri tarihli değişiklik/silme yoktur. Müşteri iletişimi isteğe bağlıdır; uygulama mesaj göndermez.

**Görsel yön:** Tamir tezgâhındaki düzenli kâğıt defter. Mürekkep laciverti navigasyon, sıcak kırık beyaz çalışma yüzeyi, pas turuncusu kabul eylemi; teslim rafında yumuşak adaçayı. Az sayıda Lucide simgesi, çizgilerle ayrılan gerçek kayıtlar; dış font, stok fotoğraf, gölge yığını veya dekoratif grafik yok. Sayaçlar canlı veriyle hesaplanır.

Masaüstünde iş defteri ana alan, teslim rafı ve uzun bekleyen işler sağ destek alanıdır. Orta ekranlarda öncelikler tablonun altına geçer. Mobilde durum menüsü yatay kaydırılır, sayfa taşmaz; tablonun bağımsız yatay kaydırması ayrıntıları korur. Formlar tek sütundur. Tarihler İstanbul saat diliminde, yaşlar tamamlanan 24 saat bloklarıdır.

Erişilebilirlik: Türkçe belge, içerik atlama bağlantısı, landmark ve başlıklar, gerçek label ve alan hata ilişkileri, açık buton isimleri, status/alert duyuruları, görünür odak, native dialog + Tab döngüsü / Escape / odak iadesi, azaltılmış hareket. Durum her zaman metinle de belirtilir. Axe taraması manuel erişilebilirlik değerlendirmesinin tamamı değildir.

**Bütünlük:** UUID kabul anahtarı ve normalize edilmiş içerik parmak izi çift kaydı önler. Durum değişiklikleri beklenen sürümle gönderilir; transaction içinde sürüm ve geçiş denetlenir, eşya ve olay birlikte yazılır. libSQL native kilit beklemesi event loop'u durdurmasın diye kısa asenkron retry vardır. İstemci başarısız kayıtta girdileri, başarısız yenilemede son verileri korur. İlk veri alınamadığında sıfırmış gibi sayaç gösterilmez.

Kısıtlar: tek yerel veri dosyası, bütün kayıtlar istemciye yüklenir; küçük atölye MVP ölçeği. Çok büyük veri için sunucu taraflı sayfalama/arama, çoklu operatör için kimlik ve yetki gerekir. Onarımın çevresel etkisi için doğrulanmamış CO₂ veya tasarruf sayıları üretilmez.
