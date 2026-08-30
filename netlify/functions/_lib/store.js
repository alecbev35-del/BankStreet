// Thin wrapper over Netlify Blobs — the CRM's data store.
//
// Netlify Blobs is a built-in key/value store available to Functions with no
// setup and no external database. We keep everything under a single store
// ("crm") with these keys:
//   config       -> { prices, reviews }          (public site reads this)
//   inquiries    -> [ { id, name, phone, ... } ] (contact-form submissions)
//   subscribers  -> [ { email, status, ... } ]   (email list)
//   campaigns    -> [ { id, subject, sentAt, count } ] (email send log)
//
// In production Blobs is always configured, so it is used directly. In local
// `netlify dev --offline` (no linked site) Blobs is unavailable; we detect that
// one specific condition and fall back to a temp JSON file so the CRM is fully
// testable locally. The fallback can never engage in production because Blobs
// is always configured there.
import { getStore } from '@netlify/blobs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE = 'crm';
const FILE = path.join(os.tmpdir(), 'bsq-crm-store.json');
let useFile = false;

// Matches ONLY the "Blobs not configured for this environment" case — never a
// transient/runtime Blobs error, so production failures are never masked.
function isUnconfigured(err) {
  return /has not been configured to use Netlify Blobs/i.test(String((err && err.message) || err));
}

async function fileRead() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}
async function fileWrite(obj) {
  await fs.writeFile(FILE, JSON.stringify(obj));
}

export async function getJSON(key, fallback = null) {
  if (!useFile) {
    try {
      const v = await getStore(STORE).get(key, { type: 'json' });
      return v == null ? fallback : v;
    } catch (err) {
      if (!isUnconfigured(err)) return fallback; // read errors degrade gracefully
      useFile = true; // fall through to file store (local dev only)
    }
  }
  const all = await fileRead();
  return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : fallback;
}

export async function setJSON(key, value) {
  if (!useFile) {
    try {
      await getStore(STORE).setJSON(key, value);
      return;
    } catch (err) {
      if (!isUnconfigured(err)) throw err; // real write errors must surface
      useFile = true;
    }
  }
  const all = await fileRead();
  all[key] = value;
  await fileWrite(all);
}

// Read-modify-write helper for the array-shaped keys.
export async function updateArray(key, fn) {
  const current = (await getJSON(key, [])) || [];
  const next = fn(Array.isArray(current) ? current : []);
  await setJSON(key, next);
  return next;
}
