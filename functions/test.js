// node test.js — bildirim kararlarının küçük denemesi
const L = require('./lib'), assert = require('assert');
const at = (day, time) => L.atLocal(day, time);
let n = 0; const ok = (c, m) => { assert(c, m); n++ };

// Saat: 19 Ekim 2026 Pazartesi 13.00 (Türkiye)
const now = at('2026-10-19', '13:00');
ok(L.localDay(now) === '2026-10-19', 'yerel gün');
ok(L.localDay(at('2026-10-19', '23:59')) === '2026-10-19' && L.localDay(at('2026-10-20', '00:01')) === '2026-10-20', 'gece yarısı');

const events = {
  a: { title: 'Diş', date: '2026-10-19', time: '14:00', rem: 'h1', members: ['ayse'], loc: 'Kadıköy', repeat: 'none' },
  b: { title: 'Toplantı', date: '2026-10-19', time: '13:10', rem: 'm15', members: ['mehmet'], repeat: 'none' },
  c: { title: 'Doğum günü', date: '2025-10-20', time: '', rem: 'd1', members: ['ayse', 'mehmet'], repeat: 'yearly' },
  d: { title: 'Sessiz', date: '2026-10-19', time: '14:00', rem: 'none', members: ['ayse'] },
  e: { title: 'Haftalık', date: '2026-10-05', time: '13:30', rem: 'm15', members: ['can'], repeat: 'weekly' }
};
let r = L.dueReminders(events, {}, now).map(x => x.key).sort();
ok(JSON.stringify(r) === JSON.stringify(['e_a_2026-10-19', 'e_b_2026-10-19']), 'saatinde olanlar: ' + r);
r = L.dueReminders(events, {}, at('2026-10-19', '09:00'));
ok(r.length === 1 && r[0].key === 'e_c_2026-10-20' && r[0].b === 'Yarın, tüm gün', 'yıllık, 1 gün önce, tüm gün: ' + JSON.stringify(r));
r = L.dueReminders(events, {}, at('2026-10-19', '13:15')).map(x => x.key);
ok(r.includes('e_e_2026-10-19') && !r.includes('e_a_2026-10-19'), 'haftalık tekrar; 15 dk geçen gitmez');
ok(L.dueReminders(events, {}, at('2026-10-19', '13:09')).some(x => x.key === 'e_a_2026-10-19'), '10 dk pay');
ok(!L.dueReminders(events, {}, at('2026-10-19', '13:11')).some(x => x.key === 'e_e_2026-10-19'), 'erken değil');
ok(!L.dueReminders(events, {}, at('2026-10-19', '13:30')).some(x => x.key === 'e_a_2026-10-19'), '10 dk sonra artık gitmez');

const tasks = {
  t1: { title: 'Çöp', due: '2026-10-19', time: '', who: ['can'], done: false },
  t2: { title: 'Market', due: '2026-10-19', time: '13:00', who: ['ayse', 'mehmet'], all: true, dn: ['ayse'], done: false },
  t3: { title: 'Bitti', due: '2026-10-19', time: '13:00', who: ['ayse'], done: true },
  t4: { title: 'Yarın', due: '2026-10-20', time: '13:00', assignee: 'ayse', done: false }
};
r = L.dueReminders({}, tasks, at('2026-10-19', '08:03'));
ok(r.length === 1 && r[0].to[0] === 'can' && r[0].b === 'Bugün yapılacak', 'saatsiz görev sabah 08.00');
r = L.dueReminders({}, tasks, now);
ok(r.length === 1 && JSON.stringify(r[0].to) === '["mehmet"]', 'herkes yapınca biter: payını yapana gitmez');

