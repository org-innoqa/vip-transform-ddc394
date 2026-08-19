# VIP Transfer — Katar

Katar odaklı VIP transfer deneyiminin uygulama temeli. Bu ilk aşama, mobil öncelikli tanıtım yüzünü, rezervasyon akışına ayrılmış giriş noktalarını ve Cloudflare Pages dağıtım yapılandırmasını hazırlar.

## Yerel geliştirme

```sh
npm install
npm run dev
```

Üretim doğrulaması için:

```sh
npm ci
npm run build
```

Cloudflare Pages için derleme çıktısı `dist` klasörüdür. Dağıtım komutu `npx wrangler pages deploy dist` olarak tanımlıdır.

## Ürün altyapısı

Rezervasyon, araç, bölge, tarife ve ekstra yönetimi sonraki veri temeli aşamasında Humainum PostgreSQL/PostgREST katmanına bağlanacaktır. Platform tarafından sağlanan `src/lib/db.ts` ve ortam değişkenleri bu temel aşamada oluşturulmamıştır.
