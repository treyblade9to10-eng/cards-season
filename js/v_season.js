// CARDS SEASON view: Season (enter scores, games, table, playoffs, leaders, history).
(function () {
  const { esc } = CS;

  // ---------- which games are up next ----------
  CS.curGames = L => {
    if (!L.season) return null;
    const po = L.season.po;
    if (po && !po.champ) { const rd = po.rounds[po.rounds.length - 1]; return { title: rd.name, games: rd.games, po: true }; }
    const wi = CS.curWeek(L); if (wi < 0 || po) return null;
    return { title: 'Week ' + (wi + 1), games: L.season.weeks[wi], po: false };
  };

  // ---------- score controls (Hub + Season) ----------
  CS.simBar = L => {
    if (!L.season) return '<div class="note">No season yet.</div>';
    const all = L.season.weeks.flat(), played = all.filter(g => g.played).length, c = CS.curGames(L);
    if (L.phase === 'season') {
      if (!c) return `<div class="note">Regular season is complete. The top ${CS.playoffSize(L)} teams make the playoffs.</div><button class="btn gold" data-act="startPlayoffs">Start the playoffs</button>`;
      const left = c.games.filter(g => !g.played).length;
      return `<div class="lbl">${c.title} of ${L.season.weeks.length} · ${played} of ${all.length} games played</div><div class="bd"><i style="width:${played / all.length * 100}%"></i></div>
        <div class="note">Play your games, then put the final scores in. You can add player stats too. Anything you leave blank gets simulated.</div>
        <button class="btn gold" data-act="weekSheet" style="font-size:17px">Enter ${c.title} scores${left < c.games.length ? ' (' + left + ' left)' : ''}</button>
        <div class="rowt"><button class="btn sm" data-act="simWeek">Sim ${c.title} for us</button><button class="btn sm" data-act="simRest">Sim the rest of the season</button></div>`;
    }
    if (!c) return '<div class="note">The playoffs are over.</div>';
    const left = c.games.filter(g => !g.played).length;
    return `<div class="note">${esc(c.title)}: ${c.games.map(g => esc(CS.tname(L, g.h)) + ' vs ' + esc(CS.tname(L, g.a))).join(' · ')}</div>
      <button class="btn gold" data-act="weekSheet" style="font-size:17px">Enter ${esc(c.title)} scores${left < c.games.length ? ' (' + left + ' left)' : ''}</button>
      <div class="rowt"><button class="btn sm" data-act="simRound">Sim ${esc(c.title)} for us</button><button class="btn sm" data-act="simPoAll">Sim all playoffs</button></div>`;
  };
  CS.showResults = (title, games) => {
    const L = CS.L;
    CS.modal(`<div class="h">${esc(title)}</div><div class="col sp">${games.map(g => CS.gameRow(L, g)).join('')}</div><button class="btn gold block sp" data-act="closeModal">Nice</button>`);
  };
  CS.act.simWeek = () => CS.confirm('Sim this week?', 'Every game that has not been played yet gets a simulated score and stats. Do this only for games you are not playing yourselves.', 'Sim it', () => {
    const L = CS.L, c = CS.curGames(L); c.games.filter(g => !g.played).forEach(g => CS.playGame(L, g, false)); CS.commit(); CS.showResults(c.title + ' scores', c.games);
  });
  CS.act.simRest = () => CS.confirm('Sim the rest of the season?', 'Every remaining game gets a simulated score. Games you already entered stay as they are.', 'Sim it', () => { CS.simRest(CS.L); CS.commit(); CS.toast('Regular season done.'); });
  CS.act.startPlayoffs = () => { CS.startPlayoffs(CS.L); CS.commit(); };
  CS.act.simRound = () => CS.confirm('Sim this round?', 'Games you have not entered get a simulated score.', 'Sim it', () => { const rd = CS.simPoRound(CS.L); CS.commit(); if (rd) CS.showResults(rd.name + ' scores', rd.games); });
  CS.act.simPoAll = () => CS.confirm('Sim all the playoffs?', 'Every playoff game that has not been entered is simulated, all the way to the champion.', 'Sim it', () => { CS.simPoAll(CS.L); CS.commit(); CS.toast('Playoffs complete.'); });

  // ---------- the week sheet: one box per score ----------
  const wsRow = (L, g) => {
    if (g.played) return `<div class="ws done"><div class="wsm">${CS.tlogo(L, g.h, 24)}<span>${esc(CS.tname(L, g.h))}</span><b class="${g.hs > g.as ? 'gold' : 'dim'}">${g.hs}</b></div><div class="wsm">${CS.tlogo(L, g.a, 24)}<span>${esc(CS.tname(L, g.a))}</span><b class="${g.as > g.hs ? 'gold' : 'dim'}">${g.as}</b></div><button class="btn xs" data-act="gameForm" data-gid="${g.id}">Fix</button></div>`;
    const inp = s => `<input type="number" inputmode="numeric" min="0" class="wsi" data-ws="${g.id}" data-s="${s}" placeholder="sim">`;
    return `<div class="ws"><div class="wsm">${CS.tlogo(L, g.h, 24)}<span>${esc(CS.tname(L, g.h))}</span>${inp('h')}</div><div class="wsm">${CS.tlogo(L, g.a, 24)}<span>${esc(CS.tname(L, g.a))}</span>${inp('a')}</div><button class="btn xs cyan" data-act="gameForm" data-gid="${g.id}">+ Stats</button></div>`;
  };
  CS.weekSheet = keep => {
    const L = CS.L, c = CS.curGames(L); if (!c) return;
    CS.modal(`<div class="h">${esc(c.title)} scores</div>
      <div class="note sp">Type the final score of each game you played. Leave a box empty and it gets simulated. Tap + Stats if you want to add player stats.</div>
      <div class="col sp">${c.games.map(g => wsRow(L, g)).join('')}</div>
      <div class="row sp"><button class="btn" data-act="closeModal">Close</button><button class="btn gold grow" data-act="saveWeek">Save scores</button></div>
      <button class="btn block sp" data-act="simBlankWeek">Sim the games I left empty</button>`);
    if (keep) document.querySelectorAll('#modal [data-ws]').forEach(el => { const k = keep[el.dataset.ws]; if (k && k[el.dataset.s] != null) el.value = k[el.dataset.s]; });
  };
  const readWs = () => { const m = {}; document.querySelectorAll('#modal [data-ws]').forEach(el => { (m[el.dataset.ws] = m[el.dataset.ws] || {})[el.dataset.s] = el.value; }); return m; };
  CS.act.weekSheet = () => CS.weekSheet();
  CS.act.saveWeek = () => {
    const L = CS.L, c = CS.curGames(L), typed = readWs(), bad = []; let n = 0;
    c.games.filter(g => !g.played).forEach(g => {
      const t = typed[g.id] || {}, h = t.h === '' || t.h == null ? null : Math.round(+t.h), a = t.a === '' || t.a == null ? null : Math.round(+t.a);
      if (h == null && a == null) return;
      if ((h != null && !(h >= 0)) || (a != null && !(a >= 0))) return bad.push(CS.tname(L, g.h) + ' vs ' + CS.tname(L, g.a) + ': scores must be 0 or more.');
      const r = CS.saveGameResult(L, g, { hs: h, as: a }, false);
      if (r.ok) n++; else bad.push(CS.tname(L, g.h) + ' vs ' + CS.tname(L, g.a) + ': ' + (r.issues ? r.issues.join(' ') : r.msg));
    });
    CS.save();
    if (bad.length) { CS.render(); CS.modal(`<div class="h red">Some games did not save</div>${bad.map(b => `<div class="issue sp">${esc(b)}</div>`).join('')}<div class="note sp">${n ? n + ' game' + (n > 1 ? 's' : '') + ' saved.' : ''}</div><button class="btn gold block sp" data-act="weekSheet">Back to the scores</button>`); return; }
    if (!n) return CS.toast('Type at least one score first.', true);
    CS.closeModal(); CS.render(); CS.toast(n + ' game' + (n > 1 ? 's' : '') + ' saved.');
    const nc = CS.curGames(CS.L); if (nc && nc.title !== c.title) CS.toast(c.title + ' is done. On to ' + nc.title + '.');
  };
  CS.act.simBlankWeek = () => {
    const L = CS.L, c = CS.curGames(L), typed = readWs(); let n = 0;
    c.games.filter(g => !g.played).forEach(g => { const t = typed[g.id] || {}; if ((t.h || '') === '' && (t.a || '') === '') { CS.playGame(L, g, c.po); n++; } });
    CS.closeModal(); CS.commit(); CS.toast(n ? n + ' game' + (n > 1 ? 's' : '') + ' simulated.' : 'No empty games to sim.');
  };

  // ---------- game form: score + the key players' stats ----------
  CS.findGame = (L, gid) => CS.allGames(L).find(g => g.id === gid) || null;
  const teamForm = (L, g, tid) => {
    const prev = (g.played && g.inp && g.inp.vals) || {}, boxL = g.played && g.box && g.box[tid];
    const rows = boxL ? boxL.map(l => ({ id: l.pid, name: l.name, pos: l.pos, ln: l })) : CS.gameCast(L, tid).map(p => ({ id: p.id, name: p.name, pos: p.pos, ovr: p.ovr }));
    return `<div class="panel flat" style="margin-top:12px"><div class="row">${CS.tlogo(L, tid, 30)}<div class="grow"><div class="tname" style="font-size:17px">${esc(CS.tname(L, tid))}</div><div class="lbl">Player stats</div></div></div>
      ${rows.map(r => `<div class="sf"><div class="sfn"><b>${esc(r.name)}</b> <span class="dim small">${r.pos}</span></div><div class="sfi">${CS.FIELDS[r.pos].map(([k, lab]) => {
        const v = prev[r.id] && prev[r.id][k] !== undefined ? prev[r.id][k] : '', ph = r.ln && (r.ln.sim || []).includes(k) ? r.ln.st[k] : 'sim';
        return `<label class="f2"><span>${lab}</span><input type="number" inputmode="numeric" min="0" data-sp="${r.id}" data-k="${k}" value="${v}" placeholder="${ph}"></label>`;
      }).join('')}</div></div>`).join('') || '<div class="note">No starters on this team.</div>'}</div>`;
  };
  CS.gameForm = (gid, pre) => {
    const L = CS.L, g = CS.findGame(L, gid); if (!g) return;
    pre = pre || {};
    const inp = g.played && g.inp ? g.inp : {}, hv = pre.h != null ? pre.h : (inp.hs == null ? '' : inp.hs), av = pre.a != null ? pre.a : (inp.as == null ? '' : inp.as);
    CS._gf = gid;
    CS.modal(`<div class="h">${g.played ? 'Fix the result' : 'Enter the result'}</div>
      <div class="note sp">Fill in what you know. <b>Anything you leave blank gets simulated</b> so it all adds up to the score.</div>
      <div class="gfs sp"><div class="gft">${CS.tlogo(L, g.h, 36)}<span>${esc(CS.tname(L, g.h))}</span></div><input type="number" inputmode="numeric" min="0" id="gfH" placeholder="${g.played ? g.hs : 'sim'}" value="${hv}"><span class="faint">-</span><input type="number" inputmode="numeric" min="0" id="gfA" placeholder="${g.played ? g.as : 'sim'}" value="${av}"><div class="gft r"><span>${esc(CS.tname(L, g.a))}</span>${CS.tlogo(L, g.a, 36)}</div></div>
      ${g.po ? '' : `<label class="row sp"><input type="checkbox" id="gfOt" ${inp.ot ? 'checked' : ''}><span class="small">Went to overtime</span></label>`}
      ${teamForm(L, g, g.h)}${teamForm(L, g, g.a)}
      <div class="row sp"><button class="btn" data-act="formCancel">Cancel</button><button class="btn gold grow" data-act="saveGame">${g.played ? 'Save changes' : 'Save result'}</button></div>
      ${g.played ? '' : `<button class="btn block sp" data-act="playOne" data-gid="${g.id}">Just sim this game</button>`}`);
  };
  CS.act.gameForm = d => {
    const h = document.querySelector(`#modal [data-ws="${d.gid}"][data-s=h]`), a = document.querySelector(`#modal [data-ws="${d.gid}"][data-s=a]`);
    CS._wsKeep = h ? readWs() : null;
    CS.gameForm(d.gid, h ? { h: h.value, a: a.value } : null);
  };
  CS.act.formCancel = () => { const k = CS._wsKeep; CS._wsKeep = null; if (k) CS.weekSheet(k); else CS.closeModal(); };
  const backToSheet = () => { const k = CS._wsKeep; CS._wsKeep = null; if (k && CS.curGames(CS.L)) CS.weekSheet(k); };
  CS.act.saveGame = () => {
    const L = CS.L, g = CS.findGame(L, CS._gf), num = id => { const v = document.getElementById(id).value; return v === '' ? null : Math.round(+v); };
    const hs = num('gfH'), as = num('gfA'), vals = {}; let bad = false;
    if ((hs != null && !(hs >= 0)) || (as != null && !(as >= 0))) return CS.toast('Scores must be 0 or more.', true);
    document.querySelectorAll('#modal [data-sp]').forEach(el => { if (el.value === '') return; const v = Math.round(+el.value); if (!(v >= 0)) { bad = true; return; } (vals[el.dataset.sp] = vals[el.dataset.sp] || {})[el.dataset.k] = v; });
    if (bad) return CS.toast('Stats must be 0 or more.', true);
    const ot = !!(document.getElementById('gfOt') && document.getElementById('gfOt').checked);
    const inp = { hs, as, ot, vals };
    if (g.played && JSON.stringify(inp) === JSON.stringify({ hs: g.inp ? g.inp.hs : null, as: g.inp ? g.inp.as : null, ot: g.inp ? !!g.inp.ot : false, vals: g.inp ? g.inp.vals : {} })) { CS.closeModal(); backToSheet(); return CS.toast('Nothing changed.'); }
    CS.closeModal();
    if (CS.guard(CS.saveGameResult(L, g, inp, false), f => CS.saveGameResult(L, g, inp, f), 'Result saved.')) backToSheet();
  };
  CS.act.playOne = d => { const L = CS.L, g = CS.findGame(L, d.gid); CS.closeModal(); CS.playGame(L, g, !!g.po); CS.commit(); if (CS._wsKeep) backToSheet(); else CS.gameModal(g.id); };

  // ---------- game modal: box score ----------
  CS.gameModal = gid => {
    const L = CS.L, g = CS.findGame(L, gid); if (!g) return;
    const rh = CS.rate(L, g.h), ra = CS.rate(L, g.a);
    const boxTeam = tid => g.box && g.box[tid] ? `<div class="lbl sp">${esc(CS.tname(L, tid))}</div>${g.box[tid].map(l => `<div class="sum" style="grid-template-columns:1fr auto"><span><b>${esc(l.name)}</b> <span class="dim">${l.pos}</span></span><span class="right dim small">${CS.boxLine(l)}</span></div>`).join('')}` : '';
    const hasSim = g.box && Object.values(g.box).some(b => b.some(l => (l.sim || []).length));
    CS.modal(`<div class="game" style="cursor:default"><div class="tm">${CS.tlogo(L, g.h, 40)}<span>${esc(CS.tname(L, g.h))}</span></div>
      <div class="sc">${g.played ? `${g.hs} <span class="faint">-</span> ${g.as}<small>${g.ot ? 'FINAL/OT' : 'FINAL'}</small>` : '<span class="faint">vs</span>'}</div>
      <div class="tm a"><span>${esc(CS.tname(L, g.a))}</span>${CS.tlogo(L, g.a, 40)}</div></div>
      <div class="small dim center sp">OVR ${rh.ovr} vs ${ra.ovr} · offense ${Math.round(rh.off)} / ${Math.round(ra.off)} · defense ${Math.round(rh.def)} / ${Math.round(ra.def)}</div>
      ${g.played && g.sum && g.sum.length ? `<div class="lbl sp">Scoring</div>${g.sum.map(s => `<div class="sum"><span class="dim">${s.q}</span><span><b>${esc(CS.tname(L, s.tid))}</b> ${esc(s.txt)}</span><span class="right nowrap dim">${s.h}-${s.a}</span></div>`).join('')}` : ''}
      ${g.played ? boxTeam(g.h) + boxTeam(g.a) : ''}
      ${g.played && g.src === 'entered' ? '<div class="note sp">Score entered by the league.</div>' : ''}${hasSim ? '<div class="note sp">* simulated to fit the score</div>' : ''}
      <div class="row sp">${g.played ? '' : `<button class="btn gold grow" data-act="gameForm" data-gid="${g.id}">Enter result</button><button class="btn grow" data-act="playOne" data-gid="${g.id}">Sim it</button>`}${g.played ? `<button class="btn gold grow" data-act="gameForm" data-gid="${g.id}">Fix result</button>` : ''}<button class="btn" data-act="closeModal">Close</button></div>`);
  };
  CS.act.gameModal = d => CS.gameModal(d.gid);

  // ---------- SEASON view ----------
  CS.views.season = L => {
    const tab = CS.ui.seasonTab;
    const tabs = [['games', 'Games'], ['table', 'Table'], ['po', 'Playoffs'], ['lead', 'Leaders'], ['hist', 'History']];
    const head = `<div class="chips scroll sp">${tabs.map(t => `<span class="chip ${tab === t[0] ? 'on' : ''}" data-act="sTab" data-a="${t[0]}">${t[1]}</span>`).join('')}</div>`;
    if (!L.season && tab !== 'hist') return head + `<div class="panel"><div class="h">No season yet</div><div class="note">The season starts after the draft. Go to the Draft tab to run it.</div></div>`;
    if (tab === 'table') return head + CS.standingsPanel(L);
    if (tab === 'po') return head + poView(L);
    if (tab === 'lead') return head + leadView(L);
    if (tab === 'hist') return head + histView(L);
    return head + gamesView(L);
  };
  CS.act.sTab = d => { CS.ui.seasonTab = d.a; CS.render(); };

  function gamesView(L) {
    const s = L.season, weeks = s.weeks, cw = CS.curWeek(L);
    let wk = CS.ui.wk; if (wk == null || wk > weeks.length) wk = cw < 0 ? weeks.length - 1 : cw;
    const chips = weeks.map((w, i) => `<span class="chip ${wk === i ? 'on' : ''}" data-act="wk" data-a="${i}">W${i + 1}${w.every(g => g.played) ? '' : cw === i ? ' *' : ''}</span>`).join('') + (s.po ? `<span class="chip ${wk === 'po' ? 'on' : ''}" data-act="wk" data-a="po">Playoffs</span>` : '');
    let body;
    if (wk === 'po') body = poView(L);
    else {
      const w = weeks[wk] || [], byeTeams = L.teams.filter(t => !w.some(g => g.h === t.id || g.a === t.id));
      body = `<div class="panel"><div class="h">Week ${wk + 1}</div><div class="col">${w.map(g => CS.gameRow(L, g)).join('')}</div>${byeTeams.length ? `<div class="note">Bye: ${byeTeams.map(t => esc(CS.tname(L, t.id))).join(', ')}</div>` : ''}</div>`;
    }
    return `<div class="chips scroll sp">${chips}</div>${L.phase === 'season' || L.phase === 'playoffs' ? `<div class="panel">${CS.simBar(L)}</div>` : ''}${body}`;
  }
  CS.act.wk = d => { CS.ui.wk = d.a === 'po' ? 'po' : +d.a; CS.render(); };

  function poView(L) {
    const po = L.season && L.season.po;
    if (!po) {
      const n = CS.playoffSize(L), st = CS.standings(L).slice(0, n);
      return `<div class="panel"><div class="h">Playoff picture <small>top ${n} qualify</small></div>${st.map((r, i) => `<div class="row" style="padding:5px 0"><b class="cc9 gold" style="width:24px">${i + 1}</b>${CS.teamRow(L, r.tid)}<span class="dim small">${r.w}-${r.l}${r.t ? '-' + r.t : ''}</span></div>`).join('')}</div>`;
    }
    return `<div class="panel"><div class="h">Playoffs <small>seeds: ${po.seeds.map((t, i) => (i + 1) + ' ' + esc(CS.tname(L, t))).join(' · ')}</small></div></div>` +
      po.rounds.map(r => `<div class="panel"><div class="h">${esc(r.name)}</div><div class="col">${r.games.map(g => CS.gameRow(L, g)).join('')}</div></div>`).join('') +
      (po.champ ? `<div class="panel hero"><div class="row">${CS.tlogo(L, po.champ, 56)}<div><div class="lbl">Champions</div><div class="big cc9 gold">${esc(CS.tfull(L, po.champ))}</div></div></div></div>` : '');
  }

  const BOARDS = [['py', 'Passing yards'], ['ptd', 'Pass TDs'], ['ru', 'Rushing yards'], ['rc', 'Receiving yards'], ['td', 'Touchdowns'], ['sck', 'Sacks'], ['dint', 'Interceptions']];
  function leadView(L) {
    const key = CS.ui.lead || 'py', l = CS.leaders(L, key, 10), name = (BOARDS.find(b => b[0] === key) || BOARDS[0])[1], st = CS.standings(L);
    return `<div class="chips scroll sp">${BOARDS.map(b => `<span class="chip ${key === b[0] ? 'on' : ''}" data-act="leadKey" data-a="${b[0]}">${b[1]}</span>`).join('')}</div>
      <div class="panel"><div class="h">${name}</div>${l.map((e, i) => `<div class="row" style="padding:6px 0;border-bottom:1px solid #1d2331"><b class="cc9 dim" style="width:22px">${i + 1}</b><div class="grow"><b>${esc(e.name)}</b> <span class="dim small">${e.pos} · ${e.tid ? esc(CS.tname(L, e.tid)) : 'free agent'} · ${e.g} G</span></div><b class="cc9 gold" style="font-size:22px">${e[key].toLocaleString('en-US')}</b></div>`).join('') || '<div class="note">Nobody yet. Enter some scores and stats first.</div>'}</div>
      <div class="panel"><div class="h">Team scoring</div><div class="tscroll"><table class="tbl"><tr><th>Team</th><th>Pts/G</th><th>Allowed/G</th></tr>${st.filter(r => r.gp).map(r => `<tr><td class="l">${CS.teamRow(L, r.tid)}</td><td>${(r.pf / r.gp).toFixed(1)}</td><td>${(r.pa / r.gp).toFixed(1)}</td></tr>`).join('')}</table></div></div>`;
  }
  CS.act.leadKey = d => { CS.ui.lead = d.a; CS.render(); };

  function histView(L) {
    if (!L.hist.length) return `<div class="panel"><div class="h">History</div><div class="note">Past seasons show up here after the first season finishes.</div></div>`;
    return L.hist.slice().reverse().map(h => `<div class="panel"><div class="h">${h.year} <small>${esc(h.tidNames[h.champ] || '')} champions</small></div>
      <div class="note">Runner-up: ${esc(h.tidNames[h.runner] || '-')}${h.topTd ? ' · TD leader: ' + esc(h.topTd.name) + ' (' + h.topTd.n + ')' : ''}${h.topQb ? ' · Passing TDs: ' + esc(h.topQb.name) + ' (' + h.topQb.n + ')' : ''}</div>
      <div class="tscroll"><table class="tbl"><tr><th>Team</th><th>W-L</th><th>PF</th><th>PA</th></tr>${h.table.map(r => `<tr><td class="l">${esc(h.tidNames[r.tid] || r.tid)}</td><td>${r.w}-${r.l}${r.t ? '-' + r.t : ''}</td><td>${r.pf}</td><td>${r.pa}</td></tr>`).join('')}</table></div></div>`).join('');
  }
})();
