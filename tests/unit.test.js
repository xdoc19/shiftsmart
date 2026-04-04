/**
 * ShiftSmart — Unit Tests
 * Testează logica de business fără browser (Node.js + vm)
 */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// ── helpers ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  ✓', name); passed++; }
  catch(e) { console.log('  ✗', name, '\n    ', e.message); failed++; }
}
function section(name) { console.log('\n' + name); }

// ── load app script ────────────────────────────────────────────────────────
const html = fs.readFileSync('C:/Users/cipri/shiftsmart/index.html', 'utf8');
const scriptContent = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function makeCtx(overrides) {
  // Mock DOM — toate funcțiile de render devin no-op
  const noop = () => {};
  const mockEl = {
    textContent: '', className: '', innerHTML: '',
    style: { display: '' },
    classList: { contains: () => false, add: noop, remove: noop }
  };
  const doc = {
    getElementById: () => Object.assign({}, mockEl),
    querySelector: () => Object.assign({}, mockEl),
    addEventListener: noop,
    querySelectorAll: () => []
  };
  const ctx = vm.createContext({
    document: doc,
    window: { innerWidth: 1920, innerHeight: 1080 },
    console, Math, String, Array, Object,
    parseInt, parseFloat, isNaN, NaN, Infinity,
    setTimeout: (fn) => fn(), // execută imediat
    ...overrides
  });
  vm.runInContext(scriptContent, ctx);
  return ctx;
}

// ── SUITE 1: Calcul capacitate ─────────────────────────────────────────────
section('1. Calcul capacitate linii');

{
  const ctx = makeCtx();
  // Linia 0: sat=true, maxSch=3, ops=2, cfg.fri=2, SH=8
  // Cap = 4*3*8 + 1*2*8 + 1*2*8 = 96 + 16 + 16 = 128
  test('getLineCap linie cu sâmbătă (sat=true)', () => {
    const cap = ctx.getLineCap(0);
    assert.strictEqual(cap, 128, `Expected 128, got ${cap}`);
  });

  // Linia 10: sat=false
  // Cap = 4*3*8 + 1*2*8 = 96 + 16 = 112
  test('getLineCap linie fără sâmbătă (sat=false)', () => {
    const cap = ctx.getLineCap(10);
    assert.strictEqual(cap, 112, `Expected 112, got ${cap}`);
  });

  test('getLineCap linie inactivă returnează 0', () => {
    ctx.lines[5].active = false;
    const cap = ctx.getLineCap(5);
    assert.strictEqual(cap, 0);
    ctx.lines[5].active = true;
  });

  // Cap 2 schimburi = (4*2 + 1*2)*8 = 80
  test('getLineCapTwoShift = 80h (4 zile × 2 sch + Vineri × 2 × 8h)', () => {
    const cap2 = ctx.getLineCapTwoShift(0);
    assert.strictEqual(cap2, 80);
  });

  // Cap 1 schimb = (4+1)*8 = 40
  test('getLineCapDay = 40h (5 zile × 1 schimb × 8h)', () => {
    const cap1 = ctx.getLineCapDay(0);
    assert.strictEqual(cap1, 40);
  });
}

// ── SUITE 2: shiftLabel ────────────────────────────────────────────────────
section('2. Etichete schimb (shiftLabel)');

{
  const ctx = makeCtx();
  test('0h → Sch1', () => assert.strictEqual(ctx.shiftLabel(0, 0), 'Sch1'));
  test('40h (cap1) → Sch1', () => assert.strictEqual(ctx.shiftLabel(40, 0), 'Sch1'));
  test('41h (>cap1) → Sch2', () => assert.strictEqual(ctx.shiftLabel(41, 0), 'Sch2'));
  test('80h (cap2) → Sch2', () => assert.strictEqual(ctx.shiftLabel(80, 0), 'Sch2'));
  test('81h (>cap2) → Sch3', () => assert.strictEqual(ctx.shiftLabel(81, 0), 'Sch3'));
}

// ── SUITE 3: buildBase — alocare corectă ──────────────────────────────────
section('3. buildBase — alocare iteme pe linii');

