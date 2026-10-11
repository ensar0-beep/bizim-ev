# Bizim Ev

Ailenin takvimi, görevleri ve listeleri tek yerde. Herkes kendi telefonundan görür, ekler, işaretler.

## Canlı

**https://ensar0-beep.github.io/bizim-ev/**

Telefonda tarayıcıda aç, "Ana Ekrana Ekle" ile uygulama gibi kur.
Bir kişi "Yeni aile oluştur" der, çıkan 8 karakterlik aile kodunu (örn. `ABCD-EFGH`) ya da davet bağlantısını diğerlerine gönderir.

## Bu sürümde ne var

- **Bugün:** saate göre selamlama, aile duyurusu, bugünün etkinlikleri ve görevleri, alınacaklar özeti, hafta sonu için bir fikir
- **Takvim:** gün / hafta / ay görünümü, kişiye göre süzme, tekrarlanan etkinlikler, kategoriler
- **Listeler → Alınacaklar:** ayakkabı, bilgisayar gibi alımlar; kimin için, ne zaman lazım (Acil / Yakında / Bir ara), not, otomatik kategori
- **Listeler → İsteklerimiz:** gezilecek yerler, kitaplar, filmler, mekanlar; "ben de istiyorum", takvime "Plana dök", "Yaptık"
- **Görevler:** atama, tekrar, "Sırayla yapılsın", gecikenler
- **Aile:** yönetici / yetişkin / çocuk rolleri, davet, telefonu olmayan üyeyi elle ekleme, son değişiklikler, büyük yazı, açık / koyu tema
- Telefonlar arasında anlık eşitleme, çevrimdışı çalışma (bağlantı gelince gönderir), 6 saniyelik "Geri al"
- **Örnek aile:** kurmadan önce denemek için, yalnızca o cihazda kalır

## Bu sürümde bilerek olmayan şey

- **Gerçek push bildirimi yok.** Hatırlatma, uygulama açıkken bildirim olarak gelir. Telefon kilitliyken bildirim için sunucu tarafı (Firebase Cloud Functions + Cloud Messaging) gerekir.
- **Gerçek kimlik doğrulama yok.** Aile kodunu bilen aileye girer; roller (yönetici / çocuk) güvenlik değil, düzen içindir. Kodu aile dışıyla paylaşma.
- Fiyat / bütçe, mesajlaşma, konum, fotoğraf albümü, yemek planı yok.

## Firebase

Veriler `https://bizimev-96297-default-rtdb.firebaseio.com` altında, her aile `families/{KOD}` içinde durur.
Firebase konsolunda **Realtime Database → Kurallar** sekmesine [`database.rules.json`](database.rules.json) içeriği yapıştırılmalı.
Bu kurallar kökten listelemeyi kapatır; bir aileye ancak kodunu bilen erişir.

## Dosyalar

- `index.html` — uygulamanın tamamı (tek dosya, derleme gerekmez)
- `manifest.json`, `sw.js`, `icons/` — ana ekrana ekleme ve çevrimdışı açılış
- `database.rules.json` — Firebase güvenlik kuralları
