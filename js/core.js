// CARDS SEASON core: constants, helpers, storage, rules (lineups, ratings, contracts, values).
const CS = window.CS = window.CS || {};
CS.VER = '1.0.0';
CS.KEY = 'cardsseason_v1';
CS.POS = ['QB', 'RB', 'WR', 'TE', 'DEF'];
CS.SLOTS = { QB: 1, RB: 1, WR: 3, TE: 1, DEF: 1 };
CS.SLOT_LIST = ['QB', 'RB', 'WR', 'WR', 'WR', 'TE', 'DEF'];
CS.SUBS = ['DL', 'LB', 'CB', 'S'];
CS.START_YEAR = 2026;

// ---------- NFL base teams ----------
CS.NFL = {};
NFL_TEAMS.forEach(r => { CS.NFL[r[0]] = { id: r[0], city: r[1], name: r[2], full: r[1] + ' ' + r[2], conf: r[3], div: r[4], c1: r[5], c2: r[6], def: r[7], ol: r[8], k: r[9], p: r[10] }; });
CS.NFL_LIST = Object.values(CS.NFL).sort((a, b) => a.full.localeCompare(b.full));
CS.logoUrl = id => 'https://a.espncdn.com/i/teamlogos/nfl/500/' + (id === 'WAS' ? 'wsh' : id.toLowerCase()) + '.png';

