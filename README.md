# Meryoş Tracker — İlk sürüm

Ücretsiz, kurulum gerektirmeyen kişisel çalışma takipçisi. Veriler yalnızca kullandığın cihazın tarayıcısında saklanır.

## Çalıştırma

Bilgisayarda bu klasörü VS Code ile açıp **Live Server** eklentisiyle çalıştır. Ardından ekrandaki “Uygulamayı yükle” düğmesini kullanabilirsin.

Telefon için aynı dosyaları ücretsiz olarak GitHub Pages, Cloudflare Pages veya Netlify'a yayımla; açılan sayfada tarayıcının **Ana ekrana ekle / Uygulamayı yükle** seçeneğini kullan.

## GitHub Pages ile HTTPS yayını

Bu klasörün tamamını yeni bir **public** GitHub deposuna `main` dalı olarak yükle. Depodaki **Settings → Pages → Build and deployment** ayarında kaynak olarak **GitHub Actions** seç. Bu klasördeki `.github/workflows/deploy-pages.yml` dosyası her `main` gönderiminde uygulamayı HTTPS üzerinden yayımlar.

`https://KULLANICI_ADIN.github.io/DEPO_ADI/` adresi hazır olduğunda uygulamayı bu URL üzerinden aç. `.gitignore`, olası gizli anahtar dosyalarının depoya eklenmesini engeller; Supabase `service_role` anahtarını veya VAPID özel anahtarını hiçbir zaman depoya koyma.

## Teknoloji seçimi

- **PWA (HTML, CSS, JavaScript):** Android, iPhone ve bilgisayarda tek kod tabanı; ücretsiz barındırma ile çalışır.
- **Tarayıcı depolaması (localStorage):** İlk sürümde hesap/sunucu maliyeti yoktur. Yedek al/yükle özelliği vardır.
- **Web bildirimleri:** İzin verildiğinde açık tarayıcıda bildirim gösterebilir. Tarayıcı tamamen kapalıyken kesin saatli bildirim için sonraki adımda ücretsiz bir otomasyon (ör. Telegram bot + GitHub Actions) eklenebilir.

## Haftalık program

**Ayarlar → Haftalık otomatik program** alanında, her gün için gelen varsayılan planı değiştirebilirsin. Her satır şu biçimdedir:

`Alan | Görev | dakika`

Örnek: `Üniversite | Veri tabanı ders notlarını tekrar et | 45`

Uygulama gün içinde ilk kez açıldığında o güne ait programı bir kez oluşturur. Mevcut görevleri silmek veya manuel görev eklemek otomatik programını bozmaz; aynı gün yenileme yapıldığında görevler tekrar çoğalmaz.

## Sonraki mantıklı geliştirme

İkinci geliştirme aşamasında Supabase tabanlı hesap, eşitleme, yerel/bulut yedekleri, haftalık değerlendirme ve Web Push altyapısı eklendi. Bağlantı ve dağıtım için [SUPABASE_SETUP.md](SUPABASE_SETUP.md) belgesini takip et.
