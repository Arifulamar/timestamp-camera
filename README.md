# Timestamp Camera GPS Online v2

Web app statis dan mobile-first untuk foto dokumentasi dengan timestamp, GPS, identitas kegiatan, dan watermark logo. Tidak membutuhkan backend.

## Fitur utama
- Kamera belakang/depan via `getUserMedia`
- Timestamp tanggal + jam real-time
- GPS latitude, longitude, akurasi, dan link Google Maps
- Nama lokasi/alamat manual
- Instansi/sekolah, kegiatan, petugas, dan catatan
- Upload logo PNG/JPG/WebP sebagai watermark
- Watermark tertanam ke file JPG hasil foto
- Pilihan posisi watermark dan kualitas JPG
- Tombol Share memakai Web Share API bila tersedia
- Galeri lokal maksimal 12 foto menggunakan IndexedDB
- Pengaturan tersimpan menggunakan localStorage
- PWA + offline asset cache
- SEO meta tags, Open Graph, FAQ Schema, WebApplication Schema
- robots.txt + sitemap.xml
- Tidak ada upload foto ke server

## Persyaratan browser
Kamera dan geolocation membutuhkan **HTTPS** atau `localhost`, serta izin pengguna. GitHub Pages sudah menggunakan HTTPS.

## Deploy GitHub Pages
1. Upload seluruh file ke repository GitHub.
2. Masuk ke **Settings > Pages**.
3. Pilih **Deploy from a branch**.
4. Pilih branch `main` dan folder `/root`.
5. Buka URL GitHub Pages dari ponsel.

## SEO sebelum publikasi
Ganti semua `https://example.com/` pada:
- `index.html`
- `robots.txt`
- `sitemap.xml`

dengan domain final Anda.

## Privasi
Aplikasi tidak mengirim foto atau data GPS ke server aplikasi. Foto galeri tersimpan pada IndexedDB browser lokal. Tombol “Buka Peta” membuka Google Maps pada tab baru setelah pengguna meminta GPS.


## Fitur baru v3

- Putaran watermark otomatis mengikuti orientasi perangkat saat foto diambil.
- Opsi manual: 0°, 90°, -90°, atau 180°.
- Preview watermark ikut berputar di layar.
