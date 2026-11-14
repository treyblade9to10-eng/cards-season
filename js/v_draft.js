// CARDS SEASON view: Draft (order setup, draft room, board).
(function () {
  const { esc, money } = CS;
  const pn = (L, e) => { const r = L.draft.order[e.n - 1]; return (e.round) + '.' + String(L.draft.order.slice(0, e.n).filter(x => x.round === e.round).length).padStart(2, '0'); };

  CS.views.draft = L => L.phase === 'setup' ? orderSetup(L) : L.phase === 'draft' ? room(L) : history(L);

  // ---------- before the first draft ----------
  function orderSetup(L) {
    const ord = L.draftOrder, qbs = L.players.filter(p => p.pos === 'QB').length;
    return `<div class="panel"><div class="h">${L.year} draft order</div>
      <div class="note">Snake draft, 7 rounds. Your first pick has to be a QB: his NFL team becomes your base team (name, defense, offensive line, kicker and punter). After that you fill RB, 3 WR, TE and 1 defensive player.</div>
      <div class="col" style="gap:6px">${ord.map((tid, i) => `<div class="row tt" style="--tc:${CS.tcolor(L, tid)};cursor:default;padding:8px 10px"><b class="cc9" style="font-size:22px;width:28px">${i + 1}</b>${CS.tlogo(L, tid, 30)}<div class="grow"><b>${esc(CS.team(L, tid).mgr)}</b></div>
        <button class="btn xs" data-act="moveOrder" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>Up</button><button class="btn xs" data-act="moveOrder" data-i="${i}" data-dir="1" ${i === ord.length - 1 ? 'disabled' : ''}>Down</button></div>`).join('')}</div>
      <div class="row"><button class="btn" data-act="shuffleOrder">Randomize order</button></div></div>
      <div class="panel"><div class="h">Card pool</div><div class="note">${L.players.length} cards in the pool, ${qbs} of them QBs. Each team needs a QB with an NFL team on the card, and no two teams can have the same NFL team. You can also log a card on the spot when it's your pick.</div>
        <div class="row"><button class="btn" data-act="lgo" data-a="cards">Add cards</button><button class="btn gold" data-act="startDraft">Start the draft</button></div></div>`;
  }
  CS.act.moveOrder = d => { const o = CS.L.draftOrder, i = +d.i, j = i + +d.dir; [o[i], o[j]] = [o[j], o[i]]; CS.commit(); };
  CS.act.shuffleOrder = () => { CS.L.draftOrder = CS.shuffle(CS.L.draftOrder); CS.commit(); CS.toast('Order drawn.'); };
  CS.act.startDraft = () => { CS.startInitialDraft(CS.L); CS.commit(); };

  // ---------- draft room ----------
  function room(L) {
    const d = L.draft, cp = CS.curPick(L);
    if (!cp) return `<div class="panel hero"><div class="big">Draft complete</div><div class="note">Everyone is drafted. Time to play.</div><button class="btn gold" data-act="finishDraftStart">Start the ${d.kind === 'future' ? d.year : L.year} season</button><button class="btn" data-act="undoPick">Undo last pick</button></div>${board(L)}`;
    const t = CS.team(L, cp.owner), allowed = CS.allowedPositions(L, cp.owner), need = d.kind === 'initial' ? CS.needs(L, cp.owner) : [];
    const df = CS.ui.df, tab = CS.ui.draftTab;
    if (!allowed.includes(df.pos)) df.pos = allowed[0];
    const taken = CS.takenNfl(L), avail = L.players.filter(p => !p.tid);
    const via = cp.owner !== cp.orig ? ` · via ${esc(CS.tname(L, cp.orig))}` : '';
    const need2 = need.length ? need.reduce((a, p) => (a[p] = (a[p] || 0) + 1, a), {}) : null;
    let h = `<div class="panel hero" style="border-left-color:${CS.tcolor(L, cp.owner)}"><div class="row">${CS.tlogo(L, cp.owner, 54)}<div class="grow"><div class="lbl">${d.year} draft · round ${cp.round} · pick ${cp.n} of ${d.order.length}${via}</div>
      <div class="tname" style="font-size:26px">${t.base ? esc(CS.tfull(L, cp.owner)) : esc(t.mgr) + ' is on the clock'}</div><div class="mgr">${esc(t.mgr)}${t.base ? '' : ' · no base team yet'}</div></div></div>
      ${!t.base ? `<div class="note gold">First pick: a QB. His NFL team becomes the base team.</div>` : ''}
      ${need2 ? `<div class="chips">${Object.entries(need2).map(([p, n]) => `<span class="chip need">Needs ${n} ${p}</span>`).join('')}</div>` : (d.kind === 'initial' ? '<div class="note">Starting lineup is full. Anything now goes to the bench.</div>' : '')}</div>`;
    h += `<div class="chips sp"><span class="chip ${tab === 'log' ? 'on' : ''}" data-act="dTab" data-a="log">Log a card</span><span class="chip ${tab === 'pool' ? 'on' : ''}" data-act="dTab" data-a="pool">From my pool (${avail.length})</span></div>`;
    if (tab === 'log') {
      const names = avail.filter(p => allowed.includes(p.pos)).map(p => `<option value="${esc(p.name)}">`).join('');
      h += `<div class="panel"><div class="h">The card they picked</div><datalist id="dnames">${names}</datalist>
        <div class="frm"><label class="f s6">Player name<input type="text" id="dfName" data-bind="dfName" data-enter="doDraft" list="dnames" autocomplete="off" autocapitalize="words" value="${esc(df.name)}" placeholder="Type the name on the card"></label>
        <div class="s6"><div class="lbl" style="margin-bottom:4px">Position</div><div class="seg">${CS.POS.map(p => `<button class="${df.pos === p ? 'on' : ''}" ${allowed.includes(p) ? '' : 'disabled style="opacity:.3"'} data-act="dfPos" data-a="${p}">${p}</button>`).join('')}</div></div>
        ${df.pos === 'DEF' ? `<div class="s6"><div class="lbl" style="margin-bottom:4px">Type (optional)</div><div class="chips">${CS.SUBS.map(s => `<span class="chip ${df.sub === s ? 'on' : ''}" data-act="dfSub" data-a="${s}">${s}</span>`).join('')}</div></div>` : ''}
        <label class="f s2">Overall<input type="number" id="dfOvr" data-bind="dfOvr" data-enter="doDraft" inputmode="numeric" min="30" max="99" value="${esc(df.ovr)}" placeholder="85"></label>
        <label class="f s2">Age<input type="number" id="dfAge" data-bind="dfAge" data-enter="doDraft" inputmode="numeric" min="16" max="50" value="${esc(df.age)}" placeholder="26"></label>
        <label class="f s2">NFL team<select id="dfNfl" data-bind="dfNfl">${CS.nflOptions(df.nfl, !t.base, L)}</select></label></div>
        <button class="btn gold block" style="font-size:18px;padding:12px" data-act="doDraft">Draft${df.name ? ' ' + esc(df.name) : ''} for ${esc(CS.tname(L, cp.owner))}</button></div>`;
    } else {
      const f = CS.ui.draftF; let list = avail.filter(p => allowed.includes(p.pos));
      if (!t.base) list = list.filter(p => !p.nfl || !taken.has(p.nfl));
      if (f.pos) list = list.filter(p => p.pos === f.pos);
      if (f.q) list = list.filter(p => p.name.toLowerCase().includes(f.q.toLowerCase()));
      list.sort((a, b) => b.ovr - a.ovr);
      h += `<div class="panel"><div class="chips"><span class="chip ${!f.pos ? 'on' : ''}" data-act="dpPos" data-a="">All</span>${allowed.filter((p, i, a) => a.indexOf(p) === i).map(p => `<span class="chip ${f.pos === p ? 'on' : ''}" data-act="dpPos" data-a="${p}">${p}</span>`).join('')}</div>
        <input type="search" id="dpQ" data-bind="dpQ" placeholder="Search by name" value="${esc(f.q)}">
        <div class="note">${list.length} available${!t.base ? ' (QBs with an open NFL team)' : ''}. Showing the top 25.</div>
        <div class="col" style="gap:6px">${list.slice(0, 25).map(p => CS.pcard(L, p, { mini: true, acts: `<button class="btn xs" data-act="editCard" data-pid="${p.id}">Edit</button><button class="btn xs gold" data-act="poolPick" data-pid="${p.id}">Draft</button>` })).join('') || '<div class="note">No cards match. Use Log a card instead.</div>'}</div></div>`;
    }
    h += `<div class="row sp"><button class="btn" data-act="autoPick">Auto pick best</button><button class="btn" data-act="skipPick">Skip pick</button><button class="btn red" data-act="undoPick" ${d.log.length ? '' : 'disabled'}>Undo last</button></div>`;
    return h + board(L);
  }
  function board(L) {
    const d = L.draft; if (!d || !d.log.length) return '';
    const rows = d.log.slice().reverse().map(e => {
      const p = e.pid ? CS.byId(L, e.pid) : null;
      return `<div class="row" style="padding:6px 0;border-bottom:1px solid #1d2331"><b class="cc9 gold" style="width:44px;font-size:16px">${pn(L, { n: e.n, round: e.round })}</b>${CS.tlogo(L, e.tid, 24)}<div class="grow small"><b>${esc(CS.tname(L, e.tid))}</b> <span class="dim">${esc(CS.team(L, e.tid).mgr)}</span></div>
        <div class="small right">${p ? `<b>${esc(p.name)}</b><div class="dim">${CS.posLabel(p)} ${p.ovr} · age ${p.age}</div>` : '<span class="dim">skipped</span>'}</div></div>`;
    }).join('');
    return `<div class="panel"><div class="h">Draft board <small>${d.log.length} picks</small></div>${rows}</div>`;
  }

  // ---------- after the draft: picks view ----------
  function history(L) {
    const years = [...new Set(L.picks.filter(k => !k.used).map(k => k.year))].sort();
    const traded = L.picks.filter(k => !k.used && k.owner !== k.orig).sort((a, b) => a.year - b.year || a.round - b.round);
    return `<div class="panel"><div class="h">Picks by team</div><div class="note">Picks are used in the draft each offseason. Trade them on the Trades tab. Draft order is worst team first.</div><div class="tscroll"><table class="tbl"><tr><th>Team</th>${years.map(y => `<th>${y}</th>`).join('')}</tr>
      ${L.teams.map(t => `<tr><td class="l">${CS.teamRow(L, t.id)}</td>${years.map(y => `<td>${L.picks.filter(k => k.owner === t.id && k.year === y && !k.used).length}</td>`).join('')}</tr>`).join('')}</table></div></div>
      <div class="panel"><div class="h">Traded picks</div>${traded.map(k => `<div class="small" style="padding:5px 0;border-bottom:1px solid #1d2331"><b>${esc(CS.pickLabel(L, k, false))}</b> <span class="dim">belongs to</span> ${esc(CS.tname(L, k.owner))} <span class="dim">(originally ${esc(CS.tname(L, k.orig))})</span></div>`).join('') || '<div class="note">No picks have been traded yet.</div>'}</div>
      ${L.draft ? board(L) : ''}`;
  }

  // ---------- actions ----------
  CS.act.dTab = d => { CS.ui.draftTab = d.a; CS.render(); };
  CS.act.dfPos = d => { CS.ui.df.pos = d.a; if (d.a !== 'DEF') CS.ui.df.sub = ''; CS.render(); };
  CS.act.dfSub = d => { const df = CS.ui.df; df.sub = df.sub === d.a ? '' : d.a; CS.render(); };
  CS.act.dpPos = d => { CS.ui.draftF.pos = d.a; CS.render(); };
  CS.bind.dpQ = v => { CS.ui.draftF.q = v; return true; };
  CS.bind.dfOvr = v => { CS.ui.df.ovr = v; };
  CS.bind.dfAge = v => { CS.ui.df.age = v; };
  CS.bind.dfNfl = v => { CS.ui.df.nfl = v; };
  CS.bind.dfName = (v, el, e) => {
    const df = CS.ui.df; df.name = v;
    if (e.type !== 'change') return;
    const L = CS.L, cp = CS.curPick(L), allowed = cp ? CS.allowedPositions(L, cp.owner) : CS.POS;
    const m = L.players.find(p => !p.tid && allowed.includes(p.pos) && p.name.toLowerCase() === CS.cleanName(v).toLowerCase());
    if (m) { df.name = m.name; df.pos = m.pos; df.sub = m.sub || ''; df.ovr = m.ovr; df.age = m.age; df.nfl = m.nfl || ''; return true; }
  };
  CS.act.doDraft = () => {
    const L = CS.L, df = CS.ui.df; if (!CS.curPick(L)) return;
    const spec = { name: df.name, pos: df.pos, sub: df.sub, ovr: df.ovr, age: df.age, nfl: df.nfl };
    const cp = CS.curPick(L), who = CS.tname(L, cp.owner);
    const run = f => { const r = CS.makePick(L, spec, f); if (r.ok) { Object.assign(df, { name: '', ovr: '', age: '', nfl: '', sub: '' }); CS.toast(r.p.name + ' drafted by ' + who + '.'); CS.after = () => { const e = document.getElementById('dfName'); if (e) e.focus(); }; } return r; };
    CS.guard(run(false), run);
  };
  CS.act.poolPick = d => CS.guard(CS.makePick(CS.L, { pid: d.pid }, false), f => CS.makePick(CS.L, { pid: d.pid }, f), 'Drafted.');
  CS.act.autoPick = () => {
    const L = CS.L, cp = CS.curPick(L), b = cp && CS.bestAvailable(L, cp.owner);
    if (!b) return CS.toast('No card in the pool fits this pick. Log a card instead.', true);
    CS.guard(CS.makePick(L, { pid: b.id }, false), f => CS.makePick(L, { pid: b.id }, f), b.name + ' drafted.');
  };
  CS.act.skipPick = () => CS.confirm('Skip this pick?', 'The team gets nothing for this pick.', 'Skip', () => { CS.skipPick(CS.L); CS.commit(); }, true);
  CS.act.undoPick = () => { const r = CS.undoPick(CS.L); if (!r.ok) CS.toast(r.msg, true); else CS.commit(); };
})();
