'use strict';

/* ตารางควบคุมการจัดให้มีการเลือกตั้ง (หน้าหลัก)
   นับถอยหลังถึงวันเลือกตั้ง: วันเลือกตั้ง = 0 หลังวันเลือกตั้งนับต่อ 1 2 3 ...
   ช่วงที่ 1: ตั้งแต่วันรุ่งขึ้นหลังวันเริ่มต้น ถึงนับถอยหลัง = split
   ช่วงที่ 2: นับถอยหลัง split-1 ถึง 0 และหลังวันเลือกตั้งตามที่ตั้งค่า
   ค่าต่าง ๆ มาจาก state.config (js/config.js) ซึ่งแก้ได้ที่หน้าผู้ดูแลระบบ */

const MAX_SPAN = 120;      // กันตารางยาวผิดปกติเมื่อกรอกวันที่ผิด
const UPCOMING_LIMIT = 5;  // จำนวนกิจกรรมถัดไปที่แสดงในแดชบอร์ด

const FONT = "Sarabun, 'Leelawadee UI', Tahoma, sans-serif";
const NS = 'http://www.w3.org/2000/svg';
const INK = '#1F2937';
const LINE = '#1E4E9C';
const RED = '#E00000';
const HOLI = '#D40000';

// ขนาดตาราง (หน่วย px ใน viewBox)
const G = {
  labelW: 150, colW: 42, rowA: 42, rowB: 36,
  fs: 13.5, fsNote: 12.5, lh: 18, pad: 4,
  g0: 18, gap: 6, arm: 12, bracket: 9, margin: 10,
};

const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const TH_DAYS_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

const DEFAULT_FORM = {
  position: 'member',   // member | chief | ข้อความตำแหน่งที่พิมพ์เอง
  orgType: 'tt',
  province: 'เชียงใหม่',
  district: 'เชียงดาว',
  orgName: 'เมืองนะ',
  zone: '2',
  caseType: 'vacancy',
  vacancy: '2026-10-07',
  election: '2026-12-06',
  autoElection: true,
  notes: '',
  view: 'all',
};

const $ = (sel) => document.querySelector(sel);
const r1 = (v) => Math.round(v * 10) / 10;

/* ---------------- จังหวัด → อำเภอ → ตำบล (data/thai-admin.js) ---------------- */

const ADMIN = Array.isArray(window.THAI_ADMIN) ? window.THAI_ADMIN : [];
const districtsOf = (province) => (ADMIN.find(([n]) => n === province) || [, []])[1];
const tambonsOf = (province, district) => (districtsOf(province).find(([n]) => n === district) || [, []])[1];

/* ---------------- วันที่ (นับเป็นเลขวันแบบ UTC เพื่อไม่ให้เพี้ยนตามเขตเวลา) ---------------- */

const DAY_MS = 86400000;
const dayNum = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const toDayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return dayNum(y, m, d); };
const toISO = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const ymd = (n) => { const t = new Date(n * DAY_MS); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), w: t.getUTCDay() }; };
const be = (y) => y + 543;
const calcToday = () => { const t = new Date(); return dayNum(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
let TODAY = calcToday();

function fmtFull(n) {
  const t = ymd(n);
  return `วัน${TH_DAYS[t.w]}ที่ ${t.d} ${TH_MONTHS[t.m]} ${be(t.y)}`;
}

function fmtDate(n) {
  const t = ymd(n);
  return `${t.d} ${TH_MONTHS[t.m]} ${be(t.y)}`;
}

function fmtShort(n) {
  const t = ymd(n);
  return `${t.d} ${TH_MONTHS_SHORT[t.m]} ${be(t.y)}`;
}

function fmtRange(s, e) {
  const A = ymd(s), B = ymd(e);
  if (s === e) return `${TH_DAYS_ABBR[A.w]}. ${A.d} ${TH_MONTHS_SHORT[A.m]} ${be(A.y)}`;
  if (A.y === B.y && A.m === B.m) return `${A.d}–${B.d} ${TH_MONTHS_SHORT[A.m]} ${be(A.y)}`;
  if (A.y === B.y) return `${A.d} ${TH_MONTHS_SHORT[A.m]} – ${B.d} ${TH_MONTHS_SHORT[B.m]} ${be(B.y)}`;
  return `${A.d} ${TH_MONTHS_SHORT[A.m]} ${be(A.y)} – ${B.d} ${TH_MONTHS_SHORT[B.m]} ${be(B.y)}`;
}

function monthLabel(a, b) {
  const A = ymd(a), B = ymd(b);
  if (A.y === B.y && A.m === B.m) return `${TH_MONTHS[A.m]} ${be(A.y)}`;
  if (A.y === B.y) return `${TH_MONTHS_SHORT[A.m]}–${TH_MONTHS_SHORT[B.m]} ${be(A.y)}`;
  const yy = (y) => String(be(y)).slice(-2);
  return `${TH_MONTHS_SHORT[A.m]} ${yy(A.y)}–${TH_MONTHS_SHORT[B.m]} ${yy(B.y)}`;
}

// นับถอยหลังถึงวันเลือกตั้ง: ก่อนวันเลือกตั้งนับลง, วันเลือกตั้ง = 0, หลังวันเลือกตั้งนับขึ้น
const countOf = (E, n) => Math.abs(E - n);

// ใช้ในตารางสรุป: ระบุชัดว่าตัวเลขหลังวันเลือกตั้งเป็นวันหลังเลือกตั้ง
function cdText(E, s, e) {
  const f = (n) => (n <= E ? String(E - n) : `${n - E} (หลังเลือกตั้ง)`);
  return s === e ? f(s) : `${f(s)} – ${f(e)}`;
}

/* ---------------- state ---------------- */

const state = {
  config: loadConfig(),
  form: { ...DEFAULT_FORM, ...store.get(KEYS.form, {}) },
};

const cfg = () => state.config;
const caseOf = (f) => caseById(cfg(), f.caseType);
// กำหนดการที่แก้จากตารางเฉพาะการเลือกตั้งนี้ (ตามกรณี) ถ้าไม่มีใช้กำหนดการมาตรฐานจากการตั้งค่า
const customRulesOf = (f) => {
  const list = f.customRules && f.customRules[caseOf(f).id];
  return Array.isArray(list) ? list : null;
};
const rulesOf = (f) => customRulesOf(f) || cfg().rulesByCase[caseOf(f).id] || [];
const orgTypeOf = (f) => orgTypeById(cfg(), f.orgType);
const limitOf = (f) => caseOf(f).days;
const fillOf = (colorId) => (paletteOf(cfg(), colorId) || {}).fill || '';
const pollTime = (t) => t.split(':').map(Number);
const fmtTime = (t) => t.replace(':', '.');

// วันเลือกตั้งอัตโนมัติ = วันอาทิตย์สุดท้ายที่ไม่เกินวันครบกำหนด
function autoElectionISO(f) {
  if (!isISO(f.vacancy)) return null;
  const deadline = toDayNum(f.vacancy) + limitOf(f);
  return toISO(deadline - ymd(deadline).w);
}

// ข้อมูลฟอร์มจากรุ่นก่อน
(function migrateForm(f) {
  // ชื่อการเลือกตั้งเคยเป็นข้อความเดียว เช่น "สมาชิกสภาเทศบาลตำบลเมืองนะ"
  if (typeof f.office === 'string') {
    const office = f.office.trim();
    let parsed = null;
    cfg().orgTypes.forEach((t) => {
      if (parsed) return;
      if (office.startsWith(t.member)) parsed = { position: 'member', orgType: t.id, orgName: office.slice(t.member.length) };
      else if (office.startsWith(t.chief)) parsed = { position: 'chief', orgType: t.id, orgName: office.slice(t.chief.length) };
    });
    Object.assign(f, parsed || { position: 'member', orgName: office });
  }
  if (f.orgName === '__custom') f.orgName = f.orgNameCustom || '';
  if (typeof f.caseText === 'string') f.caseType = /ครบวาระ/.test(f.caseText) ? 'term' : 'vacancy';
  ['office', 'orgNameCustom', 'caseText', 'limitDays'].forEach((k) => delete f[k]);
  if (typeof f.autoElection !== 'boolean') f.autoElection = !isISO(f.election) || f.election === autoElectionISO(f);
  if (f.customRules && typeof f.customRules === 'object') {
    const old = f.rulesVersion !== CONFIG_VERSION; // กำหนดการที่แก้ไว้ก่อนมีแผนงาน
    Object.keys(f.customRules).forEach((k) => {
      const list = f.customRules[k];
      if (!Array.isArray(list)) { delete f.customRules[k]; return; }
      const linked = linkRuleChain(list);
      const rules = old ? addPlanDetails(linked, DEFAULT_CONFIG.rulesByCase[k] || DEFAULT_RULES) : linked;
      f.customRules[k] = rules.map(normalizeRule).filter(Boolean);
    });
  } else {
    delete f.customRules;
  }
  f.rulesVersion = CONFIG_VERSION;
  normalizeMemberElections(f);
})(state.form);

const saveForm = () => store.set(KEYS.form, state.form);

/* ---------------- วันหยุด ---------------- */

// วว/ดด ชื่อ = ทุกปี, วว/ดด/ปปปป ชื่อ = เฉพาะปี (พ.ศ. หรือ ค.ศ.)
function parseHolidays(text, fromYear, toYear) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(\d{1,4})[/.-](\d{1,2})(?:[/.-](\d{1,4}))?\s*(.*)$/);
    if (!m) return;
    const name = m[4].trim() || 'วันหยุด';
    const a = Number(m[1]), mo = Number(m[2]);
    if (m[3] === undefined) {
      if (mo < 1 || mo > 12 || a < 1 || a > 31) return;
      for (let y = fromYear; y <= toYear; y++) out.push([dayNum(y, mo, a), name]);
      return;
    }
    const c = Number(m[3]);
    let y, d;
    if (a > 31) { y = a; d = c; } else { d = a; y = c; }
    if (y < 100) y += 2500;     // 69 → 2569
    if (y > 2400) y -= 543;     // พ.ศ. → ค.ศ.
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return;
    out.push([dayNum(y, mo, d), name]);
  });
  return out;
}

