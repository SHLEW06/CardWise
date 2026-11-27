/* ============================================================================
   exactAllocate.js — exact replacement for the greedy fill in allocateSpend.
   ----------------------------------------------------------------------------
   Same inputs CardWise already builds (lanes from lanesFor, with rate × cpp as
   `pct`, shared `pools`, and `exclusive` one-category groups). Instead of
   sorting lanes by % and filling in order, it solves the routing as a linear
   program:

       maximize   Σ pct_l · x_l / 100
       subject to Σ_{l in bucket b} x_l ≤ spend_b      (every dollar once)
                  Σ_{l uses pool p} x_l ≤ cap_p        (caps, rotating, brand)
                  x_l ≥ 0

   All right-hand sides are ≥ 0, so the slack basis is feasible and a plain
   primal simplex (Bland's rule, no Phase I) is exact. Exclusive groups
   ("5% on ONE category", "pick your 3% category") are enumerated: one LP per
   combination of choices, best one wins. Typical size: ~20–40 rows,
   ~30–120 columns, a handful of combinations.
   Pure, no dependencies.
   ========================================================================== */

const EPS = 1e-9;

/** max c·x s.t. A x ≤ b, x ≥ 0, with b ≥ 0. Returns { value, x }. */
export function simplexMax(c, A, b) {
  const m = A.length, n = c.length;
  // Tableau rows: [A | I | b]; objective row: [-c | 0 | 0]
  const W = n + m + 1;
  const T = Array.from({ length: m + 1 }, () => new Float64Array(W));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) T[i][j] = A[i][j];
    T[i][n + i] = 1;
    T[i][W - 1] = b[i];
  }
  for (let j = 0; j < n; j++) T[m][j] = -c[j];
  const basis = Array.from({ length: m }, (_, i) => n + i);
  for (let iter = 0; iter < 50 * (m + n); iter++) {
    // Bland's rule: lowest-index improving column (guarantees termination)
    let col = -1;
    for (let j = 0; j < n + m; j++) if (T[m][j] < -EPS) { col = j; break; }
    if (col < 0) break;
    let row = -1, best = Infinity;
    for (let i = 0; i < m; i++) {
      if (T[i][col] > EPS) {
        const r = T[i][W - 1] / T[i][col];
        if (r < best - EPS || (Math.abs(r - best) <= EPS && basis[i] < basis[row])) { best = r; row = i; }
      }
    }
    if (row < 0) throw new Error("unbounded");            // cannot happen: every lane sits in a bucket row
    const pv = T[row][col];
    for (let j = 0; j < W; j++) T[row][j] /= pv;
    for (let i = 0; i <= m; i++) {
      if (i === row) continue;
      const f = T[i][col];
      if (Math.abs(f) > EPS) for (let j = 0; j < W; j++) T[i][j] -= f * T[row][j];
    }
    basis[row] = col;
  }
  const x = new Float64Array(n);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][W - 1];
  return { value: T[m][W - 1], x };
}

/**
 * lanes: [{ cardId, bucket, pct, pools: [{ id, cap }], exclusive, option?, distinct? }]
 *   exclusive  a one-pick group: only lanes whose option (default: the
 *              bucket) matches the group's pick earn. One option may cover
 *              several buckets ("gas & EV", "online incl. streaming").
 *   distinct   groups sharing this key must pick different options (US Bank
 *              Cash+: two different 5% categories). They pick in increasing
 *              option order, so each pair is tried once.
 * spend: { bucket: dollars }
 * → { total, rows: [{ lane, dollars, value }], choice: { groupId: option } }
 */
export function exactAllocate(lanes, spend) {
  const usable = lanes.filter((l) => l.pct > 0 && spend[l.bucket] > 0);
  const optOf = (l) => l.option ?? l.bucket;
  const groups = {}, distinctOf = {};
  for (const l of usable) if (l.exclusive) {
    (groups[l.exclusive] ||= new Set()).add(optOf(l));
    if (l.distinct) distinctOf[l.exclusive] = l.distinct;
  }
  const gids = Object.keys(groups).sort();
  const options = gids.map((g) => [...groups[g]].sort());
  let best = { total: 0, rows: [], choice: {} };
  const pick = {};
  const solveFor = () => {
    const L = usable.filter((l) => !l.exclusive || pick[l.exclusive] === optOf(l));
    if (!L.length) return;
    const rows = [], rhs = [];
    const bucketRow = {};
    for (const l of L) if (!(l.bucket in bucketRow)) { bucketRow[l.bucket] = rows.length; rows.push(new Float64Array(L.length)); rhs.push(spend[l.bucket]); }
    const poolRow = {};
    L.forEach((l, j) => {
      rows[bucketRow[l.bucket]][j] = 1;
      for (const p of l.pools || []) {
        if (!(p.id in poolRow)) { poolRow[p.id] = rows.length; rows.push(new Float64Array(L.length)); rhs.push(Number.isFinite(p.cap) ? Math.max(0, p.cap) : 1e12); }
        rows[poolRow[p.id]][j] = 1;
      }
    });
    const { value, x } = simplexMax(L.map((l) => l.pct / 100), rows, rhs);
    if (value > best.total + 1e-7) {
      const choice = Object.fromEntries(Object.entries(pick).filter(([, o]) => o != null));
      best = { total: value, choice, rows: L.map((l, j) => ({ lane: l, dollars: x[j], value: (x[j] * l.pct) / 100 })).filter((r) => r.dollars > 1e-6) };
    }
  };
  const lastPick = {};
  const rec = (k) => {
    if (k === gids.length) return solveFor();
    const g = gids[k], d = distinctOf[g];
    const after = d ? lastPick[d] : undefined;
    const allowed = after == null ? options[k] : options[k].filter((o) => o > after);
    if (!allowed.length) { pick[g] = null; rec(k + 1); delete pick[g]; return; }
    for (const o of allowed) {
      pick[g] = o;
      if (d) lastPick[d] = o;
      rec(k + 1);
    }
    if (d) lastPick[d] = after;
    delete pick[g];
  };
  rec(0);
  return best;
}
