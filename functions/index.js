/* Bizim Ev bildirim sunucusu (Firebase Cloud Functions, Blaze).
   Telefonlar Web Push aboneliklerini families/{kod}/push/{uid} altına yazar: {m: üye, e: adres, k: {p, a}, p: {tür: false}}.
   - Her dakika: etkinlik ve görev hatırlatmaları (lib.dueReminders); gönderilenler pushlog/{kod} altında tutulur.
   - Görev, etkinlik ve pano mesajı yazılınca: "sana görev verdi", "seni etkinliğe ekledi", "panoya yazdı".
   Değişikliği yapan kişiye bildirim gitmez. pushidx ve pushlog yalnızca sunucunun okuduğu yerlerdir. */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueWritten } = require('firebase-functions/v2/database');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const webpush = require('web-push');
const L = require('./lib');

initializeApp();
const db = getDatabase();
const INSTANCE = 'bizimev-96297-default-rtdb';
const VAPID_PUBLIC = 'BLxtYzrpEo830fpjfQPVEqZJ9Q8Db2ykKuhMysKRpwQouMD8zscludFVZ4Os6OhI3BfPKiVWP-zGBmko4S4Fzmw';
const VAPID_PRIVATE = defineSecret('VAPID_PRIVATE');
setGlobalOptions({ region: 'us-central1', memory: '256MiB', maxInstances: 3 });
const opts = ref => ({ ref, instance: INSTANCE, secrets: [VAPID_PRIVATE] });

let vapidSet = false;
function vapid() { if (!vapidSet) { webpush.setVapidDetails('https://ensar0-beep.github.io/bizim-ev/', VAPID_PUBLIC, VAPID_PRIVATE.value()); vapidSet = true } }

// subs: {uid: abonelik}. note: {to, kind, t, b, tag}
async function deliver(code, subs, note) {
  vapid(); const jobs = [];
  for (const [uid, s] of Object.entries(subs || {})) {
    if (!L.okSub(s) || !note.to.includes(s.m) || !L.wants(s, note.kind)) continue;
    const body = JSON.stringify({ t: note.t, b: note.b || '', tag: note.tag || note.kind || 'bizim-ev' });
    jobs.push(webpush.sendNotification({ endpoint: s.e, keys: { p256dh: s.k.p, auth: s.k.a } }, body, { TTL: 6 * 3600, urgency: 'high' })
      .catch(e => {
        // Abonelik bitmiş (uygulama silinmiş, izin kaldırılmış): kaydı temizle
        if (e.statusCode === 404 || e.statusCode === 410) return db.ref(`families/${code}/push/${uid}`).remove();
        logger.warn('push failed', code, uid, e.statusCode, String(e.body || e.message).slice(0, 200))
      }))
  }
  await Promise.all(jobs); return jobs.length
}
const get = async p => (await db.ref(p).get()).val();
const actorOf = async (code, ev) => ev.authType === 'user' && ev.authId ? (await get(`families/${code}/uids/${ev.authId}`)) : null;
async function family(code) {
  const [subs, members] = await Promise.all([get(`families/${code}/push`), get(`families/${code}/members`)]);
  const names = {}, all = [];
  for (const [id, m] of Object.entries(members || {})) if (L.ids([id]).length) { names[id] = m && typeof m.name === 'string' ? m.name : ''; all.push(id) }
  return { subs, names, all }
}

exports.taskWritten = onValueWritten(opts('/families/{code}/tasks/{id}'), async ev => {
  const code = ev.params.code, after = ev.data.after.val(); if (!after || after.done) return;
  const f = await family(code); if (!f.subs) return;
  const actor = await actorOf(code, ev), tasks = await get(`families/${code}/tasks`);
  for (const n of L.taskNotes(ev.data.before.val(), Object.assign({ id: ev.params.id }, after), actor, f.names, tasks, Date.now())) await deliver(code, f.subs, n)
});

exports.eventWritten = onValueWritten(opts('/families/{code}/events/{id}'), async ev => {
  const code = ev.params.code, after = ev.data.after.val(); if (!after) return;
  const f = await family(code); if (!f.subs) return;
  const actor = await actorOf(code, ev);
  for (const n of L.eventNotes(ev.data.before.val(), Object.assign({ id: ev.params.id }, after), actor, f.names, f.all, Date.now())) await deliver(code, f.subs, n)
});

exports.msgWritten = onValueWritten(opts('/families/{code}/msgs/{mid}'), async ev => {
  const code = ev.params.code, f = await family(code); if (!f.subs) return;
  for (const n of L.msgNotes(ev.data.before.val(), ev.data.after.val(), ev.params.mid, f.names, f.all)) await deliver(code, f.subs, n)
});

// Abonelik yazılınca aileyi dakikalık taramaya ekle; "Dene" düğmesi (test alanı) o telefona örnek bildirim yollar
exports.pushWritten = onValueWritten(opts('/families/{code}/push/{uid}'), async ev => {
  const code = ev.params.code, before = ev.data.before.val(), after = ev.data.after.val();
  if (!/^[A-Z2-9]{8}$/.test(code)) return;
  if (after) await db.ref(`pushidx/${code}`).set(true);
  if (after && after.test && (!before || before.test !== after.test) && Date.now() - after.test < 5 * 60e3)
    await deliver(code, { [ev.params.uid]: after }, { to: [after.m], kind: '', t: 'Bildirimler açık', b: 'Hatırlatmalar ve sana dair haberler bu telefona gelecek.', tag: 'test' })
});

exports.reminders = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Europe/Istanbul', secrets: [VAPID_PRIVATE], retryCount: 0 }, async () => {
  const now = Date.now(), today = L.localDay(now), codes = Object.keys((await get('pushidx')) || {});
  for (const code of codes) {
    const [subs, events, tasks, sent] = await Promise.all([get(`families/${code}/push`), get(`families/${code}/events`), get(`families/${code}/tasks`), get(`pushlog/${code}`)]);
    if (!subs) { await db.ref(`pushidx/${code}`).remove(); continue }
    const log = sent || {}, upd = {};
    for (const r of L.dueReminders(events, tasks, now)) {
      if (log[r.key]) continue;
      upd[r.key] = now; await deliver(code, subs, r)
    }
    // iki günden eski kayıtları sil
    for (const k in log) { const d = k.slice(-10); if (d < L.addDays(today, -2)) upd[k] = null }
    if (Object.keys(upd).length) await db.ref(`pushlog/${code}`).update(upd)
  }
});
