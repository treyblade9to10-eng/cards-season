// CARDS SEASON actions: league setup, cards, signing, draft, trades, offseason. All return {ok,...}; rule problems come back as issues[] so the UI can ask the commissioner to override.
(function () {
  const { clamp, randInt } = CS;
  const fail = (msg, extra) => Object.assign({ ok: false, msg }, extra || {});

  // ---------- league ----------
  CS.addPicks = (L, year, rounds) => {
    for (let r = 1; r <= rounds; r++) L.teams.forEach(t => {
      if (!L.picks.some(k => k.year === year && k.round === r && k.orig === t.id)) L.picks.push({ id: CS.uid(), year, round: r, orig: t.id, owner: t.id });
    });
  };
  CS.ensurePicks = L => {
    const fr = L.settings.fRounds;
    for (let y = L.year; y <= L.year + 3; y++) CS.addPicks(L, y, y === L.startYear ? 7 : fr);
  };
  CS.createLeague = o => {
    const mgrs = (o.mgrs || []).map(CS.cleanName).filter(Boolean);
    const L = {
      id: CS.uid(), v: 1, name: CS.cleanName(o.name) || 'Cards Season', year: CS.START_YEAR, startYear: CS.START_YEAR, phase: 'setup', created: Date.now(),
      settings: { cap: o.cap || 110, maxRoster: 11, rounds: o.rounds || 2, playoffs: 0, fRounds: 3, rookieYrs: 3, progress: true, hfa: true },
      teams: [], players: [], picks: [], draftOrder: [], draft: null, season: null, hist: [], log: [], trades: [], offseason: null
    };
    mgrs.forEach((m, i) => L.teams.push({ id: 't' + (i + 1), mgr: m, nick: '', base: null, notes: '' }));
    L.draftOrder = L.teams.map(t => t.id);
    CS.addPicks(L, L.startYear, 7);
    for (let y = L.startYear + 1; y <= L.startYear + 3; y++) CS.addPicks(L, y, L.settings.fRounds);
    if (o.copyFrom && CS.db.leagues[o.copyFrom]) {
      CS.db.leagues[o.copyFrom].players.forEach(p => {
        const base = p.orig || { ovr: p.ovr, age: p.age };
        CS.addCard(L, { name: p.name, pos: p.pos, sub: p.sub, ovr: base.ovr, age: base.age, nfl: p.nfl });
      });
    }
    if (o.pool && o.pool !== 'own') CS.loadPool(L, o.pool);
    CS.log(L, 'League created with ' + L.teams.length + ' teams.');
    CS.db.leagues[L.id] = L; CS.db.order.unshift(L.id);
    CS.save();
    return L;
  };
  CS.deleteLeague = id => { delete CS.db.leagues[id]; CS.db.order = CS.db.order.filter(x => x !== id); CS.save(); };
  CS.exportLeague = L => JSON.stringify(L);
  CS.importLeague = str => {
    const L = JSON.parse(str);
    if (!L || !L.teams || !L.players || !L.settings) throw new Error('That does not look like a Cards Season league file.');
    L.id = CS.uid(); L.name = L.name + ' (imported)';
    CS.db.leagues[L.id] = L; CS.db.order.unshift(L.id); CS.save(); return L;
  };

  // ---------- cards ----------
  CS.cardKey = (name, pos) => CS.cleanName(name).toLowerCase() + '|' + pos;
  CS.findCard = (L, name, pos) => L.players.find(p => CS.cardKey(p.name, p.pos) === CS.cardKey(name, pos));
  CS.checkCard = c => {
    const name = CS.cleanName(c.name); if (!name) return 'Type the player name.';
    if (!CS.POS.includes(c.pos)) return 'Pick a position.';
    const o = Number(c.ovr), a = Number(c.age);
    if (!(o >= 30 && o <= 99)) return 'Overall must be between 30 and 99.';
    if (!(a >= 16 && a <= 50)) return 'Age must be between 16 and 50.';
    if (c.nfl && !CS.NFL[c.nfl]) return 'Unknown NFL team.';
    return '';
  };
  CS.addCard = (L, c) => {
    const err = CS.checkCard(c); if (err) return fail(err);
    const dup = CS.findCard(L, c.name, c.pos); if (dup) return fail(dup.name + ' (' + dup.pos + ') is already in the pool.', { dup });
    const p = { id: CS.uid(), name: CS.cleanName(c.name), pos: c.pos, sub: c.pos === 'DEF' ? (c.sub || '') : '', ovr: Math.round(c.ovr), age: Math.round(c.age), nfl: c.nfl || '', tid: null, sal: 0, yrs: 0, force: false, st: CS.blankStats(), car: { td: 0, ptd: 0 } };
    L.players.push(p); return { ok: true, p };
  };
  CS.importText = (L, text) => {
    const res = { added: 0, dups: [], errors: [], defAge: 0 };
    String(text || '').split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim(); if (!line) return;
      const toks = line.split(/[,\t|;]+/).map(s => s.trim()).filter(Boolean);
      let name = '', pos = null, nfl = '', nums = [];
      toks.forEach(t => {
        if (/^\d+$/.test(t)) { nums.push(+t); return; }
        const ps = CS.parsePos(t); if (ps && !pos) { pos = ps; return; }
        const nf = CS.parseNfl(t); if (nf && !nfl && name) { nfl = nf; return; }
        if (!name) name = t; else name += ' ' + t;
      });
      let ovr = nums[0], age = nums[1];
      if (nums.length >= 2 && nums[0] <= 45 && nums[1] >= 46) { ovr = nums[1]; age = nums[0]; }
      if (!name) return res.errors.push({ line: raw, msg: 'no name' });
      if (!pos) return res.errors.push({ line: raw, msg: 'no position (QB RB WR TE or DEF)' });
      if (ovr == null) return res.errors.push({ line: raw, msg: 'no overall' });
      if (age == null) { age = 25; res.defAge++; }
      const r = CS.addCard(L, { name, pos: pos.pos, sub: pos.sub, ovr, age, nfl });
      if (r.ok) res.added++; else if (r.dup) res.dups.push(name); else res.errors.push({ line: raw, msg: r.msg });
    });
    return res;
  };
  CS.deleteCard = (L, pid) => { L.players = L.players.filter(p => p.id !== pid); };
  CS.release = (L, pid) => {
    const p = CS.byId(L, pid); if (!p) return;
    const from = p.tid; p.prev = from; p.tid = null; p.sal = 0; p.yrs = 0; p.force = false; p.expired = false;
    if (from) CS.log(L, CS.tname(L, from) + ' released ' + p.name + '.');
  };

  // ---------- signing / contracts ----------
  CS.rosterIssues = (L, tid, extra, who) => {
    const n = CS.roster(L, tid).length + extra, mx = L.settings.maxRoster;
    return n > mx ? [CS.tname(L, tid) + ' would have ' + n + ' players (max ' + mx + ').'] : [];
  };
  CS.signIssues = (L, p, tid, sal, replacing) => {
    const issues = [];
    if (!replacing) issues.push(...CS.rosterIssues(L, tid, 1));
    const pay = CS.payroll(L, tid) - (replacing ? (p.sal || 0) : 0) + sal;
    if (pay > L.settings.cap + 0.001) issues.push(CS.tname(L, tid) + ' would be over the cap (' + CS.money(pay) + ' of ' + CS.money(L.settings.cap) + ').');
    const ask = CS.askSal(p);
    if (sal < CS.minAccept(ask)) issues.push(p.name + ' wants at least ' + CS.money(CS.minAccept(ask)) + ' (asking ' + CS.money(ask) + ').');
    return issues;
  };
  CS.sign = (L, pid, tid, sal, yrs, force) => {
    const p = CS.byId(L, pid); if (!p) return fail('Card not found.');
    sal = CS.r1(+sal); yrs = Math.round(+yrs);
    if (!(sal >= 0) || !(yrs >= 1 && yrs <= 6)) return fail('Contract needs a salary and 1 to 6 years.');
    const resign = p.tid === tid;
    const issues = CS.signIssues(L, p, tid, sal, resign);
    if (issues.length && !force) return fail('Rules', { issues, needsOk: true });
    const from = p.tid;
    p.tid = tid; p.sal = sal; p.yrs = yrs; p.expired = false; p.prev = null; CS.markPro(p);
    CS.log(L, CS.tname(L, tid) + (resign ? ' re-signed ' : ' signed ') + p.name + ' (' + p.pos + ' ' + p.ovr + ') for ' + CS.money(sal) + ' x ' + yrs + ' yr.');
    return { ok: true, p };
  };

  // ---------- draft ----------
  CS.initialSlots = 7;
  CS.pickOwner = (L, d, o) => { const k = L.picks.find(x => x.year === d.year && x.round === o.round && x.orig === o.orig); return k ? k.owner : o.orig; };
  CS.startInitialDraft = L => {
    const ord = L.draftOrder.filter(id => CS.team(L, id));
    const order = [];
    for (let r = 1; r <= CS.initialSlots; r++) (r % 2 ? ord : ord.slice().reverse()).forEach(tid => order.push({ round: r, orig: tid }));
    L.draft = { kind: 'initial', year: L.year, rounds: CS.initialSlots, order, idx: 0, log: [], done: false };
    L.phase = 'draft'; CS.log(L, 'The ' + L.year + ' draft is open.');
  };
  CS.startFutureDraft = L => {
    const year = L.year + 1;
    CS.ensurePicks(L); CS.addPicks(L, year, L.settings.fRounds);
    // worst team picks first: rank by playoff wins, then regular-season finish
    const st = CS.standings(L), po = L.season && L.season.po;
    const inPo = new Set(po ? po.seeds : []), wins = {};
    if (po) po.rounds.forEach(r => r.games.forEach(g => { const w = CS.gameWinner(g); if (w) wins[w] = (wins[w] || 0) + 1; }));
    const best = st.map(r => r.tid).sort((a, b) => (wins[b] || 0) - (wins[a] || 0) || (inPo.has(b) ? 1 : 0) - (inPo.has(a) ? 1 : 0) || st.find(r => r.tid === a).rank - st.find(r => r.tid === b).rank);
    const worstFirst = best.slice().reverse(), order = [];
    for (let r = 1; r <= L.settings.fRounds; r++) worstFirst.forEach(tid => order.push({ round: r, orig: tid }));
    L.draft = { kind: 'future', year, rounds: L.settings.fRounds, order, idx: 0, log: [], done: false };
    L.phase = 'draft'; CS.log(L, 'The ' + year + ' draft is open.');
  };
  CS.curPick = L => {
    const d = L.draft; if (!d || d.done || d.idx >= d.order.length) return null;
    const o = d.order[d.idx];
    return { n: d.idx + 1, round: o.round, orig: o.orig, owner: CS.pickOwner(L, d, o), inRound: d.order.slice(0, d.idx + 1).filter(x => x.round === o.round).length };
  };
  CS.allowedPositions = (L, tid) => {
    const t = CS.team(L, tid), d = L.draft;
    if (!t.base) return ['QB'];
    if (d.kind === 'initial') { const e = CS.needs(L, tid); if (e.length) return CS.POS.filter(p => e.includes(p)); }
    return CS.POS.slice();
  };
  // spec: {pid} to take a card from the pool, or {name,pos,sub,ovr,age,nfl} to log a brand-new card
  CS.makePick = (L, spec, force) => {
    const d = L.draft, cp = CS.curPick(L); if (!cp) return fail('The draft is over.');
    const tid = cp.owner, t = CS.team(L, tid);
    let p = null, created = false;
    if (spec.pid) { p = CS.byId(L, spec.pid); if (!p || p.tid) return fail('That card is not available.'); if (spec.nfl && CS.NFL[spec.nfl]) p.nfl = spec.nfl; }
    else {
      const err = CS.checkCard(spec); if (err) return fail(err);
      const ex = CS.findCard(L, spec.name, spec.pos);
      if (ex) { if (ex.tid) return fail(ex.name + ' is already on ' + CS.tname(L, ex.tid) + '.'); p = ex; p.ovr = Math.round(spec.ovr); p.age = Math.round(spec.age); if (spec.nfl) p.nfl = spec.nfl; }
      else { p = CS.addCard(L, spec).p; created = true; }
    }
    const undoCreated = () => { if (created) CS.deleteCard(L, p.id); };
    const issues = [];
    const allowed = CS.allowedPositions(L, tid);
    if (!allowed.includes(p.pos)) {
      undoCreated();
      return fail(!t.base ? 'The first pick has to be a QB, because the QB becomes the base team.' : CS.tname(L, tid) + ' still needs: ' + allowed.join(', ') + '.');
    }
    let setBase = false;
    if (!t.base) {
      if (!p.nfl) { undoCreated(); return fail('A QB card needs its NFL team (the team on the card), since that becomes the base team.'); }
      const owner = L.teams.find(x => x.base && x.base.nfl === p.nfl);
      if (owner) { undoCreated(); return fail('The ' + CS.NFL[p.nfl].full + ' are already taken by ' + owner.mgr + '.'); }
      setBase = true;
    }
    issues.push(...CS.rosterIssues(L, tid, 1));
    if (issues.length && !force) { undoCreated(); return fail('Rules', { issues, needsOk: true }); }
    if (setBase) { t.base = CS.makeBase(p.nfl); }
    p.tid = tid; p.expired = false; p.prev = null; p.yrs = L.settings.rookieYrs; p.sal = CS.rookieSal(p, L);
    p.drafted = { y: d.year, r: cp.round, n: cp.n }; CS.markPro(p);
    const k = L.picks.find(x => x.year === d.year && x.round === cp.round && x.orig === cp.orig); if (k) k.used = true;
    d.log.push({ n: cp.n, round: cp.round, orig: cp.orig, tid, pid: p.id, created, setBase });
    d.idx++; if (d.idx >= d.order.length) d.done = true;
    CS.log(L, CS.tname(L, tid) + ' drafted ' + p.name + ' (' + p.pos + ' ' + p.ovr + ', age ' + p.age + ') with pick ' + d.year + ' R' + cp.round + '.' + (setBase ? ' Base team: ' + CS.NFL[p.nfl].full + '.' : ''));
    return { ok: true, p, setBase };
  };
  CS.skipPick = L => {
    const d = L.draft, cp = CS.curPick(L); if (!cp) return fail('The draft is over.');
    const k = L.picks.find(x => x.year === d.year && x.round === cp.round && x.orig === cp.orig); if (k) k.used = true;
    d.log.push({ n: cp.n, round: cp.round, orig: cp.orig, tid: cp.owner, pid: null, skipped: true });
    d.idx++; if (d.idx >= d.order.length) d.done = true;
    return { ok: true };
  };
  CS.undoPick = L => {
    const d = L.draft; if (!d || !d.log.length) return fail('Nothing to undo.');
    const e = d.log.pop(), t = CS.team(L, e.tid);
    const k = L.picks.find(x => x.year === d.year && x.round === e.round && x.orig === e.orig); if (k) k.used = false;
    if (e.pid) {
      const p = CS.byId(L, e.pid);
      if (p) { if (e.created) CS.deleteCard(L, p.id); else { p.tid = null; p.sal = 0; p.yrs = 0; p.drafted = null; } }
      if (e.setBase) t.base = null;
      CS.log(L, 'Pick ' + e.n + ' was undone.');
    }
    d.idx = Math.max(0, d.idx - 1); d.done = false;
    return { ok: true };
  };
  CS.bestAvailable = (L, tid) => {
    const allowed = CS.allowedPositions(L, tid), taken = CS.takenNfl(L);
    let pool = L.players.filter(p => !p.tid && allowed.includes(p.pos));
    if (!CS.team(L, tid).base) pool = pool.filter(p => p.nfl && !taken.has(p.nfl));
    return pool.sort((a, b) => b.ovr - a.ovr)[0] || null;
  };
  CS.finishDraft = L => {
    const d = L.draft; if (!d) return;
    if (d.kind === 'future') for (let y = d.year; y <= d.year + 3; y++) CS.addPicks(L, y, L.settings.fRounds);
    L.picks = L.picks.filter(k => !(k.used && k.year <= d.year - 1)); // tidy old used picks
    d.done = true;
  };

  // ---------- season flow ----------
  CS.startSeason = L => {
    if (L.draft && L.draft.kind === 'future') L.year = L.draft.year;
    L.season = { year: L.year, weeks: CS.makeSchedule(L), po: null, champ: null };
    L.phase = 'season'; L.offseason = null;
    CS.ensurePicks(L);
    CS.log(L, 'The ' + L.year + ' season kicks off.');
  };

  // ---------- offseason ----------
  const ageDelta = p => {
    const a = p.age; let lo, hi;
    if (a <= 22) { lo = 1; hi = 4; } else if (a <= 24) { lo = 0; hi = 3; } else if (a <= 27) { lo = -1; hi = 2; }
    else if (a <= 29) { lo = -2; hi = 1; } else if (a <= 31) { lo = -3; hi = 0; } else if (a <= 33) { lo = -4; hi = -1; } else { lo = -6; hi = -2; }
    if (p.pos === 'QB' && a >= 28) { lo += 1; hi += 1; }
    if (p.pos === 'RB' && a >= 27) { lo -= 1; hi -= 1; }
    let d = randInt(lo, hi);
    if (p.ovr >= 94 && d > 0) d = Math.min(d, 1);
    return d;
  };
  CS.endSeason = L => {
    const s = L.season, st = CS.standings(L), po = s.po;
    const champ = s.champ, final = po && po.rounds[po.rounds.length - 1].games[0];
    const runner = final ? (final.h === champ ? final.a : final.h) : null;
    const topTd = CS.leaders(L, 'td', 1)[0], topQb = CS.leaders(L, 'ptd', 1)[0];
    L.hist.push({ year: L.year, champ, runner, table: st.map(r => ({ tid: r.tid, w: r.w, l: r.l, t: r.t, pf: r.pf, pa: r.pa })), seeds: po ? po.seeds : [], topTd: topTd ? { name: topTd.name, n: topTd.td } : null, topQb: topQb ? { name: topQb.name, n: topQb.ptd } : null, tidNames: Object.fromEntries(L.teams.map(t => [t.id, CS.tname(L, t.id)])) });
    const report = [], retired = [];
    Object.values(CS.statMap(L, true)).forEach(e => { const p = CS.byId(L, e.pid); if (!p) return; p.car = p.car || {}; CS.KEYS.concat(['g']).forEach(k => { p.car[k] = (p.car[k] || 0) + (e[k] || 0); }); });
    L.players.slice().forEach(p => {
      if (p.tid) p.yrs = Math.max(0, (p.yrs || 0) - 1);
      p.age += 1;
      if (L.settings.progress && p.pro) {
        const from = p.ovr, d = ageDelta(p); p.ovr = clamp(p.ovr + d, 40, 99);
        const ret = (p.age >= (p.pos === 'QB' ? 40 : 36) && (p.ovr < 80 || CS.rnd() < .5)) || (p.age >= 34 && p.ovr < 65);
        if (ret) { retired.push({ name: p.name, pos: p.pos, age: p.age, tid: p.tid }); CS.deleteCard(L, p.id); return; }
        report.push({ id: p.id, name: p.name, pos: p.pos, tid: p.tid, age: p.age, from, to: p.ovr });
      }
    });
    retired.forEach(r => CS.log(L, r.name + ' (' + r.pos + ', ' + r.age + ') retired.'));
    L.offseason = { report, retired, year: L.year };
    L.phase = 'resign';
    CS.log(L, 'The ' + L.year + ' season is over. ' + (champ ? CS.tname(L, champ) + ' are champions. ' : '') + 'Contracts and ages moved forward.');
  };
  CS.expiring = (L, tid) => L.players.filter(p => p.tid && p.yrs <= 0 && (!tid || p.tid === tid));
  CS.finishResign = L => {
    CS.expiring(L).forEach(p => { p.prev = p.tid; p.tid = null; p.sal = 0; p.yrs = 0; p.force = false; p.expired = true; });
    L.phase = 'fa';
    CS.log(L, 'Free agency is open.');
  };

  // ---------- trades ----------
  // give = { a:{p:[],k:[]}, b:{p:[],k:[]} }  a = team A sends to B
  CS.tradeEval = (L, A, B, g) => {
    const pa = g.a.p.map(id => CS.byId(L, id)).filter(Boolean), pb = g.b.p.map(id => CS.byId(L, id)).filter(Boolean);
    const ka = g.a.k.map(id => L.picks.find(k => k.id === id)).filter(Boolean), kb = g.b.k.map(id => L.picks.find(k => k.id === id)).filter(Boolean);
    const vA = CS.sum(pb, CS.playerValue) + CS.sum(kb, k => CS.pickValue(L, k)); // what A receives
    const vB = CS.sum(pa, CS.playerValue) + CS.sum(ka, k => CS.pickValue(L, k)); // what B receives
    const issues = [];
    if (A === B) issues.push('Pick two different teams.');
    if (!pa.length && !pb.length && !ka.length && !kb.length) issues.push('Nothing is in the trade yet.');
    issues.push(...CS.rosterIssues(L, A, pb.length - pa.length), ...CS.rosterIssues(L, B, pa.length - pb.length));
    const sa = CS.sum(pa, p => p.sal), sb = CS.sum(pb, p => p.sal);
    const capA = CS.payroll(L, A) - sa + sb, capB = CS.payroll(L, B) - sb + sa;
    if (capA > L.settings.cap + .001 && sb > sa) issues.push(CS.tname(L, A) + ' would be over the cap (' + CS.money(capA) + ').');
    if (capB > L.settings.cap + .001 && sa > sb) issues.push(CS.tname(L, B) + ' would be over the cap (' + CS.money(capB) + ').');
    return { vA, vB, issues, capA, capB, pa, pb, ka, kb };
  };
  CS.doTrade = (L, A, B, g, force) => {
    const e = CS.tradeEval(L, A, B, g);
    if (e.issues.length && !force) return fail('Rules', { issues: e.issues, needsOk: true });
    e.pa.forEach(p => { p.tid = B; p.force = false; CS.markPro(p); });
    e.pb.forEach(p => { p.tid = A; p.force = false; CS.markPro(p); });
    e.ka.forEach(k => { k.owner = B; }); e.kb.forEach(k => { k.owner = A; });
    const desc = x => [...x.p.map(p => p.name + ' (' + p.pos + ' ' + p.ovr + ')'), ...x.k.map(k => CS.pickLabel(L, k, false))].join(', ') || 'nothing';
    const txt = CS.tname(L, A) + ' send ' + desc({ p: e.pa, k: e.ka }) + ' to ' + CS.tname(L, B) + ' for ' + desc({ p: e.pb, k: e.kb }) + '.';
    L.trades.unshift({ y: L.year, t: Date.now(), a: A, b: B, txt }); CS.log(L, 'TRADE: ' + txt);
    return { ok: true, txt };
  };
})();