function buildHolidays(fromYear, toYear) {
  const base = parseHolidays(cfg().holidays, fromYear, toYear).sort((p, q) => p[0] - q[0]);
  const map = new Map();
  base.forEach(([n, name]) => { if (!map.has(n)) map.set(n, name); });
  // วันหยุดที่ตรงกับเสาร์-อาทิตย์ → ชดเชยวันทำการถัดไป
  base.forEach(([n, name]) => {
    const w = ymd(n).w;
    if (w !== 0 && w !== 6) return;
    let k = n + 1;
    while (map.has(k) || ymd(k).w === 0 || ymd(k).w === 6) k++;
    map.set(k, `ชดเชย${name}`);
  });
  return map;
}

/* ---------------- คำนวณกำหนดการ ---------------- */

// วันที่เริ่ม-สิ้นสุดของกิจกรรม (เลขวัน) · rules ใช้หากิจกรรมที่ผูกไว้
function ruleRange(r, E, vEff, rules) {
  const p = rulePos(r, rules);
  const base = p.base === 'V' ? vEff : E;
  return [base + p.s, base + p.e];
}

// กลับด้าน: ตั้งวันที่ให้กิจกรรม แล้วแปลงเป็น anchor + จำนวนวัน (กิจกรรมที่ผูกไว้ยังผูกอยู่)
function setRuleRange(r, s, e, E, vEff, rules) {
  if (e < s) [s, e] = [e, s];
  if (s <= E && e > E) e = E; // ช่วงที่ข้ามวันเลือกตั้งตัดที่วันเลือกตั้ง
  const single = s === e;
  const ref = r.anchor === 'rule' && rules.find((x) => x.id === r.ref && x !== r);
  if (ref) {
    const [, refEnd] = ruleRange(ref, E, vEff, rules);
    r.from = s - refEnd;
    r.to = single ? null : e - refEnd;
    return;
  }
  r.ref = null;
  if (r.anchor === 'vacancy' && s > vEff) {
    r.from = s - vEff;
    r.to = single ? null : e - vEff;
  } else if (s > E) {
    r.anchor = 'after';
    r.from = s - E;
    r.to = single ? null : e - E;
  } else {
    r.anchor = 'before';
    r.from = E - s;
    r.to = single ? null : E - e;
  }
}

function compute() {
  const f = state.form;
  if (!isISO(f.election)) return null;
  const { split, afterDays } = cfg().general;
  const E = toDayNum(f.election);
  const V = isISO(f.vacancy) ? toDayNum(f.vacancy) : null;
  const caseInfo = caseOf(f);
  const limit = caseInfo.days;
  const vEff = V ?? E - limit; // ไม่ระบุวันเริ่มต้น → ถือว่าเริ่ม limit วันก่อนวันเลือกตั้ง

  const rules = rulesOf(f);
  const events = rules.map((r, idx) => {
    const [s, e] = ruleRange(r, E, vEff, rules);
    const orphan = !!rulePos(r, rules).orphan;
    return {
      idx, text: r.text, note: r.note, detail: r.detail || '', anchor: r.anchor,
      color: paletteOf(cfg(), r.color) ? r.color : '', side: r.side, s, e, orphan,
      chart: r.chart !== false, plan: r.plan !== false,
    };
  });
  // ตารางควบคุมแสดงเฉพาะกิจกรรม chart · แผนงานและแดชบอร์ดใช้กิจกรรม plan
  const chartEvents = events.filter((ev) => ev.chart);
  const planEvents = events.filter((ev) => ev.plan);

  // ตารางเริ่มที่วันเริ่มต้น (ลาออกวันที่ 7 = นับถอยหลัง 60) · กิจกรรมเริ่มวันรุ่งขึ้นวันที่ 8
  const earliest = Math.min(vEff, ...chartEvents.map((ev) => ev.s));
  const latest = Math.max(E + afterDays, ...chartEvents.map((ev) => ev.e));
  const top = [Math.max(earliest, E - MAX_SPAN), E - split];
  const bottom = [E - split + 1, Math.min(latest, E + 60)];

  const lastPlan = Math.max(bottom[1], ...planEvents.map((ev) => ev.e));
  const holidays = buildHolidays(ymd(Math.min(top[0], vEff)).y, ymd(lastPlan).y);
  const colorMap = new Map();
  chartEvents.forEach((ev) => {
    if (!ev.color) return;
    for (let n = ev.s; n <= ev.e; n++) colorMap.set(n, ev.color);
  });

  return { E, V, vEff, limit, caseInfo, deadline: V == null ? null : V + limit, events, chartEvents, planEvents, top, bottom, holidays, colorMap };
}

/* ---------------- วัดความกว้างข้อความ ---------------- */

const measure = (() => {
  let el = null;
  const cache = new Map();
  function fn(text, size, weight = 400) {
    const key = `${size}|${weight}|${text}`;
    let w = cache.get(key);
    if (w !== undefined) return w;
    if (!el) {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;left:-10000px;top:0;width:10px;height:10px;visibility:hidden';
      el = document.createElementNS(NS, 'text');
      el.setAttribute('font-family', FONT);
      svg.appendChild(el);
      document.body.appendChild(svg);
    }
    el.setAttribute('font-size', size);
    el.setAttribute('font-weight', weight);
    el.textContent = text;
    w = el.getComputedTextLength() || text.length * size * 0.5;
    cache.set(key, w);
    return w;
  }
  fn.clear = () => cache.clear();
  return fn;
})();

/* ---------------- กล่องข้อความ (callout) ---------------- */

function makeCallout(group, ax, d0, range) {
  const lines = [];
  const offsets = [];
  group.items.forEach((ev) => {
    offsets.push(G.pad + lines.length * G.lh + G.lh / 2);
    lines.push({ kind: 'main', text: ev.text });
    if (ev.note) lines.push({ kind: 'note', text: `(${ev.note})` });
  });
  const starW = measure('* ก', G.fs) - measure('ก', G.fs);
  const widest = Math.max(...lines.map((l) => (l.kind === 'main'
    ? measure(`* ${l.text}`, G.fs)
    : starW + measure(l.text, G.fsNote))));
  return {
    side: group.side, ax, d0, range, lines, offsets, starW, special: false, day: group.s,
    w: Math.ceil(widest) + 2 * G.pad,
    h: lines.length * G.lh + 2 * G.pad,
  };
}

function electionCallout(ax, day) {
  return { side: 'up', ax, d0: 0, range: null, lines: [], offsets: [], special: true, day,
    w: Math.ceil(measure('วันเลือกตั้ง', 18, 700)) + 36, h: 36 };
}

/* ---------------- จัดวางกล่องข้อความไม่ให้ทับกัน ----------------
   ระยะ d วัดจากขอบตารางออกไป (ขึ้นด้านบน หรือ ลงด้านล่าง)
   orientation: r = ข้อความอยู่ขวาเส้น, l = ซ้ายเส้น, o = อยู่เหนือ/ใต้ปลายลูกศร */

const ORIENT_COST = { r: 0, o: 1, l: 2 };

function placeBox(c, o, W) {
  if (o === 'r') {
    const x = c.ax + G.arm;
    return x + c.w > W ? null : { x, x1: c.ax - 2, x2: x + c.w };
  }
  if (o === 'l') {
    const x = c.ax - G.arm - c.w;
    return x < 0 ? null : { x, x1: x, x2: c.ax + 2 };
  }
  const x = Math.max(0, Math.min(c.ax - c.w / 2, W - c.w));
  return { x, x1: x, x2: x + c.w };
}

function collides(c, fp, d, placed) {
  const g = G.gap;
  const top = d + c.h;
  for (const p of placed) {
    const x1 = p.fp.x1 - g, x2 = p.fp.x2 + g, d1 = p.d - g, d2 = p.d + p.c.h + g;
    if (fp.x1 < x2 && fp.x2 > x1 && d < d2 && top > d1) return true;                       // กล่องทับกล่อง
    if (c.ax > x1 && c.ax < x2 && c.d0 < d2 && d > d1) return true;                         // เส้นเราผ่านกล่องเขา
    if (p.c.ax > fp.x1 - g && p.c.ax < fp.x2 + g && p.c.d0 < top + g && p.d > d - g) return true; // เส้นเขาผ่านกล่องเรา
  }
  return false;
}

