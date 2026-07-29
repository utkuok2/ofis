# Ofis Uygulaması - Tasarım Taslağı

## 1. Teknoloji Yığını

| Bileşen | Teknoloji | Açıklama |
|---------|-----------|----------|
| UI Platform | **Electron** | Windows/Mac/Linux masaüstü uygulaması |
| Frontend | **React + TypeScript** | Modern UI geliştirme |
| Harita Motoru | **Phaser.js 3** veya **React-Konva** | 2D ofis haritası ve karakter hareketleri |
| State Yönetimi | **Zustand** | Hafif ve basit state yönetimi |
| AI API | **OpenCode Zen API** | `https://opencode.ai/zen/v1/chat/completions` |
| Veritabanı | **SQLite (better-sqlite3)** | Lokal veri depolama |
| Stil | **Tailwind CSS** | Hızlı UI geliştirme |

## 2. Veritabanı Şeması (SQLite)

```sql
-- Yöneticiler
CREATE TABLE yoneticiler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    soyad TEXT NOT NULL,
    unvan TEXT,
    avatar TEXT,
    ofis_konum_x REAL,
    ofis_konum_y REAL
);

-- Ekip Grupları (örn: Yazılım, Pazarlama, İK)
CREATE TABLE ekip_gruplari (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    renk TEXT NOT NULL,       -- Haritada görünecek renk
    kat_no INTEGER DEFAULT 1
);

-- Ekipler
CREATE TABLE ekipler (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,
    ekip_grubu_id INTEGER NOT NULL,
    yonetici_id INTEGER,
    ai_model_id INTEGER,
    oda_konum_x REAL,        -- Ofis haritasında oda konumu
    oda_konum_y REAL,
    oda_genislik REAL,
    oda_yukseklik REAL,
    FOREIGN KEY (ekip_grubu_id) REFERENCES ekip_gruplari(id),
    FOREIGN KEY (yonetici_id) REFERENCES yoneticiler(id),
    FOREIGN KEY (ai_model_id) REFERENCES ai_modelleri(id)
);

-- OpenCode AI Modelleri
CREATE TABLE ai_modelleri (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL,              -- Gösterim adı (örn: "DeepSeek V4 Flash Free")
    model_id TEXT NOT NULL UNIQUE, -- API model ID (örn: "deepseek-v4-flash-free")
    api_url TEXT DEFAULT 'https://opencode.ai/zen/v1/chat/completions',
    ucretsiz BOOLEAN DEFAULT 1,
    aktif BOOLEAN DEFAULT 1
);

-- AI Sohbet Geçmişi
CREATE TABLE sohbet_gecmisi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ekip_id INTEGER NOT NULL,
    ai_model_id INTEGER NOT NULL,
    mesaj TEXT NOT NULL,
    yanit TEXT,
    tarih DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ekip_id) REFERENCES ekipler(id),
    FOREIGN KEY (ai_model_id) REFERENCES ai_modelleri(id)
);

-- Kullanıcı profili (oyuncu)
CREATE TABLE kullanici (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ad TEXT NOT NULL DEFAULT 'Ben',
    avatar TEXT,
    konum_x REAL DEFAULT 5,
    konum_y REAL DEFAULT 5
);
```

## 3. OpenCode Ücretsiz AI Modelleri

| Gösterim Adı | Model ID | Tür |
|-------------|----------|-----|
| DeepSeek V4 Flash Free | `deepseek-v4-flash-free` | Genel / Kod |
| MiMo-V2.5 Free | `mimo-v2.5-free` | Multimodal |
| Laguna S 2.1 Free | `laguna-s-2.1-free` | Genel |
| Ling-3.0-flash Free | `ling-3.0-flash-free` | Hızlı |
| North Mini Code Free | `north-mini-code-free` | Kod |
| Nemotron 3 Ultra Free | `nemotron-3-ultra-free` | Genel |
| Big Pickle | `big-pickle` | Gizli / Genel |
| Kimi K2.5 Free | `kimi-k2.5-free` | Genel |
| MiniMax M2.5 Free | `minimax-m2.5-free` | Genel |
| GPT 5 Nano | `gpt-5-nano` | Hızlı / Hafif |

API URL: `https://opencode.ai/zen/v1/chat/completions`
Auth: API key gerekmez (ücretsiz kullanım)

## 4. Ekran Tasarımı

### 4.1 Ana Ekran - Ofis Haritası (2D Top-Down View)