const names = { ayse: 'Ayşe', mehmet: 'Mehmet Yılmaz', can: 'Can', zeynep: 'Zeynep' }, all = Object.keys(names);
r = L.taskNotes(null, { id: 'x', title: 'Çöpü çıkar', due: '2026-10-19', who: ['ayse', 'can'], by: 'ayse' }, 'ayse', names, {}, now);
ok(r.length === 1 && JSON.stringify(r[0].to) === '["can"]' && r[0].t === 'Ayşe sana bir görev verdi' && r[0].b === 'Çöpü çıkar · Bugün', 'yeni görev: ' + JSON.stringify(r));
r = L.taskNotes({ who: ['can'] }, { title: 'Çöp', due: '2026-10-20', time: '18:00', who: ['can', 'zeynep'] }, 'mehmet', names, {}, now);
ok(r.length === 1 && r[0].to[0] === 'zeynep' && r[0].t.startsWith('Mehmet') && r[0].b === 'Çöp · Yarın 18.00', 'kişi eklendi');
ok(!L.taskNotes({ who: ['can'] }, { title: 'Çöp', who: ['can'] }, 'can', names, {}, now).length, 'değişmeyen kişi');
const done = { title: 'Market', repeat: 'weekly', done: true, doneAt: now - 1000 };
ok(!L.taskNotes(null, { title: 'Market', repeat: 'weekly', who: ['ayse', 'mehmet'], due: '2026-10-26' }, 'ayse', names, { o: done }, now).length, 'tekrar kopyası, sırasız: sessiz');
r = L.taskNotes(null, { title: 'Market', repeat: 'weekly', who: ['mehmet'], rot: ['ayse', 'mehmet'], due: '2026-10-26' }, 'ayse', names, { o: done }, now);
ok(r.length === 1 && r[0].t === 'Sıra sende: Market', 'sıra sende');
ok(!L.taskNotes(null, { title: 'X', who: ['can'], done: true }, 'ayse', names, {}, now).length, 'bitmiş görev');

r = L.eventNotes(null, { title: 'Piknik', date: '2026-10-24', time: '14:00', members: ['ayse', 'zeynep'] }, 'ayse', names, all, now);
ok(r.length === 1 && r[0].to[0] === 'zeynep' && r[0].t === 'Ayşe seni bir etkinliğe ekledi' && r[0].b === 'Piknik · 24 Ekim Cumartesi 14.00', 'etkinlik: ' + JSON.stringify(r));
r = L.eventNotes(null, { title: 'Sohbet', date: '2026-10-23', time: '19:00', members: all }, 'mehmet', names, all, now);
ok(r[0].t === 'Mehmet aileye bir etkinlik ekledi' && r[0].to.length === 3, 'bütün aile');
ok(!L.eventNotes(null, { title: 'Eski', date: '2026-10-01', members: ['can'] }, 'ayse', names, all, now).length, 'geçmiş etkinlik');
ok(!L.eventNotes({ members: ['can'] }, { title: 'A', date: '2026-10-24', members: ['can'] }, 'ayse', names, all, now).length, 'sadece başlık değişti');

r = L.msgNotes(null, { t: 'Geç geleceğim', at: 1 }, 'can', names, all);
ok(r.length === 1 && r[0].to.length === 3 && !r[0].to.includes('can') && r[0].t === 'Can panoya yazdı', 'pano');
ok(!L.msgNotes({ t: 'a' }, { t: 'a', at: 2 }, 'can', names, all).length && !L.msgNotes({ t: 'a' }, null, 'can', names, all).length, 'aynı mesaj / silme');

const sub = { m: 'ayse', e: 'https://web.push.apple.com/abc', k: { p: 'x', a: 'y' } };
ok(L.okSub(sub) && L.okSub({ ...sub, e: 'https://fcm.googleapis.com/fcm/send/1' }), 'push adresleri');
ok(!L.okSub({ ...sub, e: 'https://evil.example.com/' }) && !L.okSub({ ...sub, e: 'http://web.push.apple.com/' }) && !L.okSub({ ...sub, m: '../x' }), 'yabancı adres reddedilir');
ok(L.wants(sub, 'ev') && !L.wants({ ...sub, p: { ev: false } }, 'ev') && L.wants({ ...sub, p: { ev: false } }, ''), 'tür ayarı');
console.log(n, 'deneme geçti');
