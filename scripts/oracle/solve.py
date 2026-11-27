"""Independent exact allocator. Same lanes/caps/rates as CardWise, but solved as a
linear program (HiGHS) with every exclusive 'one category' choice enumerated,
instead of CardWise's sort-by-rate greedy fill."""
import json, itertools, sys
import numpy as np
from scipy.optimize import linprog

def solve(sc):
    lanes, spend = sc["lanes"], sc["spend"]
    opt = lambda l: l.get("option") or l["bucket"]
    groups, distinct = {}, {}
    for i, l in enumerate(lanes):
        if l["exclusive"] and l["pct"] > 0 and spend.get(l["bucket"], 0) > 0:
            groups.setdefault(l["exclusive"], set()).add(opt(l))
            if l.get("distinct"): distinct[l["exclusive"]] = l["distinct"]
    gkeys = sorted(groups)
    best, best_x = -1, None
    for choice in itertools.product(*[sorted(groups[g]) + ([None] if g in distinct else []) for g in gkeys]) if gkeys else [()]:
        pick = dict(zip(gkeys, choice))
        # independent check of "distinct": groups sharing a key never pick the same option
        seen = {}
        dup = False
        for g, o in pick.items():
            d = distinct.get(g)
            if d and o is not None:
                if o in seen.setdefault(d, set()): dup = True
                seen[d].add(o)
        if dup: continue
        ok = [i for i, l in enumerate(lanes) if l["pct"] > 0 and spend.get(l["bucket"], 0) > 0 and (not l["exclusive"] or pick.get(l["exclusive"]) == opt(l))]
        if not ok: continue
        rows, rhs = [], []
        for b, amt in spend.items():
            r = [1.0 if lanes[i]["bucket"] == b else 0.0 for i in ok]
            if any(r): rows.append(r); rhs.append(amt or 0)
        pools = {}
        for j, i in enumerate(ok):
            for p in lanes[i]["pools"]:
                pools.setdefault(p["id"], [p["cap"], []])[1].append(j)
        for pid, (cap, js) in pools.items():
            r = [0.0] * len(ok)
            for j in js: r[j] = 1.0
            rows.append(r); rhs.append(cap if cap is not None and cap < 1e15 else 1e12)
        c = -np.array([lanes[i]["pct"] / 100 for i in ok])
        res = linprog(c, A_ub=np.array(rows), b_ub=np.array(rhs), bounds=(0, None), method="highs")
        if res.status == 0 and -res.fun > best:
            best, best_x = -res.fun, {lanes[i]["card"] + "/" + lanes[i]["bucket"]: round(x) for i, x in zip(ok, res.x) if x > 0.5}
    return best, best_x

sc = json.load(open("scenarios.json"))
rows = []
for s in sc:
    opt, x = solve(s)
    rows.append({"id": s["id"], "set": s["meta"]["set"], "cards": s["cards"], "greedy": s["greedy"], "opt": opt, "gap": opt - s["greedy"], "x": x, "label": s["meta"].get("label")})
json.dump(rows, open("results.json", "w"))
neg = [r for r in rows if r["gap"] < -0.5]
print("solver below greedy (should be none):", len(neg), [ (r["id"], round(r["gap"],2)) for r in neg[:5]])
for st in ["grid", "held", "rec", "random"]:
    R = [r for r in rows if r["set"] == st]
    g = [r for r in R if r["gap"] >= 1]
    gaps = sorted(r["gap"] for r in g)
    print(f"{st:7s} n={len(R):4d}  misallocated(≥$1/yr)={len(g):4d} ({100*len(g)/max(1,len(R)):.1f}%)  "
          f"median gap={np.median(gaps) if gaps else 0:.0f}  p90={np.percentile(gaps,90) if gaps else 0:.0f}  max={max(gaps) if gaps else 0:.0f}  "
          f"total$ greedy={sum(r['greedy'] for r in R):.0f} opt={sum(r['opt'] for r in R):.0f}")