{
  const ctx = makeCtx();

  // Înlocuim datele cu un scenariu controlat
  ctx.lines = [
    { id:0, code:'L01', active:true, maxSch:3, ops:2, sat:false },
    { id:1, code:'L02', active:true, maxSch:3, ops:2, sat:false },
    { id:2, code:'L03', active:false, maxSch:3, ops:2, sat:false }
  ];
  ctx.items = [
    { id:0, code:'ITEM-A', rr:{0:100, 1:0,  2:0},  defLine:0 },
    { id:1, code:'ITEM-B', rr:{0:0,   1:50,  2:0},  defLine:1 },
    { id:2, code:'ITEM-C', rr:{0:0,   1:0,   2:80}, defLine:2 } // linie inactivă
  ];
  ctx.demand = [
    [500, 0, 0], // item 0: 500 buc W1
    [0, 300, 0], // item 1: 300 buc W2
    [200, 0, 0]  // item 2: 200 buc (linie inactivă)
  ];
  ctx.WEEKS = 3;

  const base = ctx.buildBase();

  test('ITEM-A se alocă pe L01 (defLine cu rr>0)', () => {
    const a = base.al.find(a => a.ii === 0);
    assert.ok(a, 'Nicio alocare pentru ITEM-A');
    assert.strictEqual(a.li, 0, `Expected li=0, got ${a.li}`);
  });

  test('ITEM-B se alocă pe L02 (singurul cu rr>0)', () => {
    const a = base.al.find(a => a.ii === 1);
    assert.ok(a, 'Nicio alocare pentru ITEM-B');
    assert.strictEqual(a.li, 1, `Expected li=1, got ${a.li}`);
  });

  test('ITEM-C nu se alocă (linia default e inactivă și nu are altă linie)', () => {
    const a = base.al.find(a => a.ii === 2);
    assert.ok(!a, 'ITEM-C nu trebuia alocat (linie inactivă)');
  });

  test('Ore ITEM-A = 500/100 = 5h', () => {
    const a = base.al.find(a => a.ii === 0);
    assert.strictEqual(a.hrs, 5);
  });

  test('ll[L01][W0] acumulează corect', () => {
    assert.strictEqual(base.ll[0][0], 5);
  });

  test('ll[L02][W1] = 300/50 = 6h', () => {
    assert.strictEqual(base.ll[1][1], 6);
  });

  test('Niciun item nu ajunge pe o linie cu rr=0', () => {
    for (const a of base.al) {
      const rrVal = ctx.items[a.ii].rr[a.li];
      assert.ok(rrVal > 0, `Item ${a.ii} alocat pe linia ${a.li} cu rr=${rrVal}`);
    }
  });
}

// ── SUITE 4: buildBase — defLine ignorat când rr=0 ────────────────────────
section('4. buildBase — fallback corect când defLine are rr=0');

{
  const ctx = makeCtx();
  ctx.lines = [
    { id:0, code:'L01', active:true, maxSch:3, ops:2, sat:false },
    { id:1, code:'L02', active:true, maxSch:3, ops:2, sat:false }
  ];
  // defLine=0 dar rr[0]=0 → trebuie să cadă pe L02
  ctx.items = [
    { id:0, code:'ITEM-X', rr:{0:0, 1:60}, defLine:0 }
  ];
  ctx.demand = [[300]];
  ctx.WEEKS = 1;

  const base = ctx.buildBase();

  test('Când defLine are rr=0, se alocă pe linia cu cel mai mare rr (L02)', () => {
    const a = base.al.find(a => a.ii === 0);
    assert.ok(a, 'Nicio alocare');
    assert.strictEqual(a.li, 1, `Expected L02 (id=1), got ${a.li}`);
  });

  test('Ore corecte cu rr de pe linia fallback (300/60 = 5h)', () => {
    const a = base.al.find(a => a.ii === 0);
    assert.strictEqual(a.hrs, 5);
  });
}

// ── SUITE 5: Optimizer Step 1 — mutare pe linie alternativă ───────────────
section('5. Optimizer Step 1 — mutare pe linie alternativă când supraîncărcat');

{
  const ctx = makeCtx();
  // cap2 L01 = (4*2+2)*8 = 80h, punem 200h pe ea
  ctx.lines = [
    { id:0, code:'L01', active:true, maxSch:3, ops:2, sat:false },
    { id:1, code:'L02', active:true, maxSch:3, ops:2, sat:false }
  ];
  ctx.items = [
    { id:0, code:'ITEM-A', rr:{0:50, 1:40}, defLine:0 }
  ];
  // 10000 buc / 50 rr = 200h > cap2 (80h) → ar trebui mutat pe L02 dacă are loc
  ctx.demand = [[10000]];
  ctx.WEEKS = 1;
  ctx.cfg = { s1:8, s2:8, s3:8, mth:3, fri:2, win:2 };

  // Rulăm optimizer logic fără render DOM
  ctx.updateKPIs = () => {};
  ctx.renderDash = () => {};
  ctx.renderCap = () => {};
  ctx.renderHmap = () => {};
  ctx.renderOrd = () => {};
  ctx.renderOpsGap = () => {};

  ctx.runOptimizerLogic();
  const al = ctx.sch.al;

  test('Optimizatorul nu alocă pe linii cu rr=0', () => {
    for (const a of al) {
      const rrVal = ctx.items[a.ii].rr[a.li];
      assert.ok(rrVal > 0, `Alocare cu rr=0 pe linia ${a.li}`);
    }
  });
}