function greedy(order, W, coverPenalty) {
  const placed = [];
  order.forEach((c, idx) => {
    const pending = order.slice(idx + 1);
    const levels = [G.g0, ...placed.map((p) => p.d + p.c.h + G.gap)];
    let best = null;
    for (const o of (c.special ? ['o'] : ['r', 'o', 'l'])) {
      const fp = placeBox(c, o, W);
      if (!fp) continue;
      // ถ้ากล่องนี้บังจุดของรายการที่ยังไม่วาง ให้เว้นที่ด้านล่างไว้ให้รายการนั้น
      const covered = coverPenalty ? pending.filter((q) => q.ax > fp.x1 - G.gap && q.ax < fp.x2 + G.gap) : [];
      const minD = covered.length ? G.g0 + Math.max(...covered.map((q) => q.h)) + G.gap : G.g0;
      const cands = [...new Set([minD, ...levels])].filter((v) => v >= minD).sort((a, b) => a - b);
      const d = cands.find((v) => !collides(c, fp, v, placed));
      if (d === undefined) continue;
      const cost = d + covered.length * coverPenalty + ORIENT_COST[o];
      if (!best || cost < best.cost) best = { c, o, fp, d, cost };
    }
    if (!best) {
      const o = c.special ? 'o' : ['r', 'l', 'o'].find((k) => placeBox(c, k, W));
      best = { c, o, fp: placeBox(c, o, W), d: Math.max(...levels) };
    }
    placed.push(best);
  });
  return placed;
}

function scoreLayout(pl) {
  let cross = 0, height = 0, sumD = 0, orient = 0;
  for (const a of pl) {
    height = Math.max(height, a.d + a.c.h);
    sumD += a.d;
    orient += ORIENT_COST[a.o];
    for (const b of pl) {
      if (a === b) continue;
      if (a.c.ax > b.fp.x1 && a.c.ax < b.fp.x2 && a.c.d0 < b.d + b.c.h && a.d > b.d) cross++;
      if (a.fp.x1 < b.fp.x2 && a.fp.x2 > b.fp.x1 && a.d < b.d + b.c.h && a.d + a.c.h > b.d) cross++;
    }
  }
  return cross * 10000 + height + sumD * 0.05 + orient;
}

function layoutSide(callouts, W) {
  if (!callouts.length) return [];
  const specials = callouts.filter((c) => c.special);
  const normal = callouts.filter((c) => !c.special);
  const asc = normal.slice().sort((a, b) => a.ax - b.ax);
  const orders = [asc, asc.slice().reverse(), normal.slice().sort((a, b) => b.w - a.w)];
  let seed = 20261206;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 40; k++) {
    const o = asc.slice();
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [o[i], o[j]] = [o[j], o[i]];
    }
    orders.push(o);
  }
  let best = null;
  for (const ord of orders) {
    for (const pen of [0, 40]) {
      const pl = greedy([...specials, ...ord], W, pen);
      const sc = scoreLayout(pl);
      if (!best || sc < best.sc) best = { pl, sc };
    }
  }
  return best.pl;
}

/* ---------------- วาดตาราง (SVG) ---------------- */

function drawCallout(p, gridTop, gridBottom, uid) {
  const { c, o, d } = p;
  const x = r1(p.fp.x);
  const up = c.side === 'up';
  const yAt = (dist) => r1(up ? gridTop - dist : gridBottom + dist);
  const boxY = r1(up ? gridTop - d - c.h : gridBottom + d);
  const stroke = `stroke="${LINE}" stroke-width="1.3" fill="none"`;
  const arrow = `marker-end="url(#${uid}-ah)"`;
  const ax = r1(c.ax);

  let lines = '';
  if (c.range) {
    const [xl, xr] = c.range.map(r1);
    lines += `<path d="M${xl} ${yAt(2)} V${yAt(G.bracket)} H${xr} V${yAt(2)}" ${stroke}/>`;
  }
  if (o === 'o') {
    lines += `<line x1="${ax}" y1="${yAt(c.d0)}" x2="${ax}" y2="${yAt(d - 1)}" ${stroke} ${arrow}/>`;
  } else {
    const ys = c.offsets.map((off) => r1(boxY + off));
    const far = up ? Math.min(...ys) : Math.max(...ys);
    const ex = r1(o === 'r' ? x - 1 : x + c.w + 1);
    lines += `<line x1="${ax}" y1="${yAt(c.d0)}" x2="${ax}" y2="${far}" ${stroke}/>`;
    ys.forEach((y) => { lines += `<line x1="${ax}" y1="${y}" x2="${ex}" y2="${y}" ${stroke} ${arrow}/>`; });
  }

  // กล่องข้อความแตะเพื่อแก้กำหนดการของวันนั้นได้
  let box = `<g class="callout" data-day="${c.day}">`;
  if (c.special) {
    box += `<rect x="${x}" y="${boxY}" width="${c.w}" height="${c.h}" rx="4" fill="${RED}" stroke="#5C0000" stroke-width="2.5"/>`
      + `<text x="${r1(x + c.w / 2)}" y="${r1(boxY + c.h / 2 + 6)}" text-anchor="middle" font-size="18" font-weight="700" fill="#FFE45C">วันเลือกตั้ง</text>`;
  } else {
    box += `<rect class="callout-bg" x="${x}" y="${boxY}" width="${c.w}" height="${c.h}" rx="3" fill="#fff" fill-opacity="0.92"/>`;
    c.lines.forEach((ln, i) => {
      const ty = r1(boxY + G.pad + i * G.lh + G.lh * 0.78);
      box += ln.kind === 'main'
        ? `<text x="${r1(x + G.pad)}" y="${ty}" font-size="${G.fs}" fill="${INK}"><tspan fill="${HOLI}">*</tspan> ${esc(ln.text)}</text>`
        : `<text x="${r1(x + G.pad + c.starW)}" y="${ty}" font-size="${G.fsNote}" fill="#4B5563">${esc(ln.text)}</text>`;
    });
  }
  box += '</g>';
  return { lines, box };
}

function buildChart([a, b], ctx, uid) {
  const n = b - a + 1;
  const W = G.labelW + n * G.colW;
  const colX = (i) => G.labelW + i * G.colW;

  // รวมกิจกรรมวันเดียวกัน ด้านเดียวกัน เป็นกล่องเดียว
  const groups = new Map();
  for (const ev of ctx.chartEvents) {
    if (ev.s < a || ev.s > b) continue;
    const key = `${ev.side}|${ev.s}|${ev.e}`;
    if (!groups.has(key)) groups.set(key, { side: ev.side, s: ev.s, e: Math.min(ev.e, b), items: [] });
    groups.get(key).items.push(ev);
  }
  const callouts = [...groups.values()].map((g) => {
    const i0 = g.s - a, i1 = g.e - a;
    if (i1 > i0) return makeCallout(g, G.labelW + ((i0 + i1 + 1) / 2) * G.colW, G.bracket, [colX(i0) + 5, colX(i1 + 1) - 5]);
    return makeCallout(g, colX(i0) + G.colW / 2, 0, null);
  });
  if (ctx.E >= a && ctx.E <= b) callouts.push(electionCallout(colX(ctx.E - a) + G.colW / 2, ctx.E));

  const ups = layoutSide(callouts.filter((c) => c.side === 'up'), W);
  const downs = layoutSide(callouts.filter((c) => c.side === 'down'), W);
  const ext = (pl) => pl.reduce((m, p) => Math.max(m, p.d + p.c.h), 0);
  const gridTop = ext(ups) + G.margin;
  const gridH = G.rowA + G.rowB;
  const gridBottom = gridTop + gridH;
  const H = Math.ceil(gridBottom + ext(downs) + G.margin);

  // คอลัมน์หัวตาราง
  let svg = `<rect x="0" y="${gridTop}" width="${G.labelW}" height="${gridH}" fill="#F3F4F6"/>`
    + `<text x="${G.labelW / 2}" y="${gridTop + G.rowA / 2 + 5}" font-size="14" font-weight="700" text-anchor="middle" fill="${INK}">${esc(monthLabel(a, b))}</text>`
    + `<text font-size="12.5" font-weight="600" text-anchor="middle" fill="${INK}">`
    + `<tspan x="${G.labelW / 2}" y="${gridTop + G.rowA + 15}">นับถอยหลัง</tspan>`
    + `<tspan x="${G.labelW / 2}" y="${gridTop + G.rowA + 30}">ถึงวันเลือกตั้ง</tspan></text>`;

  // ช่องวันที่
  for (let i = 0; i < n; i++) {
    const dn = a + i;
    const x = colX(i);
    const cx = x + G.colW / 2;
    const t = ymd(dn);
    const isE = dn === ctx.E;
    const pal = paletteOf(cfg(), ctx.colorMap.get(dn));
    const fill = isE ? RED : (pal && pal.fill) || '#fff';
    const dark = isE || (pal && pal.dark);
    const off = t.w === 0 || t.w === 6 || ctx.holidays.has(dn);
    const ink = dark ? (off ? '#FFE45C' : '#fff') : (off ? HOLI : INK);
    const sub = dark ? (off ? '#FFE45C' : '#E8EEFF') : (off ? HOLI : '#6B7280');
    const cd = countOf(ctx.E, dn);

    const tip = [fmtFull(dn), dn < ctx.E ? `อีก ${ctx.E - dn} วันถึงวันเลือกตั้ง` : isE ? 'วันเลือกตั้ง' : `หลังวันเลือกตั้ง ${dn - ctx.E} วัน`];
    if (ctx.V != null && dn === ctx.V) tip.push(ctx.caseInfo.start);
    if (ctx.V != null && dn === ctx.V + 1) tip.push(`วันรุ่งขึ้นหลัง${ctx.caseInfo.start} (${fmtShort(ctx.V)})`);
    if (ctx.holidays.has(dn)) tip.push(ctx.holidays.get(dn));
    if (dn === ctx.deadline) tip.push('วันสุดท้ายที่ต้องจัดให้มีการเลือกตั้ง');
    ctx.chartEvents.forEach((ev) => { if (ev.s <= dn && dn <= ev.e) tip.push(`• ${ev.text}`); });

    tip.push('(แตะเพื่อแก้ไขกำหนดการวันนี้)');
    svg += `<g class="cell" data-day="${dn}"><title>${esc(tip.join('\n'))}</title>`
      + `<rect x="${x}" y="${gridTop}" width="${G.colW}" height="${gridH}" fill="${fill}"/>`
      + `<text x="${cx}" y="${gridTop + 13}" font-size="10.5" fill="${sub}" text-anchor="middle">${TH_DAYS_ABBR[t.w]}</text>`
      + `<text x="${cx}" y="${gridTop + G.rowA - 8}" font-size="16" font-weight="${isE ? 700 : 600}" fill="${ink}" text-anchor="middle">${t.d}</text>`
      + `<text x="${cx}" y="${gridTop + G.rowA + G.rowB / 2 + 5.5}" font-size="15" font-weight="${isE ? 700 : 400}" fill="${ink}" text-anchor="middle">${cd}</text>`
      + '</g>';
  }

  // เส้นตาราง (เส้นหนา = ขึ้นเดือนใหม่)
  svg += `<line x1="0" x2="${W}" y1="${gridTop + G.rowA}" y2="${gridTop + G.rowA}" stroke="#555" stroke-width="0.8"/>`;
  for (let i = 0; i <= n; i++) {
    const x = colX(i);
    const monthStart = i > 0 && i < n && ymd(a + i).d === 1;
    const w = monthStart ? 2.4 : i === 0 ? 1.4 : 0.8;
    svg += `<line x1="${x}" x2="${x}" y1="${gridTop}" y2="${gridBottom}" stroke="${monthStart ? '#111' : '#555'}" stroke-width="${w}"/>`;
  }
  svg += `<rect x="0.7" y="${gridTop}" width="${W - 1.4}" height="${gridH}" fill="none" stroke="#333" stroke-width="1.4"/>`;

  // วันนี้ (กรอบน้ำเงิน แสดงเฉพาะบนจอ)
  if (TODAY >= a && TODAY <= b) {
    const x = colX(TODAY - a);
    svg += `<rect class="today-mark" x="${x + 1.5}" y="${gridTop + 1.5}" width="${G.colW - 3}" height="${gridH - 3}" fill="none" stroke="#1565C0" stroke-width="3"/>`;
  }

  // ลูกศรก่อน แล้ววางกล่องข้อความทับ
  const drawn = [...ups, ...downs].map((p) => drawCallout(p, gridTop, gridBottom, uid));
  svg += drawn.map((d) => d.lines).join('') + drawn.map((d) => d.box).join('');

  const defs = `<defs><marker id="${uid}-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">`
    + `<path d="M0,0 L10,5 L0,10 z" fill="${LINE}"/></marker></defs>`;

  return {
    W, H,
    html: (pct) => `<svg xmlns="${NS}" class="chart-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"`
      + ` style="width:${pct.toFixed(2)}%;min-width:${Math.round(W * 0.62)}px" font-family="${FONT}"`
      + ` role="img" aria-label="${esc(`ตารางนับถอยหลัง ${fmtDate(a)} ถึง ${fmtDate(b)}`)}">${defs}${svg}</svg>`,
  };
}

