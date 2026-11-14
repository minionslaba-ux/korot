// Лесная почта: еженедельный турнир.
//   GET ?pid=        — таблица своего контура (50 мест), место игрока, итог прошлой недели (с признаком «приз забран»)
//   POST {pid,name,score,week,signed?}   — лучший результат недели
//   POST {action:'claim',pid,signed?}    — приз за прошлую неделю (сумму считает сервер, выдаёт один раз)
// Контуры: pid 'pk-<id>' — Пикабу Игры. Для них обязателен signed — подписанные данные игрока
// (player.getSignedData() из SDK Пикабу, JWT HS256, ключ игры из Студии Пикабу в секрете LP_PIKABU_SECRET).
// Сервер сам выводит pid и имя из подписи, поэтому чужим аккаунтом Пикабу результат не отправить.
// pid 'lp-...' — сайт и демо: без подписи, своя отдельная таблица.
// Разворачивается в Supabase как функция lp-tour с verify_jwt=false (проверки — внутри).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const SECRET = (Deno.env.get('LP_PIKABU_SECRET') || '').trim();
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MSK = 3 * 3600e3;
const weekOf = (t: number) => Math.floor((Math.floor((t + MSK) / 864e5) + 3) / 7);
const weekEnd = (w: number) => ((w + 1) * 7 - 3) * 864e5 - MSK;
const PID = /^(lp-[a-z0-9]{8,37}|pk-[a-z0-9_]{1,37})$/;
const PRIZE = (r: number) => r === 1 ? 500 : r <= 3 ? 300 : r <= 10 ? 150 : r <= 50 ? 60 : 20;
const BAD = /(х[уy][йияеёю]|п[иі]зд|[её]б[аол]|бля|сук[аи]|муда|гандон|пид[оа]р|залуп|шлюх|дроч)/i;
const prefix = (pid: string) => pid.slice(0, 3);
function cleanName(n: unknown, pid: string) {
  let s = String(n ?? '').replace(/[<>"'`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (s.length < 2 || BAD.test(s)) s = 'Почтальон ' + pid.replace(/[^0-9]/g, '').slice(-4).padStart(4, '7');
  return s;
}
// ---- подпись Пикабу (как в pikabu-verify): JWT HS256
const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function verifyPikabu(token: unknown): Promise<Record<string, unknown> | null> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || !SECRET) return null;
  try {
    const head = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[0])));
    if (head.alg !== 'HS256') return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    if (!await crypto.subtle.verify('HMAC', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]))) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlBytes(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (typeof p.exp === 'number' && p.exp < now - 60) return null;          // просрочена
    if (typeof p.iat === 'number' && p.iat < now - 7 * 86400) return null;   // старше недели
    return p;
  } catch { return null; }
}
const playerIdOf = (p: Record<string, unknown>) => String(p.playerId ?? p.id ?? p.userId ?? p.user_id ?? p.sub ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 37);
// для pid 'pk-...' — проверить подпись и вернуть {pid, name}; иначе {pid} как есть
async function who(b: Record<string, unknown>): Promise<{ pid: string; name?: string } | { err: string; code: number }> {
  const pid = String(b.pid || '');
  if (!PID.test(pid)) return { err: 'bad pid', code: 400 };
  if (prefix(pid) !== 'pk-') return { pid };
  if (!SECRET) return { err: 'not_configured', code: 503 };
  const p = await verifyPikabu(b.signed);
  if (!p) return { err: 'bad_signature', code: 403 };
  const id = playerIdOf(p);
  if (!id || 'pk-' + id !== pid) return { err: 'player_mismatch', code: 403 };
  return { pid, name: typeof p.name === 'string' ? p.name : undefined };
}
async function board(week: number, pid?: string, pref = 'lp-') {
  const pr = pid ? prefix(pid) : pref;
  const { data: top } = await db.from('lp_tour_scores').select('name,score,pid').eq('week', week).like('pid', pr + '%').order('score', { ascending: false }).order('updated_at', { ascending: true }).limit(50);
  let me = null;
  if (pid) { const { data } = await db.rpc('lp_tour_rank', { p_week: week, p_pid: pid }); if (data && data[0]) me = { rank: Number(data[0].rank), score: data[0].score }; }
  const { count } = await db.from('lp_tour_scores').select('pid', { count: 'exact', head: true }).eq('week', week).like('pid', pr + '%');
  return { top: (top || []).map((r: any) => ({ n: r.name, s: r.score, me: r.pid === pid })), me, total: count || 0, board: pr === 'pk-' ? 'pikabu' : 'web' };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const now = Date.now(), week = weekOf(now);
    if (req.method === 'GET') {
      const u = new URL(req.url), pid = u.searchParams.get('pid') || '';
      const p = PID.test(pid) ? pid : undefined;
      const cur = await board(week, p, u.searchParams.get('board') === 'pikabu' ? 'pk-' : 'lp-');
      let last = null;
      if (p) {
        const { data } = await db.rpc('lp_tour_rank', { p_week: week - 1, p_pid: p });
        if (data && data[0]) {
          const { data: cl } = await db.from('lp_tour_claims').select('prize').eq('week', week - 1).eq('pid', p).maybeSingle();
          const rank = Number(data[0].rank);
          last = { week: week - 1, rank, score: data[0].score, total: Number(data[0].total), prize: PRIZE(rank), claimed: !!cl };
        }
      }
      return J({ week, ends: weekEnd(week), ...cur, last, verify: !!SECRET });
    }
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const w = await who(b);
      if ('err' in w) return J({ error: w.err }, w.code);
      const pid = w.pid;
      if (b.action === 'claim') {
        const { data, error } = await db.rpc('lp_tour_claim', { p_week: week - 1, p_pid: pid });
        if (error) return J({ error: 'db' }, 500);
        const v = Number(data);
        if (v === 0) return J({ error: 'no entry' }, 404);
        if (v < 0) return J({ error: 'already claimed' }, 409);
        return J({ week: week - 1, prize: v });
      }
      const score = Math.floor(Number(b.score));
      if (!Number.isFinite(score) || score < 0 || score > 250000) return J({ error: 'bad score' }, 400);
      if (b.week != null && Number(b.week) !== week) return J({ error: 'week over', week }, 409);
      const { data: prev } = await db.from('lp_tour_scores').select('updated_at').eq('week', week).eq('pid', pid).maybeSingle();
      if (prev && now - new Date(prev.updated_at).getTime() < 15000) return J({ error: 'too fast' }, 429);
      const { error } = await db.rpc('lp_tour_submit', { p_week: week, p_pid: pid, p_name: cleanName(w.name ?? b.name, pid), p_score: score });
      if (error) return J({ error: 'db' }, 500);
      return J({ week, ends: weekEnd(week), ...(await board(week, pid)) });
    }
    return J({ error: 'method' }, 405);
  } catch (_e) { return J({ error: 'server' }, 500); }
});
