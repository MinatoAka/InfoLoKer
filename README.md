# InfoLoKer
Info LoKer Jooble REST API

### Script property
- APP_TOKEN : minato_AturDompet2026
- JOOBLE_KEY : 96de1bee-4b9c-4064-a219-xxxxxxxxxx

### Cara Mendapatkan Kunci Jooble REST API
- Daftar akun di portal API Jooble untuk negara target Anda (misalnya, id.jooble.org/api/about).
- Setelah terdaftar, salin dan simpan dengan aman kunci API yang telah dibuat.

### Batasan Penggunaan API:
Paket REST API gratis mencakup batas seumur hidup sebanyak 500 permintaan per kunci (ini adalah kuota seumur hidup mutlak, bukan batas bulanan).

### Parameter Permintaan (JSON Body)
Payload permintaan harus dikirim dalam format application/json dengan parameter berikut:

- keywords(string, wajib): Kata kunci atau jabatan yang ingin dicari.
- location(string, wajib): Nama lokasi (kota, wilayah, atau negara).
- radius(string, opsional): Radius pencarian dalam kilometer. Nilai yang diperbolehkan: 0, 4, 8, 16, 26, 40, 80.
- salary(integer, opsional): Batas gaji minimum.
- page(integer, opsional): Nomor halaman hasil pencarian (default adalah 1).
- ResultOnPage(integer, opsional): Jumlah item lowongan yang dikembalikan per halaman.
- SearchMode(integer, opsional): Mode algoritme pencarian (default adalah 0).
- companysearch(boolean, opsional):
  1. true – Cari kata kunci secara khusus dalam nama perusahaan.
  2. false – Cari kata kunci dalam jabatan dan deskripsi.

### Parameter Respons
Setelah permintaan berhasil, server mengembalikan objek JSON yang berisi:

1. totalCount(integer): Jumlah total lowongan cocok yang ditemukan.
2. jobs(array): Daftar objek lowongan yang berisi:
   - id(integer): Pengidentifikasi unik lowongan.
   - title(string): Jabatan.
   - location(string): Lokasi lowongan.
   - snippet(string): Cuplikan deskripsi singkat yang ditampilkan dalam hasil pencarian.
   - salary(string): Rentang gaji yang diformat sebagai {min} - {max} {currency}.
   - source(string): Sumber postingan lowongan.
   - type(string): Jenis pekerjaan (misalnya, Penuh waktu, Paruh waktu).
   - link(string): URL langsung ke lowongan di Jooble.
   - company(string): Nama perusahaan.
   - updated(string): Stempel waktu ISO dari pembaruan lowongan terakhir.

### Respons HTTP & Kode Kesalahan
+ 200 OK: Permintaan berhasil dan mengembalikan data.
+ 403 Access Denied: Kunci API tidak valid atau hilang.
+ 404 Not Found: Endpoint atau sumber daya yang diminta tidak ada.
