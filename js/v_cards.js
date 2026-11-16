// CARDS SEASON view: Cards (your card pool, add cards, free agency, edit a card).
(function () {
  const { esc, money } = CS;

  CS.views.cards = L => {
    const F = CS.ui.cardF, qa = CS.ui.qa;
    const all = L.players, fa = all.filter(p => !p.tid);
    let list = F.st === 'fa' ? fa : F.st === 'team' ? all.filter(p => p.tid) : all.slice();
    if (F.pos) list = list.filter(p => p.pos === F.pos);
    if (F.q) { const q = F.q.toLowerCase(); list = list.filter(p => p.name.toLowerCase().includes(q) || (p.nfl || '').toLowerCase() === q); }
    const sorts = { ovr: (a, b) => b.ovr - a.ovr, age: (a, b) => a.age - b.age, name: (a, b) => a.name.localeCompare(b.name), ask: (a, b) => CS.askSal(b) - CS.askSal(a) };
    list.sort(sorts[F.sort] || sorts.ovr);
    const lim = F.lim || 40, shown = list.slice(0, lim);
    const fa2 = L.phase === 'fa';
    return `<div class="panel"><div class="h">Add cards <small>${all.length} in the pool</small></div>
      <div class="chips"><span class="chip ${!F.bulk ? 'on' : ''}" data-act="cBulk" data-a="0">One card</span><span class="chip ${F.bulk ? 'on' : ''}" data-act="cBulk" data-a="1">Paste a list</span></div>
      ${F.bulk ? bulkForm() : `<div class="frm"><label class="f s6">Player name<input type="text" id="qaName" data-bind="qaName" data-enter="addCard" autocomplete="off" autocapitalize="words" value="${esc(qa.name)}" placeholder="Name on the card"></label>
        <div class="s6"><div class="lbl" style="margin-bottom:4px">Position</div><div class="seg">${CS.POS.map(p => `<button class="${qa.pos === p ? 'on' : ''}" data-act="qaPos" data-a="${p}">${p}</button>`).join('')}</div></div>
        ${qa.pos === 'DEF' ? `<div class="s6"><div class="lbl" style="margin-bottom:4px">Type (optional)</div><div class="chips">${CS.SUBS.map(s => `<span class="chip ${qa.sub === s ? 'on' : ''}" data-act="qaSub" data-a="${s}">${s}</span>`).join('')}</div></div>` : ''}
        <label class="f s2">Overall<input type="number" id="qaOvr" data-bind="qaOvr" data-enter="addCard" inputmode="numeric" value="${esc(qa.ovr)}" placeholder="85"></label>
        <label class="f s2">Age<input type="number" id="qaAge" data-bind="qaAge" data-enter="addCard" inputmode="numeric" value="${esc(qa.age)}" placeholder="26"></label>
        <label class="f s2">NFL team<select data-bind="qaNfl">${CS.nflOptions(qa.nfl)}</select></label></div>
        <button class="btn gold block" data-act="addCard" style="font-size:18px;padding:11px">Add card</button>
        <div class="note">The NFL team on the card matters for QBs: it becomes the base team when drafted.</div>`}</div>
      ${presetPanel(L)}
      <div class="panel"><div class="h">${fa2 ? 'Free agency' : 'Card pool'} <small>${list.length} shown</small></div>
        <div class="chips">${[['fa', 'Free agents (' + fa.length + ')'], ['team', 'On teams (' + (all.length - fa.length) + ')'], ['all', 'All']].map(s => `<span class="chip ${F.st === s[0] ? 'on' : ''}" data-act="cSt" data-a="${s[0]}">${s[1]}</span>`).join('')}</div>
        <div class="chips"><span class="chip ${!F.pos ? 'on' : ''}" data-act="cPos" data-a="">All</span>${CS.POS.map(p => `<span class="chip ${F.pos === p ? 'on' : ''}" data-act="cPos" data-a="${p}">${p}</span>`).join('')}</div>
        <div class="g2"><input type="search" id="cQ" data-bind="cQ" placeholder="Search name or NFL team" value="${esc(F.q)}"><select data-bind="cSort">${[['ovr', 'Best overall'], ['age', 'Youngest'], ['name', 'Name'], ['ask', 'Highest ask']].map(s => `<option value="${s[0]}"${F.sort === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></div>
        <div class="col" style="gap:8px">${shown.map(p => card(L, p)).join('') || `<div class="note">${all.length ? 'No cards match.' : 'No cards yet. Add the cards you have at home above.'}</div>`}</div>
        ${list.length > lim ? `<button class="btn block" data-act="cMore">Show more (${list.length - lim} left)</button>` : ''}</div>`;
  };
  function card(L, p) {
    const tags = (p.expired ? '<span class="tag exp">Contract ended</span>' : '') + (p.tid ? `<span class="tag rk">${esc(CS.tname(L, p.tid))}</span>` : '');
    const acts = p.tid ? `<button class="btn xs" data-act="editCard" data-pid="${p.id}">Edit</button>`
      : `<button class="btn xs gold" data-act="contract" data-pid="${p.id}">Sign</button><button class="btn xs" data-act="editCard" data-pid="${p.id}">Edit</button>`;
    return CS.pcard(L, p, { tags, acts, meta: p.tid ? '' : 'asks ' + money(CS.askSal(p)) });
  }
  function presetPanel(L) {
    const loaded = L.pools || [];
    return `<div class="panel"><div class="h">Preset pools</div><div class="note">Add a ready-made pool of cards. Cards already in your pool are skipped, so it's safe to load more than one.</div>
      <div class="col" style="gap:8px">${CS.POOLS.map(p => `<div class="row"><div class="grow"><b>${esc(p.name)}</b> <span class="dim small">${CS.poolCount(p.id)} cards${loaded.includes(p.id) ? ' · loaded' : ''}</span><div class="note">${esc(p.blurb)}</div></div><button class="btn sm ${loaded.includes(p.id) ? '' : 'gold'}" data-act="loadPool" data-a="${p.id}">${loaded.includes(p.id) ? 'Load again' : 'Add'}</button></div>`).join('')}</div></div>`;
  }
  CS.act.loadPool = d => {
    const L = CS.L, p = CS.POOLS.find(x => x.id === d.a);
    CS.confirm('Add ' + p.name + '?', CS.poolCount(p.id) + ' cards go into the pool. ' + (L.phase === 'setup' ? '' : 'The league is already running, so new cards will be free agents. '), 'Add cards', () => {
      const r = CS.loadPool(L, p.id); CS.commit(); CS.toast(r.added + ' cards added' + (r.skipped ? ', ' + r.skipped + ' were already here.' : '.'));
    });
  };
  function bulkForm() {
    return `<label class="f">One card per line<textarea id="bulkTxt" data-bind="bulkTxt" placeholder="Patrick Mahomes, QB, 98, 30, KC&#10;Travis Kelce, TE, 91, 36, KC&#10;Micah Parsons, DEF, 94, 27, DAL">${esc(CS.ui.bulk || '')}</textarea></label>
      <div class="note">Order: name, position, overall, age, NFL team. Use QB, RB, WR, TE or DEF (DL, LB, CB, S work too). Team is optional except for QBs.</div>
      <button class="btn gold block" data-act="addBulk">Add these cards</button>`;
  }

  CS.act.cBulk = d => { CS.ui.cardF.bulk = d.a === '1'; CS.render(); };
  CS.act.cSt = d => { CS.ui.cardF.st = d.a; CS.ui.cardF.lim = 40; CS.render(); };
  CS.act.cPos = d => { CS.ui.cardF.pos = d.a; CS.ui.cardF.lim = 40; CS.render(); };
  CS.act.cMore = () => { CS.ui.cardF.lim = (CS.ui.cardF.lim || 40) + 60; CS.render(); };
  CS.bind.cQ = v => { CS.ui.cardF.q = v; CS.ui.cardF.lim = 40; return true; };
  CS.bind.cSort = v => { CS.ui.cardF.sort = v; return true; };
  CS.bind.qaName = v => { CS.ui.qa.name = v; };
  CS.bind.qaOvr = v => { CS.ui.qa.ovr = v; };
  CS.bind.qaAge = v => { CS.ui.qa.age = v; };
  CS.bind.qaNfl = v => { CS.ui.qa.nfl = v; };
  CS.bind.bulkTxt = v => { CS.ui.bulk = v; };
  CS.act.qaPos = d => { CS.ui.qa.pos = d.a; if (d.a !== 'DEF') CS.ui.qa.sub = ''; CS.render(); };
  CS.act.qaSub = d => { const q = CS.ui.qa; q.sub = q.sub === d.a ? '' : d.a; CS.render(); };
  CS.act.addCard = () => {
    const L = CS.L, q = CS.ui.qa;
    const r = CS.addCard(L, { name: q.name, pos: q.pos, sub: q.sub, ovr: q.ovr, age: q.age, nfl: q.nfl });
    if (!r.ok) return CS.toast(r.msg, true);
    CS.toast(r.p.name + ' added (' + (L.players.length) + ' cards).');
    q.name = ''; q.ovr = ''; q.age = '';
    CS.save(); CS.after = () => { const e = document.getElementById('qaName'); if (e) e.focus(); }; CS.render();
  };
  CS.act.addBulk = () => {
    const L = CS.L, res = CS.importText(L, CS.ui.bulk || '');
    CS.save();
    CS.modal(`<div class="h">${res.added} card${res.added === 1 ? '' : 's'} added</div>
      ${res.defAge ? `<div class="note sp">${res.defAge} had no age, so I set age 25. Fix those with Edit.</div>` : ''}
      ${res.dups.length ? `<div class="note sp">Already in the pool: ${res.dups.map(esc).join(', ')}</div>` : ''}
      ${res.errors.map(e => `<div class="issue sp"><b>${esc(e.line)}</b><br>${esc(e.msg)}</div>`).join('')}
      <button class="btn gold block sp" data-act="closeModal">OK</button>`);
    if (res.added) CS.ui.bulk = '';
    CS.render();
  };

  // ---------- edit card ----------
  CS.act.editCard = d => {
    const L = CS.L, p = CS.byId(L, d.pid); if (!p) return;
    CS._ec = d.pid;
    CS.modal(`<div class="h">Edit card</div><div class="frm sp"><label class="f s6">Name<input type="text" id="ecName" value="${esc(p.name)}"></label>
      <label class="f s2">Position<select id="ecPos">${CS.POS.map(x => `<option${x === p.pos ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f s2">Type<select id="ecSub"><option value="">-</option>${CS.SUBS.map(x => `<option${x === p.sub ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="f s2">NFL team<select id="ecNfl">${CS.nflOptions(p.nfl)}</select></label>
      <label class="f s3">Overall<input type="number" id="ecOvr" inputmode="numeric" value="${p.ovr}"></label>
      <label class="f s3">Age<input type="number" id="ecAge" inputmode="numeric" value="${p.age}"></label>
      ${p.tid ? `<label class="f s2">Team<select id="ecTid">${L.teams.map(t => `<option value="${t.id}"${t.id === p.tid ? ' selected' : ''}>${esc(CS.tname(L, t.id))}</option>`).join('')}</select></label>
        <label class="f s2">Salary ($M)<input type="number" id="ecSal" step="0.1" inputmode="decimal" value="${p.sal}"></label>
        <label class="f s2">Years left<input type="number" id="ecYrs" inputmode="numeric" value="${p.yrs}"></label>` : ''}</div>
      <div class="row sp"><button class="btn red" data-act="deleteCard">Delete card</button><button class="btn grow" data-act="closeModal">Cancel</button><button class="btn gold grow" data-act="saveCard">Save</button></div>`);
  };
  CS.act.saveCard = () => {
    const L = CS.L, p = CS.byId(L, CS._ec), v = id => document.getElementById(id);
    const c = { name: v('ecName').value, pos: v('ecPos').value, ovr: v('ecOvr').value, age: v('ecAge').value, nfl: v('ecNfl').value };
    const err = CS.checkCard(c); if (err) return CS.toast(err, true);
    const dup = CS.findCard(L, c.name, c.pos); if (dup && dup.id !== p.id) return CS.toast('Another card already has that name and position.', true);
    p.name = CS.cleanName(c.name); p.pos = c.pos; p.sub = c.pos === 'DEF' ? v('ecSub').value : ''; p.ovr = Math.round(c.ovr); p.age = Math.round(c.age); p.nfl = c.nfl;
    if (p.tid && v('ecTid')) { p.tid = v('ecTid').value; p.sal = CS.r1(+v('ecSal').value || 0); p.yrs = Math.max(0, Math.round(+v('ecYrs').value || 0)); }
    if (p.orig && !p.tid) p.orig = { ovr: p.ovr, age: p.age };
    CS.closeModal(); CS.commit(); CS.toast('Card saved.');
  };
  CS.act.deleteCard = () => {
    const L = CS.L, p = CS.byId(L, CS._ec);
    CS.confirm('Delete ' + p.name + '?', 'The card is removed from the league completely.', 'Delete', () => { CS.deleteCard(L, p.id); CS.commit(); }, true);
  };
})();