/* ---------------- หัวตาราง ---------------- */

function stripPrefix(s, prefixes) {
  let v = String(s || '').trim();
  prefixes.forEach((p) => { if (v.startsWith(p)) v = v.slice(p.length).trim(); });
  return v;
}

const isCustomPosition = (f) => f.position !== 'member' && f.position !== 'chief';

function positionTitle(f) {
  const t = orgTypeOf(f);
  if (f.position === 'chief') return t.chief;
  if (f.position === 'member' || !String(f.position || '').trim()) return t.member;
  return String(f.position).trim(); // ตำแหน่งที่พิมพ์เอง ใช้ตามที่พิมพ์
}

// เลือก "ทุกเขต": พิมพ์แยกหน้าละเขต 1..จำนวนเขต (เฉพาะเลือกตั้งสมาชิกสภาที่ทราบจำนวนเขต)
const ALL_ZONES = 'all';
function allZonesCount(f) {
  if (f.zone !== ALL_ZONES || f.position === 'chief') return 0;
  return zoneCountFor(cfg(), f).n;
}

// "การเลือกตั้งสมาชิกสภาเทศบาลตำบลเมืองนะ เขตเลือกตั้งที่ 2 อำเภอเชียงดาว จังหวัดเชียงใหม่"
// zone: กำหนดเขตเองได้ (ใช้ตอนพิมพ์ทุกเขต)
function electionTitle(f, zoneOverride) {
  const t = orgTypeOf(f);
  const province = stripPrefix(f.province, ['จังหวัด', 'จ.']);
  const district = stripPrefix(f.district, ['อำเภอ', 'อ.']);
  const name = t.useProvince ? province : String(f.orgName || '').trim();
  const all = allZonesCount(f);
  const zone = f.position === 'chief' ? ''
    : zoneOverride != null ? String(zoneOverride)
    : all ? `1–${all}`
    : f.zone === ALL_ZONES ? '' : String(f.zone || '').trim();
  let s = `การเลือกตั้ง${positionTitle(f)}${name}`;
  if (zone) s += ` เขตเลือกตั้งที่ ${zone}`;
  // อปท. ระดับจังหวัด: ชื่อมีจังหวัดอยู่แล้ว และการเลือกนายกครอบคลุมทั้งจังหวัดจึงไม่ระบุอำเภอ
  if (t.useProvince) return f.position === 'chief' || !district ? s : `${s} อำเภอ${district}`;
  if (district) s += ` ${district.startsWith('เขต') ? '' : 'อำเภอ'}${district}`;
  if (province) s += ` ${province === 'กรุงเทพมหานคร' ? '' : 'จังหวัด'}${province}`;
  return s;
}

/* ---------------- แสดงผล ---------------- */

let lastCtx = null;

function renderHints() {
  const f = state.form;
  const c = caseOf(f);
  $('#l-vacancy').textContent = c.start;
  const hv = $('#h-vacancy');
  hv.classList.toggle('prompt', f.autoElection && !isISO(f.vacancy));
  hv.textContent = isISO(f.vacancy) ? fmtFull(toDayNum(f.vacancy))
    : f.autoElection ? `กรอก${c.start} เพื่อคำนวณวันเลือกตั้งอัตโนมัติ`
    : `ไม่ระบุ: ถือว่า${startShort(c)} ${c.days} วันก่อนวันเลือกตั้ง`;
  const auto = f.autoElection && isISO(f.vacancy) && f.election === autoElectionISO(f);
  $('#h-election').textContent = isISO(f.election) ? `${fmtFull(toDayNum(f.election))}${auto ? ' · คำนวณอัตโนมัติ' : ''}` : 'กรุณาเลือกวันเลือกตั้ง';
  $('#h-deadline').textContent = isISO(f.vacancy) ? `ครบกำหนด ${fmtFull(toDayNum(f.vacancy) + c.days)}` : `ภายใน ${c.days} วันนับแต่${c.start}`;
  $('#f-auto').checked = !!f.autoElection;
  $('#h-office').innerHTML = `หัวตาราง: <b>${esc(electionTitle(f))}</b>`;
}

function renderTitle(ctx) {
  const f = state.form;
  $('#t1').textContent = `${cfg().general.tablePrefix}${electionTitle(f)}`;
  $('#t2').textContent = ctx ? `เลือกตั้ง${caseOf(f).name} ใน${fmtFull(ctx.E)}` : '';
}

function renderAlerts(ctx) {
  const list = [];
  const w = ymd(ctx.E).w;
  if (w !== 0) list.push(['warn', `วันเลือกตั้งที่เลือกตรงกับวัน${TH_DAYS[w]} โดยปกติจะจัดการเลือกตั้งในวันอาทิตย์`]);
  const orphans = ctx.events.filter((ev) => ev.orphan);
  if (orphans.length) {
    list.push(['warn', `กิจกรรมที่ผูกกับกิจกรรมที่ไม่มีอยู่แล้ว: ${orphans.map((ev) => ev.text).join(', ')} (นับจากวันเลือกตั้งแทน) แก้ได้ที่หน้าผู้ดูแลระบบ`]);
  }
  if (ctx.V != null) {
    const start = ctx.caseInfo.start;
    if (ctx.E <= ctx.V) {
      list.push(['error', `วันเลือกตั้งต้องอยู่หลัง${start}`]);
    } else if (ctx.E > ctx.deadline) {
      list.push(['error', `วันเลือกตั้งเกินกำหนด ${ctx.E - ctx.deadline} วัน ต้องจัดให้มีการเลือกตั้งภายใน${fmtFull(ctx.deadline)} (${ctx.limit} วันนับแต่${start})`]);
    }
    const early = ctx.events.filter((ev) => ev.anchor !== 'vacancy' && ev.s <= ctx.V);
    if (early.length) {
      list.push(['warn', `มี ${early.length} กิจกรรมที่ตกก่อนวันเริ่มนับ ${fmtShort(ctx.V + 1)} (วันรุ่งขึ้นหลัง${start}): ${early.map((ev) => ev.text).join(', ')} ปรับวันได้ที่หน้าผู้ดูแลระบบ`]);
    }
  }
  $('#alerts').innerHTML = list.map(([type, msg]) => `<div class="alert ${type}" role="${type === 'error' ? 'alert' : 'status'}">${esc(msg)}</div>`).join('');
}

