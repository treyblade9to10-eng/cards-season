// CARDS SEASON ui shell: router, modal, toast, shared components, home + new league screens.
(function () {
  const { esc, money } = CS;
  CS.views = {}; CS.act = {}; CS.bind = {};
  CS.L = null;
  CS.ui = { nl: null, cardF: { st: 'fa', pos: '', q: '', sort: 'ovr', add: false, bulk: false }, qa: { pos: 'WR', nfl: '', sub: '', name: '', ovr: '', age: '' },
    draftTab: 'log', draftF: { pos: '', q: '' }, df: { name: '', pos: '', sub: '', ovr: '', age: '', nfl: '' }, trade: null, seasonTab: 'games', wk: null, teamSort: 'rec', cm: 'teams' };

  // ---------- routing ----------
  CS.route = () => {
    const p = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    if (!p[0]) return { page: 'home' };
    if (p[0] === 'new') return { page: 'new' };
    if (p[0] === 'l') return { page: 'league', id: p[1], tab: p[2] || 'hub', arg: p[3] };
    return { page: 'home' };
  };
  CS.go = path => { location.hash = '#/' + path; };
  CS.lgo = (tab, arg) => { CS.go('l/' + CS.L.id + '/' + tab + (arg ? '/' + arg : '')); };

  // ---------- shared pieces ----------
  CS.tlogo = (L, tid, s) => {
    const t = CS.team(L, tid); s = s || 34;
    if (!t || !t.base) return `<span class="lg plain" style="--s:${s}px">${esc(((t && t.mgr) || '?')[0].toUpperCase())}</span>`;
    return CS.nlogo(t.base.nfl, s);
  };
  CS.nlogo = (abbr, s) => {
    const n = CS.NFL[abbr]; if (!n) return `<span class="lg plain" style="--s:${s || 34}px">?</span>`;
    return `<span class="lg" style="--s:${s || 34}px;--c1:${n.c1};--c2:${n.c2}">${esc(abbr)}<img src="${CS.logoUrl(abbr)}" alt="" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"></span>`;
  };
  CS.tcolor = (L, tid) => { const t = CS.team(L, tid); return t && t.base ? CS.NFL[t.base.nfl].c1 : '#3a4256'; };
  CS.posLabel = p => p.pos + (p.sub ? ' ' + p.sub : '');
  // a player card row. o: {acts:html, tags:html, mini:bool, sel:bool, meta:string}
  CS.pcard = (L, p, o) => {
    o = o || {};
    const n = p.nfl ? CS.NFL[p.nfl] : null, tc = n ? n.c1 : '#444';
    const k = p.tid ? ` · ${money(p.sal)} × ${p.yrs}y` : '';
    return `<div class="pc ${CS.tier(p.ovr)}${o.mini ? ' mini' : ''}${o.sel ? ' sel' : ''}" style="--tc:${tc}"${o.attr || ''}>
      <div class="ov"><b>${p.ovr}</b><i>${esc(p.pos)}</i></div>
      <div style="min-width:0"><div class="nm">${esc(p.name)}</div>
        <div class="mt">${o.tags || ''}${esc(CS.posLabel(p))} · age ${p.age}${n ? ' · ' + n.id : ''}${k}${o.meta ? ' · ' + o.meta : ''}</div></div>
      <div class="ac">${o.acts || ''}</div></div>`;
  };
  CS.emptyCard = slot => `<div class="pc empty"><div class="ov"><b>--</b><i>${slot}</i></div><div><div class="nm dim">Open ${slot} spot</div><div class="mt">Sign a free agent or draft one</div></div><div></div></div>`;
  CS.rbar = (name, v, max) => `<div class="rbar"><span class="lbl">${name}</span><div class="t"><i style="width:${CS.clamp((v - 40) / ((max || 100) - 40) * 100, 0, 100)}%"></i></div><b>${Math.round(v)}</b></div>`;
  CS.nflOptions = (sel, takenBy, L) => '<option value="">Pick NFL team</option>' + CS.NFL_LIST.map(n => {
    const t = takenBy && L && L.teams.find(x => x.base && x.base.nfl === n.id);
    return `<option value="${n.id}"${n.id === sel ? ' selected' : ''}${t ? ' disabled' : ''}>${esc(n.full)}${t ? ' (' + esc(t.mgr) + ')' : ''}</option>`;
  }).join('');
  CS.phaseLabel = L => {
    switch (L.phase) {
      case 'setup': return 'Card pool';
      case 'draft': return (L.draft && L.draft.year) + ' draft';
      case 'season': { const w = CS.curWeek(L); return w < 0 ? 'Season done' : 'Week ' + (w + 1) + ' of ' + L.season.weeks.length; }
      case 'playoffs': return L.season && L.season.champ ? 'Champions' : 'Playoffs';
      case 'resign': return 'Re-sign';
      case 'fa': return 'Free agency';
    }
    return '';
  };

  // ---------- modal / toast / confirm ----------
  CS.modal = html => { const m = document.getElementById('modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.add('on'); };
  CS.closeModal = () => { const m = document.getElementById('modal'); m.classList.remove('on'); m.innerHTML = ''; };
  let tt;
  CS.toast = (msg, bad) => { const t = document.getElementById('toast'); t.textContent = msg; t.className = 'on' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => { t.className = ''; }, bad ? 3800 : 2200); };
  CS.confirm = (title, body, okLabel, cb, danger) => {
    CS._cb = cb;
    CS.modal(`<div class="h">${esc(title)}</div><div class="note sp">${body}</div><div class="row sp"><button class="btn block" data-act="closeModal">Cancel</button><button class="btn block ${danger ? 'red' : 'gold'}" data-act="confirmYes">${esc(okLabel)}</button></div>`);
  };
  CS.act.confirmYes = () => { const cb = CS._cb; CS._cb = null; CS.closeModal(); if (cb) cb(); };
  CS.act.closeModal = () => CS.closeModal();
  // result handler: runs retry(true) if the commissioner chooses to override rule problems
  CS.guard = (res, retry, okMsg) => {
    if (res.ok) { CS.save(); CS.render(); if (okMsg) CS.toast(okMsg); return true; }
    if (res.needsOk) {
      CS._cb = () => { const r2 = retry(true); if (r2.ok) { CS.save(); CS.render(); if (okMsg) CS.toast(okMsg); } else CS.toast(r2.msg, true); };
      CS.modal(`<div class="h red">Rule problem</div>${res.issues.map(i => `<div class="issue sp">${esc(i)}</div>`).join('')}
        <div class="note sp">You're the commissioner, so you can override this.</div>
        <div class="row sp"><button class="btn block" data-act="closeModal">Cancel</button><button class="btn block gold" data-act="confirmYes">Override</button></div>`);
      return false;
    }
    CS.toast(res.msg || 'Could not do that.', true); return false;
  };
  CS.commit = () => { CS.save(); CS.render(); };

  // ---------- render ----------
  const TABS = [['hub', 'Hub'], ['teams', 'Teams'], ['draft', 'Draft'], ['trades', 'Trades'], ['season', 'Season'], ['cards', 'Cards'], ['commish', 'Commish']];
  CS.render = keep => {
    const app = document.getElementById('app'), y = window.scrollY, r = CS.route();
    let html = ''; CS.L = null;
    if (r.page === 'home') html = homeView();
    else if (r.page === 'new') html = newView();
    else {
      const L = CS.league(r.id);
      if (!L) { CS.go(''); return; }
      CS.L = L;
      const tab = r.tab === 'team' ? 'teams' : r.tab, view = CS.views[r.tab] || CS.views.hub;
      html = `<div class="top"><a class="back" href="#/" data-nav><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 2L4 8l6 6" fill="none" stroke="#eef1f7" stroke-width="2.4"/></svg></a>
        <div class="grow"><div class="ttl">${esc(L.name)}</div><div class="sub">${L.year} season · ${L.teams.length} teams</div></div><span class="phase">${esc(CS.phaseLabel(L))}</span></div>
        ${view(L, r)}
        <nav class="tabs">${TABS.map(t => `<a href="#/l/${L.id}/${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</a>`).join('')}</nav>`;
    }
    app.innerHTML = html;
    window.scrollTo(0, keep === false ? 0 : y);
    if (CS.after) { const f = CS.after; CS.after = null; f(); }
  };

  // ---------- home ----------
  function homeView() {
    const ls = CS.db.order.map(id => CS.db.leagues[id]).filter(Boolean);
    return `<div class="logo"><div class="a">Cards</div><div class="b">Season<span class="bar"></span></div></div>
      <div class="tagline">Draft your real cards. Run the whole league.</div>
      <div class="col sp">${ls.map(L => {
        const champ = L.hist.length ? L.hist[L.hist.length - 1] : null;
        return `<div class="lcard" data-act="openLeague" data-a="${L.id}"><div class="grow"><div class="tname">${esc(L.name)}</div>
          <div class="mgr">${L.teams.length} teams · ${L.players.length} cards · ${L.year} · ${esc(CS.phaseLabel(L))}${champ ? ' · ' + champ.year + ' champs: ' + esc(champ.tidNames[champ.champ] || '') : ''}</div></div>
          <svg width="18" height="18" viewBox="0 0 16 16"><path d="M6 2l6 6-6 6" fill="none" stroke="#8a93a6" stroke-width="2.4"/></svg></div>`;
      }).join('')}</div>
      <div class="col sp"><button class="btn gold block" data-act="goNew" style="font-size:20px;padding:13px">New league</button>
      <div class="center"><span class="link" data-act="importLeague">Import a saved league file</span></div></div>
      <div class="center faint small sp">Cards Season v${CS.VER} · saved on this device</div>
      <input type="file" id="impFile" accept=".json,application/json" style="display:none">`;
  }
  CS.act.openLeague = d => CS.go('l/' + d.a + '/hub');
  CS.act.goNew = () => { const n = 6; CS.ui.nl = { name: 'Cards Season', n, mgrs: Array(16).fill(''), cap: 110, rounds: 2, copy: '' }; CS.go('new'); };
  CS.act.importLeague = () => { const f = document.getElementById('impFile'); f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { const L = CS.importLeague(rd.result); CS.toast('Imported ' + L.name); CS.render(); } catch (e) { CS.toast(e.message, true); } }; rd.readAsText(file); }; f.click(); };

  // ---------- new league ----------
  function newView() {
    const s = CS.ui.nl || (CS.ui.nl = { name: 'Cards Season', n: 6, mgrs: Array(16).fill(''), cap: 110, rounds: 2, copy: '' });
    const others = CS.db.order.map(id => CS.db.leagues[id]).filter(Boolean);
    const games = (s.n % 2 ? s.n - 1 : s.n - 1) * s.rounds;
    return `<div class="top"><a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 2L4 8l6 6" fill="none" stroke="#eef1f7" stroke-width="2.4"/></svg></a><div class="ttl">New league</div></div>
      <div class="panel"><label class="f">League name<input type="text" data-bind="nlName" value="${esc(s.name)}"></label>
        <div class="lbl sp">How many teams?</div>
        <div class="stepper"><button data-act="nlN" data-a="-1">&minus;</button><b>${s.n}</b><button data-act="nlN" data-a="1">+</button><span class="dim small">2 to 16 teams</span></div></div>
      <div class="panel"><div class="h">Who is playing?</div><div class="note">Type each person's name. Their team name comes from the QB they draft.</div>
        <div class="g2">${Array.from({ length: s.n }, (_, i) => `<label class="f">Team ${i + 1}<input type="text" data-bind="nlMgr" data-i="${i}" value="${esc(s.mgrs[i])}" placeholder="Player ${i + 1}"></label>`).join('')}</div></div>
      <div class="panel"><div class="h">Season</div>
        <div class="lbl">Games against each opponent</div>
        <div class="seg">${[1, 2, 3].map(r => `<button class="${s.rounds === r ? 'on' : ''}" data-act="nlRounds" data-a="${r}">${r}x</button>`).join('')}</div>
        <div class="note">${games} games per team, then the playoffs.</div>
        <label class="f sp">Salary cap ($M per team)<input type="number" inputmode="decimal" data-bind="nlCap" value="${s.cap}"></label>
        ${others.length ? `<label class="f">Start with the cards from another league<select data-bind="nlCopy"><option value="">No, start empty</option>${others.map(o => `<option value="${o.id}"${s.copy === o.id ? ' selected' : ''}>${esc(o.name)} (${o.players.length} cards)</option>`).join('')}</select></label>` : ''}</div>
      <button class="btn gold block sp" style="font-size:20px;padding:13px" data-act="createLeague">Create league</button>`;
  }
  CS.bind.nlName = v => { CS.ui.nl.name = v; };
  CS.bind.nlMgr = (v, el) => { CS.ui.nl.mgrs[+el.dataset.i] = v; };
  CS.bind.nlCap = v => { CS.ui.nl.cap = Math.max(20, +v || 110); };
  CS.bind.nlCopy = v => { CS.ui.nl.copy = v; };
  CS.act.nlN = d => { const s = CS.ui.nl; s.n = CS.clamp(s.n + +d.a, 2, 16); CS.render(); };
  CS.act.nlRounds = d => { CS.ui.nl.rounds = +d.a; CS.render(); };
  CS.act.createLeague = () => {
    const s = CS.ui.nl, mgrs = Array.from({ length: s.n }, (_, i) => CS.cleanName(s.mgrs[i]) || 'Player ' + (i + 1));
    const dupe = mgrs.find((m, i) => mgrs.indexOf(m) !== i);
    if (dupe) return CS.toast('Two teams are named "' + dupe + '". Give each person a different name.', true);
    const L = CS.createLeague({ name: s.name, mgrs, cap: s.cap, rounds: s.rounds, copyFrom: s.copy });
    CS.ui.nl = null; CS.toast('League created. Add your cards next.'); CS.go('l/' + L.id + '/cards');
  };

  // ---------- boot ----------
  CS.start = () => {
    CS.load();
    CS.onSaveError = () => CS.toast('Could not save: the browser storage is full.', true);
    document.addEventListener('click', e => {
      if (e.target.id === 'modal') return CS.closeModal();
      const el = e.target.closest('[data-act]'); if (!el) return;
      const f = CS.act[el.dataset.act]; if (!f) return;
      e.preventDefault(); f(el.dataset, el, e);
    });
    const onIn = e => {
      const el = e.target.closest('[data-bind]'); if (!el) return;
      const f = CS.bind[el.dataset.bind]; if (!f) return;
      const isText = el.matches('input[type=text],input[type=number],input[type=search],textarea');
      if (isText && e.type === 'change') { if (f(el.type === 'checkbox' ? el.checked : el.value, el, e) === true) CS.render(); return; }
      if (isText && e.type === 'input') { if (f(el.value, el, e) === true) { const id = el.id; CS.after = () => { const x = document.getElementById(id); if (x) { x.focus(); try { const l = x.value.length; x.setSelectionRange(l, l); } catch (_) { } } }; CS.render(); } return; }
      if (!isText && e.type === 'change') { if (f(el.type === 'checkbox' ? el.checked : el.value, el, e) === true) CS.render(); }
    };
    document.addEventListener('input', onIn); document.addEventListener('change', onIn);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') CS.closeModal();
      if (e.key === 'Enter' && e.target.matches('[data-enter]')) { e.preventDefault(); const f = CS.act[e.target.dataset.enter]; if (f) f({}, e.target, e); }
    });
    window.addEventListener('hashchange', () => { CS.closeModal(); CS.render(false); });
    CS.render(false);
  };
})();
