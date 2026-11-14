// Лесная почта: обезличенная статистика игровых событий (как mutaciya_events у «Мутации»).
// POST {d: id устройства, s: id захода, pk: на Пикабу?, v: версия, e: [[событие, {данные}], ...]} — до 40 событий за раз.
// Пишет в lp_events. Сводка: select public.lp_report(дней, только_пикабу). Разворачивается с verify_jwt=false.
import { createClient } from 'npm:@supabase/supabase-js@2';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const ID = /^[a-z0-9]{8,32}$/, EV = /^[a-z0-9_]{2,32}$/;
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response('ok', { headers: CORS });
  try {
    const b = await req.json();
    const d = String(b.d || ''), s = String(b.s || '');
    if (!ID.test(d) || !ID.test(s) || !Array.isArray(b.e)) return new Response('bad', { status: 400, headers: CORS });
    const rows = b.e.slice(0, 40).filter((x: unknown) => Array.isArray(x) && EV.test(String(x[0]))).map((x: unknown[]) => {
      let data = x[1] && typeof x[1] === 'object' ? x[1] : {};
      if (JSON.stringify(data).length > 600) data = {};
      return { device: d, session: s, pk: !!b.pk, ver: String(b.v || '').slice(0, 16), ev: String(x[0]), data };
    });
    if (rows.length) await db.from('lp_events').insert(rows);
    return new Response('ok', { headers: CORS });
  } catch (_) { return new Response('bad', { status: 400, headers: CORS }); }
});
