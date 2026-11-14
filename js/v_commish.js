// CARDS SEASON view: Commissioner (settings, edit teams, tools, backup, log).
(function () {
  const { esc, money } = CS;

  CS.views.commish = L => {
    const tab = CS.ui.cm, tabs = [['teams', 'Teams'], ['rules', 'Rules'], ['tools', 'Tools'], ['log', 'Log']];
    const head = `<div class="chips scroll sp">${tabs.map(t => `<span class="chip ${tab === t[0] ? 'on' : ''}" data-act="cmTab" data-a="${t[0]}">${t[1]}</span>`).join('')}</div>`;
    return head + (tab === 'rules' ? rules(L) : tab === 'tools' ? tools(L) : tab === 'log' ? log(L) : teams(L));
  };
  CS.act.cmTab = d => { CS.ui.cm = d.a; CS.render(); };

  // ---------- teams ----------
  function teams(L) {
    return `<div class="panel"><div class="h">All teams <small>commissioner</small></div><div class="note">You can see and change everything here. Tap a team to edit its name, manager and base team ratings.</div>
      <div class="tscroll"><table class="tbl"><tr><th>Team</th><th>OVR</th><th>Payroll</th><th>Roster</th><th></th></tr>
      ${L.teams.map(t => `<tr><td class="l">${CS.teamRow(L, t.id)}<div class="mgr">${esc(t.mgr)}</div></td><td><b>${CS.rate(L, t.id).ovr}</b></td><td>${money(CS.payroll(L, t.id))}</td><td>${CS.roster(L, t.id).length}</td><td><button class="btn xs" data-act="editTeam" data-tid="${t.id}">Edit</button> <button class="btn xs cyan" data-act="openTeam" data-tid="${t.id}">Open</button></td></tr>`).join('')}</table></div></div>`;
  }
  CS.act.editTeam = d => CS.editTeamModal(d.tid);
  CS.editTeamModal = tid => {
    const L = CS.L, t = CS.team(L, tid), b = t.base;
    CS._et = tid;
    CS.modal(`<div class="h">Edit ${esc(CS.tname(L, tid))}</div><div class="frm sp">
      <label class="f s3">Manager name<input type="text" id="etMgr" value="${esc(t.mgr)}"></label>
      <label class="f s3">Custom team name (optional)<input type="text" id="etNick" value="${esc(t.nick)}" placeholder="${esc(b ? CS.NFL[b.nfl].full : '')}"></label>
      <label class="f s6">Base team (from the QB)<select id="etNfl" data-bind="etNfl"><option value="">None yet</option>${CS.NFL_LIST.map(n => { const o = L.teams.find(x => x.base && x.base.nfl === n.id && x.id !== tid); return `<option value="${n.id}"${b && b.nfl === n.id ? ' selected' : ''}${o ? ' disabled' : ''}>${esc(n.full)}${o ? ' (' + esc(o.mgr) + ')' : ''}</option>`; }).join('')}</select></label>
      <label class="f s3">Defense<input type="number" id="etDef" value="${b ? b.def : ''}"></label><label class="f s3">Offensive line<input type="number" id="etOl" value="${b ? b.ol : ''}"></label>
      <label class="f s3">Kicker<input type="number" id="etK" value="${b ? b.k : ''}"></label><label class="f s3">Punter<input type="number" id="etP" value="${b ? b.p : ''}"></label>
      <label class="f s6">Notes<input type="text" id="etNotes" value="${esc(t.notes)}"></label></div>
      <div class="note sp">Changing the base team loads that team's real defense, line, kicker and punter ratings. Then you can change the numbers.</div>
      <div class="row sp"><button class="btn" data-act="clearStarters" data-tid="${tid}">Reset lineup</button><button class="btn grow" data-act="closeModal">Cancel</button><button class="btn gold grow" data-act="saveTeam">Save</button></div>`);
  };
  CS.bind.etNfl = v => {
    const n = CS.NFL[v]; if (!n) return;
    ['etDef', 'etOl', 'etK', 'etP'].forEach((id, i) => { document.getElementById(id).value = [n.def, n.ol, n.k, n.p][i]; });
  };
  CS.act.clearStarters = d => { CS.clearStarters(CS.L, d.tid); CS.commit(); CS.toast('Lineup is automatic again.'); };
  CS.act.saveTeam = () => {
    const L = CS.L, t = CS.team(L, CS._et), v = id => document.getElementById(id).value;
    const mgr = CS.cleanName(v('etMgr')); if (!mgr) return CS.toast('Give the manager a name.', true);
    if (L.teams.some(x => x.id !== t.id && x.mgr.toLowerCase() === mgr.toLowerCase())) return CS.toast('Another team has that manager name.', true);
    t.mgr = mgr; t.nick = CS.cleanName(v('etNick')); t.notes = v('etNotes');
    const nfl = v('etNfl');
    if (nfl) {
      const num = (id, d) => CS.clamp(Math.round(+v(id) || d), 30, 99);
      const n = CS.NFL[nfl]; t.base = { nfl, def: num('etDef', n.def), ol: num('etOl', n.ol), k: num('etK', n.k), p: num('etP', n.p) };
    } else t.base = null;
    CS.closeModal(); CS.commit(); CS.toast('Team saved.');
  };

  // ---------- rules ----------
  const SET = [['cap', 'Salary cap ($M)', 20, 500], ['maxRoster', 'Max roster size', 7, 30], ['fRounds', 'Rounds in future drafts', 1, 7], ['rookieYrs', 'Rookie contract (years)', 1, 6]];
  function rules(L) {
    const s = L.settings, n = L.teams.length;
    const po = [0, 2, 4, 8, 16].filter(x => x === 0 || x <= n);
    return `<div class="panel"><div class="h">League rules</div>
      <label class="f">League name<input type="text" data-bind="setName" value="${esc(L.name)}"></label>
      <div class="g2">${SET.map(f => `<label class="f">${f[1]}<input type="number" inputmode="numeric" data-bind="set" data-k="${f[0]}" data-min="${f[2]}" data-max="${f[3]}" value="${s[f[0]]}"></label>`).join('')}
      <label class="f">Playoff teams<select data-bind="setPo">${po.map(x => `<option value="${x}"${s.playoffs === x ? ' selected' : ''}>${x ? 'Top ' + x : 'Automatic (' + CS.playoffSize(L) + ')'}</option>`).join('')}</select></label>
      <label class="f">Games vs each team<select data-bind="setRounds" ${L.season ? 'disabled' : ''}>${[1, 2, 3, 4].map(x => `<option${s.rounds === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <label class="row sp"><input type="checkbox" data-bind="setChk" data-k="progress" ${s.progress ? 'checked' : ''}><span>Cards change every offseason (young players improve, older ones decline, old players retire)</span></label>
      <label class="row"><input type="checkbox" data-bind="setChk" data-k="hfa" ${s.hfa !== false ? 'checked' : ''}><span>Home teams get a small edge</span></label>
      <div class="note">Rule changes apply right away. Games per opponent is locked once the season starts.</div></div>`;
  }
  CS.bind.setName = v => { const L = CS.L; L.name = CS.cleanName(v) || L.name; CS.save(); };
  CS.bind.set = (v, el) => { const L = CS.L, x = Math.round(+v); if (!(x >= +el.dataset.min && x <= +el.dataset.max)) return; L.settings[el.dataset.k] = x; CS.save(); };
  CS.bind.setPo = v => { CS.L.settings.playoffs = +v; CS.save(); };
  CS.bind.setRounds = v => { CS.L.settings.rounds = +v; CS.save(); };
  CS.bind.setChk = (v, el) => { CS.L.settings[el.dataset.k] = !!el.checked; CS.save(); };

  // ---------- tools ----------
  function tools(L) {
    return `<div class="panel"><div class="h">Draft picks</div><div class="note">Move a pick from one team to another without a trade, or add picks for another year.</div>
        <div class="row"><button class="btn" data-act="movePick">Move a pick</button><button class="btn" data-act="addPickYear">Add a year of picks</button></div></div>
      ${L.season ? `<div class="panel"><div class="h">Season</div><div class="note">Start the schedule over. Every game result is erased (records, scores and stat leaders reset).</div><button class="btn red" data-act="resetSeason">Restart this season</button></div>` : ''}
      <div class="panel"><div class="h">Backup</div><div class="note">Your league is saved on this device. Download a file so you can restore it or move it to another device.</div>
        <div class="row"><button class="btn gold" data-act="exportLeague">Download league file</button></div></div>
      <div class="panel"><div class="h red">Danger zone</div><button class="btn red" data-act="delLeague">Delete this league</button></div>`;
  }
  CS.act.exportLeague = () => {
    const L = CS.L, blob = new Blob([CS.exportLeague(L)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'cards-season-' + L.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + L.year + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  CS.act.delLeague = () => CS.confirm('Delete "' + CS.L.name + '"?', 'All teams, cards, contracts and history in this league are gone. Download a backup first if you might want it.', 'Delete forever', () => { CS.deleteLeague(CS.L.id); CS.go(''); }, true);
  CS.act.resetSeason = () => CS.confirm('Restart the season?', 'All games go back to unplayed.', 'Restart', () => {
    const L = CS.L; L.players.forEach(p => { p.st = CS.blankStats(); }); L.season = { year: L.year, weeks: CS.makeSchedule(L), po: null, champ: null }; L.phase = 'season'; CS.log(L, 'The ' + L.year + ' season was restarted.'); CS.commit();
  }, true);
  CS.act.movePick = () => {
    const L = CS.L, picks = L.picks.filter(k => !k.used).sort((a, b) => a.year - b.year || a.round - b.round || a.orig.localeCompare(b.orig));
    CS.modal(`<div class="h">Move a pick</div><label class="f sp">Pick<select id="mpPick">${picks.map(k => `<option value="${k.id}">${esc(CS.pickLabel(L, k, false))} - ${esc(CS.tname(L, k.orig))}'s pick (now ${esc(CS.tname(L, k.owner))})</option>`).join('')}</select></label>
      <label class="f sp">New owner<select id="mpTo">${L.teams.map(t => `<option value="${t.id}">${esc(CS.tfull(L, t.id))}</option>`).join('')}</select></label>
      <div class="row sp"><button class="btn block" data-act="closeModal">Cancel</button><button class="btn gold block" data-act="saveMovePick">Move pick</button></div>`);
  };
  CS.act.saveMovePick = () => {
    const L = CS.L, k = L.picks.find(x => x.id === document.getElementById('mpPick').value), to = document.getElementById('mpTo').value;
    if (!k) return; k.owner = to; CS.log(L, 'Commissioner moved ' + CS.pickLabel(L, k, false) + ' to ' + CS.tname(L, to) + '.'); CS.closeModal(); CS.commit(); CS.toast('Pick moved.');
  };
  CS.act.addPickYear = () => {
    const L = CS.L, y = Math.max(...L.picks.map(k => k.year), L.year) + 1;
    CS.addPicks(L, y, L.settings.fRounds); CS.commit(); CS.toast(y + ' picks added.');
  };

  // ---------- log ----------
  function log(L) {
    return `<div class="panel"><div class="h">Everything that happened <small>${L.log.length}</small></div>${L.log.slice(0, 100).map(n => `<div class="small" style="padding:6px 0;border-bottom:1px solid #1d2331"><span class="faint">${n.y}</span> ${esc(n.m)}</div>`).join('')}</div>`;
  }
})();