// ---------- helpers ----------
CS.rnd = Math.random;
CS.uid = () => Math.floor(CS.rnd() * 36 ** 6).toString(36).padStart(6, '0') + Date.now().toString(36).slice(-3);
CS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
CS.randInt = (a, b) => a + Math.floor(CS.rnd() * (b - a + 1));
CS.gauss = () => { let u = 0, v = 0; while (!u) u = CS.rnd(); while (!v) v = CS.rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
CS.pick = a => a[Math.floor(CS.rnd() * a.length)];
CS.shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(CS.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
CS.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
CS.r1 = n => Math.round(n * 10) / 10;
CS.money = n => '$' + CS.r1(n).toFixed(1) + 'M';
CS.ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
CS.sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

// ---------- storage ----------
CS.db = { leagues: {}, order: [] };
CS.load = () => {
  try { const j = JSON.parse(localStorage.getItem(CS.KEY)); if (j && j.leagues) CS.db = { leagues: j.leagues, order: j.order || Object.keys(j.leagues) }; } catch (e) { /* fresh start */ }
};
CS.save = () => {
  try { localStorage.setItem(CS.KEY, JSON.stringify(CS.db)); return true; }
  catch (e) { if (CS.onSaveError) CS.onSaveError(e); return false; }
};
CS.league = id => CS.db.leagues[id];

// ---------- teams / names ----------
CS.team = (L, tid) => L.teams.find(t => t.id === tid);
CS.tfull = (L, tid) => { const t = CS.team(L, tid); if (!t) return '?'; if (t.nick) return t.nick; return t.base ? CS.NFL[t.base.nfl].full : t.mgr + "'s team"; };
CS.tname = (L, tid) => { const t = CS.team(L, tid); if (!t) return '?'; if (t.nick) return t.nick; return t.base ? CS.NFL[t.base.nfl].name : t.mgr; };
CS.takenNfl = L => new Set(L.teams.filter(t => t.base).map(t => t.base.nfl));
CS.makeBase = abbr => { const n = CS.NFL[abbr]; return { nfl: abbr, def: n.def, ol: n.ol, k: n.k, p: n.p }; };

// ---------- rosters ----------
CS.roster = (L, tid) => L.players.filter(p => p.tid === tid);
CS.payroll = (L, tid) => CS.r1(CS.sum(CS.roster(L, tid), p => p.sal || 0));
CS.capSpace = (L, tid) => CS.r1(L.settings.cap - CS.payroll(L, tid));
CS.byId = (L, pid) => L.players.find(p => p.id === pid);
CS.lineup = (L, tid) => {
  const r = CS.roster(L, tid).sort((a, b) => (b.force ? 1 : 0) - (a.force ? 1 : 0) || b.ovr - a.ovr);
  const by = { QB: [], RB: [], WR: [], TE: [], DEF: [] };
  r.forEach(p => by[p.pos].push(p));
  const lu = { QB: by.QB[0] || null, RB: by.RB[0] || null, WR: by.WR.slice(0, 3), TE: by.TE[0] || null, DEF: by.DEF[0] || null };
  lu.starters = [lu.QB, lu.RB, ...lu.WR, lu.TE, lu.DEF].filter(Boolean);
  const ids = new Set(lu.starters.map(p => p.id));
  lu.bench = r.filter(p => !ids.has(p.id));
  lu.empty = []; // open starter slots
  if (!lu.QB) lu.empty.push('QB'); if (!lu.RB) lu.empty.push('RB');
  for (let i = lu.WR.length; i < 3; i++) lu.empty.push('WR');
  if (!lu.TE) lu.empty.push('TE'); if (!lu.DEF) lu.empty.push('DEF');
  return lu;
};
CS.needs = (L, tid) => CS.lineupSlots(L, tid).empty;
CS.lineupSlots = (L, tid) => {
  // open slots by plain count (ignores the force flag)
  const r = CS.roster(L, tid), c = {}; CS.POS.forEach(p => c[p] = r.filter(x => x.pos === p).length);
  const empty = [];
  CS.POS.forEach(p => { for (let i = c[p]; i < CS.SLOTS[p]; i++) empty.push(p); });
  return { empty, count: c };
};
CS.setStarter = (L, pid) => {
  const p = CS.byId(L, pid); if (!p || p.tid == null) return;
  const mates = CS.roster(L, p.tid).filter(x => x.pos === p.pos && x.id !== p.id);
  p.force = true;
  const forced = mates.filter(x => x.force).sort((a, b) => b.ovr - a.ovr);
  const keep = CS.SLOTS[p.pos] - 1;
  forced.slice(keep).forEach(x => { x.force = false; });
};
CS.clearStarters = (L, tid) => CS.roster(L, tid).forEach(p => { p.force = false; });

// ---------- ratings ----------
CS.EMPTY = 45;
CS.rate = (L, tid) => {
  const t = CS.team(L, tid), lu = CS.lineup(L, tid), E = CS.EMPTY;
  const b = t.base || { def: 65, ol: 65, k: 65, p: 65 };
  const qb = lu.QB ? lu.QB.ovr : E, rb = lu.RB ? lu.RB.ovr : E, te = lu.TE ? lu.TE.ovr : E, dp = lu.DEF ? lu.DEF.ovr : E;
  const w = [0, 1, 2].map(i => lu.WR[i] ? lu.WR[i].ovr : E);
  const wr = w[0] * .4 + w[1] * .32 + w[2] * .28;
  const off = .32 * qb + .09 * rb + .24 * wr + .07 * te + .28 * b.ol;
  const def = .65 * b.def + .35 * dp;
  const st = (b.k + b.p) / 2;
  return { off, def, st, ovr: Math.round(.46 * off + .42 * def + .12 * st), qb, rb, wr, te, ol: b.ol, dp, k: b.k, p: b.p, def0: b.def };
};

// ---------- contracts ----------
const POS_PAY = { QB: 1.25, RB: .8, WR: .9, TE: .7, DEF: 1 };
CS.askSal = p => {
  const base = .6 + 26 * Math.pow(Math.max(p.ovr - 60, 0) / 39, 2.2);
  const ageM = p.age <= 26 ? 1.05 : p.age <= 29 ? 1 : p.age <= 31 ? .88 : .7;
  return CS.r1(Math.max(.5, base * (POS_PAY[p.pos] || 1) * ageM));
};
CS.askYears = p => p.age <= 26 ? 4 : p.age <= 29 ? 3 : p.age <= 32 ? 2 : 1;
CS.rookieSal = (p, L) => CS.r1(Math.max(.5, CS.askSal(p) * .45));
CS.minAccept = ask => CS.r1(ask * .9);

// ---------- trade values ----------
const AGE_VAL = a => a <= 24 ? 1.25 : a <= 27 ? 1.1 : a <= 29 ? 1 : a <= 31 ? .8 : a <= 33 ? .6 : .4;
const POS_VAL = { QB: 1.3, RB: .85, WR: 1, TE: .8, DEF: 1 };
CS.playerValue = p => Math.round(Math.pow(Math.max(p.ovr - 62, 0), 2) / 40 * AGE_VAL(p.age) * (POS_VAL[p.pos] || 1) * 10) / 10;
CS.pickValue = (L, k) => {
  const base = [0, 12, 5, 2, 1, .6, .4, .3][Math.min(k.round, 7)] || .3;
  return Math.round(base * Math.max(.6, 1 - .08 * (k.year - L.year)) * 10) / 10;
};
CS.pickLabel = (L, k, withVia) => {
  const via = withVia !== false && k.orig !== k.owner ? ' (via ' + CS.tname(L, k.orig) + ')' : '';
  return k.year + ' Round ' + k.round + via;
};

// ---------- tiers (card look) ----------
CS.tier = o => o >= 95 ? 't-hot' : o >= 90 ? 't-gold' : o >= 85 ? 't-cyan' : o >= 80 ? 't-green' : o >= 75 ? 't-white' : 't-dim';

CS.markPro = p => { p.pro = true; p.orig = p.orig || { ovr: p.ovr, age: p.age }; };

// ---------- log ----------
CS.log = (L, msg) => { L.log.unshift({ y: L.year, t: Date.now(), m: msg }); if (L.log.length > 400) L.log.length = 400; };

// ---------- position / team parsing for imports ----------
CS.POS_MAP = { QB: ['QB'], RB: ['RB'], HB: ['RB'], FB: ['RB'], WR: ['WR'], TE: ['TE'], DEF: ['DEF'], DE: ['DEF', 'DL'], DT: ['DEF', 'DL'], DL: ['DEF', 'DL'], EDGE: ['DEF', 'DL'], NT: ['DEF', 'DL'], LB: ['DEF', 'LB'], OLB: ['DEF', 'LB'], ILB: ['DEF', 'LB'], MLB: ['DEF', 'LB'], CB: ['DEF', 'CB'], DB: ['DEF', 'CB'], S: ['DEF', 'S'], FS: ['DEF', 'S'], SS: ['DEF', 'S'] };
CS.parsePos = s => { const m = CS.POS_MAP[String(s || '').trim().toUpperCase().replace(/[^A-Z]/g, '')]; return m ? { pos: m[0], sub: m[1] || '' } : null; };
const ALT = { JAC: 'JAX', WSH: 'WAS', OAK: 'LV', LA: 'LAR', SD: 'LAC', STL: 'LAR', ARZ: 'ARI', BLT: 'BAL', CLV: 'CLE', HST: 'HOU', GNB: 'GB', KAN: 'KC', NWE: 'NE', NOR: 'NO', SFO: 'SF', TAM: 'TB' };
CS.parseNfl = s => {
  const q = String(s || '').trim(); if (!q) return null;
  const u = q.toUpperCase(); if (CS.NFL[u]) return u; if (ALT[u]) return ALT[u];
  const l = q.toLowerCase();
  for (const t of CS.NFL_LIST) if (t.full.toLowerCase() === l || t.name.toLowerCase() === l || t.city.toLowerCase() === l) return t.id;
  if (l === 'new york' || l === 'los angeles') return null;
  return null;
};
CS.cleanName = s => String(s || '').replace(/\s+/g, ' ').trim();
