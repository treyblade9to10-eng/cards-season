// CARDS SEASON view: Season (games, table, playoffs, leaders, history) + sim controls.
(function () {
  const { esc, money } = CS;

  // ---------- sim controls (used on Hub and Season) ----------
  CS.simBar = L => {
    if (!L.season) return '<div class="note">No season yet.</div>';
    const all = L.season.weeks.flat(), played = all.filter(g => g.played).length;
    if (L.phase === 'season') {
      const w = CS.curWeek(L);
      if (w < 0) return `<div class="note">Regular season is complete. The top ${CS.playoffSize(L)} teams make the playoffs.</div><button class="btn gold" data-act="startPlayoffs">Start the playoffs</button>`;
      return `<div class="row"><div class="grow"><div class="lbl">Week ${w + 1} of ${L.season.weeks.length} · ${played} of ${all.length} games played</div><div class="bd"><i style="width:${played / all.length * 100}%"></i></div></div></div>
        <div class="rowt"><button class="btn" data-act="simNext">Play next game</button><button class="btn gold" data-act="simWeek">Play week ${w + 1}</button><button class="btn" data-act="simRest">Play rest of season</button></div>`;
    }
    const po = L.season.po, rd = po.rounds[po.rounds.length - 1];
    if (po.champ) return '<div class="note">The playoffs are over.</div>';
    return `<div class="note">${esc(rd.name)}: ${rd.games.map(g => esc(CS.tname(L, g.h)) + ' vs ' + esc(CS.tname(L, g.a))).join(' · ')}</div>
      <div class="rowt"><button class="btn gold" data-act="simRound">Play ${esc(rd.name)}</button><button class="btn" data-act="simPoAll">Play all playoffs</button></div>`;
  };
  CS.showResults = (title, games) => {
    const L = CS.L;
    CS.modal(`<div class="h">${esc(title)}</div><div class="col sp">${games.map(g => CS.gameRow(L, g)).join('')}</div><button class="btn gold block sp" data-act="closeModal">Nice</button>`);
  };
  CS.act.simNext = () => { const g = CS.simNext(CS.L); CS.commit(); if (g) CS.gameModal(g.id); };
  CS.act.simWeek = () => { const L = CS.L, w = CS.curWeek(L), gs = CS.simWeek(L); CS.commit(); CS.showResults('Week ' + (w + 1) + ' scores', gs); };
  CS.act.simRest = () => CS.confirm('Play the rest of the season?', 'Every remaining game is played right now. You can still trade and sign people after.', 'Play it', () => { CS.simRest(CS.L); CS.commit(); CS.toast('Regular season done.'); });
  CS.act.startPlayoffs = () => { CS.startPlayoffs(CS.L); CS.commit(); };
  CS.act.simRound = () => { const rd = CS.simPoRound(CS.L); CS.commit(); if (rd) CS.showResults(rd.name + ' scores', rd.games); };
  CS.act.simPoAll = () => { CS.simPoAll(CS.L); CS.commit(); CS.toast('Playoffs complete.'); };

  // ---------- game modal ----------
  CS.findGame = (L, gid) => {
    if (!L.season) return null;
    for (const w of L.season.weeks) for (const g of w) if (g.id === gid) return g;
    if (L.season.po) for (const r of L.season.po.rounds) for (const g of r.games) if (g.id === gid) return g;
    return null;
  };
  CS.gameModal = gid => {
    const L = CS.L, g = CS.findGame(L, gid); if (!g) return;
    const rh = CS.rate(L, g.h), ra = CS.rate(L, g.a);
    CS.modal(`<div class="game" style="cursor:default">${`<div class="tm">${CS.tlogo(L, g.h, 40)}<span>${esc(CS.tname(L, g.h))}</span></div>`}
      <div class="sc">${g.played ? `${g.hs} <span class="faint">-</span> ${g.as}<small>${g.ot ? 'FINAL/OT' : 'FINAL'}</small>` : '<span class="faint">vs</span>'}</div>
      <div class="tm a"><span>${esc(CS.tname(L, g.a))}</span>${CS.tlogo(L, g.a, 40)}</div></div>
      <div class="small dim center sp">OVR ${rh.ovr} vs ${ra.ovr} · offense ${Math.round(rh.off)} / ${Math.round(ra.off)} · defense ${Math.round(rh.def)} / ${Math.round(ra.def)}</div>
      ${g.played && g.sum && g.sum.length ? `<div class="lbl sp">Scoring</div>${g.sum.map(s => `<div class="sum"><span class="dim">${s.q}</span><span><b>${esc(CS.tname(L, s.tid))}</b> ${esc(s.txt)}</span><span class="right nowrap dim">${s.h}-${s.a}</span></div>`).join('')}` : (g.played ? '<div class="note sp">Score entered by hand.</div>' : '')}
      <div class="row sp">${g.played ? '' : `<button class="btn gold grow" data-act="playOne" data-gid="${g.id}">Play this game</button>`}<button class="btn grow" data-act="editScore" data-gid="${g.id}">${g.played ? 'Fix score' : 'Enter score'}</button><button class="btn" data-act="closeModal">Close</button></div>`);
  };
  CS.act.gameModal = d => CS.gameModal(d.gid);
  CS.act.playOne = d => { const L = CS.L, g = CS.findGame(L, d.gid); CS.playGame(L, g, !!g.po); if (g.po) CS.afterPoGame(L); CS.commit(); CS.gameModal(g.id); };
  CS.afterPoGame = L => { /* playoffs advance from the Sim round buttons */ };
  CS.act.editScore = d => {
    const L = CS.L, g = CS.findGame(L, d.gid);
    CS.modal(`<div class="h">${g.played ? 'Fix' : 'Enter'} the score</div><div class="g2 sp"><label class="f">${esc(CS.tname(L, g.h))}<input type="number" id="esH" inputmode="numeric" value="${g.played ? g.hs : ''}"></label><label class="f">${esc(CS.tname(L, g.a))}<input type="number" id="esA" inputmode="numeric" value="${g.played ? g.as : ''}"></label></div>
      <div class="note">Use this if you played a game for real. It won't add touchdowns to the stat leaders.</div>
      <div class="row sp"><button class="btn block" data-act="closeModal">Cancel</button><button class="btn block gold" data-act="saveScore" data-gid="${g.id}">Save</button></div>`);
  };
  CS.act.saveScore = d => {
    const L = CS.L, g = CS.findGame(L, d.gid), h = +document.getElementById('esH').value, a = +document.getElementById('esA').value;
    if (!(h >= 0) || !(a >= 0) || document.getElementById('esH').value === '' || document.getElementById('esA').value === '') return CS.toast('Type both scores.', true);
    if (g.po && h === a) return CS.toast('A playoff game needs a winner.', true);
    g.hs = Math.round(h); g.as = Math.round(a); g.played = true; g.sum = []; g.ot = false;
    CS.commit(); CS.closeModal(); CS.toast('Score saved.');
  };

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

  function leadView(L) {
    const board = (title, key, label) => {
      const l = CS.leaders(L, key, 8);
      return `<div class="panel"><div class="h">${title}</div>${l.map((p, i) => `<div class="row" style="padding:5px 0;border-bottom:1px solid #1d2331"><b class="cc9 dim" style="width:22px">${i + 1}</b><div class="grow"><b>${esc(p.name)}</b> <span class="dim small">${p.pos} · ${p.tid ? esc(CS.tname(L, p.tid)) : 'free agent'}</span></div><b class="cc9 gold" style="font-size:20px">${p.st[key]}</b></div>`).join('') || '<div class="note">Nobody yet. Play some games.</div>'}</div>`;
    };
    const st = CS.standings(L);
    return board('Touchdowns', 'td') + board('Passing touchdowns', 'ptd') +
      `<div class="panel"><div class="h">Team scoring</div><div class="tscroll"><table class="tbl"><tr><th>Team</th><th>Pts/G</th><th>Allowed/G</th></tr>${st.filter(r => r.gp).map(r => `<tr><td class="l">${CS.teamRow(L, r.tid)}</td><td>${(r.pf / r.gp).toFixed(1)}</td><td>${(r.pa / r.gp).toFixed(1)}</td></tr>`).join('')}</table></div></div>`;
  }

  function histView(L) {
    if (!L.hist.length) return `<div class="panel"><div class="h">History</div><div class="note">Past seasons show up here after the first season finishes.</div></div>`;
    return L.hist.slice().reverse().map(h => `<div class="panel"><div class="h">${h.year} <small>${esc(h.tidNames[h.champ] || '')} champions</small></div>
      <div class="note">Runner-up: ${esc(h.tidNames[h.runner] || '-')}${h.topTd ? ' · TD leader: ' + esc(h.topTd.name) + ' (' + h.topTd.n + ')' : ''}${h.topQb ? ' · Passing TDs: ' + esc(h.topQb.name) + ' (' + h.topQb.n + ')' : ''}</div>
      <div class="tscroll"><table class="tbl"><tr><th>Team</th><th>W-L</th><th>PF</th><th>PA</th></tr>${h.table.map(r => `<tr><td class="l">${esc(h.tidNames[r.tid] || r.tid)}</td><td>${r.w}-${r.l}${r.t ? '-' + r.t : ''}</td><td>${r.pf}</td><td>${r.pa}</td></tr>`).join('')}</table></div></div>`).join('');
  }
})();
