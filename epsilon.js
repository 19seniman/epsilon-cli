#!/usr/bin/env node
// Epsilon Miner (mining.epsilons.io) — CLI Node.js.
// Login: Telegram WebApp initData → ditukar jadi JWT di /auth/telegram.
// initData disimpan di .env (INIT_DATA=...), JWT hasil login di .tokens.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.EPS_API || 'https://api.epsilons.io/api/v1';
const TOKENS = path.join(HERE, '.tokens.json');
const argv = process.argv.slice(2);
const cmd = argv[0] || 'help';
const arg = (k, d = null) => {
  const i = argv.indexOf(k);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const has = (k) => argv.includes(k);

/* ---------- banner ---------- */
const C = { c: '\x1b[36m', m: '\x1b[35m', d: '\x1b[2m', b: '\x1b[1m', r: '\x1b[0m' };
const color = () => process.stdout.isTTY && !process.env.NO_COLOR && !has('--quiet');
function banner() {
  if (!color()) return;
  const { c, m, d, b, r } = C;
  const line = '─'.repeat(46);
  console.log(`
${d}┌${line}┐${r}
${d}│${r}  ${b}${c}E P S I L O N${r}   ${d}miner companion${r}
${d}│${r}  ${m}project${r}  Epsilon Miner · mining.epsilons.io
${d}│${r}  ${m}author ${r} 19Seniman
${d}│${r}  ${m}build  ${r} v1.0.0
${d}└${line}┘${r}`);
}

/* ---------- env ---------- */
function loadEnv() {
  const out = { ...process.env };
  const p = path.join(HERE, '.env');
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (v !== '') out[m[1]] = v;
    }
  }
  return out;
}
const ENV = loadEnv();

/* ---------- anti-bot ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HUMAN_MIN = Number(ENV.HUMAN_MIN_MS || 600);
const HUMAN_MAX = Number(ENV.HUMAN_MAX_MS || 1800);
const humanPause = async () => {
  if (ENV.NO_PACING === '1') return;
  await sleep(rnd(HUMAN_MIN, HUMAN_MAX));
};

/* ---------- tokens ---------- */
const loadTokens = () => { try { return JSON.parse(fs.readFileSync(TOKENS, 'utf8')); } catch { return {}; } };
const saveTokens = (t) => {
  fs.writeFileSync(TOKENS, JSON.stringify(t, null, 2), { mode: 0o600 });
  try { fs.chmodSync(TOKENS, 0o600); } catch {}
};

