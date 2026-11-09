'use strict';
/* Utilitários das funções do servidor (Vercel). O "_" no nome impede que
   este arquivo vire uma rota pública. */
const crypto = require('crypto');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function sb(path, { method = 'GET', body, prefer } = {}) {
  if (!SB_URL || !SB_KEY) throw new Error('Supabase não configurado no servidor');
  const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
}

function siteUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return (process.env.SITE_URL || `https://${host}`).replace(/\/$/, '');
}

async function getSettings() {
  const rows = await sb('settings?select=key,value');
  const out = {};
  (rows || []).forEach(r => { out[r.key] = r.value; });
  return out;
}

function genCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return 'GM-' + Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const escHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* E-mail opcional via Resend. Sem RESEND_API_KEY, simplesmente não envia. */
async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, html })
    });
    return r.ok;
  } catch (e) {
    return false;
  }
}

module.exports = { sb, send, siteUrl, getSettings, genCode, brl, escHtml, sendEmail };
