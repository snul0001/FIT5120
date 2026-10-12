"""
Data analysis of job_growth from the output of cleaned_quarterly_unitgroup.csv, looking through percentage changes,
annual average as well as checking for less than 10k workers on some unitgroups

"""
import pandas as pd
from global_variable import CLEAN_FILE, GROWTH_FILE, YEARS

g = pd.read_csv(GROWTH_FILE, dtype={"code": str})
q = pd.read_csv(CLEAN_FILE, dtype={"code": str})
yoy = [f"pct_change_{a}_{b}" for a, b in zip(YEARS[:-1], YEARS[1:])]
head = g.total_pct_change_2020_2025

# 1. What the headline will show across the 81 cards
print("Grew / Fell:", (g.total_change_2020_2025 > 0).sum(), (g.total_change_2020_2025 < 0).sum())
print("Median headline %:", f"{head.median():.1%}", "range:", f"{head.min():.1%} to {head.max():.1%}")
bins = pd.cut(head, [-1, -.10, .10, .20, 10], labels=["fell 10%+", "within 10%", "rose 10-20%", "rose 20%+"])
print(bins.value_counts().reindex(["rose 20%+", "rose 10-20%", "within 10%", "fell 10%+"]).to_dict())

# 2. Jobs added against % change: do the two headline figures rank occupations alike?
top_jobs = set(g.nlargest(10, "total_change_2020_2025").code)
top_pct = set(g.nlargest(10, "total_pct_change_2020_2025").code)
print("Top-10 overlap (jobs vs %):", len(top_jobs & top_pct), "rank correlation:",
      round(g.total_change_2020_2025.rank().corr(head.rank()), 2))

# 3. What a headline can hide
print("Rose every year:", (g[yoy] > 0).all(axis=1).sum(), "| fell in at least one year:", (g[yoy] < 0).any(axis=1).sum())
print("Headline up, latest year down:", ((head > 0) & (g.pct_change_2024_2025 < 0)).sum(),
      "| Headline down, latest year up:", ((head < 0) & (g.pct_change_2024_2025 > 0)).sum())

# 4. Why the annual average: headline from one quarter against the annual-average headline
one = q.pivot_table(index="code", columns=["quarter", "year"], values="employed_k")
diffs = pd.DataFrame({m: one[(m, 2025)] / one[(m, 2020)] - 1 for m in ["February", "May", "August", "November"]})
ref = head.set_axis(g.code)
flips = (diffs.lt(0).ne(ref.lt(0), axis=0)).sum().sum()
diffs = diffs.sub(ref, axis=0).abs()
print("One-quarter headline vs Annual-average headline, ABS gap (points):",
      f"Median {diffs.stack().median() * 100:.1f}", f"90th pct {diffs.stack().quantile(.9) * 100:.1f}",
      "| Gap over 5 points:", f"{(diffs.stack() > .05).mean():.0%}",
      "| Opposite direction:", flips, "of", diffs.size)

# 5. Small unit group (fewer than 10k workers in 2020)
small = g.employed_2020_k < 10
sw = g[yoy].abs().median(axis=1)
print("Small:", small.sum(), "Median yearly swing small vs others:", f"{sw[small].median():.1%},", f"{sw[~small].median():.1%}")