```
+-------------------------------------------------------+
| [Menü] Ofis Uygulaması                   [Kullanıcı]  |
+-------------------------------------------------------+
|                                                        |
|  +-------+  +----------+  +----------+  +----------+  |
|  | Top-  |  | Yazılım |  | Pazarlama|  |   İK     |  |
|  | lantı |  | Ekibi    |  | Ekibi    |  | Ekibi    |  |
|  | Odası |  | [AI] [M] |  | [AI] [M] |  | [AI] [M] |  |
|  +-------+  +----------+  +----------+  +----------+  |
|                                                        |
|     [Siz 👤]  ---  [DeepSeek AI 🤖]                    |
|                                                        |
|  +----------+  +----------+  +----------+              |
|  |  Muhasebe|  |  Ar-Ge   |  | Destek   |              |
|  |  [AI][M] |  |  [AI][M] |  |  [AI][M] |              |
|  +----------+  +----------+  +----------+              |
|                                                        |
+-------------------------------------------------------+
| [Sohbet] [Yönetim] [Ayarlar]     Kat: 1/3   [+/-]    |
+-------------------------------------------------------+
```

### 4.2 Yönetim Paneli

```
+-------------------------------------------------------+
| Yönetim Paneli                              [Kapat]   |
+-------------------------------------------------------+
| [Ekip Grupları] [Ekipler] [Yöneticiler] [AI Modeller] |
+-------------------------------------------------------+
|                                                        |
| + Ekip Grubu: [_________________] [Ekle]              |
|                                                        |
| | Yazılım    | [Düzenle] [Sil]  | Renk: 🟦          |
| | Pazarlama  | [Düzenle] [Sil]  | Renk: 🟥          |
| | İK         | [Düzenle] [Sil]  | Renk: 🟩          |
| | Ar-Ge      | [Düzenle] [Sil]  | Renk: 🟨          |
|                                                        |
+-------------------------------------------------------+
```

## 5. Uygulama Mimarisi

```
src/
├── main/                    # Electron ana süreç
│   ├── main.ts              # Electron giriş noktası
│   ├── database.ts          # SQLite veritabanı yönetimi
│   └── ai-bridge.ts         # OpenCode AI API köprüsü
├── renderer/                # React UI
│   ├── App.tsx              # Ana uygulama
│   ├── components/
│   │   ├── OfficeMap/       # 2D ofis haritası
│   │   │   ├── OfficeMap.tsx
│   │   │   ├── Character.tsx
│   │   │   ├── Room.tsx
│   │   │   └── AISprite.tsx
│   │   ├── Management/      # Yönetim panelleri
│   │   │   ├── YonetimPaneli.tsx
│   │   │   ├── EkipForm.tsx
│   │   │   ├── YoneticiForm.tsx
│   │   │   └── AIModelForm.tsx
│   │   ├── Chat/            # AI sohbet arayüzü
│   │   │   ├── SohbetPanel.tsx
│   │   │   └── MesajBileseni.tsx
│   │   └── Layout/          # Genel layout
│   ├── store/               # Zustand store
│   │   ├── useOfisStore.ts
│   │   └── useSohbetStore.ts
│   ├── services/
│   │   ├── aiService.ts     # OpenCode API çağrıları
│   │   └── dbService.ts     # Veritabanı işlemleri
│   └── types/
│       └── index.ts         # TypeScript tipleri
├── assets/
│   ├── sprites/             # Karakter grafikleri
│   └── tiles/               # Harita tile'ları
└── package.json
```

## 6. Özellik Listesi

### Faz 1 - Temel (MVP)
- [x] 2D ofis haritası (oda, koridor, kat planı)
- [x] Kullanıcının ofiste hareket etmesi (ok tuşları / tıklama)
- [x] Ekip grubu oluşturma/düzenleme/silme
- [x] Ekip oluşturma ve ekibe yönetici atama
- [x] AI modeli ekleme ve ekibe atama
- [x] OpenCode ücretsiz AI modelleri ile sohbet

### Faz 2 - Gelişmiş
- [ ] Çok katlı ofis (kat arası geçiş)
- [ ] AI agent'ların ofiste dolaşması (otonom hareket)
- [ ] Toplantı odaları (ekip toplantısı simülasyonu)
- [ ] Bildirim sistemi (AI size bir şey söylemek istediğinde)

### Faz 3 - Profesyonel
- [ ] Dosya paylaşımı (ekip içi)
- [ ] Takvim / randevu sistemi
- [ ] Performans raporları
- [ ] Özel AI model konfigürasyonu (sıcaklık, sistem promptu)

## 7. AI Entegrasyonu (OpenCode Zen API)

```typescript
// Örnek API çağrısı
const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'deepseek-v4-flash-free',       // ücretsiz model
    messages: [
      { role: 'system', content: 'Sen bir yazılım ekibi üyesisin. Uzmanlık alanın: TypeScript geliştirme.' },
      { role: 'user', content: 'Merhaba, proje durumu nedir?' }
    ]
  })
});
```

## 8. Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modunda çalıştır
npm run dev

# Derleme
npm run build

# Windows için paketle
npm run package:win
```

---

*Taslak sürüm: v0.1*