/* ---------------- แดชบอร์ด ---------------- */

function kpi(label, value, sub) {
  return `<div class="kpi"><div class="kpi-label">${esc(label)}</div>`
    + `<div class="kpi-value">${esc(value)}</div><div class="kpi-sub">${esc(sub)}</div></div>`;
}

function inDays(n) {
  return n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : n > 0 ? `อีก ${n} วัน` : `เลยมา ${-n} วัน`;
}

function renderDashboard(ctx) {
  const el = $('#dashboard');
  if (!ctx) {
    el.innerHTML = '<div class="dash-empty">กรอกวันที่ตำแหน่งว่างหรือวันเลือกตั้ง เพื่อเริ่มนับถอยหลัง</div>';
    return;
  }
  const { E, vEff, limit, caseInfo } = ctx;
  const { split, pollOpen, pollClose } = cfg().general;
  const diff = E - TODAY;

  // ตัวเลขหลัก = นับถอยหลังถึงวันเลือกตั้ง
  const hero = diff > 0 ? { label: 'นับถอยหลังถึงวันเลือกตั้ง', value: String(diff), unit: 'วัน' }
    : diff === 0 ? { label: 'วันนี้คือ', value: 'วันเลือกตั้ง', unit: '' }
    : { label: 'ผ่านวันเลือกตั้งมาแล้ว', value: String(-diff), unit: 'วัน' };
  hero.sub = fmtFull(E);

  // ความคืบหน้าตั้งแต่วันเริ่มต้นถึงวันเลือกตั้ง
  const total = E - vEff;
  let meter = '';
  if (total > 0) {
    const done = Math.min(Math.max(TODAY - vEff, 0), total);
    const pct = (done / total) * 100;
    meter = `<div class="meter-head"><span>ผ่านไป ${done} จาก ${total} วัน</span><span>${Math.round(pct)}%</span></div>`
      + `<div class="meter" role="progressbar" aria-label="ความคืบหน้าถึงวันเลือกตั้ง" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}">`
      + `<div class="meter-fill" style="width:${pct.toFixed(2)}%"></div></div>`
      + `<div class="meter-foot"><span>${ctx.V != null ? startShort(caseInfo) : 'เริ่มนับ'} ${esc(fmtShort(vEff))}</span><span>เลือกตั้ง ${esc(fmtShort(E))}</span></div>`;
  }

  // นับถอยหลังถึงวันสุดท้ายที่ต้องจัดให้มีการเลือกตั้ง (ในกรอบสีน้ำเงิน)
  let deadline;
  if (ctx.deadline != null) {
    const left = ctx.deadline - TODAY;
    const margin = ctx.deadline - E;
    const figure = left > 0 ? `<span class="dl-pre">อีก</span><b>${left}</b><span class="dl-unit">วัน</span>`
      : left === 0 ? '<b class="dl-word">วันนี้</b>'
      : `<span class="dl-pre">เลยกำหนด</span><b>${-left}</b><span class="dl-unit">วัน</span>`;
    deadline = `<div class="dl-text">`
      + `<div class="dl-label">วันสุดท้ายที่ต้องจัดให้มีการเลือกตั้ง</div>`
      + `<div class="dl-date">${esc(fmtFull(ctx.deadline))} <span class="dl-limit">(ภายใน ${limit} วัน)</span></div>`
      + `<div class="dl-sub">${margin > 0 ? `วันเลือกตั้งก่อนครบกำหนด ${margin} วัน` : margin === 0 ? 'วันเลือกตั้งตรงกับวันครบกำหนด' : `วันเลือกตั้งเกินกำหนด ${-margin} วัน`}</div>`
      + `</div><div class="dl-figure" aria-label="${esc(left >= 0 ? inDays(left) : `เลยกำหนด ${-left} วัน`)}">${figure}</div>`;
  } else {
    deadline = `<div class="dl-text"><div class="dl-label">วันสุดท้ายที่ต้องจัดให้มีการเลือกตั้ง (ภายใน ${limit} วัน)</div>`
      + `<div class="dl-sub">กรอก${esc(caseInfo.start)}เพื่อคำนวณ</div></div>`;
  }
  const late = ctx.deadline != null && ctx.deadline < TODAY;

  // ตัวชี้วัด
  const kpis = [];
  if (TODAY > E) kpis.push(kpi('ช่วงปัจจุบัน', 'หลังเลือกตั้ง', `หลังวันเลือกตั้ง ${TODAY - E} วัน`));
  else if (TODAY === E) kpis.push(kpi('ช่วงปัจจุบัน', 'วันเลือกตั้ง', `ลงคะแนน ${fmtTime(pollOpen)}–${fmtTime(pollClose)} น.`));
  else if (TODAY <= vEff) kpis.push(kpi('ช่วงปัจจุบัน', 'ยังไม่เริ่ม', `เริ่ม ${fmtShort(vEff + 1)}`));
  else if (diff >= split) kpis.push(kpi('ช่วงปัจจุบัน', 'ช่วงที่ 1', `อีก ${diff - split + 1} วันเข้าช่วงที่ 2`));
  else kpis.push(kpi('ช่วงปัจจุบัน', 'ช่วงที่ 2', `${split - 1} วันสุดท้ายก่อนวันเลือกตั้ง`));

  const rows = planRows(ctx);
  const tasks = ctx.planEvents;
  const doneCount = tasks.filter((ev) => ev.e < TODAY).length;
  const nowCount = tasks.filter((ev) => ev.s <= TODAY && TODAY <= ev.e).length;
  kpis.push(kpi('กิจกรรมเสร็จแล้ว', `${doneCount}/${tasks.length}`,
    `กำลังดำเนินการ ${nowCount} · รอดำเนินการ ${tasks.length - doneCount - nowCount}`));

  // กิจกรรมวันนี้
  const today = rows.filter((r) => r.s <= TODAY && TODAY <= r.e);
  const todayHtml = today.length ? today.map((r) => {
    const fill = r.election ? RED : fillOf(r.color);
    const progress = r.e > r.s ? `วันที่ ${TODAY - r.s + 1} จาก ${r.e - r.s + 1} · สิ้นสุด ${fmtShort(r.e)} (${inDays(r.e - TODAY)})` : '';
    return `<li><span class="sw"${fill ? ` style="background:${fill}"` : ''}></span><div>`
      + `<div class="task-text">${esc(r.text)}</div>`
      + `${r.note || progress ? `<div class="task-sub">${esc([r.note && `(${r.note})`, progress].filter(Boolean).join(' '))}</div>` : ''}`
      + '</div></li>';
  }).join('') : '<li class="none">ไม่มีกิจกรรมตามกำหนดการในวันนี้</li>';

  // กิจกรรมถัดไป
  const next = rows.filter((r) => r.s > TODAY);
  const nextHtml = next.length ? next.slice(0, UPCOMING_LIMIT).map((r) => {
    const n = r.s - TODAY;
    const level = n <= 3 ? 'urgent' : n <= 7 ? 'soon' : '';
    const fill = r.election ? RED : fillOf(r.color);
    return `<li><span class="pill ${level}">${inDays(n)}</span><div>`
      + `<div class="task-text"><span class="sw"${fill ? ` style="background:${fill}"` : ''}></span>${esc(r.text)}</div>`
      + `<div class="task-sub">${esc(fmtRange(r.s, r.e))}</div></div></li>`;
  }).join('') : '<li class="none">ไม่มีกิจกรรมที่เหลืออยู่</li>';
  const more = next.length > UPCOMING_LIMIT ? `<a class="more" href="#plan-title">และอีก ${next.length - UPCOMING_LIMIT} กิจกรรม · ดูแผนงานทั้งหมด</a>` : '';

  el.innerHTML = `
    <div class="dash-hero${diff === 0 ? ' is-today' : ''}">
      <div class="hero-top">
        <div class="hero-label">${esc(hero.label)}</div>
        <div class="hero-figure"><span class="hero-value">${esc(hero.value)}</span>${hero.unit ? `<span class="hero-unit">${hero.unit}</span>` : ''}</div>
        <div class="hero-date">${esc(hero.sub)}</div>
      </div>
      <div class="hero-deadline${late ? ' late' : ''}">${deadline}</div>
      <div class="clock" id="dash-clock">
        <div class="clock-label" data-k="label"></div>
        <div class="clock-units" data-k="units">
          <span class="unit"><b data-k="d"></b><small>วัน</small></span>
          <span class="unit"><b data-k="h"></b><small>ชั่วโมง</small></span>
          <span class="unit"><b data-k="m"></b><small>นาที</small></span>
          <span class="unit"><b data-k="s"></b><small>วินาที</small></span>
        </div>
      </div>
      <div class="meter-wrap">${meter}</div>
    </div>
    <div class="dash-side">
      <div class="kpis">${kpis.join('')}</div>
      <div class="panels">
        <section class="panel" aria-labelledby="p-today">
          <h3 id="p-today">กิจกรรมวันนี้ <small>${esc(fmtFull(TODAY))}</small></h3>
          <ul class="tasks">${todayHtml}</ul>
        </section>
        <section class="panel" aria-labelledby="p-next">
          <h3 id="p-next">กิจกรรมถัดไป</h3>
          <ul class="tasks">${nextHtml}</ul>
          ${more}
        </section>
      </div>
    </div>`;
  updateClock();
}

