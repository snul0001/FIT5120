"""
Step 3 - collapse the *_with_anzsco.csv files to ONE row per
(occupation group, skill).

The new crosswalk maps each occupation group to 1-4 O*NET codes, with
Match_score acting as a weight (sums to 1 within a group). So the same
skill arrives several times for a group and has to be combined:

  essential / transferable skills
      score = sum(w_i * score_i) / sum(w_i)
      over the group's O*NET codes that have data for that skill.
      Dividing by sum(w_i) renormalises the weights when an O*NET code
      is missing from the source, `coverage_weight` shows how much of
      the group's original weight was actually backed by data.

  software skills (rank 1-4, 1 = best)
      rank         = best rank across the group's O*NET codes
      weight_share = share of the group's weight whose O*NET codes list
                     that skill (tie-breaker: 1.0 = every mapped code)

After grouping, two clean-up rules are applied:

  1. essential / transferable skills with a group score below MIN_SCORE
     are removed.
  2. software skills from the same product family are merged into one
     theme (Microsoft Excel + Microsoft Word -> "Microsoft"), using the
     THEMES list below. The merged row keeps the best rank of its
     members and lists them in the `members` column.

  3. software skills are trimmed per group: tools with neither flag
     (rank 4) are dropped and at most SOFTWARE_MAX are kept, best
     first. If a group has fewer than SOFTWARE_MIN flagged tools, its
     best rank-4 tools are kept to top it up to SOFTWARE_MIN.

This script is the single source of truth for exclusions: downstream
scripts read the *_by_anzsco files and inherit them.
"""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "output"

SOFTWARE_SRC = OUTPUT_DIR / "software_skills_soc15_ranked_with_anzsco.csv"
SCORED_SRC = {
    "essential_skills": OUTPUT_DIR / "essential_skills_ict_ranked_with_anzsco.csv",
    "transferable_skills": OUTPUT_DIR / "transferable_skills_ict_ranked_with_anzsco.csv",
}

# Exclusions by ANZSCO code or code prefix (none by default).
EXCLUDE_IDS: set[str] = set()
EXCLUDE_PREFIXES: tuple[str, ...] = ()


# Essential / transferable skills scoring below this (0-100) are dropped.
MIN_SCORE = 20

# Software tags kept per group: between SOFTWARE_MIN and SOFTWARE_MAX.
SOFTWARE_MIN = 10
SOFTWARE_MAX = 15
UNFLAGGED_RANK = 4          # neither Hot Technology nor In Demand

# Software themes: (theme name, regex). First match wins, case-insensitive.
# A skill that matches nothing keeps its own name. Add or remove lines freely.
THEMES = [
    ("Microsoft", r"\bmicrosoft\b"),
    ("Adobe", r"\badobe\b"),
    ("Google", r"\bgoogle\b"),
    ("Amazon Web Services", r"\bamazon\b|\baws\b"),
    ("Oracle", r"\boracle\b"),
    ("SAP", r"\bsap\b"),
    ("IBM", r"\bibm\b"),
    ("Apple", r"\bapple\b"),
    ("Autodesk", r"\bautodesk\b"),
    ("Atlassian", r"\batlassian\b"),
    ("Salesforce", r"\bsalesforce\b"),
    ("Cisco", r"\bcisco\b"),
    ("Intuit", r"\bintuit\b"),
]
_THEMES = [(name, re.compile(pat, re.I)) for name, pat in THEMES]


def theme_of(skill: str) -> str:
    for name, rx in _THEMES:
        if rx.search(skill):
            return name
    return skill


def in_scope(r) -> bool:
    gid = r["anzsco_code"].strip()
    return bool(gid) and gid not in EXCLUDE_IDS and not gid.startswith(EXCLUDE_PREFIXES or ("\0",))


def load(path: Path):
    if not path.exists():
        print(f"skipping {path.name} (not found - run map_onet_to_anzsco.py first)")
        return []
    with open(path, newline="", encoding="utf-8-sig") as f:
        return [r for r in csv.DictReader(f) if in_scope(r)]


def write(label: str, rows: list[dict], fieldnames: list[str]):
    csv_path = OUTPUT_DIR / f"{label}_by_anzsco.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    grouped = {}
    for r in rows:
        g = grouped.setdefault(r["anzsco_code"], {
            "anzsco_code": r["anzsco_code"],
            "anzsco_title": r["anzsco_title"],
            "skills": [],
        })
        g["skills"].append({k: v for k, v in r.items()
                            if k not in ("anzsco_code", "anzsco_title")})
    with open(OUTPUT_DIR / f"{label}_by_anzsco.json", "w", encoding="utf-8") as f:
        json.dump(list(grouped.values()), f, indent=2, ensure_ascii=False)

    print(f"[{label}] {len(rows)} rows, {len(grouped)} occupation groups -> {csv_path.name} / .json")


