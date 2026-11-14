// Лесная почта: проверка покупок на Пикабу Играх (как mutaciya-pikabu / nf-pikabu).
// Игра присылает signedData покупки (purchase.getSignedData(): JWT HS256, подписан секретным ключом игры из Студии Пикабу),
// функция проверяет подпись ключом LP_PIKABU_SECRET (тот же, что у турнира), товар и записывает покупку в lp_pk_purchases.
// Ответ: { ok, productId, purchaseId, test, fresh }. Разворачивается с verify_jwt=false.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SECRET = (Deno.env.get('LP_PIKABU_SECRET') || '').trim();
const PRODUCTS = new Set(['starter', 'coins500', 'coins1500', 'coins4000', 'moves5', 'noads', 'pass']);
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function verify(token: unknown): Promise<Record<string, unknown> | null> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !SECRET) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0])));
    if (head.alg !== 'HS256') return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) return null;
    return JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1])));
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ ok: true, ready: !!SECRET });
  if (!SECRET) return json({ ok: false, error: 'not_configured' }, 503);
  const b = await req.json().catch(() => null);
  const p = await verify(b && b.signedData);
  if (!p) return json({ ok: false, error: 'bad_signature' }, 403);
  const purchaseId = String(p.purchaseId || ''), productId = String(p.productId || '');
  if (!purchaseId || !PRODUCTS.has(productId)) return json({ ok: false, error: 'unknown_product' }, 400);
  const { data, error } = await db.from('lp_pk_purchases').upsert({ purchase_id: purchaseId.slice(0, 200), player_id: String(p.playerId ?? '').slice(0, 100), product_id: productId, test: !!p.isTestPurchase }, { onConflict: 'purchase_id', ignoreDuplicates: true }).select('purchase_id');
  if (error) return json({ ok: false, error: 'db' }, 500);
  return json({ ok: true, productId, purchaseId, test: !!p.isTestPurchase, fresh: !!(data && data.length) });
});