// นาฬิกานับถอยหลังถึงเวลาเปิดหีบ / ปิดหีบ (อัปเดตทุกวินาที)
function updateClock() {
  const el = document.getElementById('dash-clock');
  if (!el || !lastCtx) return;
  const { pollOpen, pollClose } = cfg().general;
  const t = ymd(lastCtx.E);
  const open = new Date(t.y, t.m, t.d, ...pollTime(pollOpen), 0);
  const close = new Date(t.y, t.m, t.d, ...pollTime(pollClose), 0);
  const now = new Date();
  const q = (k) => el.querySelector(`[data-k="${k}"]`);
  let target = null;
  if (now < open) {
    q('label').textContent = `เปิดหีบเลือกตั้ง ${fmtTime(pollOpen)} น. ในอีก`;
    target = open;
  } else if (now < close) {
    q('label').textContent = `กำลังลงคะแนน · ปิดหีบ ${fmtTime(pollClose)} น. ในอีก`;
    target = close;
  } else {
    q('label').textContent = 'ปิดหีบเลือกตั้งแล้ว';
  }
  q('units').hidden = !target;
  if (!target) return;
  const sec = Math.max(0, Math.floor((target - now) / 1000));
  q('d').textContent = Math.floor(sec / 86400);
  q('h').textContent = String(Math.floor((sec % 86400) / 3600)).padStart(2, '0');
  q('m').textContent = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  q('s').textContent = String(sec % 60).padStart(2, '0');
}

function renderCharts(ctx) {
  const view = state.form.view;
  const parts = [];
  if (view !== 'bottom') {
    if (ctx.top[1] >= ctx.top[0]) parts.push({ key: 'top', range: ctx.top });
    else if (view === 'top') parts.push({ empty: 'ไม่มีข้อมูลช่วงที่ 1' });
  }
  if (view !== 'top') parts.push({ key: 'bottom', range: ctx.bottom });
  const built = parts.map((p) => (p.empty ? p : { ...p, chart: buildChart(p.range, ctx, `c-${p.key}`) }));
  const maxW = Math.max(1, ...built.filter((p) => p.chart).map((p) => p.chart.W));
  $('#charts').innerHTML = built.map((p) => (p.empty
    ? `<p class="empty">${esc(p.empty)}</p>`
    : `<div class="chart-block"><div class="chart-scroll">${p.chart.html((p.chart.W / maxW) * 100)}</div></div>`)).join('');
}