// ── SUITE 6: Optimizer Step 2 — mutare în săptămâni adiacente ─────────────
section('6. Optimizer Step 2 — mutare săptămână adiacentă');

{
  const ctx = makeCtx();
  ctx.lines = [
    { id:0, code:'L01', active:true, maxSch:3, ops:2, sat:false }
  ];
  // cap2 = 80h. Item A: 700buc/10rr=70h, Item B: 200buc/10rr=20h → total W0=90h > 80h
  // Item B (20h) poate fi mutat în W1 unde e liber
  ctx.items = [
    { id:0, code:'A', rr:{0:10}, defLine:0 },
    { id:1, code:'B', rr:{0:10}, defLine:0 }
  ];
  ctx.demand = [
    [700, 0, 0, 0],
    [200, 0, 0, 0]
  ];
  ctx.WEEKS = 4;
  ctx.cfg = { s1:8, s2:8, s3:8, mth:3, fri:2, win:3 };
  ctx.updateKPIs = () => {};
  ctx.renderDash = () => {};
  ctx.renderCap = () => {};
  ctx.renderHmap = () => {};
  ctx.renderOrd = () => {};
  ctx.renderOpsGap = () => {};

  ctx.runOptimizerLogic();

  test('Step 2 mută alocări în săptămâni adiacente (cel puțin una e moved)', () => {
    const moved = ctx.sch.al.filter(a => a.moved);
    assert.ok(moved.length > 0, 'Nicio alocare nu a fost mutată în săpt. adiacentă');
    // alocarea mutată nu mai e în W0
    assert.ok(moved[0].w !== 0, `Alocarea mutată e tot în W0: w=${moved[0].w}`);
  });
}

// ── SUITE 7: Filtru iteme — text ───────────────────────────────────────────
section('7. Filtru text item');

{
  // Simulăm logica de filtrare extrasă din renderItemsTable
  function filterItems(itemsList, query) {
    var q = query.trim().toLowerCase();
    return itemsList.filter(function(item) {
      if (q && item.code.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  const mockItems = [
    { code: 'TEN-01' }, { code: 'TEN-02' },
    { code: 'BRK-01' }, { code: 'CLT-05' }
  ];

  test('Fără filtru returnează toate itemele', () => {
    assert.strictEqual(filterItems(mockItems, '').length, 4);
  });

  test('Filtru "ten" → 2 iteme', () => {
    assert.strictEqual(filterItems(mockItems, 'ten').length, 2);
  });

  test('Filtru "brk" → 1 item', () => {
    assert.strictEqual(filterItems(mockItems, 'brk').length, 1);
  });

  test('Filtru case-insensitive "TEN" → 2 iteme', () => {
    assert.strictEqual(filterItems(mockItems, 'TEN').length, 2);
  });

  test('Filtru fără rezultat → 0 iteme', () => {
    assert.strictEqual(filterItems(mockItems, 'xyz').length, 0);
  });
}

// ── SUITE 8: Filtru chip linie — numai iteme compatibile ──────────────────
section('8. Filtru chip linie (rr > 0)');

{
  function filterByLine(itemsList, lineId) {
    if (lineId === -1) return itemsList;
    return itemsList.filter(function(item) {
      return item.rr[lineId] > 0;
    });
  }

  const mockItems = [
    { code: 'A', rr: {0:100, 1:0,  2:50} },
    { code: 'B', rr: {0:0,   1:80, 2:0}  },
    { code: 'C', rr: {0:60,  1:0,  2:0}  },
    { code: 'D', rr: {0:0,   1:0,  2:0}  }  // incompatibil cu toate
  ];

  test('lineId=-1 (Toate) returnează toate', () => {
    assert.strictEqual(filterByLine(mockItems, -1).length, 4);
  });

  test('Filtru L01 (id=0) → 2 iteme compatibile (A, C)', () => {
    const r = filterByLine(mockItems, 0);
    assert.strictEqual(r.length, 2);
    assert.ok(r.find(i => i.code === 'A'));
    assert.ok(r.find(i => i.code === 'C'));
  });

  test('Filtru L02 (id=1) → 1 item (B)', () => {
    const r = filterByLine(mockItems, 1);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].code, 'B');
  });

  test('Item fără niciun rr nu apare la niciun filtru specific', () => {
    assert.strictEqual(filterByLine([mockItems[3]], 0).length, 0);
    assert.strictEqual(filterByLine([mockItems[3]], 1).length, 0);
    assert.strictEqual(filterByLine([mockItems[3]], 2).length, 0);
  });

  test('Item cu rr=0 explicit nu apare la filtru', () => {
    const item = { code: 'E', rr: {0:0} };
    assert.strictEqual(filterByLine([item], 0).length, 0);
  });
}

// ── SUITE 9: Filtru defLine dropdown ──────────────────────────────────────
section('9. Filtru linie default (dropdown)');

{
  function filterByDefLine(itemsList, defLineFilterVal) {
    return itemsList.filter(function(item) {
      var defLi = typeof item.defLine !== 'undefined' ? item.defLine : -1;
      if (defLineFilterVal === -2 && defLi !== -1) return false;
      if (defLineFilterVal >= 0 && defLi !== defLineFilterVal) return false;
      return true;
    });
  }

  const mockItems = [
    { code: 'A', defLine: 0  },
    { code: 'B', defLine: 1  },
    { code: 'C', defLine: 0  },
    { code: 'D', defLine: -1 }  // nesetat
  ];

  test('Filtru -1 (Toate) → toate itemele', () => {
    assert.strictEqual(filterByDefLine(mockItems, -1).length, 4);
  });

  test('Filtru -2 (Nesetat) → doar D', () => {
    const r = filterByDefLine(mockItems, -2);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].code, 'D');
  });

  test('Filtru L01 (id=0) → A și C', () => {
    const r = filterByDefLine(mockItems, 0);
    assert.strictEqual(r.length, 2);
    assert.ok(r.find(i => i.code === 'A'));
    assert.ok(r.find(i => i.code === 'C'));
  });

  test('Filtru L02 (id=1) → doar B', () => {
    const r = filterByDefLine(mockItems, 1);
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].code, 'B');
  });
}

