const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Rastgele Kelime Havuzu
const kelimeHavuzu = ["araba", "elma", "bilgisayar", "güneş", "kedi", "gözlük", "uçak", "telefon", "ağaç", "kitap"];

let oyuncular = {};
let cizenKisiId = null;
let gizliKelime = "";

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Yeni Tur Başlatma Fonksiyonu
function yeniTur() {
  const idler = Object.keys(oyuncular);
  if (idler.length >= 2) {
    cizenKisiId = idler[Math.floor(Math.random() * idler.length)];
    gizliKelime = kelimeHavuzu[Math.floor(Math.random() * kelimeHavuzu.length)];
    
    io.to(cizenKisiId).emit('sen_cizeceksin', gizliKelime);
    
    idler.forEach(id => {
      if(id !== cizenKisiId) {
        io.to(id).emit('baskasi_cizecek', oyuncular[cizenKisiId].nickname);
      }
    });
    io.emit('tahtayi_temizle');
  }
}

io.on('connection', (socket) => {
  
  // Artık oyuncu katılırken sadece isim değil, profil fotosu ve chat yetkisi de geliyor
  socket.on('oyuna_katil', (kullaniciVerisi) => {
    oyuncular[socket.id] = { 
      nickname: kullaniciVerisi.nickname, 
      avatar: kullaniciVerisi.avatar,
      canChat: kullaniciVerisi.canChat
    };
    
    io.emit('sistem_mesaji', `${kullaniciVerisi.nickname} odaya katıldı!`);
    
    if(Object.keys(oyuncular).length >= 2 && !cizenKisiId) {
        yeniTur();
    }
  });

  socket.on('cizim', (veri) => {
    if(socket.id === cizenKisiId) {
      socket.broadcast.emit('cizim', veri);
    }
  });

  socket.on('tahmin_et', (tahmin) => {
    if(socket.id === cizenKisiId) return;

    if (tahmin.toLowerCase() === gizliKelime.toLowerCase()) {
      io.emit('sistem_mesaji', `🎉 ${oyuncular[socket.id].nickname} doğru bildi! Kelime: ${gizliKelime}`);
      setTimeout(yeniTur, 3000); 
    } else {
      // Tahminlere de profil fotoğrafını ekleyerek gönderiyoruz
      io.emit('tahmin_yayinla', { 
        isim: oyuncular[socket.id].nickname, 
        avatar: oyuncular[socket.id].avatar,
        mesaj: tahmin 
      });
    }
  });

  socket.on('chat_mesaji', (mesaj) => {
    // Sadece chat yetkisi olanlar (Google ile girenler) mesaj gönderebilir
    if (oyuncular[socket.id] && oyuncular[socket.id].canChat) {
      io.emit('chat_yayinla', { 
        isim: oyuncular[socket.id].nickname, 
        avatar: oyuncular[socket.id].avatar,
        mesaj: mesaj 
      });
    }
  });

  socket.on('disconnect', () => {
    if(oyuncular[socket.id]) {
      io.emit('sistem_mesaji', `${oyuncular[socket.id].nickname} oyundan ayrıldı.`);
      delete oyuncular[socket.id];
      
      if(socket.id === cizenKisiId) {
        cizenKisiId = null;
        setTimeout(yeniTur, 1000); 
      }
    }
  });
});

http.listen(3000, () => {
  console.log('Sunucu çalışıyor! Tarayıcıda http://localhost:3000 adresine girin.');
});