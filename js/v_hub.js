// CARDS SEASON views: Hub, Teams, Team page, contract modal.
(function () {
  const { esc, money } = CS;

  // ---------- helpers ----------
  const rec = (L, tid) => { const r = CS.standings(L).find(x => x.tid === tid); return r && r.gp ? r.w + '-' + r.l + (r.t ? '-' + r.t : '') : '0-0'; };
  CS.recStr = rec;
  const teamRow = (L, tid, size) => `<span class="row" style="gap:8px">${CS.tlogo(L, tid, size || 26)}<span class="cc9" style="font-size:16px">${esc(CS.tname(L, tid))}</span></span>`;
  CS.teamRow = teamRow;

  // ---------- HUB ----------
  CS.views.hub = L => nextStep(L) + offseasonPanels(L) + standingsPanel(L) + recentPanel(L) + newsPanel(L) + historyPanel(L);

  function nextStep(L) {
    const n = L.players.length, qbs = L.players.filter(p => p.pos === 'QB').length, d = L.draft;
    let h = '', body = '';
    switch (L.phase) {
      case 'setup':
        h = n ? 'Ready to draft?' : 'Start by adding your cards';
        body = n ? `<div class="note">${n} cards in the pool (${qbs} QBs). Set the draft order, then start the draft. You can keep adding cards during the draft too.</div>
          <div class="row"><button class="btn" data-act="lgo" data-a="cards">Add more cards</button><button class="btn gold" data-act="lgo" data-a="draft">Draft order</button></div>`
          : `<div class="note">Type in the cards you have at home (name, position, overall, age, and the NFL team on the card). Then run the draft.</div>
          <button class="btn gold" data-act="lgo" data-a="cards">Add cards</button>`;
        break;
      case 'draft': {
        const cp = CS.curPick(L);
        h = d.year + ' draft';
        body = cp ? `<div class="row">${CS.tlogo(L, cp.owner, 44)}<div class="grow"><div class="lbl">On the clock · pick ${cp.n} of ${d.order.length}</div><div class="tname">${esc(CS.tfull(L, cp.owner))}</div><div class="mgr">${esc(CS.team(L, cp.owner).mgr)}</div></div></div>
          <button class="btn gold" data-act="lgo" data-a="draft">Open draft</button>`
          : `<div class="note">The draft is finished.</div><button class="btn gold" data-act="finishDraftStart">Start the ${d.kind === 'future' ? d.year : L.year} season</button>`;
        break; }
      case 'season':
        h = 'Regular season';
        body = CS.simBar(L); break;
      case 'playoffs': {
        const s = L.season;
        if (s.champ) {
          h = L.year + ' champions';
          body = `<div class="row">${CS.tlogo(L, s.champ, 56)}<div><div class="big cc9 gold">${esc(CS.tfull(L, s.champ))}</div><div class="mgr">${esc(CS.team(L, s.champ).mgr)} takes the Cards Bowl</div></div></div>
            <button class="btn gold" data-act="endSeason">Start the offseason</button>`;
        } else { h = 'Playoffs'; body = CS.simBar(L); }
        break; }
      case 'resign':
        h = 'Re-sign window'; body = `<div class="note">Contracts moved forward a year, everyone got a year older. Re-sign the players you want to keep, then move to free agency. Anyone you let go becomes a free agent.</div>`;
        break;
      case 'fa':
        h = 'Free agency'; body = `<div class="note">Free agents can sign with any team (check the cap). When everyone is set, start the ${L.year + 1} draft. Picks traded earlier are used here.</div>
          <div class="row"><button class="btn" data-act="lgo" data-a="cards">Free agents</button><button class="btn gold" data-act="startFutureDraft">Start ${L.year + 1} draft</button></div>`;
        break;
    }
    return `<div class="panel hero"><div class="big">${esc(h)}</div>${body}</div>`;
  }
  CS.act.lgo = d => CS.lgo(d.a, d.b);
  CS.act.finishDraftStart = () => { CS.finishDraft(CS.L); CS.startSeason(CS.L); CS.commit(); CS.toast('Season started. Good luck.'); };
  CS.act.endSeason = () => CS.confirm('Start the offseason?', 'Contracts drop a year, everyone ages and cards progress. Then you re-sign players, run free agency, and draft.', 'Start offseason', () => { CS.endSeason(CS.L); CS.commit(); });
  CS.act.startFutureDraft = () => {
    const L = CS.L, left = L.players.filter(p => p.tid && p.yrs <= 0).length;
    CS.confirm('Start the ' + (L.year + 1) + ' draft?', 'Draft order is worst team first. Anyone still without a team stays a free agent.', 'Start draft', () => { CS.startFutureDraft(L); CS.commit(); CS.lgo('draft'); });
  };

  function offseasonPanels(L) {
    if (L.phase !== 'resign' || !L.offseason) return '';
    const rep = L.offseason.report.filter(r => r.tid), ups = rep.slice().sort((a, b) => (b.to - b.from) - (a.to - a.from)).filter(r => r.to > r.from).slice(0, 5);
    const dns = rep.slice().sort((a, b) => (a.to - a.from) - (b.to - b.from)).filter(r => r.to < r.from).slice(0, 5);
    const line = r => `<div class="row small" style="padding:4px 0"><span class="grow"><b>${esc(r.name)}</b> <span class="dim">${r.pos} · age ${r.age} · ${esc(CS.tname(L, r.tid))}</span></span><span>${r.from} &rarr; <b class="${r.to > r.from ? 'green' : 'red'}">${r.to}</b></span></div>`;
    let h = '';
    if (L.settings.progress) h += `<div class="panel"><div class="h">Progress report <small>${L.offseason.year} offseason</small></div><div class="g2 stack"><div><div class="lbl green">Risers</div>${ups.map(line).join('') || '<div class="note">None</div>'}</div><div><div class="lbl red">Fallers</div>${dns.map(line).join('') || '<div class="note">None</div>'}</div></div>
      ${L.offseason.retired.length ? `<div class="note">Retired: ${L.offseason.retired.map(r => esc(r.name) + ' (' + r.pos + ')').join(', ')}</div>` : ''}</div>`;
    const ex = CS.expiring(L);
    h += `<div class="panel"><div class="h">Contracts up <small>${ex.length} players</small></div>`;
    if (!ex.length) h += '<div class="note">Nobody has an expiring deal.</div>';
    L.teams.forEach(t => {
      const list = ex.filter(p => p.tid === t.id).sort((a, b) => b.ovr - a.ovr); if (!list.length) return;
      h += `<div class="row sp">${CS.tlogo(L, t.id, 26)}<span class="cc9" style="font-size:17px">${esc(CS.tname(L, t.id))}</span><span class="dim small">cap space ${money(CS.capSpace(L, t.id))}</span></div>`;
      h += list.map(p => CS.pcard(L, p, { mini: true, tags: '<span class="tag exp">Expiring</span>', meta: 'asks ' + money(CS.askSal(p)),
        acts: `<button class="btn xs gold" data-act="contract" data-pid="${p.id}">Re-sign</button><button class="btn xs red" data-act="letGo" data-pid="${p.id}">Let go</button>` })).join('');
    });
    h += `<button class="btn gold block sp" data-act="finishResign">${ex.length ? 'Done re-signing: move to free agency' : 'Move to free agency'}</button></div>`;
    return h;
  }
  CS.act.finishResign = () => {
    const ex = CS.expiring(CS.L).length;
    CS.confirm('Move to free agency?', ex ? ex + ' players with expiring deals will become free agents.' : 'Everyone is signed.', 'Free agency', () => { CS.finishResign(CS.L); CS.commit(); });
  };
  CS.act.letGo = d => { const p = CS.byId(CS.L, d.pid); CS.confirm('Let ' + p.name + ' go?', 'He becomes a free agent.', 'Let go', () => { CS.release(CS.L, d.pid); CS.commit(); }, true); };

  function standingsPanel(L) {
    if (!L.season) {
      return `<div class="panel"><div class="h">Power rankings</div><div class="tscroll"><table class="tbl"><tr><th>Team</th><th>OVR</th><th>OFF</th><th>DEF</th><th>Cap</th></tr>
        ${L.teams.slice().sort((a, b) => CS.rate(L, b.id).ovr - CS.rate(L, a.id).ovr).map(t => { const r = CS.rate(L, t.id); return `<tr><td class="l">${teamRow(L, t.id)}</td><td><b>${r.ovr}</b></td><td>${Math.round(r.off)}</td><td>${Math.round(r.def)}</td><td>${money(CS.capSpace(L, t.id))}</td></tr>`; }).join('')}</table></div></div>`;
    }
    const st = CS.standings(L), cut = CS.playoffSize(L);
    return `<div class="panel"><div class="h">Standings <small>top ${cut} make the playoffs</small></div><div class="tscroll"><table class="tbl"><tr><th>#</th><th class="l">Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Diff</th><th>Strk</th></tr>
      ${st.map((r, i) => `<tr class="${i === cut - 1 ? 'cut' : ''}"><td class="l faint">${r.rank}</td><td class="l">${teamRow(L, r.tid)}</td><td><b>${r.w}-${r.l}${r.t ? '-' + r.t : ''}</b></td><td>${r.pf}</td><td>${r.pa}</td><td class="${r.diff >= 0 ? 'green' : 'red'}">${r.diff > 0 ? '+' : ''}${r.diff}</td><td class="dim">${r.strk}</td></tr>`).join('')}</table></div></div>`;
  }

  CS.standingsPanel = standingsPanel;
  function gameRow(L, g, small) {
    const done = g.played, hw = done && g.hs > g.as, aw = done && g.as > g.hs;
    return `<div class="game" data-act="gameModal" data-gid="${g.id}"><div class="tm">${CS.tlogo(L, g.h, 30)}<span>${esc(CS.tname(L, g.h))}</span></div>
      <div class="sc">${done ? `<span class="${hw ? 'w' : 'l'}">${g.hs}</span> <span class="faint">-</span> <span class="${aw ? 'w' : 'l'}">${g.as}</span><small>${g.ot ? 'FINAL/OT' : 'FINAL'}</small>` : `<span class="faint">vs</span><small>${g.po ? 'PLAYOFFS' : 'TO PLAY'}</small>`}</div>
      <div class="tm a"><span>${esc(CS.tname(L, g.a))}</span>${CS.tlogo(L, g.a, 30)}</div></div>`;
  }
  CS.gameRow = gameRow;
  function recentPanel(L) {
    if (!L.season) return '';
    const all = []; L.season.weeks.forEach((w, i) => w.forEach(g => { if (g.played) all.push({ g, w: i + 1 }); }));
    if (L.season.po) L.season.po.rounds.forEach(r => r.games.forEach(g => { if (g.played) all.push({ g, w: r.name }); }));
    if (!all.length) return '';
    const last = all.slice(-4).reverse();
    return `<div class="panel"><div class="h">Latest scores</div><div class="col">${last.map(x => gameRow(L, x.g)).join('')}</div><button class="link" data-act="lgo" data-a="season">All games</button></div>`;
  }
  function newsPanel(L) {
    if (!L.log.length) return '';
    return `<div class="panel"><div class="h">League news</div>${L.log.slice(0, 10).map(n => `<div class="small" style="padding:5px 0;border-bottom:1px solid #1d2331"><span class="faint">${n.y}</span> ${esc(n.m)}</div>`).join('')}</div>`;
  }
  function historyPanel(L) {
    if (!L.hist.length) return '';
    return `<div class="panel"><div class="h">Champions</div>${L.hist.slice().reverse().map(h => `<div class="row" style="padding:5px 0">${CS.tlogo(L, h.champ, 28)}<div class="grow"><b>${h.year}</b> ${esc(h.tidNames[h.champ] || '')}</div><span class="dim small">${h.topTd ? esc(h.topTd.name) + ' ' + h.topTd.n + ' TD' : ''}</span></div>`).join('')}</div>`;
  }

  // ---------- cap breakdown bar ----------
  CS.capBar = (L, tid) => {
    const t = CS.team(L, tid), b = CS.baseCost(t), cards = CS.cardPay(L, tid), cap = L.settings.cap, pay = CS.r1(cards + b.total), sp = CS.r1(cap - pay);
    const segs = [['Cards', cards, 'var(--gold)'], ['Defense', b.def, 'var(--red)'], ['O-line', b.ol, 'var(--cyan)'], ['K + P', CS.r1(b.k + b.p), 'var(--purple)']];
    const tot = Math.max(cap, pay);
    return `<div class="capbar"><div class="row"><div class="lbl grow">Payroll ${money(pay)} of ${money(cap)}</div><b class="cc9 ${sp < 0 ? 'red' : 'green'}" style="font-size:18px">${sp < 0 ? money(-sp) + ' over' : money(sp) + ' space'}</b></div>
      <div class="cb">${segs.map(s => `<i style="width:${s[1] / tot * 100}%;background:${s[2]}"></i>`).join('')}${pay > cap ? `<em style="left:${cap / tot * 100}%"></em>` : ''}</div>
      <div class="cbk">${segs.map(s => `<span><i style="background:${s[2]}"></i>${s[0]} ${money(s[1])}</span>`).join('')}</div></div>`;
  };

  // ---------- TEAMS ----------
  CS.views.teams = L => {
    const sort = CS.ui.teamSort, rows = L.teams.map(t => ({ t, r: CS.rate(L, t.id), st: CS.standings(L).find(x => x.tid === t.id) }));
    rows.sort((a, b) => sort === 'ovr' ? b.r.ovr - a.r.ovr : sort === 'cap' ? CS.capSpace(L, b.t.id) - CS.capSpace(L, a.t.id) : sort === 'mgr' ? a.t.mgr.localeCompare(b.t.mgr) : (a.st.rank - b.st.rank));
    return `<div class="chips sp">${[['rec', 'Record'], ['ovr', 'Rating'], ['cap', 'Cap space'], ['mgr', 'Name']].map(c => `<span class="chip ${sort === c[0] ? 'on' : ''}" data-act="teamSort" data-a="${c[0]}">${c[1]}</span>`).join('')}</div>
      <div class="col sp">${rows.map(({ t, r, st }) => { const qb = CS.lineup(L, t.id).QB; return `<div class="tt" style="--tc:${CS.tcolor(L, t.id)}" data-act="openTeam" data-tid="${t.id}">${CS.tlogo(L, t.id, 48)}
        <div class="grow"><div class="tname">${esc(CS.tfull(L, t.id))}</div><div class="mgr">${esc(t.mgr)}${qb ? ' · QB ' + esc(qb.name) : ' · no QB yet'}</div>
        <div class="small dim">${L.season ? 'Record ' + rec(L, t.id) + ' · ' : ''}<span class="${CS.capSpace(L, t.id) < 0 ? 'red' : ''}">Cap space ${money(CS.capSpace(L, t.id))}</span> · ${CS.roster(L, t.id).length} players</div></div>
        <div class="center"><div class="big-ovr ${CS.tier(r.ovr)}"><b>${r.ovr}</b></div><div class="lbl">OVR</div></div></div>`; }).join('')}</div>`;
  };
  CS.act.teamSort = d => { CS.ui.teamSort = d.a; CS.render(); };
  CS.act.openTeam = d => CS.lgo('team', d.tid);

  // ---------- TEAM PAGE ----------
  CS.views.team = (L, r) => {
    const t = CS.team(L, r.arg); if (!t) return '<div class="panel">Team not found.</div>';
    const R = CS.rate(L, t.id), lu = CS.lineup(L, t.id), pay = CS.payroll(L, t.id), cap = L.settings.cap;
    const slots = [['QB', lu.QB], ['RB', lu.RB], ['WR', lu.WR[0]], ['WR', lu.WR[1]], ['WR', lu.WR[2]], ['TE', lu.TE], ['DEF', lu.DEF]];
    const acts = (p, bench) => `${bench ? `<button class="btn xs cyan" data-act="makeStarter" data-pid="${p.id}">Start</button>` : ''}<button class="btn xs" data-act="contract" data-pid="${p.id}">Contract</button><button class="btn xs" data-act="editCard" data-pid="${p.id}">Edit</button><button class="btn xs red" data-act="releaseP" data-pid="${p.id}">Release</button>`;
    const tags = p => (p.yrs <= 0 && L.phase === 'resign' ? '<span class="tag exp">Expiring</span>' : p.yrs === 1 ? '<span class="tag exp">Final year</span>' : '') + (p.force ? '<span class="tag st">Set starter</span>' : '');
    const picks = L.picks.filter(k => k.owner === t.id && !k.used).sort((a, b) => a.year - b.year || a.round - b.round);
    return `<div class="panel" style="--tc:${CS.tcolor(L, t.id)};border-left:5px solid var(--tc)"><div class="row">${CS.tlogo(L, t.id, 64)}<div class="grow"><div class="tname" style="font-size:26px">${esc(CS.tfull(L, t.id))}</div><div class="mgr">Managed by ${esc(t.mgr)}${L.season ? ' · ' + rec(L, t.id) : ''}</div></div>
        <div class="center"><div class="big-ovr ${CS.tier(R.ovr)}"><b>${R.ovr}</b></div><div class="lbl">Team OVR</div></div></div>
      <div class="g2 stack sp"><div class="col" style="gap:6px">${CS.rbar('OFF', R.off)}${CS.rbar('DEF', R.def)}${CS.rbar('OL', R.ol)}</div><div class="col" style="gap:6px">${CS.rbar('QB', R.qb)}${CS.rbar('KICK', R.k)}${CS.rbar('PUNT', R.p)}</div></div>
      <div class="note">${t.base ? `Base team: ${esc(CS.NFL[t.base.nfl].full)} (defense ${t.base.def}, offensive line ${t.base.ol}, kicker ${t.base.k}, punter ${t.base.p})` : 'No base team yet. Draft a QB to get one.'}</div>
      ${CS.capBar(L, t.id)}<div class="row"><button class="btn sm" data-act="editTeam" data-tid="${t.id}">Edit team</button><button class="btn sm cyan" data-act="tradeWith" data-tid="${t.id}">Trade</button></div></div>
      <div class="panel"><div class="h">Starting lineup</div><div class="col" style="gap:8px">${slots.map(([s, p]) => p ? CS.pcard(L, p, { tags: tags(p), acts: acts(p, false), meta: CS.seasonLine(L, p) }) : CS.emptyCard(s)).join('')}</div></div>
      <div class="panel"><div class="h">Bench <small>${lu.bench.length} · roster ${CS.roster(L, t.id).length} of ${L.settings.maxRoster}</small></div>
        <div class="col" style="gap:8px">${lu.bench.map(p => CS.pcard(L, p, { tags: tags(p), acts: acts(p, true), meta: CS.seasonLine(L, p) })).join('') || '<div class="note">No bench players.</div>'}</div></div>
      <div class="panel"><div class="h">Draft picks <small>${picks.length}</small></div><div class="chips">${picks.map(k => `<span class="pick">${esc(CS.pickLabel(L, k))}</span>`).join('') || '<span class="note">No picks.</span>'}</div></div>
      <button class="link center" data-act="lgo" data-a="teams">&larr; All teams</button>`;
  };
  CS.act.makeStarter = d => { CS.setStarter(CS.L, d.pid); CS.commit(); };
  CS.act.releaseP = d => { const p = CS.byId(CS.L, d.pid); CS.confirm('Release ' + p.name + '?', 'He goes to free agency and his contract comes off the cap.', 'Release', () => { CS.release(CS.L, d.pid); CS.commit(); CS.toast(p.name + ' released.'); }, true); };
  CS.act.tradeWith = d => { CS.ui.trade = { a: d.tid, b: '', pa: [], ka: [], pb: [], kb: [] }; CS.lgo('trades'); };

  // ---------- CONTRACT MODAL (re-sign, extend, or sign a free agent) ----------
  CS.act.contract = d => CS.contractModal(d.pid, d.tid || null);
  CS.contractModal = (pid, tid) => {
    const L = CS.L, p = CS.byId(L, pid), ask = CS.askSal(p), yrs = p.tid && p.yrs > 0 ? p.yrs : CS.askYears(p);
    const team = tid || p.tid;
    CS._cm = { pid, tid: team };
    const resign = !!p.tid;
    CS.modal(`<div class="h">${resign ? (p.yrs <= 0 ? 'Re-sign ' : 'New contract: ') : 'Sign '}${esc(p.name)}</div>
      ${CS.pcard(L, p, { mini: true })}
      <div class="note sp">Asking ${money(ask)} per year for ${CS.askYears(p)} year${CS.askYears(p) > 1 ? 's' : ''}. He signs at ${money(CS.minAccept(ask))} or more.</div>
      ${resign ? '' : `<label class="f sp">Team<select id="cmTeam">${L.teams.map(t => `<option value="${t.id}"${t.id === team ? ' selected' : ''}>${esc(CS.tfull(L, t.id))} (cap space ${money(CS.capSpace(L, t.id))}, ${CS.roster(L, t.id).length} players)</option>`).join('')}</select></label>`}
      <div class="g2 sp"><label class="f">Salary ($M a year)<input type="number" id="cmSal" inputmode="decimal" step="0.1" value="${ask}"></label>
      <label class="f">Years<select id="cmYrs">${[1, 2, 3, 4, 5, 6].map(y => `<option${y === yrs ? ' selected' : ''}>${y}</option>`).join('')}</select></label></div>
      ${resign ? `<div class="note">${esc(CS.tname(L, team))} cap space: ${money(CS.capSpace(L, team) + (p.sal || 0))} with his old salary off the books.</div>` : ''}
      <div class="row sp"><button class="btn block" data-act="closeModal">Cancel</button><button class="btn block gold" data-act="saveContract">${resign ? 'Save contract' : 'Sign'}</button></div>`);
  };
  CS.act.saveContract = () => {
    const L = CS.L, c = CS._cm, el = document.getElementById('cmTeam'), tid = el ? el.value : c.tid;
    const sal = document.getElementById('cmSal').value, yrs = document.getElementById('cmYrs').value;
    const p = CS.byId(L, c.pid), resign = p.tid === tid;
    CS.closeModal();
    CS.guard(CS.sign(L, c.pid, tid, sal, yrs, false), f => CS.sign(L, c.pid, tid, sal, yrs, f), resign ? 'Contract saved.' : p.name + ' signed.');
  };
})();
