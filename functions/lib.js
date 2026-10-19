// Bildirim kararları: veritabanına ya da ağa dokunmayan saf fonksiyonlar (index.js kullanır, test.js dener).
// Tarihler uygulamadaki gibi yerel 'YYYY-MM-DD' / 'HH:MM' dizgeleri. Türkiye 2016'dan beri yaz saati
// uygulamıyor, yerel saat her zaman UTC+3.
const TR_OFFSET = 3 * 3600e3;
const REM_MS = { m15: 15 * 60e3, h1: 3600e3, d1: 864e5 };
const GRACE = 10 * 60e3; // sunucu bir dakikayı kaçırırsa hatırlatma 10 dk içinde yine gider
const TASK_HOUR = '08:00', ALLDAY_HOUR = '09:00';
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const MON = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const pad = n => String(n).padStart(2, '0');
const isoUTC = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const localDay = now => isoUTC(new Date(now + TR_OFFSET));
const addDays = (day, n) => { const d = new Date(day + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return isoUTC(d) };
// Yerel gün + saat -> gerçek zaman (ms)
const atLocal = (day, time) => { const [y, m, d] = day.split('-').map(Number), [h, mi] = (time || '00:00').split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi) - TR_OFFSET };
const okDate = v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v);
const okTime = v => typeof v === 'string' && /^\d\d:\d\d$/.test(v);
const okId = k => typeof k === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(k);
const str = v => typeof v === 'string' ? v : '';
const ids = v => (Array.isArray(v) ? v : v && typeof v === 'object' ? Object.values(v) : []).filter(okId);
const clip = (s, n) => { s = str(s).trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s };
const hm = t => t ? t.replace(':', '.') : '';
const first = n => str(n).split(' ')[0] || 'Biri';

// uygulamadaki occurs() ile aynı
function occurs(e, day) {
  if (!okDate(e.date) || day < e.date) return false; if (day === e.date) return true;
  const a = new Date(e.date + 'T00:00:00Z'), b = new Date(day + 'T00:00:00Z');
  switch (e.repeat) {
    case 'daily': return true;
    case 'weekly': return a.getUTCDay() === b.getUTCDay();
    case 'monthly': return a.getUTCDate() === b.getUTCDate();
    case 'yearly': return a.getUTCDate() === b.getUTCDate() && a.getUTCMonth() === b.getUTCMonth();
  } return false
}
const ws = t => { const w = ids(t && t.who); return w.length ? w : okId(t && t.assignee) ? [t.assignee] : [] };

