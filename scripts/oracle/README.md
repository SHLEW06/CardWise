# Independent routing oracle

A second, unrelated solver checks CardWise's spend router
(`src/engine/v5/exactAllocate.js`). It does not use CardWise's own optimizer
as the answer key. It came from an external review on 2026-11-27 and was
extended here to cover multi-category options and distinct picks (BoA
Customized Cash, US Bank Cash+).

- `export.mjs` dumps 3,284 scenarios with CardWise's own lanes, rates and
  caps: a 36-case dining/gas grid, the 200 personas' held and recommended
  wallets, and 3,000 random everyday wallets.
- `solve.py` re-solves each scenario as a linear program with SciPy/HiGHS,
  trying every one-category choice. It enforces "different categories" for
  distinct picks on its own.
- `validate.mjs` compares `exactAllocate.js` with the HiGHS results.

```sh
cd scripts/oracle
node export.mjs && python3 solve.py && node validate.mjs
```

Result on 2026-11-27: on all 3,284 scenarios the two solvers differ by at
most $0.000000, and a routing takes about 0.09 ms. A handful of "solver below
greedy" lines are wallets worth $0, where the solver reports −1 as a
placeholder.