// ── SUITE 10: showBarTip — date tooltip corecte ───────────────────���───────
section('10. Date tooltip hover bar');

{
  // Simulăm logica din showBarTip
  function buildTipData(li, w, al, itemsList) {
    var matching = al.filter(function(a) { return a.li === li && a.w === w; });
    matching.sort(function(a, b) { return b.qty - a.qty; });
    var totalQty = 0, totalH = 0;
    var rows = matching.slice(0, 10).map(function(a) {
      totalQty += a.qty; totalH += a.hrs;
      return { code: itemsList[a.ii].code, qty: a.qty, hrs: a.hrs };
    });
    return { rows, totalQty, totalH: +totalH.toFixed(1), hasMore: matching.length > 10 };
  }

  const al = [
    { li:0, w:0, ii:0, qty:500, hrs:5.0 },
    { li:0, w:0, ii:1, qty:300, hrs:6.0 },
    { li:1, w:0, ii:2, qty:200, hrs:4.0 },
    { li:0, w:1, ii:0, qty:100, hrs:1.0 }
  ];
  const itemsList = [
    { code:'TEN-01' }, { code:'BRK-01' }, { code:'CLT-01' }
  ];

  test('Tooltip L01/W0 returnează 2 rânduri (nu și L02 sau W1)', () => {
    const tip = buildTipData(0, 0, al, itemsList);
    assert.strictEqual(tip.rows.length, 2);
  });

  test('Tooltip L01/W0 ordonat descrescător după qty', () => {
    const tip = buildTipData(0, 0, al, itemsList);
    assert.strictEqual(tip.rows[0].qty, 500);
    assert.strictEqual(tip.rows[1].qty, 300);
  });

  test('Total qty L01/W0 = 800', () => {
    const tip = buildTipData(0, 0, al, itemsList);
    assert.strictEqual(tip.totalQty, 800);
  });

  test('Total ore L01/W0 = 11h', () => {
    const tip = buildTipData(0, 0, al, itemsList);
    assert.strictEqual(tip.totalH, 11.0);
  });

  test('Tooltip linie fără alocări în acea săpt. returnează 0 rânduri', () => {
    const tip = buildTipData(1, 1, al, itemsList);
    assert.strictEqual(tip.rows.length, 0);
  });

  test('hasMore=false când <= 10 iteme', () => {
    const tip = buildTipData(0, 0, al, itemsList);
    assert.strictEqual(tip.hasMore, false);
  });
}

// ── SUMAR ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Rezultat: ${passed} trecute, ${failed} eșuate din ${passed+failed} total`);
if (failed > 0) process.exit(1);
