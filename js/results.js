// CARDS SEASON results: the league enters scores + player stats; anything left blank is simulated to fit what was entered.
// A played game keeps a box score (g.box), and all season/career stats are added up from the games (so fixing a result never double counts).
(function () {
  const { clamp, randInt, gauss } = CS;
  const pw = CS.pickWeighted, sum = CS.sum;
  const poisson = m => { const l = Math.exp(-m); let k = 0, p = 1; do { k++; p *= CS.rnd(); } while (p > l && k < 25); return k - 1; };
  const binom = (n, p) => { let c = 0; for (let i = 0; i < n; i++) if (CS.rnd() < p) c++; return c; };

  // the stat boxes asked for each position
  CS.FIELDS = {
    QB: [['py', 'Pass yds'], ['ptd', 'Pass TD'], ['pint', 'INT'], ['ru', 'Rush yds'], ['rutd', 'Rush TD']],
    RB: [['ru', 'Rush yds'], ['rutd', 'Rush TD'], ['rc', 'Rec yds'], ['rctd', 'Rec TD']],
    WR: [['rc', 'Rec yds'], ['rctd', 'Rec TD']],
    TE: [['rc', 'Rec yds'], ['rctd', 'Rec TD']],
    DEF: [['sck', 'Sacks'], ['dint', 'INT'], ['dtd', 'Def TD']]
  };
  CS.KEYS = ['py', 'ptd', 'pint', 'ru', 'rutd', 'rc', 'rctd', 'sck', 'dint', 'dtd'];
  CS.blankStats = () => ({});
  CS.gameCast = (L, tid) => { const lu = CS.lineup(L, tid); return [lu.QB, lu.RB, ...lu.WR, lu.TE, lu.DEF].filter(Boolean); };

  // ---------- how a score breaks down into touchdowns / field goals ----------
  // P points = 7 per TD (6 if the kick is missed), 3 per field goal, 2 for a safety
  function decomp(P, o, test) {
    const c = [];
    for (let t = 0; t <= Math.floor(P / 6); t++) {
      if (o.tMin != null && t < o.tMin) continue;
      if (o.tIn && !o.tIn.includes(t)) continue;
      for (let m = 0; m <= Math.min(t, 2); m++) for (let s = 0; s <= 1; s++) {
        const rem = P - (7 * t - m) - 2 * s; if (rem < 0 || rem % 3) continue;
        const fg = rem / 3; if (fg > 7) continue;
        c.push({ t, m, s, fg, w: Math.exp(-.3 * fg) * (m ? .12 : 1) * (s ? .08 : 1) });
      }
    }
    if (test) return c.length > 0;
    return c.length ? pw(c) : null;
  }
  const looseDecomp = P => decomp(P, {}) || { t: Math.floor(P / 7), m: 0, s: 0, fg: 0, odd: true };

  // ---------- what was typed for one team ----------
  function teamEnt(L, tid, vals) {
    const cast = CS.gameCast(L, tid), by = pos => cast.find(p => p.pos === pos);
    const get = (p, k) => p && vals[p.id] ? vals[p.id][k] : undefined;
    const qb = by('QB'), rb = by('RB'), def = by('DEF'), recv = cast.filter(p => p.pos === 'WR' || p.pos === 'TE' || p.pos === 'RB');
    const ptdE = get(qb, 'ptd'), dE = get(def, 'dtd');
    const rbRu = get(rb, 'rutd'), qbRu = get(qb, 'rutd'), rutdMin = (rbRu || 0) + (qbRu || 0);
    const rutdE = (rb || qb) && (!rb || rbRu !== undefined) && (!qb || qbRu !== undefined) ? rutdMin : undefined; // team rushing TDs, known only if every runner was filled in
    const recEnt = sum(recv, p => get(p, 'rctd') || 0);
    const ptdMin = Math.max(ptdE || 0, recEnt), tMin = ptdMin + rutdMin + (dE || 0);
    let tIn = null; const problems = [];
    if (ptdE !== undefined && rutdE !== undefined) { const base = ptdMin + rutdE + (dE || 0); tIn = [base, base + 1]; }
    if (ptdE !== undefined && recEnt > ptdE) problems.push('the receivers have ' + recEnt + ' TD catches but the QB only has ' + ptdE + ' passing TD' + (ptdE === 1 ? '' : 's') + '.');
    return { cast, get, qb, rb, def, recv, ptdE, rutdE, rutdMin, dE, ptdMin, tMin, tIn, problems };
  }

  // ---------- phase 1: touchdowns, yards, runs for one team ----------
  function phase1(L, tid, P, dec, E, vals, R) {
    const out = {}, sim = {};
    const put = (p, k, v, simmed) => { (out[p.id] = out[p.id] || {})[k] = v; if (simmed) (sim[p.id] = sim[p.id] || new Set()).add(k); };
    E.cast.forEach(p => { out[p.id] = out[p.id] || {}; CS.FIELDS[p.pos].forEach(([k]) => { const v = E.get(p, k); if (v !== undefined) put(p, k, v, false); }); });
    const blank = (p, k) => out[p.id][k] === undefined;
    const { qb, rb, def, recv } = E, t = dec.t;
    // defensive / special teams TDs
    let d;
    if (def && !blank(def, 'dtd')) d = out[def.id].dtd;
    else if (E.ptdE !== undefined && E.rutdE !== undefined) d = Math.max(0, t - E.ptdMin - E.rutdE);
    else d = Math.min(binom(t, .05), Math.max(0, t - E.ptdMin - E.rutdMin));
    const o = Math.max(0, t - d);
    if (def && blank(def, 'dtd')) put(def, 'dtd', d, true);
    // passing / rushing TD split
    let ptd, rutd;
    if (E.ptdE !== undefined && E.rutdE !== undefined) { ptd = E.ptdE; rutd = E.rutdE; }
    else if (E.ptdE !== undefined) { ptd = E.ptdE; rutd = Math.max(E.rutdMin, o - ptd); }
    else if (E.rutdE !== undefined) { rutd = E.rutdE; ptd = Math.max(E.ptdMin, o - rutd); }
    else { const pp = clamp(.58 + (R.qb - 80) * .004, .35, .8); ptd = clamp(binom(o, pp), E.ptdMin, Math.max(E.ptdMin, o - E.rutdMin)); rutd = Math.max(0, o - ptd); }
    if (qb && blank(qb, 'ptd')) put(qb, 'ptd', ptd, true);
    // rushing TDs: split between the RB and the QB (a QB keeps about 1 in 6 on his own)
    const runners = [rb, qb].filter(Boolean), blankR = runners.filter(p => blank(p, 'rutd'));
    let rleft = Math.max(0, rutd - sum(runners.filter(p => !blankR.includes(p)), p => out[p.id].rutd));
    if (blankR.length === 2) { const q = binom(rleft, .17); put(qb, 'rutd', q, true); put(rb, 'rutd', rleft - q, true); }
    else if (blankR.length === 1) put(blankR[0], 'rutd', rleft, true);
    // who caught the TDs
    const wrIdx = p => E.cast.filter(x => x.pos === 'WR').indexOf(p);
    const rw = p => (p.pos === 'WR' ? [.27, .21, .16][wrIdx(p)] || .14 : p.pos === 'TE' ? .15 : .08) * Math.pow(p.ovr / 80, 2);
    const blankTd = recv.filter(p => blank(p, 'rctd'));
    blankTd.forEach(p => put(p, 'rctd', 0, true));
    let rem = Math.max(0, ptd - sum(recv.filter(p => !blankTd.includes(p)), p => out[p.id].rctd));
    while (rem-- > 0 && blankTd.length) { const w = pw(blankTd.map(p => ({ p, w: rw(p) }))).p; out[w.id].rctd++; }
    const tdY = {}; recv.forEach(p => { tdY[p.id] = Array.from({ length: out[p.id].rctd || 0 }, () => randInt(2, 45)); });
    // passing yards, then the receivers' yards
    const blankRc = recv.filter(p => blank(p, 'rc'));
    const entRc = sum(recv.filter(p => !blankRc.includes(p)), p => out[p.id].rc);
    const floor = sum(blankRc, p => sum(tdY[p.id]));
    let py = qb ? out[qb.id].py : undefined;
    if (py === undefined) {
      py = Math.round(clamp(150 + 46 * ptd + (R.qb - 80) * 2.4 + gauss() * 42 + (P - 20) * 1.2, 55, 520));
      if (py < entRc + floor + 10) py = entRc + floor + randInt(10, 60);
      if (qb) put(qb, 'py', py, true);
    }
    const left = Math.max(0, py - entRc - floor), wts = blankRc.map(p => rw(p) * (.6 + .8 * CS.rnd())), wt = sum(wts) || 1;
    blankRc.forEach((p, i) => put(p, 'rc', sum(tdY[p.id]) + Math.round(left * wts[i] / wt), true));
    // rushing
    const runs = [];
    runners.forEach(p => { for (let i = 0; i < (out[p.id].rutd || 0); i++) runs.push({ p, y: randInt(1, p.pos === 'QB' ? 18 : 30) }); });
    const ry = p => sum(runs.filter(r => r.p === p), r => r.y);
    if (rb && blank(rb, 'ru')) put(rb, 'ru', Math.max(ry(rb) + 4, Math.round(52 + (R.rb - 80) * 1.4 + 14 * (out[rb.id].rutd || 0) + (P - 20) * .9 + gauss() * 24)), true);
    if (qb && blank(qb, 'ru')) put(qb, 'ru', Math.max(ry(qb) + (out[qb.id].rutd ? 2 : 0), Math.round(15 + 10 * (out[qb.id].rutd || 0) + gauss() * 13)), true);
    return { tid, E, out, sim, put, blank, d, ptd, rutd, tdY, runs, dec, R };
  }

  // ---------- phase 2: turnovers + sacks (needs both teams) ----------
  function phase2(me, opp) {
    const { qb, def } = me.E;
    if (qb && me.blank(qb, 'pint')) {
      const w = me.R.qb < 78 ? [.3, .36, .22, .12] : [.42, .35, .17, .06];
      me.put(qb, 'pint', Math.max(pw(w.map((x, i) => ({ v: i, w: x }))).v, opp.d), true);
    }
  }
  function phase3(me, opp) {
    const { def } = me.E; if (!def) return;
    const oppInt = opp.E.qb ? opp.out[opp.E.qb.id].pint || 0 : 0;
    if (me.blank(def, 'sck')) me.put(def, 'sck', Math.min(8, poisson(2.3 * (me.R.def0 / 80))), true);
    if (me.blank(def, 'dint')) me.put(def, 'dint', Math.max(Math.round(oppInt * (.4 + .35 * CS.rnd())), Math.min(me.d, oppInt)), true);
  }

  // ---------- scoring summary (only for fully simulated games) ----------
  function events(L, T) {
    const { E, out, dec } = T, ev = [], qn = E.qb ? E.qb.name : 'Pass';
    E.recv.forEach(p => (T.tdY[p.id] || []).forEach(y => ev.push({ txt: qn + ' to ' + p.name + ', ' + y + ' yd TD', td: 1 })));
    T.runs.forEach(r => ev.push({ txt: r.p.name + ' ' + r.y + ' yd run TD', td: 1 }));
    for (let i = 0; i < T.d; i++) ev.push({ txt: (E.def ? E.def.name : 'The defense') + ' interception return TD', td: 1 });
    if (ev.length !== dec.t) return null;
    CS.shuffle(ev.map((e, i) => i)).slice(0, dec.m).forEach(i => { ev[i].miss = 1; });
    ev.forEach(e => { e.pts = e.miss ? 6 : 7; if (e.miss) e.txt += ' (kick missed)'; });
    for (let i = 0; i < dec.fg; i++) ev.push({ txt: 'Field goal, ' + randInt(22, 56) + ' yds', pts: 3 });
    if (dec.s) ev.push({ txt: 'Safety', pts: 2 });
    return ev;
  }
  function summary(L, hT, aT, hs, as, ot) {
    const eh = events(L, hT), ea = events(L, aT); if (!eh || !ea) return [];
    const all = [];
    [[hT, eh], [aT, ea]].forEach(([T, ev]) => ev.forEach(e => all.push({ tid: T.tid, txt: e.txt, pts: e.pts, qn: randInt(1, 4), r: CS.rnd() })));
    if (ot && hs !== as) { const w = hs > as ? hT.tid : aT.tid, mine = all.filter(e => e.tid === w); if (mine.length) mine.sort((a, b) => b.qn - a.qn || b.r - a.r)[0].qn = 5; }
    all.sort((a, b) => a.qn - b.qn || a.r - b.r);
    let h = 0, a = 0;
    return all.map(e => { if (e.tid === hT.tid) h += e.pts; else a += e.pts; return { tid: e.tid, q: e.qn === 5 ? 'OT' : 'Q' + e.qn, txt: e.txt, pts: e.pts, h, a }; });
  }

  // ---------- score simulation that respects what was typed ----------
  function simScoreWith(L, H, A, playoff, fx) {
    const pre = { [H]: CS.rate(L, H), [A]: CS.rate(L, A) };
    let s = null;
    for (let i = 0; i < 12000; i++) {
      s = CS.simGame(L, H, A, playoff, pre);
      if ((fx.hs == null || s.hs === fx.hs) && (fx.as == null || s.as === fx.as) && fx.pred(s)) return s;
    }
    s = CS.simGame(L, H, A, playoff, pre); // could not match everything: honor what was typed
    if (fx.hs != null) s.hs = fx.hs; if (fx.as != null) s.as = fx.as;
    if (playoff && s.hs === s.as) { if (fx.hs == null) s.hs += 3; else s.as += 3; }
    return s;
  }

  // ---------- resolve one game ----------
  // inp = { hs, as, ot, vals: { playerId: { key: number } } }; blanks are simulated. Returns {ok:false,issues} or the finished result.
  CS.resolveGame = (L, g, inp, force) => {
    inp = inp || {}; const vals = inp.vals || {};
    const H = g.h, A = g.a, playoff = !!g.po, E = { [H]: teamEnt(L, H, vals), [A]: teamEnt(L, A, vals) };
    const issues = [];
    [H, A].forEach(id => E[id].problems.forEach(m => issues.push(CS.tname(L, id) + ': ' + m)));
    let hs = inp.hs == null ? null : inp.hs, as = inp.as == null ? null : inp.as, ot = !!inp.ot;
    const entered = hs != null && as != null;
    if (!entered) {
      const fit = (id, P) => decomp(P, { tMin: E[id].tMin, tIn: E[id].tIn }, true);
      const s = simScoreWith(L, H, A, playoff, { hs, as, pred: s => s.hs >= 6 * E[H].tMin && s.as >= 6 * E[A].tMin && fit(H, s.hs) && fit(A, s.as) });
      hs = s.hs; as = s.as; ot = s.ot;
    }
    if (playoff && hs === as) return { ok: false, msg: 'A playoff game needs a winner.' };
    const dec = {};
    [H, A].forEach(id => {
      const P = id === H ? hs : as; let d = decomp(P, { tMin: E[id].tMin, tIn: E[id].tIn });
      if (!d) { issues.push(CS.tname(L, id) + ': ' + P + ' points does not fit the touchdowns you entered (' + E[id].tMin + '+ TDs). Check the score or the TD numbers.'); d = looseDecomp(P); }
      dec[id] = d;
    });
    if (issues.length && !force) return { ok: false, needsOk: true, issues, msg: 'Rules' };
    const R = { [H]: CS.rate(L, H), [A]: CS.rate(L, A) }, T = {};
    [H, A].forEach(id => { T[id] = phase1(L, id, id === H ? hs : as, dec[id], E[id], vals, R[id]); });
    phase2(T[H], T[A]); phase2(T[A], T[H]); phase3(T[H], T[A]); phase3(T[A], T[H]);
    const box = {};
    [H, A].forEach(id => {
      box[id] = T[id].E.cast.map(p => ({ pid: p.id, name: p.name, pos: p.pos, st: Object.fromEntries(CS.FIELDS[p.pos].map(([k]) => [k, T[id].out[p.id][k] || 0])), sim: [...(T[id].sim[p.id] || [])] }));
    });
    return { ok: true, hs, as, ot, box, sum: entered ? [] : summary(L, T[H], T[A], hs, as, ot), src: entered ? 'entered' : 'sim' };
  };

  CS.poRoundIdx = (L, g) => L.season.po ? L.season.po.rounds.findIndex(r => r.games.includes(g)) : -1;
  // resolve + save into the game. The commissioner can override rule problems with force.
  CS.saveGameResult = (L, g, inp, force) => {
    const r = CS.resolveGame(L, g, inp, force); if (!r.ok) return r;
    if (g.po && g.played) {
      const ri = CS.poRoundIdx(L, g), po = L.season.po;
      if (ri >= 0 && ri < po.rounds.length - 1 && (r.hs > r.as) !== (g.hs > g.as)) return { ok: false, msg: 'That would change who won an earlier playoff round, and the next round is already set. Restart the playoffs or keep the same winner.' };
    }
    g.hs = r.hs; g.as = r.as; g.ot = r.ot; g.box = r.box; g.sum = r.sum; g.src = r.src; g.played = true;
    g.inp = { hs: inp.hs == null ? null : inp.hs, as: inp.as == null ? null : inp.as, ot: !!inp.ot, vals: inp.vals || {} };
    CS._sm = null;
    if (g.po) CS.advancePo(L);
    return { ok: true, g };
  };
  CS.playGame = (L, g, playoff) => { const r = CS.saveGameResult(L, g, {}, true); return g; };

  // ---------- season + career stats, added up from the games ----------
  CS.allGames = L => {
    const a = []; if (!L.season) return a;
    L.season.weeks.forEach(w => w.forEach(g => a.push(g)));
    if (L.season.po) L.season.po.rounds.forEach(r => r.games.forEach(g => a.push(g)));
    return a;
  };
  CS.statMap = (L, fresh) => {
    if (!fresh && CS._sm && CS._smL === L) return CS._sm;
    const m = {};
    CS.allGames(L).forEach(g => {
      if (!g.played || !g.box) return;
      Object.keys(g.box).forEach(tid => g.box[tid].forEach(ln => {
        const e = m[ln.pid] || (m[ln.pid] = Object.assign({ pid: ln.pid, name: ln.name, pos: ln.pos, g: 0 }, Object.fromEntries(CS.KEYS.map(k => [k, 0]))));
        e.g++; Object.keys(ln.st).forEach(k => { e[k] += ln.st[k] || 0; });
      }));
    });
    Object.values(m).forEach(e => { e.td = e.rutd + e.rctd + e.dtd; const p = CS.byId(L, e.pid); e.tid = p ? p.tid : null; e.name = p ? p.name : e.name; });
    CS._sm = m; CS._smL = L; return m;
  };
  CS.leaders = (L, key, n) => Object.values(CS.statMap(L)).filter(e => e[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n || 10);
  const f = (v, s) => v.toLocaleString('en-US') + (s || '');
  CS.seasonLine = (L, p) => {
    const e = CS.statMap(L)[p.id]; if (!e || !e.g) return '';
    if (p.pos === 'QB') return f(e.py) + ' yds, ' + e.ptd + ' TD, ' + e.pint + ' INT' + (e.ru || e.rutd ? ', ' + e.ru + ' rush yds' + (e.rutd ? ', ' + e.rutd + ' rush TD' : '') : '');
    if (p.pos === 'RB') return f(e.ru) + ' rush yds, ' + e.rutd + ' TD, ' + f(e.rc) + ' rec';
    if (p.pos === 'DEF') return e.sck + ' sacks, ' + e.dint + ' INT' + (e.dtd ? ', ' + e.dtd + ' TD' : '');
    return f(e.rc) + ' rec yds, ' + e.rctd + ' TD';
  };
  // one line of a box score; simulated numbers get a * so everyone knows what was typed vs made up
  CS.boxLine = ln => {
    const v = k => ln.st[k] + ((ln.sim || []).includes(k) ? '*' : '');
    if (ln.pos === 'QB') return v('py') + ' yds, ' + v('ptd') + ' TD, ' + v('pint') + ' INT' + (ln.st.ru || ln.st.rutd ? ', ' + v('ru') + ' rush yds' + (ln.st.rutd ? ', ' + v('rutd') + ' rush TD' : '') : '');
    if (ln.pos === 'RB') return v('ru') + ' rush yds, ' + v('rutd') + ' TD, ' + v('rc') + ' rec yds' + (ln.st.rctd ? ', ' + v('rctd') + ' rec TD' : '');
    if (ln.pos === 'DEF') return v('sck') + ' sacks, ' + v('dint') + ' INT' + (ln.st.dtd ? ', ' + v('dtd') + ' TD' : '');
    return v('rc') + ' rec yds, ' + v('rctd') + ' TD';
  };
})();
