# Meryoş Tracker — Bulut ve kapalıyken bildirim kurulumu

Bu sürümün uygulama kodu, veri şeması ve Edge Function'ı hazırdır; henüz bir Supabase projesine bağlanmamıştır. Bağlantı bilgileri olmadan uygulama yalnızca yerel çalışır.

## Mimari

```text
Telefon PWA / Bilgisayar PWA
       │  HTTPS + kullanıcı oturumu
       ▼
Supabase Auth ──► tracker_state (tek kullanıcı verisi) ──► günlük / manuel yedekler
       │                         ▲
       └─────────────────────────┘ 30 sn'de bir ve değişiklikten sonra eşitleme

Supabase Cron ─► Edge Function ─► Web Push servisleri ─► kapalı PWA'nın Service Worker'ı
```

- **Supabase Auth + Postgres:** e-posta/parola hesabı ve cihazlar arası veri eşitleme.
- **RLS:** her tablo satırı yalnız ilgili `auth.uid()` tarafından okunur/yazılır.
- **Yerel yedek:** Her değişiklikte `localStorage` içinde ikinci bir anlık kopya tutulur.
- **Bulut yedeği:** İlk günlük eşitlemede bir günlük snapshot, ayrıca isteğe bağlı el ile snapshot saklanır.
- **Web Push:** Push aboneliği kullanıcıya ait olarak saklanır; özel VAPID anahtarı yalnız Edge Function gizli değişkeninde kalır.

Supabase Free planı şu an 500 MB veritabanı, 50.000 aylık aktif kullanıcı, Realtime ve ayda 500.000 Edge Function çağrısı içeriyor; ancak bir hafta hareketsiz kalan ücretsiz projeler duraklatılıyor. Küçük kişisel kullanım için yeterlidir.

## 1. Supabase projesi oluşturma

1. [Supabase Dashboard](https://supabase.com/dashboard)'da ücretsiz proje oluştur.
2. **Authentication → Providers → Email** bölümünde e-posta girişini etkin tut.
3. **SQL Editor** açıp [schema.sql](supabase/schema.sql) dosyasının tamamını çalıştır.
4. **Project Settings → API** bölümünden proje URL'sini ve **publishable/anon** anahtarını al. `service_role` anahtarını asla uygulamaya yapıştırma.
5. Uygulamada **Ayarlar → Bulut senkronizasyonu → Supabase bağlantı bilgileri** alanlarına URL ve publishable/anon anahtarını gir. Sonra e-posta/parola ile hesap oluştur veya giriş yap.

Eşitleme değişiklikten kısa süre sonra, uygulama tekrar öne geldiğinde ve açıkken her 30 saniyede bir yapılır. Aynı kayıt iki cihazda çakışırsa son kaydedilen sürüm kazanır.

## 2. Kapalıyken bildirimleri dağıtma

Web push yalnız HTTPS altında çalışan, yüklenmiş PWA'larda ve kullanıcı izin verdikten sonra kullanılabilir. iPhone'da PWA'nın Ana Ekrana eklenmiş olması gerekebilir.

1. Uygulamayı GitHub Pages, Cloudflare Pages veya Netlify gibi HTTPS sağlayan bir servise yayımla.
2. VAPID anahtar çifti oluştur. `@negrel/webpush` belgesindeki anahtar üretme komutu kullanılabilir:

   ```bash
   deno run -A https://raw.githubusercontent.com/negrel/webpush/master/cmd/generate-vapid-keys.ts
   ```

3. `publicKey` değerini uygulamadaki **VAPID genel anahtarı** alanına gir. Özel JWK anahtarını uygulamaya koyma.
4. Supabase CLI ile bu klasördeki `supabase/functions/send-reminders` klasörünü projenin `supabase/functions` klasörüne taşı, sonra fonksiyonu dağıt:

   ```bash
   supabase functions deploy send-reminders
   supabase secrets set VAPID_KEYS_JSON='{"publicKey":{...},"privateKey":{...}}'
   supabase secrets set VAPID_CONTACT='mailto:senin-epostan@example.com'
   supabase secrets set CRON_SECRET='uzun-rastgele-bir-deger'
   ```

5. Dashboard SQL Editor'da `pg_cron`, `pg_net` ve Vault etkinse aşağıdaki örneğe kendi proje referansını koyarak her beş dakikada bir fonksiyonu çağır:

   ```sql
   select vault.create_secret('uzun-rastgele-bir-deger', 'meryos_cron_secret');
   select cron.schedule(
     'meryos-reminders-every-5-minutes',
     '*/5 * * * *',
     $$select net.http_post(
       url := 'https://PROJE_REF.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
         (select decrypted_secret from vault.decrypted_secrets where name = 'meryos_cron_secret')),
       body := '{}'::jsonb
     );$$
   );
   ```

6. Uygulamada giriş yaptıktan sonra **Kapalıyken bildirimi etkinleştir** düğmesine dokun ve sistem bildirim izni ver.

Fonksiyon, kullanıcının seçtiği plan ve akşam rapor saatlerini `Europe/Istanbul` gibi cihaz saat diliminde kontrol eder. Beş dakikalık cron çözünürlüğü nedeniyle bildirim, hedef saatin bulunduğu beş dakika içinde gönderilir.

## Test durumu

- Yerel görev/rapor/haftalık değerlendirme/yedek testleri otomatik olarak geçti.
- Supabase Auth, RLS, iki cihazlı eşitleme, Edge Function deploy'u ve gerçek kapalıyken push bildirimi **test edilmedi**: bunlar kullanıcı Supabase projesi, VAPID anahtarları ve HTTPS yayını gerektirir.
