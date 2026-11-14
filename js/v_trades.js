// CARDS SEASON view: Trades (players + draft picks).
(function () {
  const { esc, money } = CS;

  const fixT = L => {
    let T = CS.ui.trade;
    if (!T || !CS.team(L, T.a)) T = CS.ui.trade = { a: L.teams[0].id, b: '', pa: [], ka: [], pb: [], kb: [] };
    if (!T.b || !CS.team(L, T.b) || T.b === T.a) { const o = L.teams.find(t => t.id !== T.a); T.b = o ? o.id : ''; T.pb = []; T.kb = []; }
    ['pa', 'ka', 'pb', 'kb'].forEach(k => { T[k] = T[k] || []; });
    return T;
  };
  const side = (L, T, s, tid, pk, kk, other) => {
    const t = CS.team(L, tid), sel = T[pk], ks = T[kk];
    const picks = L.picks.filter(k => k.owner === tid && !k.used).sort((a, b) => a.year - b.year || a.round - b.round);
    const outSal = CS.sum(sel, id => (CS.byId(L, id) || {}).sal || 0), inSal = CS.sum(T[s === 'a' ? 'pb' : 'pa'], id => (CS.byId(L, id) || {}).sal || 0);
    const pay = CS.r1(CS.payroll(L, tid) - outSal + inSal);
    const players = CS.roster(L, tid).sort((a, b) => b.ovr - a.ovr);
    return `<div class="panel" style="margin-top:0"><div class="row">${CS.tlogo(L, tid, 36)}<div class="grow"><div class="tname">${esc(CS.tname(L, tid))}</div><div class="mgr">${esc(t.mgr)} sends</div></div></div>
      <div class="small dim">Payroll after: <b class="${pay > L.settings.cap ? 'red' : ''}">${money(pay)}</b> of ${money(L.settings.cap)}</div>
      <div class="col" style="gap:6px">${players.map(p => CS.pcard(L, p, { mini: true, sel: sel.includes(p.id), attr: ` data-act="tgP" data-s="${s}" data-pid="${p.id}"`, acts: `<span class="chip ${sel.includes(p.id) ? 'on' : ''}">${sel.includes(p.id) ? 'In trade' : 'Add'}</span>` })).join('') || '<div class="note">No players on this team yet.</div>'}</div>
      <div class="lbl sp">Draft picks</div><div class="chips">${picks.map(k => `<span class="pick ${ks.includes(k.id) ? 'sel' : ''}" data-act="tgK" data-s="${s}" data-kid="${k.id}" style="cursor:pointer">${esc(CS.pickLabel(L, k))}</span>`).join('') || '<span class="note">No picks left.</span>'}</div></div>`;
  };

  CS.views.trades = L => {
    const T = fixT(L);
    if (L.teams.length < 2) return '<div class="panel">You need at least two teams to trade.</div>';
    const g = { a: { p: T.pa, k: T.ka }, b: { p: T.pb, k: T.kb } }, e = CS.tradeEval(L, T.a, T.b, g);
    const hi = Math.max(e.vA, e.vB, 1), diff = Math.abs(e.vA - e.vB);
    const verdict = (!e.pa.length && !e.pb.length && !e.ka.length && !e.kb.length) ? 'Pick players and picks on both sides.'
      : diff <= Math.max(2, hi * .15) ? 'Pretty even trade.' : (e.vA > e.vB ? CS.tname(L, T.a) : CS.tname(L, T.b)) + ' wins this one by ' + CS.r1(diff) + ' value.';
    const opts = sel => L.teams.map(t => `<option value="${t.id}"${t.id === sel ? ' selected' : ''}>${esc(CS.tfull(L, t.id))} (${esc(t.mgr)})</option>`).join('');
    return `<div class="panel"><div class="h">Trade center</div><div class="g2"><label class="f">Team one<select data-bind="trA">${opts(T.a)}</select></label><label class="f">Team two<select data-bind="trB">${opts(T.b)}</select></label></div>
        <div class="note">Tap a player or pick to put it in the trade. Players keep their contracts. Picks can be used in future drafts by whoever owns them.</div></div>
      <div class="g2 stack sp">${side(L, T, 'a', T.a, 'pa', 'ka')}${side(L, T, 'b', T.b, 'pb', 'kb')}</div>
      <div class="panel hero"><div class="h">The deal</div>
        <div class="g2"><div><div class="lbl">${esc(CS.tname(L, T.a))} gets</div><div class="big-ovr">${CS.r1(e.vA)}</div><div class="small dim">${[...e.pb.map(p => esc(p.name)), ...e.kb.map(k => esc(CS.pickLabel(L, k, false)))].join(', ') || 'nothing'}</div></div>
        <div><div class="lbl">${esc(CS.tname(L, T.b))} gets</div><div class="big-ovr">${CS.r1(e.vB)}</div><div class="small dim">${[...e.pa.map(p => esc(p.name)), ...e.ka.map(k => esc(CS.pickLabel(L, k, false)))].join(', ') || 'nothing'}</div></div></div>
        <div class="note"><b>${verdict}</b> Value is just a guide. You decide what's fair.</div>
        ${e.issues.filter(i => i !== 'Nothing is in the trade yet.').map(i => `<div class="issue">${esc(i)}</div>`).join('')}
        <div class="row"><button class="btn" data-act="clearTrade">Clear</button><button class="btn gold grow" data-act="doTrade" ${e.pa.length + e.pb.length + e.ka.length + e.kb.length ? '' : 'disabled'}>Make the trade</button></div></div>
      ${L.trades.length ? `<div class="panel"><div class="h">Trade history</div>${L.trades.slice(0, 12).map(t => `<div class="small" style="padding:6px 0;border-bottom:1px solid #1d2331"><span class="faint">${t.y}</span> ${esc(t.txt)}</div>`).join('')}</div>` : ''}`;
  };

  const flip = (arr, id) => { const i = arr.indexOf(id); if (i < 0) arr.push(id); else arr.splice(i, 1); };
  CS.bind.trA = v => { const T = CS.ui.trade; T.a = v; T.pa = []; T.ka = []; if (T.b === v) T.b = ''; return true; };
  CS.bind.trB = v => { const T = CS.ui.trade; T.b = v; T.pb = []; T.kb = []; return true; };
  CS.act.tgP = d => { const T = CS.ui.trade; flip(d.s === 'a' ? T.pa : T.pb, d.pid); CS.render(); };
  CS.act.tgK = d => { const T = CS.ui.trade; flip(d.s === 'a' ? T.ka : T.kb, d.kid); CS.render(); };
  CS.act.clearTrade = () => { const T = CS.ui.trade; T.pa = []; T.ka = []; T.pb = []; T.kb = []; CS.render(); };
  CS.act.doTrade = () => {
    const L = CS.L, T = CS.ui.trade, g = { a: { p: T.pa.slice(), k: T.ka.slice() }, b: { p: T.pb.slice(), k: T.kb.slice() } };
    const run = f => { const r = CS.doTrade(L, T.a, T.b, g, f); if (r.ok) { T.pa = []; T.ka = []; T.pb = []; T.kb = []; } return r; };
    CS.guard(run(false), run, 'Trade done.');
  };
})();
