// Лесная почта: еженедельный турнир. GET — таблица, POST {pid,name,score} — результат, POST {action:'claim',pid} — приз за прошлую неделю.
// Разворачивается в Supabase как функция lp-tour с verify_jwt=false (проверки — внутри).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const MSK = 3 * 3600e3;
const weekOf = (t: number) => Math.floor((Math.floor((t + MSK) / 864e5) + 3) / 7);
const weekEnd = (w: number) => ((w + 1) * 7 - 3) * 864e5 - MSK;
const PID = /^[a-z0-9-]{8,40}$/;
const PRIZE = (r: number) => r === 1 ? 500 : r <= 3 ? 300 : r <= 10 ? 150 : r <= 50 ? 60 : 20;
const BAD = /(х[уy][йияеёю]|п[иі]зд|[её]б[аол]|бля|сук[аи]|муда|гандон|пид[оа]р|залуп|шлюх|дроч)/i;
function cleanName(n: unknown, pid: string) {
  let s = String(n ?? '').replace(/[<>"'`\\\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (s.length < 2 || BAD.test(s)) s = 'Почтальон ' + pid.replace(/[^0-9]/g, '').slice(-4).padStart(4, '7');
  return s;
}
async function board(week: number, pid?: string) {
  const { data: top } = await db.from('lp_tour_scores').select('name,score,pid').eq('week', week).order('score', { ascending: false }).order('updated_at', { ascending: true }).limit(50);
  let me = null;
  if (pid) { const { data } = await db.rpc('lp_tour_rank', { p_week: week, p_pid: pid }); if (data && data[0]) me = { rank: Number(data[0].rank), score: data[0].score }; }
  const { count } = await db.from('lp_tour_scores').select('pid', { count: 'exact', head: true }).eq('week', week);
  return { top: (top || []).map((r: any) => ({ n: r.name, s: r.score, me: r.pid === pid })), me, total: count || 0 };
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const now = Date.now(), week = weekOf(now);
    if (req.method === 'GET') {
      const pid = new URL(req.url).searchParams.get('pid') || '';
      const p = PID.test(pid) ? pid : undefined;
      const cur = await board(week, p);
      let last = null;
      if (p) { const { data } = await db.rpc('lp_tour_rank', { p_week: week - 1, p_pid: p }); if (data && data[0]) { const { count } = await db.from('lp_tour_scores').select('pid', { count: 'exact', head: true }).eq('week', week - 1); const { data: cl } = await db.from('lp_tour_claims').select('prize').eq('week', week - 1).eq('pid', p).maybeSingle(); const rank = Number(data[0].rank); last = { week: week - 1, rank, score: data[0].score, total: count || 0, prize: PRIZE(rank), claimed: !!cl }; } }
      return J({ week, ends: weekEnd(week), ...cur, last });
    }
    if (req.method === 'POST') {
      const b = await req.json().catch(() => ({}));
      const pid = String(b.pid || '');
      if (!PID.test(pid)) return J({ error: 'bad pid' }, 400);
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
      const { error } = await db.rpc('lp_tour_submit', { p_week: week, p_pid: pid, p_name: cleanName(b.name, pid), p_score: score });
      if (error) return J({ error: 'db' }, 500);
      return J({ week, ends: weekEnd(week), ...(await board(week, pid)) });
    }
    return J({ error: 'method' }, 405);
  } catch (_e) { return J({ error: 'server' }, 500); }
});
