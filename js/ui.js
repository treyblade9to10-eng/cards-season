// CARDS SEASON ui shell: router, modal, toast, shared components, home + new league screens.
(function () {
  const { esc, money } = CS;
  CS.views = {}; CS.act = {}; CS.bind = {};
  CS.L = null;
  CS.ui = { nl: null, cardF: { st: 'fa', pos: '', q: '', sort: 'ovr', add: false, bulk: false }, qa: { pos: 'WR', nfl: '', sub: '', name: '', ovr: '', age: '' },
    draftTab: null, draftF: { pos: '', q: '' }, df: { name: '', pos: '', sub: '', ovr: '', age: '', nfl: '' }, trade: null, seasonTab: 'games', wk: null, teamSort: 'rec', cm: 'teams' };

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
    let html = ''; CS.L = null; CS._sm = null;
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
    CS._r = true; try { app.innerHTML = html; } finally { CS._r = false; }
    window.scrollTo(0, keep === false ? 0 : y);
    if (CS.after) { const f = CS.after; CS.after = null; f(); }
  };

  // ---------- home ----------
  const FAN = [['WR', 96, '#c60c30', '#00338d', 'Deep threat'], ['QB', 99, '#ffc93c', '#7a5a00', 'Franchise QB'], ['DEF', 94, '#33c4ff', '#004c6d', 'Lockdown']];
  const fanCard = (c, i) => `<div class="fc fc${i}" style="--a:${c[2]};--b:${c[3]}"><div class="fct"><b>${c[1]}</b><span>${c[0]}</span></div><div class="fcm"><svg viewBox="0 0 60 60"><circle cx="30" cy="22" r="11" fill="rgba(255,255,255,.85)"/><path d="M10 58c2-14 10-21 20-21s18 7 20 21z" fill="rgba(255,255,255,.85)"/></svg></div><div class="fcn">${c[4]}</div></div>`;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent), standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  function leagueCard(L, big) {
    const champ = L.hist.length ? L.hist[L.hist.length - 1] : null, st = L.season ? CS.standings(L) : null, top = st && st[0] && st[0].gp ? st[0] : null;
    const logos = L.teams.filter(t => t.base).slice(0, 8).map(t => CS.nlogo(t.base.nfl, big ? 30 : 22)).join('');
    return `<div class="lcard${big ? ' big' : ''}" data-act="openLeague" data-a="${L.id}">
      <div class="grow">${big ? '<div class="lbl gold">Continue</div>' : ''}<div class="tname"${big ? ' style="font-size:28px"' : ''}>${esc(L.name)}</div>
        <div class="mgr">${L.year} · ${L.teams.length} teams · <b class="gold">${esc(CS.phaseLabel(L))}</b>${top ? ' · 1st: ' + esc(CS.tname(L, top.tid)) + ' ' + top.w + '-' + top.l : ''}${champ ? ' · ' + champ.year + ' champs: ' + esc(champ.tidNames[champ.champ] || '') : ''}</div>
        ${logos ? `<div class="lgrow">${logos}</div>` : ''}</div>
      <svg width="20" height="20" viewBox="0 0 16 16"><path d="M6 2l6 6-6 6" fill="none" stroke="${big ? '#ffc93c' : '#8a93a6'}" stroke-width="2.4"/></svg></div>`;
  }
  function homeView() {
    const ls = CS.db.order.map(id => CS.db.leagues[id]).filter(Boolean);
    const hint = isIOS && !standalone && !localStorage.getItem('cs_nohint');
    return `<div class="hero2${ls.length ? ' sm' : ''}"><div class="fan">${FAN.map(fanCard).join('')}</div>
        <div class="logo"><div class="a">Cards</div><div class="b">Season<span class="bar"></span></div></div>
        <div class="tagline">Draft your cards. Play the games. Run the league.</div></div>
      ${ls.length ? `<div class="col sp">${leagueCard(ls[0], true)}${ls.slice(1).map(L => leagueCard(L, false)).join('')}</div>` :
        `<div class="steps sp">${[['1', 'Draft', 'Your cards, the current NFL or all-time legends. QB first: his team is your base.'], ['2', 'Play', 'Play your games for real and type in the scores. Blanks get simulated.'], ['3', 'Run it', 'Contracts, a $300M cap, trades with picks, free agency, new seasons.']].map(s => `<div class="step"><b>${s[0]}</b><div><div class="cc9" style="font-size:19px">${s[1]}</div><div class="note">${s[2]}</div></div></div>`).join('')}</div>`}
      <div class="col sp"><button class="btn gold block" data-act="goNew" style="font-size:21px;padding:14px">${ls.length ? 'Start another league' : 'Start a league'}</button>
      <div class="center"><span class="link" data-act="importLeague">Import a saved league file</span></div></div>
      ${hint ? `<div class="panel flat inst"><div class="row"><img src="icons/icon-180.png" width="44" height="44" alt=""><div class="grow"><b>Put it on your home screen</b><div class="note">Tap the Share button, then "Add to Home Screen". It opens full screen like an app.</div></div><button class="btn xs" data-act="noHint">OK</button></div></div>` : ''}
      <div class="center faint small sp">Cards Season v${CS.VER} · saved on this device</div>
      <input type="file" id="impFile" accept=".json,application/json" style="display:none">`;
  }
  CS.act.noHint = () => { localStorage.setItem('cs_nohint', '1'); CS.render(); };
  CS.act.openLeague = d => CS.go('l/' + d.a + '/hub');
  CS.act.goNew = () => { const n = 6; CS.ui.nl = { name: 'Cards Season', n, mgrs: Array(16).fill(''), cap: 300, rounds: 2, copy: '', pool: 'own' }; CS.go('new'); };
  CS.act.importLeague = () => { const f = document.getElementById('impFile'); f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { const L = CS.importLeague(rd.result); CS.toast('Imported ' + L.name); CS.render(); } catch (e) { CS.toast(e.message, true); } }; rd.readAsText(file); }; f.click(); };

  // ---------- new league ----------
  function newView() {
    const s = CS.ui.nl || (CS.ui.nl = { name: 'Cards Season', n: 6, mgrs: Array(16).fill(''), cap: 300, rounds: 2, copy: '', pool: 'own' });
    const others = CS.db.order.map(id => CS.db.leagues[id]).filter(Boolean);
    const games = (s.n % 2 ? s.n - 1 : s.n - 1) * s.rounds;
    return `<div class="top"><a class="back" href="#/"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M10 2L4 8l6 6" fill="none" stroke="#eef1f7" stroke-width="2.4"/></svg></a><div class="ttl">New league</div></div>
      <div class="panel"><label class="f">League name<input type="text" data-bind="nlName" value="${esc(s.name)}"></label>
        <div class="lbl sp">How many teams?</div>
        <div class="stepper"><button data-act="nlN" data-a="-1">&minus;</button><b>${s.n}</b><button data-act="nlN" data-a="1">+</button><span class="dim small">2 to 16 teams</span></div></div>
      <div class="panel"><div class="h">Who is playing?</div><div class="note">Type each person's name. Their team name comes from the QB they draft.</div>
        <div class="g2">${Array.from({ length: s.n }, (_, i) => `<label class="f">Team ${i + 1}<input type="text" data-bind="nlMgr" data-i="${i}" value="${esc(s.mgrs[i])}" placeholder="Player ${i + 1}"></label>`).join('')}</div></div>
      <div class="panel"><div class="h">Card pool</div><div class="note">Where do the cards you draft from come from?</div>
        <div class="col" style="gap:8px">${[{ id: 'own', name: 'My own cards', blurb: 'Type in the cards you have at home. You can also load a preset pool later.' }].concat(CS.POOLS).map(p => `<div class="pc mini ${s.pool === p.id ? 'sel' : ''}" style="--tc:${s.pool === p.id ? '#ffc93c' : '#3a4256'};cursor:pointer;grid-template-columns:1fr auto" data-act="nlPool" data-a="${p.id}"><div style="padding-left:10px"><div class="nm">${esc(p.name)}</div><div class="mt">${esc(p.blurb)}</div></div><div class="ac"><span class="chip ${s.pool === p.id ? 'on' : ''}">${p.id === 'own' ? 'You add' : CS.poolCount(p.id) + ' cards'}</span></div></div>`).join('')}</div></div>
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
  CS.bind.nlCap = v => { CS.ui.nl.cap = Math.max(50, +v || 300); };
  CS.bind.nlCopy = v => { CS.ui.nl.copy = v; };
  CS.act.nlN = d => { const s = CS.ui.nl; s.n = CS.clamp(s.n + +d.a, 2, 16); CS.render(); };
  CS.act.nlPool = d => { const s = CS.ui.nl; s.pool = d.a; if (s.cap === 300 || s.cap === 330) s.cap = (d.a === 'all' || d.a === 'both') ? 330 : 300; CS.render(); };
  CS.act.nlRounds = d => { CS.ui.nl.rounds = +d.a; CS.render(); };
  CS.act.createLeague = () => {
    const s = CS.ui.nl, mgrs = Array.from({ length: s.n }, (_, i) => CS.cleanName(s.mgrs[i]) || 'Player ' + (i + 1));
    const dupe = mgrs.find((m, i) => mgrs.indexOf(m) !== i);
    if (dupe) return CS.toast('Two teams are named "' + dupe + '". Give each person a different name.', true);
    const L = CS.createLeague({ name: s.name, mgrs, cap: s.cap, rounds: s.rounds, copyFrom: s.copy, pool: s.pool });
    CS.ui.nl = null; CS.toast(s.pool === 'own' ? 'League created. Add your cards next.' : 'League created with ' + L.players.length + ' cards.'); CS.go('l/' + L.id + '/' + (s.pool === 'own' ? 'cards' : 'draft'));
  };

  // ---------- boot ----------
  CS.start = () => {
    CS.load();
    let mig = 0; Object.values(CS.db.leagues).forEach(L => { if (CS.migrateMoney(L)) mig++; }); if (mig) CS.save();
    CS.onSaveError = () => CS.toast('Could not save: the browser storage is full.', true);
    document.addEventListener('click', e => {
      if (e.target.id === 'modal') return CS.closeModal();
      const el = e.target.closest('[data-act]'); if (!el) return;
      const f = CS.act[el.dataset.act]; if (!f) return;
      e.preventDefault(); f(el.dataset, el, e);
    });
    const onIn = e => {
      if (CS._r) return; // the browser fires 'change' on an input that is being replaced by a render
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