function renderNotes(ctx) {
  const notes = [];
  if (ctx.V != null) {
    notes.push(`${ctx.caseInfo.start} ${fmtFull(ctx.V)}`);
    notes.push(`วันสุดท้ายที่ต้องจัดให้มีการเลือกตั้ง ${fmtFull(ctx.deadline)} (ภายใน ${ctx.limit} วัน)`);
  }
  notes.push('ตัวเลขสีแดง คือ วันเสาร์ วันอาทิตย์ และวันหยุดราชการ');
  String(state.form.notes || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean).forEach((s) => notes.push(s));
  $('#notes').innerHTML = `<div class="notes-box"><div class="notes-title">หมายเหตุ</div><ul>${notes.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
}

/* ---------------- แผนงาน (รายละเอียดแต่ละวัน) ---------------- */

// ข้อความแผนงาน: แทน {จังหวัด} {อำเภอ} {อปท} ด้วยข้อมูลการเลือกตั้งนี้
function planText(ev, f = state.form) {
  const t = orgTypeOf(f);
  const province = stripPrefix(f.province, ['จังหวัด', 'จ.']);
  const district = stripPrefix(f.district, ['อำเภอ', 'อ.']);
  const org = `${t.name}${t.useProvince ? province : String(f.orgName || '').trim()}`;
  return (ev.detail || ev.text)
    .replace(/\{จังหวัด\}/g, province)
    .replace(/\{อำเภอ\}/g, district)
    .replace(/\{อปท\}/g, org);
}

function planRows(ctx, f = state.form) {
  const rows = ctx.planEvents.map((ev) => ({ s: ev.s, e: ev.e, idx: ev.idx, text: planText(ev, f), note: ev.note, color: ev.color }));
  rows.push({ s: ctx.E, e: ctx.E, idx: -1, text: 'วันเลือกตั้ง', note: '', election: true });
  return rows.sort((p, q) => p.s - q.s || p.e - q.e || p.idx - q.idx);
}

// "1 ต.ค.69", "5 - 9 ต.ค.69", "28 ต.ค.- 3 พ.ย.69"
function planDate(s, e) {
  const A = ymd(s), B = ymd(e);
  const yy = (t) => String(be(t.y)).slice(-2);
  if (s === e) return `${A.d} ${TH_MONTHS_SHORT[A.m]}${yy(A)}`;
  if (A.y === B.y && A.m === B.m) return `${A.d} - ${B.d} ${TH_MONTHS_SHORT[A.m]}${yy(A)}`;
  if (A.y === B.y) return `${A.d} ${TH_MONTHS_SHORT[A.m]}- ${B.d} ${TH_MONTHS_SHORT[B.m]}${yy(B)}`;
  return `${A.d} ${TH_MONTHS_SHORT[A.m]}${yy(A)} - ${B.d} ${TH_MONTHS_SHORT[B.m]}${yy(B)}`;
}

// เดือน → วันที่ (หรือช่วงวันที่เดียวกัน) → รายการ
function planGroups(ctx, f = state.form) {
  const months = [];
  planRows(ctx, f).forEach((r) => {
    const t = ymd(r.s);
    const label = `${TH_MONTHS[t.m]} ${be(t.y)}`;
    let month = months[months.length - 1];
    if (!month || month.label !== label) months.push(month = { label, days: [] });
    let day = month.days[month.days.length - 1];
    if (!day || day.s !== r.s || day.e !== r.e) month.days.push(day = { s: r.s, e: r.e, items: [] });
    day.items.push(r);
  });
  return months;
}

const planTitle = (f = state.form) => `แผนงานการจัด${electionTitle(f)}`;

// แผนงานแยกชุดตามการเลือกตั้งแต่ละแถวและแต่ละเขต (ทุกเขต = ชุดละเขต) เหมือนการพิมพ์ตารางควบคุม
function planSets(f = state.form) {
  const seen = new Set();
  return printElectionsFor(f).filter((x) => {
    const t = electionTitle(x);
    return !seen.has(t) && seen.add(t);
  });
}

let planPick = 0; // ชุดที่แสดงบนจอ

// แผนงาน 1 ชุด · editable: ปุ่มแก้ไขและป้ายวันนี้ (เฉพาะบนจอ)
function planSheet(ctx, f, editable) {
  const body = planGroups(ctx, f).map((month) => {
    const head = `<tbody class="plan-month"><tr><th colspan="3" scope="colgroup">${esc(month.label)}</th></tr></tbody>`;
    return head + month.days.map((day) => {
      const now = day.s <= TODAY && TODAY <= day.e;
      const cls = ['plan-day', day.e < TODAY ? 'past' : '', now ? 'now' : '', day.items.some((r) => r.election) ? 'election' : ''].filter(Boolean).join(' ');
      const rows = day.items.map((r, i) => {
        const date = i ? '' : `<td class="plan-date" rowspan="${day.items.length}">${esc(planDate(day.s, day.e))}`
          + (editable ? `${now ? '<span class="badge no-print">วันนี้</span>' : ''}`
            + `<button type="button" class="plan-edit no-print" data-day="${day.s}" aria-label="${esc(`แก้ไขกำหนดการ ${fmtFull(day.s)}`)}">แก้ไข</button>` : '')
          + '</td>';
        return `<tr${i ? ' class="cont"' : ''}>${date}`
          + `<td class="plan-act">${r.election ? `<b>- ${esc(r.text)}</b>` : `- ${esc(r.text)}`}</td>`
          + `<td class="plan-note">${esc(r.note || '')}</td></tr>`;
      }).join('');
      return `<tbody class="${cls}">${rows}</tbody>`;
    }).join('');
  }).join('');

  return `<div class="plan-sheet"><header class="plan-head"><h2>${esc(planTitle(f))}</h2>`
    + `<p>เลือกตั้งใน${esc(fmtFull(ctx.E))}</p></header>`
    + '<table class="plan-table"><colgroup><col class="c-date"><col><col class="c-note"></colgroup>'
    + '<thead><tr><th scope="col">วัน/เดือน/ปี</th><th scope="col">การดำเนินการ</th><th scope="col">หมายเหตุ</th></tr></thead>'
    + `${body}</table></div>`;
}

function renderPlan(ctx) {
  const sets = planSets();
  planPick = Math.min(planPick, sets.length - 1);
  const pick = $('#plan-pick');
  pick.closest('.field').hidden = sets.length < 2;
  pick.replaceChildren(...sets.map((x, i) => h('option', { value: i }, `ชุดที่ ${i + 1}/${sets.length} · ${electionTitle(x)}`)));
  pick.value = String(planPick);
  $('#btn-print-plan').textContent = sets.length > 1 ? `พิมพ์แผนงาน / บันทึก PDF (${sets.length} ชุด)` : 'พิมพ์แผนงาน / บันทึก PDF';
  $('#plan').innerHTML = planSheet(ctx, sets[planPick], true);
}

// พิมพ์แผนงานทุกชุด ชุดละหน้าใหม่ บนกระดาษ A4 แนวตั้ง (ตารางควบคุมพิมพ์แนวนอนตามปกติ)
function printPlan() {
  if (!lastCtx) return;
  const box = $('#plan-print');
  box.innerHTML = planSets().map((x) => planSheet(lastCtx, x, false)).join('');
  const page = h('style', { id: 'plan-page' }, '@page { size: A4 portrait; margin: 12mm 15mm; }');
  document.head.append(page);
  document.body.classList.add('print-plan');
  const done = () => {
    page.remove();
    document.body.classList.remove('print-plan');
    box.innerHTML = '';
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

// แจ้งเมื่อตารางนี้ใช้กำหนดการที่แก้เอง
function renderCustomBanner() {
  const custom = customRulesOf(state.form);
  $('#custom-banner').innerHTML = custom
    ? `<span>ตารางนี้ใช้กำหนดการที่แก้ไขเฉพาะการเลือกตั้งนี้ (${esc(caseOf(state.form).name)})</span>`
      + '<span class="spacer"></span>'
      + '<button type="button" class="btn" data-custom="reset">คืนค่ากำหนดการมาตรฐาน</button>'
      + '<button type="button" class="btn" data-custom="promote">บันทึกเป็นกำหนดการมาตรฐาน</button>'
    : '<span>แตะช่องวันที่หรือกล่องข้อความในตาราง เพื่อแก้ไข เพิ่ม หรือย้ายกิจกรรมของวันนั้น</span>';
  $('#custom-banner').classList.toggle('active', !!custom);
}

function onCustomBanner(e) {
  const btn = e.target.closest('[data-custom]');
  if (!btn) return;
  const f = state.form;
  const caseId = caseOf(f).id;
  if (btn.dataset.custom === 'reset') {
    if (!confirm('ล้างการแก้ไขในตารางนี้ แล้วกลับไปใช้กำหนดการมาตรฐาน?')) return;
  } else {
    if (!confirm(`ใช้กำหนดการของตารางนี้เป็นกำหนดการมาตรฐานของ "${caseOf(f).name}" สำหรับทุกการเลือกตั้ง?`)) return;
    state.config.rulesByCase[caseId] = clone(customRulesOf(f));
    saveConfig(state.config);
    if (typeof admin !== 'undefined' && !admin.dirty) admin.draft = null;
  }
  delete f.customRules[caseId];
  saveForm();
  render();
}

function render() {
  renderHints();
  renderCustomBanner();
  $('.seg [data-view="top"]').textContent = `ช่วงที่ 1 · ${limitOf(state.form)} วัน`;
  $('.seg [data-view="bottom"]').textContent = `ช่วงที่ 2 · ${cfg().general.split} วัน`;
  const ctx = compute();
  lastCtx = ctx;
  renderTitle(ctx);
  renderDashboard(ctx);
  if (!ctx) {
    $('#charts').innerHTML = '<p class="empty">กรุณาเลือกวันเลือกตั้งเพื่อสร้างตาราง</p>';
    ['#notes', '#plan', '#alerts'].forEach((s) => { $(s).innerHTML = ''; });
    renderPrintCopies(null);
    return;
  }
  renderAlerts(ctx);
  renderCharts(ctx);
  renderNotes(ctx);
  renderPlan(ctx);
  renderPrintCopies(ctx);
}

// ทุกเขต: สร้างหน้าสำหรับพิมพ์หน้าละเขต (ตารางเหมือนกัน ต่างกันที่หัวตาราง) ซ่อนไว้บนจอ
function renderPrintCopies(ctx) {
  const f = state.form;
  const n = ctx ? allZonesCount(f) : 0;
  const multiple = f.members.length > 0;
  const copies = ctx ? printElectionsFor(f) : [];
  const box = $('#print-copies');
  $('#paper').classList.toggle('no-print', !!ctx && (n > 0 || multiple));
  $('#btn-print').textContent = multiple && ctx ? `พิมพ์ / บันทึก PDF (${copies.length} หน้า)`
    : n > 0 ? `พิมพ์ / บันทึก PDF (${n} เขต ${n} หน้า)` : 'พิมพ์ / บันทึก PDF';
  if (!ctx || (!n && !multiple)) { box.innerHTML = ''; return; }
  const charts = $('#charts').innerHTML;
  const notes = $('#notes').innerHTML;
  const t2 = $('#t2').textContent;
  let html = '';
  copies.forEach((election, i) => {
    // id ของลูกศรใน SVG ต้องไม่ซ้ำกันในแต่ละหน้า
    const body = charts.replace(/(c-(?:top|bottom))-ah/g, `$1-p${i + 1}-ah`);
    html += '<section class="paper print-copy">'
      + `<header class="paper-head"><h2>${esc(`${cfg().general.tablePrefix}${electionTitle(election)}`)}</h2><p>${esc(t2)}</p></header>`
      + `${body}<div class="notes-wrap">${notes}</div></section>`;
  });
  box.innerHTML = html;
}

let renderTimer = 0;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

/* ---------------- ฟอร์ม ---------------- */

const FIELDS = { caseType: 'f-case', vacancy: 'f-vacancy', election: 'f-election', notes: 'f-notes' };

// เปิดโหมดอัตโนมัติอยู่ → ตั้งวันเลือกตั้งตามวันเริ่มต้นและจำนวนวันของกรณีที่เลือก
function applyAutoElection() {
  const iso = autoElectionISO(state.form);
  if (!state.form.autoElection || !iso) return;
  state.form.election = iso;
  $('#f-election').value = iso;
}

function renderCaseOptions() {
  const f = state.form;
  if (!cfg().cases.some((c) => c.id === f.caseType)) f.caseType = cfg().cases[0].id;
  $('#f-case').innerHTML = cfg().cases
    .map((c) => `<option value="${esc(c.id)}"${c.id === f.caseType ? ' selected' : ''}>${esc(c.name)} (ภายใน ${c.days} วัน)</option>`)
    .join('');
}

function bindForm() {
  renderCaseOptions();
  Object.entries(FIELDS).forEach(([key, id]) => {
    const el = document.getElementById(id);
    el.value = state.form[key] ?? '';
    el.addEventListener('input', () => {
      state.form[key] = el.value;
      if (key === 'vacancy' || key === 'caseType') applyAutoElection();
      // แก้วันเลือกตั้งเอง → ปิดโหมดอัตโนมัติ (ยกเว้นตรงกับวันที่คำนวณได้)
      if (key === 'election' && isISO(state.form.vacancy)) state.form.autoElection = el.value === autoElectionISO(state.form);
      $('#f-auto').checked = !!state.form.autoElection;
      saveForm();
      scheduleRender();
    });
  });
  $('#f-auto').addEventListener('change', (e) => {
    state.form.autoElection = e.target.checked;
    applyAutoElection();
    saveForm();
    render();
  });
}

/* ---------------- ช่องเลือกแบบค้นหา: ตำแหน่ง / ประเภท / จังหวัด / อำเภอ / ชื่อ อปท. / เขต ---------------- */

const combos = {};

function syncOrgControls() {
  const f = state.form;
  const t = orgTypeOf(f);
  if (!cfg().orgTypes.some((x) => x.id === f.orgType)) f.orgType = t.id;
  const posLabel = f.position === 'chief' ? cfg().positions.chief : f.position === 'member' ? cfg().positions.member : f.position;
  combos.position.set(f.position, posLabel);
  combos.orgType.set(t.id, t.name);
  combos.province.set(f.province || '', f.province || '');
  combos.district.set(f.district || '', f.district || '');
  combos.district.setDisabled(!f.province && ADMIN.length > 0);
  if (t.useProvince) {
    combos.orgName.set('', f.province || '');
    combos.orgName.setDisabled(true);
  } else {
    combos.orgName.set(f.orgName || '', f.orgName || '');
    combos.orgName.setDisabled(false);
  }
  const chief = f.position === 'chief';
  // เขตต้องอยู่ในจำนวนเขตจริงของ อปท. นี้
  const { n } = zoneCountFor(cfg(), f);
  const validZone = f.zone === ALL_ZONES ? n > 0 : !(n > 0 && f.zone) || (/^\d+$/.test(f.zone) && Number(f.zone) >= 1 && Number(f.zone) <= n);
  if (!chief && !validZone) {
    f.zone = '';
    saveForm();
  }
  const zoneLabel = f.zone === ALL_ZONES ? `ทุกเขต (1–${n})` : f.zone || '';
  combos.zone.set(chief ? '' : f.zone || '', chief ? 'ไม่มี (เลือกตั้งนายก)' : zoneLabel);
  combos.zone.setDisabled(chief);
  renderZoneHint();
  $('#h-office').innerHTML = `หัวตาราง: <b>${esc(electionTitle(f))}</b>`;
  syncAdditionalMembers();
}

// บรรทัดใต้ช่องเขต: บอกจำนวนเขตของ อปท. นี้ และแก้ได้ทันที
function renderZoneHint(editing = false, f = state.form, el = $('#h-zone')) {
  el.classList.remove('prompt');
  if (f.position === 'chief') { el.replaceChildren(); return; }
  const { n, source, type } = zoneCountFor(cfg(), f);
  const name = type.useProvince ? `${type.name}${f.province || ''}` : `${type.name}${f.orgName || ''}`;
  if (editing) {
    const input = h('input', { type: 'number', min: 0, max: 200, value: n || '', class: 'zone-count', 'aria-label': `จำนวนเขตเลือกตั้งของ${name}` });
    const save = () => {
      const v = parseInt(input.value, 10);
      setZoneCount(cfg(), f, Number.isFinite(v) && v > 0 ? Math.min(v, 200) : 0);
      saveConfig(cfg());
      if (typeof admin !== 'undefined' && !admin.dirty) admin.draft = null;
      syncOrgControls();
      scheduleRender();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') renderZoneHint(false, f, el);
    });
    el.replaceChildren(`${name} มี`, input, 'เขต ',
      h('button', { type: 'button', class: 'link-btn ok', onclick: save }, 'บันทึก'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => renderZoneHint(false, f, el) }, 'ยกเลิก'),
      h('span', {}, ' · ใส่ 0 หรือเว้นว่างเพื่อกลับไปใช้ข้อมูลอัตโนมัติ'));
    input.focus();
    input.select();
    return;
  }
  const edit = (label) => h('button', { type: 'button', class: 'link-btn ok', onclick: () => renderZoneHint(true, f, el) }, label);
  const sourceLink = (url, label) => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label);
  if (source === 'villages') el.replaceChildren(`${name} มี ${n} เขต ตามจำนวน ${n} หมู่บ้าน · `,
    sourceLink('https://gdcatalog.go.th/dataset/gdpublish-nrd2c', 'ข้อมูลหมู่บ้าน'), ' ', edit('แก้เฉพาะแห่งนี้'));
  else if (source === 'ect') el.replaceChildren(`${name} มี ${n} เขต · `,
    sourceLink(window.PAO_ZONES_SOURCE.url, 'ข้อมูล ECT (เลือกตั้ง 1 ก.พ. 2568)'), ' ', edit('แก้เฉพาะแห่งนี้'));
  else if (source === 'org') el.replaceChildren(`${name} มี ${n} เขต (กำหนดเอง) `, edit('แก้'));
  else if (source === 'type') el.replaceChildren(`${type.name}มี ${n} เขต `, edit('แก้เฉพาะแห่งนี้'));
  else {
    el.classList.add('prompt');
    el.replaceChildren('ยังไม่ทราบจำนวนเขตของ อปท. นี้ ', edit('ระบุจำนวนเขต'));
  }
  if (f.zone === ALL_ZONES && n > 0) el.append(` · พิมพ์แยกหน้าละเขต รวม ${n} หน้า`);
}

function bindOrgCombos() {
  const f = state.form;
  const changed = () => {
    saveForm();
    syncOrgControls();
    scheduleRender();
  };

  combos.position = createCombo($('#f-position'), {
    allowFree: true,
    getItems: () => [
      { value: 'member', label: cfg().positions.member },
      { value: 'chief', label: cfg().positions.chief },
    ],
    onSelect: (v) => { f.position = v || 'member'; changed(); },
  });

  combos.orgType = createCombo($('#f-orgtype'), {
    getItems: () => cfg().orgTypes.map((t) => ({ value: t.id, label: t.name })),
    onSelect: (v) => { f.orgType = v; changed(); },
  });

  combos.province = createCombo($('#f-province'), {
    allowFree: !ADMIN.length,
    getItems: () => ADMIN.map(([n]) => ({ value: n, label: n })),
    onSelect: (v) => {
      if (v === f.province) return;
      f.province = v;
      f.district = '';
      f.orgName = '';
      changed();
    },
  });

  combos.district = createCombo($('#f-district'), {
    allowFree: !ADMIN.length,
    emptyText: 'ไม่พบอำเภอ (เลือกจังหวัดก่อน)',
    getItems: () => districtsOf(f.province).map(([n]) => ({ value: n, label: n })),
    onSelect: (v) => {
      if (v === f.district) return;
      f.district = v;
      f.orgName = '';
      changed();
    },
  });

  // ชื่อ อปท.: ตำบลในอำเภอ + ชื่ออำเภอ/จังหวัด (เทศบาลบางแห่งใช้ชื่อเมือง) หรือพิมพ์เอง
  combos.orgName = createCombo($('#f-orgname'), {
    allowFree: true,
    getItems: () => {
      const tambons = tambonsOf(f.province, f.district);
      const others = [...new Set([f.district, f.province].filter((n) => n && !tambons.includes(n)))];
      return [
        ...tambons.map((n) => ({ value: n, label: n, group: `ตำบลในอำเภอ${f.district}` })),
        ...others.map((n) => ({ value: n, label: n, group: 'ชื่ออำเภอ / จังหวัด' })),
      ];
    },
    onSelect: (v) => { f.orgName = v; changed(); },
  });

  // เขต: เลือกได้เฉพาะ 1..จำนวนเขตจริง · ถ้ายังไม่ทราบจำนวนเขต พิมพ์เองได้
  combos.zone = createCombo($('#f-zone'), {
    allowFree: () => zoneCountFor(cfg(), f).n === 0,
    emptyText: 'พิมพ์เขตเลือกตั้ง หรือระบุจำนวนเขตด้านล่าง',
    getItems: () => {
      const { n } = zoneCountFor(cfg(), f);
      return n ? [
        { value: '', label: '— ไม่ระบุเขต —' },
        { value: ALL_ZONES, label: `ทุกเขต (1–${n})` },
        ...Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      ] : [];
    },
    onSelect: (v) => { f.zone = v; changed(); },
  });

  syncOrgControls();
}

function bindView() {
  const buttons = document.querySelectorAll('.seg button');
  const sync = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.form.view)));
  buttons.forEach((b) => b.addEventListener('click', () => {
    state.form.view = b.dataset.view;
    saveForm();
    sync();
    render();
  }));
  sync();
}

/* ---------------- CSV ---------------- */

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadCSV(ctx) {
  // รูปแบบเดียวกับแผนงาน: ทุกชุดต่อกัน แต่ละชุดมีชื่อ แถวเดือน แล้วรายการของแต่ละวัน
  const rows = [];
  planSets().forEach((f, k) => {
    if (k) rows.push([]);
    rows.push([planTitle(f)], [`เลือกตั้งใน${fmtFull(ctx.E)}`], [],
      ['วัน/เดือน/ปี', 'การดำเนินการ', 'หมายเหตุ', 'นับถอยหลัง (วัน)', 'วันที่เริ่ม', 'วันที่สิ้นสุด']);
    planGroups(ctx, f).forEach((month) => {
      rows.push([month.label]);
      month.days.forEach((day) => day.items.forEach((r, i) => {
        rows.push([i ? '' : planDate(day.s, day.e), `- ${r.text}`, r.note || '', cdText(ctx.E, r.s, r.e), toISO(r.s), toISO(r.e)]);
      }));
    });
  });
  const csv = '﻿' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  downloadFile(`แผนงานการเลือกตั้ง_${toISO(ctx.E)}.csv`, csv, 'text/csv;charset=utf-8');
}

/* ---------------- ใช้การตั้งค่าใหม่ (หลังบันทึกจากหน้าผู้ดูแลระบบ) ---------------- */

function applyConfig() {
  const g = cfg().general;
  document.title = g.appTitle;
  $('#app-title').textContent = g.appTitle;
  $('#app-subtitle').textContent = g.appSubtitle;
  renderCaseOptions();
  if (!cfg().orgTypes.some((t) => t.id === state.form.orgType)) state.form.orgType = cfg().orgTypes[0].id;
  applyAutoElection();
  saveForm();
  if (combos.position) syncOrgControls();
  measure.clear();
}

/* ---------------- หน้าหลัก / หน้าผู้ดูแลระบบ ---------------- */

function route() {
  const admin = location.hash === '#admin';
  if (!admin && typeof adminCanLeave === 'function' && !adminCanLeave()) {
    history.replaceState(null, '', '#admin');
    return;
  }
  $('#app-view').hidden = admin;
  $('#admin-view').hidden = !admin;
  $('#nav-admin').hidden = admin;
  $('#nav-home').hidden = !admin;
  if (admin) {
    openAdmin();
  } else {
    applyConfig();
    render();
  }
  window.scrollTo(0, 0);
}

function init() {
  applyConfig();
  bindForm();
  bindOrgCombos();
  bindAdditionalMembers();
  bindView();
  $('#btn-print').addEventListener('click', () => window.print());
  $('#btn-print-plan').addEventListener('click', printPlan);
  $('#plan-pick').addEventListener('change', (e) => {
    planPick = Number(e.target.value) || 0;
    if (lastCtx) renderPlan(lastCtx);
  });
  $('#btn-csv').addEventListener('click', () => { if (lastCtx) downloadCSV(lastCtx); });
  // แตะช่องวันที่ กล่องข้อความ หรือปุ่ม "แก้ไข" ในแผนงาน → เปิดหน้าต่างแก้กำหนดการของวันนั้น
  const openFromEvent = (e) => {
    const el = e.target.closest('[data-day]');
    if (el && lastCtx) openDayEditor(Number(el.dataset.day));
  };
  $('#charts').addEventListener('click', openFromEvent);
  $('#plan').addEventListener('click', openFromEvent);
  $('#custom-banner').addEventListener('click', onCustomBanner);
  window.addEventListener('hashchange', route);
  route();

  // นาฬิกาเดินทุกวินาที และวาดใหม่ทั้งหมดเมื่อขึ้นวันใหม่
  setInterval(() => {
    const t = calcToday();
    if (t !== TODAY) {
      TODAY = t;
      if (location.hash !== '#admin') render();
    } else {
      updateClock();
    }
  }, 1000);

  // วัดความกว้างข้อความใหม่เมื่อฟอนต์ Sarabun โหลดเสร็จ
  if (document.fonts) {
    const refresh = () => { measure.clear(); if (location.hash !== '#admin') render(); };
    document.fonts.ready.then(refresh);
    document.fonts.addEventListener('loadingdone', refresh);
  }
}

document.addEventListener('DOMContentLoaded', init);