def group_scored(label: str, path: Path):
    rows = load(path)
    if not rows:
        return
    acc = {}
    for r in rows:
        key = (r["anzsco_code"], r["element_id"])
        a = acc.setdefault(key, {
            "anzsco_code": r["anzsco_code"],
            "anzsco_title": r["anzsco_title"],
            "element_id": r["element_id"],
            "element_name": r["element_name"],
            "w": 0.0, "imp": 0.0, "lvl": 0.0, "pri": 0.0, "socs": set(),
        })
        if r["soc_code"] in a["socs"]:
            continue
        w = float(r["match_score"])
        a["socs"].add(r["soc_code"])
        a["w"] += w
        a["imp"] += w * float(r["importance_score"])
        a["lvl"] += w * float(r["level_score"])
        a["pri"] += w * float(r["priority_score"])

    out = []
    for a in acc.values():
        w = a["w"]
        out.append({
            "anzsco_code": a["anzsco_code"],
            "anzsco_title": a["anzsco_title"],
            "element_id": a["element_id"],
            "element_name": a["element_name"],
            "importance_score": round(a["imp"] / w, 2),
            "level_score": round(a["lvl"] / w, 2),
            "priority_score": round(a["pri"] / w, 2),
            "coverage_weight": round(w, 3),
            "n_soc_codes": len(a["socs"]),
            "source_soc_codes": "; ".join(sorted(a["socs"])),
        })
    before = len(out)
    out = [r for r in out if r["priority_score"] >= MIN_SCORE]
    print(f"[{label}] removed {before - len(out)} of {before} skills scoring below {MIN_SCORE}")
    out.sort(key=lambda r: (r["anzsco_code"], -r["priority_score"], r["element_name"]))
    write(label, out, list(out[0].keys()))

    low = sorted({(r["anzsco_code"], r["coverage_weight"]) for r in out if r["coverage_weight"] < 0.999})
    if low:
        print(f"  groups not fully covered by source data (id, weight covered): {low}")


def group_software():
    rows = load(SOFTWARE_SRC)
    if not rows:
        return
    # weight of each O*NET code per group (only codes present in the file)
    soc_w = defaultdict(dict)
    for r in rows:
        soc_w[r["anzsco_code"]][r["soc_code"]] = float(r["match_score"])

    acc = {}
    for r in rows:
        original = r["workplace_example"].strip()
        skill = theme_of(original)
        key = (r["anzsco_code"], skill.lower())
        rank = int(r["rank"])
        a = acc.get(key)
        if a is None or rank < a["rank"]:
            keep = a or {"socs": set(), "members": set()}
            a = acc[key] = {
                "anzsco_code": r["anzsco_code"],
                "anzsco_title": r["anzsco_title"],
                "skill": skill,
                "element_id": r["element_id"],
                "element_name": r["element_name"],
                "hot_technology": r["hot_technology"],
                "in_demand": r["in_demand"],
                "rank": rank,
                "socs": keep["socs"],
                "members": keep["members"],
            }
        a["socs"].add(r["soc_code"])
        a["members"].add(original)

    out, merged = [], 0
    for a in acc.values():
        weights = soc_w[a["anzsco_code"]]
        socs, members = a.pop("socs"), a.pop("members")
        a["weight_share"] = round(sum(weights[s] for s in socs) / sum(weights.values()), 3)
        a["n_soc_codes"] = len(socs)
        a["source_soc_codes"] = "; ".join(sorted(socs))
        a["n_members"] = len(members)
        a["members"] = "; ".join(sorted(members, key=str.lower))
        merged += len(members) - 1
        out.append(a)
    print(f"[software_skills] {merged} skills merged into themes "
          f"({len(out) + merged} -> {len(out)} rows)")
    out.sort(key=lambda r: (r["anzsco_code"], r["rank"], -r["weight_share"], r["skill"].lower()))

    # trim each group: flagged tools up to SOFTWARE_MAX, topped up with
    # rank-4 tools only when fewer than SOFTWARE_MIN are flagged
    by_group = defaultdict(list)
    for r in out:
        by_group[r["anzsco_code"]].append(r)          # already best-first
    trimmed, topped_up, short = [], [], []
    for gid, rows_g in by_group.items():
        flagged = [r for r in rows_g if r["rank"] < UNFLAGGED_RANK]
        keep = flagged[:SOFTWARE_MAX]
        if len(keep) < SOFTWARE_MIN:
            unflagged = [r for r in rows_g if r["rank"] >= UNFLAGGED_RANK]
            keep += unflagged[:SOFTWARE_MIN - len(keep)]
            topped_up.append(gid)
            if len(keep) < SOFTWARE_MIN:
                short.append((gid, len(keep)))
        trimmed += keep
    print(f"[software_skills] trimmed to {SOFTWARE_MIN}-{SOFTWARE_MAX} per group: "
          f"{len(out)} -> {len(trimmed)} rows")
    print(f"  groups topped up with rank-{UNFLAGGED_RANK} tools: {len(topped_up)} {sorted(topped_up)}")
    if short:
        print(f"  groups with fewer than {SOFTWARE_MIN} tools in total (id, count): {sorted(short)}")
    out = trimmed
    write("software_skills", out, list(out[0].keys()))


if __name__ == "__main__":
    group_software()
    for label, path in SCORED_SRC.items():
        group_scored(label, path)
