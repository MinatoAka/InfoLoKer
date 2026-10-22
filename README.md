![GitHub repo size](https://img.shields.io/github/repo-size/MinatoAka/InfoLoKer)
![GitHub top language](https://img.shields.io/github/languages/top/MinatoAka/InfoLoKer)
![GitHub last commit](https://img.shields.io/github/last-commit/MinatoAka/InfoLoKer)
![GitHub license](https://img.shields.io/github/license/MinatoAka/InfoLoKer)

[![Saweria](https://img.shields.io/badge/Support%20Me-Saweria-%23ff69b4?logo=coffee&logoColor=white)](https://saweria.co/AKaAturDompet)

# InfoLoKer

InfoLoKer adalah aplikasi Google Apps Script yang menyediakan endpoint REST-like untuk mencari lowongan kerja dari Jooble API. Aplikasi ini dibuat untuk mempermudah integrasi pencarian pekerjaan melalui API yang ringan, aman, dan mudah dikustomisasi.

## Fitur

- Search lowongan kerja dari Jooble API
- Autentikasi menggunakan `token`
- Cache hasil pencarian untuk mengurangi request berulang
- Proteksi anti-spam per token dan query
- Dapat dijalankan sebagai Web App di Google Apps Script

## Struktur Project

- `Main.gs` — endpoint utama untuk menerima request HTTP
- `Jooble.gs` — wrapper untuk memanggil API Jooble dengan retry
- `Cache.gs` — logika cache dan penyimpanan hasil respons
- `Parser.gs` — normalisasi data lowongan
- `Utils.gs` — helper umum seperti validasi, sanitasi, dan formatter

## Persiapan

### 1. Buat Script Properties di Google Apps Script

Buka proyek Apps Script Anda, lalu isi Script Properties dengan dua variabel berikut:

- `APP_TOKEN` — token rahasia untuk autentikasi request
- `JOOBLE_KEY` — API key dari Jooble REST API

Contoh:

```text
APP_TOKEN=your_secure_token_here
JOOBLE_KEY=your_jooble_api_key_here
```

Pastikan nilai token bersifat unik dan tidak dipublikasikan ke repository publik.

### 2. Deploy sebagai Web App

Setelah semua script selesai, deploy aplikasi sebagai Web App di Google Apps Script.

Setelah deployment, Anda akan mendapatkan URL seperti:

```text
https://script.google.com/macros/s/AKfy.../exec
```

## Cara Menggunakan API

Endpoint dapat dipanggil melalui HTTP GET.

### Parameter Request

- `token` (wajib): token autentikasi yang sama dengan `APP_TOKEN`
- `kw` (wajib): kata kunci pekerjaan, contoh: `frontend`, `data analyst`
- `loc` (opsional): lokasi pencarian, contoh: `Sidoarjo, Jawa Timur`

### Contoh Request

```text
https://script.google.com/macros/s/AKfy.../exec?token=your_secure_token_here&kw=frontend&loc=Sidoarjo%2C%20Jawa%20Timur
```

### Contoh Respons

```json
[
  {
    "title": "Frontend Developer",
    "location": "Sidoarjo, Jawa Timur",
    "snippet": "Membuat UI dan pengalaman pengguna yang modern.",
    "salary": "Rp 6.000.000 - Rp 10.000.000",
    "source": "JobStreet",
    "type": "Full time",
    "link": "https://example.com/jobs/123",
    "company": "PT Contoh Teknologi",
    "updated": "2026-10-21T08:00:00Z"
  }
]
```

## Keamanan

- Jangan pernah menaruh `APP_TOKEN` atau `JOOBLE_KEY` di repository publik.
- Gunakan `Script Properties` atau environment variable yang aman.
- Token yang dikirim di query string harus dipastikan hanya digunakan oleh client yang berwenang.

## Batasan API Jooble

Paket Jooble REST API gratis biasanya memiliki batas penggunaan tertentu, misalnya:

- maksimum 500 request per API key untuk paket gratis
- kuota bersifat terbatas dan dapat berubah sesuai kebijakan Jooble

## Parameter Jooble yang Digunakan

Request ke Jooble API dikirim dalam format JSON dengan payload berikut:

- `keywords` (wajib): kata kunci pekerjaan
- `location` (wajib): lokasi pencarian
- `radius` (opsional): jangkauan radius dalam kilometer
- `page` (opsional): nomor halaman
- `ResultOnPage` (opsional): jumlah hasil per halaman

## Kode Status HTTP

- `200 OK` — request berhasil
- `403 Access Denied` — token tidak valid atau tidak diberikan
- `429 Too Many Requests` — request diblokir oleh sistem anti-spam
- `500` atau error internal — gangguan saat memproses request

## Catatan Pengembangan

Project ini dibangun dengan Google Apps Script dan dirancang untuk integrasi ringan dengan frontend, bot, atau layanan lain yang membutuhkan data lowongan kerja dalam format JSON.

## Lisensi

Proyek ini dilisensikan di bawah MIT License. Lihat file `LICENSE` untuk detail lengkap.

## Kontribusi

Pull request dan saran sangat diterima. Jika Anda ingin mengembangkan fitur baru, pastikan:

- menjaga struktur kode tetap rapi
- menambahkan validasi input
- menjaga keamanan token dan API key
- menulis dokumentasi untuk fitur baru

## Penutup

InfoLoKer dibuat untuk memudahkan pencarian pekerjaan secara terstruktur dan cepat, khususnya untuk kebutuhan integrasi dengan aplikasi lain melalui API berbasis Google Apps Script.
