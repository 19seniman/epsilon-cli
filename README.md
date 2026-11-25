# epsilon.js — CLI Epsilon Miner (mining.epsilons.io)

Login pakai **initData** Telegram (bukan bot token), ditukar jadi JWT. Setelah itu mining bisa dijalankan otomatis: start → tunggu → claim, sekaligus menyelesaikan task.

```
┌──────────────────────────────────────────────┐
│  E P S I L O N   miner companion             │
│  project  Epsilon Miner · mining.epsilons.io │
│  author   19Seniman                          │
│  build    v1.0.0                             │
└──────────────────────────────────────────────┘
```

## Instalasi

```bash
git clone 
cd 
npm install
nano .env 
```

Tidak ada dependency — cukup Node 18+.

## Ambil initData

1. Buka `https://web.telegram.org/k/` (Telegram Web), login
2. Jalankan bot **@Epsiloncrypto_bot** → **Epsilon**
3. **F12** → tab **Network** → filter `auth/telegram`
4. Klik request itu → **Payload** → copy nilai **`initData`**
   (string panjang diawali `query_id=...` diakhiri `&hash=...`)
5. Tempel ke `.env`:

```ini
INIT_DATA=query_id=AAF...&user=...&auth_date=...&hash=...
```

## API yang dipakai

Base: `https://api.epsilons.io/api/v1` · auth `Authorization: Bearer <JWT>`

| Fitur | Method | Path | Body |
|---|---|---|---|
| Tukar initData | POST | `/auth/telegram` | `{initData}` → `{token, user}` |
| Profil | GET | `/auth/me`, `/auth/profile` | — |
| Status mining | GET | `/mining` | — |
| Mulai | POST | `/mining/start` | `{}` |
| Klaim | POST | `/mining/claim` | `{}` → `{balance}` |
| Task | GET | `/tasks` | — |
| Selesaikan task | POST | `/tasks/{id}/complete` | `{}` atau `{code}` |
| Referral | GET | `/referral` | — |
| Klaim fiat (manual) | GET/POST | `/claims/current`, `/claims/open`, `/claims/pay` | — |

Status mining: `IDLE` → `MINING` → `READY`. Reward per sesi `rewardEps` (default 0,2 EPS).

## Claim & task otomatis

**Claim mining** — `/mining` memberi status `IDLE` / `MINING` / `READY`:

- `claim` langsung memanggil `/mining/claim`, hanya berhasil saat `READY`
- `claim --wait` memantau sampai `READY` (kalau `IDLE`, dia memulai sesi dulu), lalu klaim — cocok ditinggal
- loop `auto` melakukan hal yang sama tanpa henti

**Auto task** — membaca `GET /tasks`, lalu `POST /tasks/{id}/complete`:

| Kondisi task | Perilaku |
|---|---|
| Sudah `COMPLETED`/`APPROVED` | dilewati |
| `verifyMode: "code"` | dilewati kecuali diberi `--code XXXX` |
| Butuh bukti (`submit`) | dilewati, dicatat alasannya |
| Reward berhasil | dicatat `+X EPS · balance Y` |
| `alreadyDone` | dicatat, tidak dihitung dua kali |

## Catatan

- `initData` punya `auth_date`; kalau server menolak, ambil ulang dari Telegram.
- JWT hasil login disimpan di `.tokens.json` (mode 600, gitignored) — biasanya bertahan lebih lama dari initData.
- Task bertipe `VIDEO_WATCH` atau yang butuh `code` dilewati saat `--auto` karena butuh aksi manusia.
- Anti-bot: jeda acak 0,6–1,8 s antar request, poll diacak ±20%, retry 429/5xx maks 3×.
- `initData` adalah kredensial akun Telegram-mu — jangan dibagikan, dan jangan commit `.env`.