/* ---------- http ---------- */
async function api(endpoint, { method = 'GET', body, auth = true, quiet = false } = {}) {
  if (!quiet) await humanPause();
  const t = loadTokens();
  const headers = { accept: 'application/json', origin: 'https://mining.epsilons.io', referer: 'https://mining.epsilons.io/' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (auth && t.token) headers.authorization = `Bearer ${t.token}`;

  let res = await fetch(API + endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  for (let i = 1; i <= 3 && (res.status === 429 || res.status >= 500); i++) {
    const wait = Math.round(1500 * Math.pow(2, i) * rnd(0.8, 1.3));
    console.log(`  rate-limit ${res.status} · tunggu ${Math.round(wait / 1000)}s (${i}/3)`);
    await sleep(wait);
    res = await fetch(API + endpoint, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    const e = new Error(`${res.status} ${data?.error?.message || data?.message || ''}`.trim());
    e.status = res.status; e.code = data?.error?.code; e.data = data;
    throw e;
  }
  return data;
}

/* ---------- table ---------- */
const strip = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
const vlen = (s) => [...strip(s)].length;
const padTo = (s, n, right = false) => {
  const gap = ' '.repeat(Math.max(0, n - vlen(s)));
  return right ? gap + strip(s) : strip(s) + gap;
};
function table(headers, rows, aligns = []) {
  const cols = headers.map((h, i) => Math.max(vlen(h), ...rows.map((r) => vlen(r[i]))));
  const on = color();
  const D = on ? C.d : '', B = on ? C.b : '', R = on ? C.r : '';
  const rule = (l, m, r) => D + l + cols.map((w) => '─'.repeat(w + 2)).join(m) + r + R;
  console.log(rule('┌', '┬', '┐'));
  console.log(D + '│' + R + headers.map((h, i) => ` ${B}${padTo(h, cols[i])}${R} `).join(D + '│' + R) + D + '│' + R);
  console.log(rule('├', '┼', '┤'));
  for (const r of rows) console.log(D + '│' + R + r.map((c, i) => ` ${padTo(c ?? '-', cols[i], aligns[i] === 'r')} `).join(D + '│' + R) + D + '│' + R);
  console.log(rule('└', '┴', '┘'));
}

const nf = (n, d = 4) => (typeof n === 'number' ? n.toLocaleString('id-ID', { maximumFractionDigits: d }) : n ?? '-');
const fmtLeft = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return 'siap';
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m ? `${m}m ${s}s` : `${s}s`;
};

/* ---------- auth ---------- */
async function login() {
  const initData = arg('--init-data') || ENV.INIT_DATA;
  if (!initData) {
    console.error('INIT_DATA kosong. Ambil dari Telegram WebApp, lalu isi di .env');
    process.exit(1);
  }
  const r = await api('/auth/telegram', { method: 'POST', body: { initData }, auth: false });
  if (!r?.token) throw new Error('tidak ada token di respons: ' + JSON.stringify(r).slice(0, 200));
  saveTokens({ token: r.token, user: r.user || null, at: new Date().toISOString() });
  const u = r.user || {};
  console.log(`login OK · ${u.username ? '@' + u.username : u.firstName || u.id || 'user'}`);
  return r;
}

async function ensureLogin() {
  const t = loadTokens();
  if (t.token) {
    try { await api('/auth/me'); return t; } catch (e) { if (e.status !== 401) throw e; }
    console.log('JWT kedaluwarsa — login ulang dari INIT_DATA');
  }
  const r = await login();
  return { token: r.token };
}

/* ---------- views ---------- */
async function me() {
  const [p, m] = await Promise.all([api('/auth/profile').catch(() => null), api('/mining').catch(() => null)]);
  const u = p?.user || loadTokens().user || {};
  table(['FIELD', 'NILAI'], [
    ['akun', u.username ? '@' + u.username : u.firstName || u.id || '-'],
    ['telegram id', u.telegramId ?? u.id ?? '-'],
    ['balance', `${nf(m?.balance ?? u.balance ?? 0)} EPS`],
    ['status mining', m?.status ?? '-'],
    ['referral', u.referralCode ?? '-'],
  ]);
}

async function mining() {
  const m = await api('/mining');
  const left = m?.readyAt ? m.readyAt - (Date.now() + (m.serverNow ? m.serverNow - Date.now() : 0)) : 0;
  table(['FIELD', 'NILAI'], [
    ['status', m?.status ?? '-'],
    ['reward', `${nf(m?.rewardEps)} EPS`],
    ['selesai dalam', m?.status === 'MINING' ? fmtLeft(left) : '-'],
    ['balance', `${nf(m?.balance)} EPS`],
  ]);
  return m;
}

async function startMining() {
  const r = await api('/mining/start', { method: 'POST', body: {} });
  console.log(`mining dimulai · reward ${nf(r?.rewardEps)} EPS · selesai ${r?.readyAt ? new Date(r.readyAt).toISOString() : '?'}`);
  return r;
}

async function claimMining() {
  const r = await api('/mining/claim', { method: 'POST', body: {} });
  console.log(`claim ✓ · balance ${nf(r?.balance)} EPS`);
  return r;
}

async function tasks(auto = false) {
  const d = await api('/tasks');
  const list = d?.tasks || [];
  if (!list.length) return console.log('tidak ada task');
  table(
    ['ID', 'JUDUL', 'TIPE', 'REWARD', 'STATUS'],
    list.map((t) => [String(t.id).slice(0, 10), (t.title || '-').slice(0, 30), t.type || '-', t.reward != null ? `${t.reward} EPS` : '-', t.status || (t.completed ? 'COMPLETED' : '-')]),
    [0, 0, 0, 'r', 0]
  );
  if (!auto) return;

  for (const t of list) {
    if (t.completed || t.status === 'COMPLETED') continue;
    if (t.type === 'VIDEO_WATCH' || t.requiresCode) { console.log(`lewati ${t.id} (butuh aksi manual)`); continue; }
    try {
      const r = await api(`/tasks/${t.id}/complete`, { method: 'POST', body: {} });
      console.log(`task ✓ ${t.title?.slice(0, 40) || t.id}${r?.reward ? ` · +${r.reward} EPS` : ''}`);
    } catch (e) {
      console.log(`task ✗ ${t.id}: ${e.message}`);
    }
  }
}

async function autoLoop() {
  const poll = Math.max(20, Number(ENV.POLL_SECONDS || 60));
  const maxRounds = Number(ENV.MAX_ROUNDS || 0);
  console.log(`auto · poll ${poll}s · Ctrl+C stop`);
  let rounds = 0;
  for (;;) {
    if (maxRounds && ++rounds > maxRounds) { console.log(`batas ${maxRounds} putaran — berhenti`); break; }
    try {
      const m = await api('/mining');
      if (m.status === 'IDLE') await startMining();
      else if (m.status === 'READY') await claimMining();
      else console.log(`${new Date().toLocaleTimeString('id-ID')} · ${m.status.toLowerCase()} · ${fmtLeft((m.readyAt || 0) - Date.now())} lagi · ${nf(m.balance)} EPS`);
      await tasks(true);
    } catch (e) {
      console.log(`error: ${e.message}`);
      if (e.status === 401) { console.log('sesi habis — perbarui INIT_DATA'); break; }
    }
    await sleep(Math.round(poll * 1000 * rnd(0.8, 1.3)));
  }
}

/* ---------- main ---------- */
banner();
try {
  if (cmd === 'login') await login();
  else if (cmd === 'me') { await ensureLogin(); await me(); }
  else if (cmd === 'mining') { await ensureLogin(); await mining(); }
  else if (cmd === 'start') { await ensureLogin(); await startMining(); }
  else if (cmd === 'claim') { await ensureLogin(); await claimMining(); }
  else if (cmd === 'tasks') { await ensureLogin(); await tasks(has('--auto')); }
  else if (cmd === 'auto') { await ensureLogin(); await autoLoop(); }
  else if (cmd === 'referral') { await ensureLogin(); const r = await api('/referral'); console.log(JSON.stringify(r, null, 2)); }
  else if (cmd === 'whoami') {
    const t = loadTokens();
    console.log(t.token ? `login sejak ${t.at} · ${t.user?.username || t.user?.id || '-'}` : 'belum login');
  } else {
    console.log(`epsilon.js — CLI Epsilon Miner (mining.epsilons.io)

  node epsilon.js login             tukar INIT_DATA → JWT
  node epsilon.js me                profil + balance
  node epsilon.js mining            status sesi mining
  node epsilon.js start             mulai mining
  node epsilon.js claim             klaim reward
  node epsilon.js tasks             daftar task
  node epsilon.js tasks --auto      selesaikan task otomatis
  node epsilon.js auto              loop: start → wait → claim (+tasks)
  node epsilon.js referral          info referral
  node epsilon.js whoami            cek sesi tersimpan

.env: INIT_DATA=<initData dari Telegram WebApp>`);
  }
} catch (e) {
  console.error('error:', e.message);
  if (e.code) console.error('code   :', e.code);
  if (e.data) console.error('detail :', JSON.stringify(e.data).slice(0, 300));
  process.exit(1);
}
