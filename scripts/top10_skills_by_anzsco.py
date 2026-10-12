"""
Step 4 - top 10 skills per occupation group per skill type, with a
star rating for the front end.

Reads the *_by_anzsco.csv files from group_by_anzsco.py, which are
already one row per (occupation group, skill) and sorted best-first, so
this takes the first TOP_N of each.

Star rule (the same for all three skill types)
----------------------------------------------
Stars are relative WITHIN one occupation group and one skill type: the
group's strongest skill gets 5 stars and the others are rated against it.

    stars = 5 * strength / strongest strength in the group's top 10
            rounded to the nearest half star, minimum 1

    strength = priority_score          for essential / transferable
             = 5 - rank  (4, 3, 2, 1)  for software (rank 1 is best)

Software uses the rank only, so tools with the same rank in a group
always get the same stars.

Stars are NOT comparable between occupation groups: 5 stars means "the
most important for this occupation", not the same level everywhere.
"""
import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "output"
TOP_N = 10

# skill_type -> (file, skill-name column, score column)
SOURCES = {
    "software": ("software_skills_by_anzsco.csv", "skill", "rank"),
    "essential": ("essential_skills_by_anzsco.csv", "element_name", "priority_score"),
    "transferable": ("transferable_skills_by_anzsco.csv", "element_name", "priority_score"),
}


def strength(skill_type: str, r: dict) -> float:
    """Higher = stronger, whatever the skill type."""
    if skill_type == "software":
        return 5 - int(float(r["rank"]))
    return float(r["priority_score"])


def stars(value: float, best: float) -> float:
    """Rate a skill against the strongest one in its group (half-star steps)."""
    if best <= 0:
        return 1.0
    return min(5.0, max(1.0, round(5 * value / best * 2) / 2))


rows_out, nested = [], {}
for skill_type, (fname, name_col, score_col) in SOURCES.items():
    path = OUTPUT_DIR / fname
    if not path.exists():
        print(f"skipping {fname} (not found - run group_by_anzsco.py first)")
        continue
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    # first TOP_N rows per group (file order = best first within a group)
    top = {}
    for r in rows:
        picked = top.setdefault(r["anzsco_code"], [])
        if len(picked) < TOP_N:
            picked.append(r)

    for gid, picked in top.items():
        best = max(strength(skill_type, r) for r in picked)
        for position, r in enumerate(picked, start=1):
            s = stars(strength(skill_type, r), best)
            rows_out.append({
                "anzsco_code": gid,
                "anzsco_title": r["anzsco_title"],
                "skill_type": skill_type,
                "position": position,
                "skill": r[name_col],
                "score_type": score_col,
                "score": r[score_col],
                "stars": s,
            })
            g = nested.setdefault(gid, {"anzsco_code": gid,
                                        "anzsco_title": r["anzsco_title"]})
            g.setdefault(skill_type, []).append({"position": position,
                                                 "skill": r[name_col],
                                                 score_col: float(r[score_col]),
                                                 "stars": s})
    print(f"[{skill_type}] {len(top)} occupation groups")

rows_out.sort(key=lambda r: (r["anzsco_code"], list(SOURCES).index(r["skill_type"]), r["position"]))
if rows_out:
    with open(OUTPUT_DIR / "top10_skills_by_anzsco.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
        w.writeheader()
        w.writerows(rows_out)
    with open(OUTPUT_DIR / "top10_skills_by_anzsco.json", "w", encoding="utf-8") as f:
        json.dump([nested[k] for k in sorted(nested)], f, indent=2, ensure_ascii=False)
    print(f"written: top10_skills_by_anzsco.csv / .json ({len(rows_out)} rows, {len(nested)} groups)")
