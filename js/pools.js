// CARDS SEASON preset card pools: current 2026 NFL, current stars, all-time legends, or a mix.
(function () {
  const STAR_MIN = { QB: 76, RB: 82, WR: 82, TE: 80, DL: 86, LB: 84, CB: 84, S: 84 };
  const parse = txt => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const t = l.split(','), ps = CS.parsePos(t[1]);
    return ps ? { name: t[0], pos: ps.pos, sub: ps.sub, tag: t[1], ovr: +t[2], age: +t[3], nfl: t[4] } : null;
  }).filter(Boolean);
  const cache = {};
  const rows = k => cache[k] || (cache[k] = parse(k === 'cur' ? CS.POOL_CUR : CS.POOL_ALL));

  CS.POOLS = [
    { id: 'cur', name: 'Current NFL 2026', blurb: 'Real players on real teams right now: every starter and key backup, with Madden 27 overalls and their real ages.' },
    { id: 'stars', name: 'Current stars', blurb: 'Only the best current players at each position. Smaller pool, so every pick matters.' },
    { id: 'all', name: 'All-time legends', blurb: 'Hall of Famers and legends at their peak, from Jim Brown to Mahomes. Ratings are my estimates.' },
    { id: 'both', name: 'Current + all-time', blurb: 'Both pools together. Where a player is in both, the current card is used.' }
  ];
  CS.poolList = key => {
    if (key === 'stars') return rows('cur').filter(r => r.ovr >= STAR_MIN[r.tag]);
    if (key === 'both') { const seen = new Set(rows('cur').map(r => CS.cardKey(r.name, r.pos))); return rows('cur').concat(rows('all').filter(r => !seen.has(CS.cardKey(r.name, r.pos)))); }
    return rows(key === 'all' ? 'all' : 'cur');
  };
  CS.poolCount = key => CS.poolList(key).length;
  CS.loadPool = (L, key) => {
    let added = 0, skipped = 0;
    CS.poolList(key).forEach(r => {
      const x = CS.addCard(L, { name: r.name, pos: r.pos, sub: r.sub, ovr: r.ovr, age: r.age, nfl: r.nfl });
      if (x.ok) added++; else skipped++;
    });
    L.pools = L.pools || []; if (!L.pools.includes(key)) L.pools.push(key);
    CS.log(L, 'Loaded the ' + CS.POOLS.find(p => p.id === key).name + ' card pool (' + added + ' cards).');
    return { added, skipped };
  };
})();
