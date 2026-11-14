// CARDS SEASON sim: schedule, drive-by-drive game sim, standings, playoffs.
(function () {
  const { clamp, randInt, gauss, pick } = CS;

  // ---------- schedule ----------
  function roundRobin(ids) {
    const t = ids.slice(); if (t.length % 2) t.push(null);
    const n = t.length, rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        const a = t[i], b = t[n - 1 - i];
        if (a && b) games.push(r % 2 ? [a, b] : [b, a]);
      }
      rounds.push(games);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }
  CS.makeSchedule = (L) => {
    const ids = L.teams.map(t => t.id), weeks = [];
    const rr = roundRobin(ids);
    for (let k = 0; k < L.settings.rounds; k++) {
      rr.forEach((games, w) => weeks.push(games.map((g, i) => ({ id: 'g' + weeks.length + '-' + i, h: k % 2 ? g[1] : g[0], a: k % 2 ? g[0] : g[1], played: false }))));
    }
    return weeks;
  };
  CS.playoffSize = L => {
    const n = L.teams.length, s = L.settings.playoffs;
    if (s && s >= 2 && s <= n && (s & (s - 1)) === 0) return s;
    return n <= 3 ? 2 : n <= 7 ? 4 : n <= 15 ? 8 : 16;
  };
  CS.roundName = n => n === 2 ? 'Cards Bowl' : n === 4 ? 'Semifinal' : n === 8 ? 'Quarterfinal' : 'Round of ' + n;

  // ---------- one game ----------
  const xpGood = k => clamp(.93 + (k - 80) * .002, .84, .99);
  const fgGood = k => clamp(.8 + (k - 80) * .012, .6, .97);

  function pickWeighted(items) {
    const tot = items.reduce((s, i) => s + i.w, 0); let r = CS.rnd() * tot;
    for (const i of items) { r -= i.w; if (r <= 0) return i; }
    return items[items.length - 1];
  }
  function tdPlay(L, tid) {
    const lu = CS.lineup(L, tid), R = CS.rate(L, tid);
    const passP = clamp(.62 + (R.qb - 80) * .004, .45, .8);
    const nm = p => p ? p.name : 'the offense';
    if (CS.rnd() < passP && lu.QB) {
      const tg = [];
      lu.WR.forEach((p, i) => tg.push({ p, w: [.27, .21, .16][i] * Math.pow(p.ovr / 80, 2) }));
      if (lu.TE) tg.push({ p: lu.TE, w: .15 * Math.pow(lu.TE.ovr / 80, 2) });
      if (lu.RB) tg.push({ p: lu.RB, w: .12 * Math.pow(lu.RB.ovr / 80, 2) });
      const rec = pickWeighted(tg).p;
      const yd = Math.max(2, Math.round(Math.pow(CS.rnd(), 1.6) * 65) + 2);
      lu.QB.st.ptd++; lu.QB.st.py += yd; rec.st.td++; rec.st.ry += yd;
      return { txt: nm(lu.QB) + ' to ' + rec.name + ', ' + yd + ' yd TD', by: rec.id };
    }
    const useQB = lu.QB && (!lu.RB || CS.rnd() < .18);
    const runner = useQB ? lu.QB : lu.RB;
    const yd = Math.max(1, Math.round(Math.pow(CS.rnd(), 2.2) * 48) + 1);
    if (runner) { runner.st.td++; runner.st.ry += yd; }
    return { txt: nm(runner) + ' ' + yd + ' yd run TD', by: runner && runner.id };
  }

  // possession -> {kind:'td'|'fg'|'miss'|'to'|'pick6'|'punt'|'safety', pts}
  function drive(o, d, kOff, pOpp) {
    const diff = o - d;
    const pTD = clamp(.205 + .0085 * diff - (pOpp - 78) * .0008, .03, .56);
    const pTO = clamp(.115 - .0025 * diff, .04, .24);
    const pFG = clamp(.15 + .002 * diff, .08, .22);
    const r = CS.rnd();
    if (r < pTD) return { kind: 'td' };
    if (r < pTD + pTO) return { kind: CS.rnd() < .09 ? 'pick6' : 'to' };
    if (r < pTD + pTO + pFG) return { kind: CS.rnd() < fgGood(kOff) ? 'fg' : 'miss' };
    if (CS.rnd() < .012) return { kind: 'safety' };
    return { kind: 'punt' };
  }

  // Plays one game. Returns the game result {hs, as, ot, sum:[{tid,q,txt,pts}]} (does not touch the schedule).
  CS.simGame = (L, hid, aid, playoff) => {
    const R = { [hid]: CS.rate(L, hid), [aid]: CS.rate(L, aid) };
    const form = {}; [hid, aid].forEach(id => { form[id] = { o: gauss() * 3.6 + (id === hid && L.settings.hfa !== false ? 1.2 : 0), d: gauss() * 3.6 }; });
    const sc = { [hid]: 0, [aid]: 0 }, sum = [];
    const n = randInt(10, 12);
    let first = CS.rnd() < .5 ? hid : aid;
    const seq = [];
    for (let i = 0; i < n; i++) { seq.push(first); seq.push(first === hid ? aid : hid); }
    const total = seq.length;
    const stat = (id, tdScoring) => { };
    const run = (off, i, ot) => {
      const def = off === hid ? aid : hid;
      const q = ot ? 'OT' : 'Q' + Math.min(4, 1 + Math.floor(i / (total / 4)));
      const res = drive(R[off].off + form[off].o, R[def].def + form[def].d, R[off].k, R[def].p);
      const add = (tid, pts, txt) => { sc[tid] += pts; sum.push({ tid, q, txt, pts, h: sc[hid], a: sc[aid] }); };
      if (res.kind === 'td') {
        const p = tdPlay(L, off), good = CS.rnd() < xpGood(R[off].k);
        add(off, good ? 7 : 6, p.txt + (good ? '' : ' (kick missed)'));
      } else if (res.kind === 'fg') {
        const yd = randInt(24, 56); add(off, 3, 'Field goal, ' + yd + ' yds');
      } else if (res.kind === 'pick6') {
        const dl = CS.lineup(L, def).DEF; const good = CS.rnd() < xpGood(R[def].k);
        if (dl) dl.st.td++;
        add(def, good ? 7 : 6, (dl ? dl.name : 'The defense') + ' interception return TD');
      } else if (res.kind === 'safety') {
        add(def, 2, 'Safety');
      }
      return res;
    };
    seq.forEach((off, i) => run(off, i, false));
    let ot = false;
    if (sc[hid] === sc[aid]) {
      ot = true;
      const maxR = playoff ? 8 : 3;
      for (let r = 0; r < maxR && sc[hid] === sc[aid]; r++) {
        const o1 = r % 2 ? aid : hid, o2 = o1 === hid ? aid : hid;
        const a = run(o1, 0, true);
        if (sc[o1] > sc[o2]) break; // scored first possession -> sudden-death-ish
        run(o2, 0, true);
      }
      if (playoff && sc[hid] === sc[aid]) { const w = CS.rnd() < .5 ? hid : aid; sc[w] += 3; sum.push({ tid: w, q: 'OT', txt: 'Field goal, 41 yds', pts: 3, h: sc[hid], a: sc[aid] }); }
    }
    // per-game appearance stat for starters
    [hid, aid].forEach(id => CS.lineup(L, id).starters.forEach(p => { p.st.g++; }));
    return { hs: sc[hid], as: sc[aid], ot, sum };
  };

  // ---------- playing scheduled games ----------
  CS.playGame = (L, g, playoff) => {
    const r = CS.simGame(L, g.h, g.a, playoff);
    g.hs = r.hs; g.as = r.as; g.ot = r.ot; g.sum = r.sum; g.played = true;
    return g;
  };
  CS.curWeek = L => L.season ? L.season.weeks.findIndex(w => w.some(g => !g.played)) : -1;
  CS.regDone = L => !!L.season && L.season.weeks.every(w => w.every(g => g.played));
  CS.simNext = L => { // plays the next unplayed regular-season game
    const wi = CS.curWeek(L); if (wi < 0) return null;
    const g = L.season.weeks[wi].find(x => !x.played); CS.playGame(L, g, false); return g;
  };
  CS.simWeek = L => {
    const wi = CS.curWeek(L); if (wi < 0) return [];
    return L.season.weeks[wi].filter(g => !g.played).map(g => CS.playGame(L, g, false));
  };
  CS.simRest = L => { let c = 0; while (CS.curWeek(L) >= 0) { CS.simWeek(L); c++; } return c; };

  // ---------- standings ----------
  CS.standings = L => {
    const rec = {}; L.teams.forEach(t => { rec[t.id] = { tid: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0, strk: '', run: [] }; });
    if (L.season) L.season.weeks.forEach(wk => wk.forEach(g => {
      if (!g.played) return;
      const H = rec[g.h], A = rec[g.a]; if (!H || !A) return;
      H.pf += g.hs; H.pa += g.as; A.pf += g.as; A.pa += g.hs;
      if (g.hs > g.as) { H.w++; A.l++; H.run.push('W'); A.run.push('L'); }
      else if (g.hs < g.as) { A.w++; H.l++; A.run.push('W'); H.run.push('L'); }
      else { H.t++; A.t++; H.run.push('T'); A.run.push('T'); }
    }));
    const rows = Object.values(rec);
    rows.forEach(r => {
      const gp = r.w + r.l + r.t; r.gp = gp; r.pct = gp ? (r.w + r.t / 2) / gp : 0; r.diff = r.pf - r.pa;
      const last = r.run[r.run.length - 1]; let c = 0; for (let i = r.run.length - 1; i >= 0 && r.run[i] === last; i--) c++;
      r.strk = last ? last + c : '';
    });
    rows.sort((a, b) => b.pct - a.pct || b.diff - a.diff || b.pf - a.pf);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  };

  // ---------- playoffs ----------
  CS.startPlayoffs = L => {
    const size = CS.playoffSize(L), seeds = CS.standings(L).slice(0, size).map(r => r.tid);
    L.season.po = { size, seeds, rounds: [], round: 0, champ: null };
    CS.nextPoRound(L, seeds);
    L.phase = 'playoffs';
  };
  CS.nextPoRound = (L, alive) => {
    const po = L.season.po, seedOf = tid => po.seeds.indexOf(tid);
    const s = alive.slice().sort((a, b) => seedOf(a) - seedOf(b)), games = [];
    for (let i = 0; i < s.length / 2; i++) { const hi = s[i], lo = s[s.length - 1 - i]; games.push({ id: 'p' + po.rounds.length + '-' + i, h: hi, a: lo, played: false, po: true }); }
    po.rounds.push({ name: CS.roundName(s.length), games });
  };
  CS.simPoRound = L => {
    const po = L.season.po; if (!po || po.champ) return null;
    const rd = po.rounds[po.rounds.length - 1];
    rd.games.filter(g => !g.played).forEach(g => CS.playGame(L, g, true));
    const winners = rd.games.map(g => g.hs > g.as ? g.h : g.a);
    if (winners.length === 1) { po.champ = winners[0]; L.season.champ = winners[0]; }
    else CS.nextPoRound(L, winners);
    return rd;
  };
  CS.simPoAll = L => { while (L.season.po && !L.season.po.champ) CS.simPoRound(L); };
  CS.gameWinner = g => g.played ? (g.hs > g.as ? g.h : g.hs < g.as ? g.a : null) : null;

  // ---------- leaders ----------
  CS.leaders = (L, key, n) => L.players.filter(p => p.st && p.st[key] > 0).sort((a, b) => b.st[key] - a.st[key]).slice(0, n || 10);
  CS.blankStats = () => ({ td: 0, ptd: 0, py: 0, ry: 0, g: 0 });
})();