function relDay(day, today) {
  if (day === today) return 'Bugün'; if (day === addDays(today, 1)) return 'Yarın';
  const d = new Date(day + 'T00:00:00Z'); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${DAYS[d.getUTCDay()]}`
}
const when = (day, time, today) => `${relDay(day, today)}${okTime(time) ? ' ' + hm(time) : ''}`;

// Şu an gönderilmesi gereken hatırlatmalar: [{key, to:[memberId], kind, t, b}]
function dueReminders(events, tasks, now) {
  const out = [], today = localDay(now);
  for (const day of [today, addDays(today, 1)]) for (const [id, e] of Object.entries(events || {})) {
    if (!e || !REM_MS[e.rem] || !occurs(e, day)) continue;
    const start = atLocal(day, okTime(e.time) ? e.time : ALLDAY_HOUR), at = start - REM_MS[e.rem];
    if (now < at || now - at >= GRACE || now >= start + 3600e3) continue;
    const to = ids(e.members); if (!to.length) continue;
    out.push({ key: `e_${id}_${day}`, day, to, kind: 'ev', t: clip(e.title, 80) || 'Etkinlik', b: `${okTime(e.time) ? when(day, e.time, today) : relDay(day, today) + ', tüm gün'}${str(e.loc) ? ' · ' + clip(e.loc, 60) : ''}`, tag: 'e' + id })
  }
  for (const [id, t] of Object.entries(tasks || {})) {
    if (!t || t.done || t.due !== today) continue;
    const at = atLocal(today, okTime(t.time) ? t.time : TASK_HOUR);
    if (now < at || now - at >= GRACE) continue;
    const dn = ids(t.dn), to = ws(t).filter(m => !(t.all && dn.includes(m))); if (!to.length) continue;
    out.push({ key: `t_${id}_${today}`, day: today, to, kind: 'tk', t: `Görev: ${clip(t.title, 70)}`, b: okTime(t.time) ? `Bugün ${hm(t.time)}` : 'Bugün yapılacak', tag: 't' + id })
  }
  return out
}

// Bir görev yazıldığında kime ne gider. tasks: ailenin bütün görevleri (tekrarlayan görevin yeni kopyasını tanımak için)
function taskNotes(before, after, actor, names, tasks, now) {
  if (!after || after.done) return [];
  const old = before ? ws(before) : [], added = ws(after).filter(m => m !== actor && !old.includes(m));
  if (!added.length) return [];
  const today = localDay(now), title = clip(after.title, 70) || 'Görev', due = okDate(after.due) ? when(after.due, after.time, today) : '';
  // Tekrarlayan görev tamamlanınca uygulama aynı başlıkla yeni bir kopya açar: bu "görev verme" değil.
  // Sıra (rot) varsa sıradakine "Sıra sende" gider, yoksa kimseye bir şey gitmez.
  if (!before && after.repeat && after.repeat !== 'none') {
    const twin = Object.values(tasks || {}).some(x => x && x !== after && x.done && x.title === after.title && x.repeat === after.repeat && +x.doneAt > now - 5 * 60e3);
    if (twin) return ids(after.rot).length > 1 ? [{ to: added, kind: 'as', t: `Sıra sende: ${title}`, b: due }] : []
  }
  const who = names[actor] ? first(names[actor]) : first(names[after.by]);
  return [{ to: added, kind: 'as', t: `${who} sana bir görev verdi`, b: `${title}${due ? ' · ' + due : ''}`, tag: 'a' + (after.id || '') }]
}

function eventNotes(before, after, actor, names, allIds, now) {
  if (!after) return [];
  const old = before ? ids(before.members) : [], mem = ids(after.members), added = mem.filter(m => m !== actor && !old.includes(m));
  if (!added.length || !okDate(after.date)) return [];
  const today = localDay(now);
  if (after.date < today && (!after.repeat || after.repeat === 'none')) return [];
  const who = first(names[actor] || names[after.by]), title = clip(after.title, 70) || 'Etkinlik';
  const fam = allIds.length > 1 && allIds.every(m => mem.includes(m));
  return [{ to: added, kind: 'ad', t: fam ? `${who} aileye bir etkinlik ekledi` : `${who} seni bir etkinliğe ekledi`, b: `${title} · ${when(after.date, after.time, today)}`, tag: 'v' + (after.id || '') }]
}

function msgNotes(before, after, author, names, allIds) {
  const t = after && clip(after.t, 80); if (!t || (before && str(before.t) === str(after.t))) return [];
  const to = allIds.filter(m => m !== author); if (!to.length) return [];
  return [{ to, kind: 'ms', t: `${first(names[author])} panoya yazdı`, b: `“${t}”`, tag: 'm' + author }]
}

// Sadece tarayıcıların push sunucularına gönderilir; aile üyesi başka bir adres yazamaz.
const PUSH_HOSTS = /^(web\.push\.apple\.com|fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|push\.services\.mozilla\.com)$/;
function okSub(s) {
  if (!s || typeof s !== 'object' || !okId(s.m) || typeof s.e !== 'string' || s.e.length > 1000 || !s.k) return false;
  let u; try { u = new URL(s.e) } catch (e) { return false }
  return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname) && typeof s.k.p === 'string' && typeof s.k.a === 'string' && s.k.p.length < 200 && s.k.a.length < 100
}
// Kişinin o tür bildirimi kapatıp kapatmadığı (varsayılan açık)
const wants = (s, kind) => !kind || !s.p || s.p[kind] !== false;

module.exports = { TR_OFFSET, localDay, addDays, atLocal, occurs, ws, ids, dueReminders, taskNotes, eventNotes, msgNotes, okSub, wants, relDay };
