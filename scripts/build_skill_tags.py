"""
Step 5 - flat, de-duplicated skill tag list per occupation group.

Pools ALL skills (no threshold) from the three *_by_anzsco.csv files. A
tag appearing in more than one skill type is kept once, with every
source listed.
"""
import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "output"

SOURCES = {
    "software": ("software_skills_by_anzsco.csv", "skill"),
    "essential": ("essential_skills_by_anzsco.csv", "element_name"),
    "transferable": ("transferable_skills_by_anzsco.csv", "element_name"),
}

titles, tags = {}, {}                   # tags[gid][tag.lower()] = {"tag", "sources"}
for source, (fname, name_col) in SOURCES.items():
    path = OUTPUT_DIR / fname
    if not path.exists():
        print(f"skipping {fname} (not found - run group_by_anzsco.py first)")
        continue
    with open(path, newline="", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            gid, tag = r["anzsco_code"], r[name_col].strip()
            if not tag:
                continue
            titles[gid] = r["anzsco_title"]
            t = tags.setdefault(gid, {}).setdefault(tag.lower(), {"tag": tag, "sources": []})
            if source not in t["sources"]:
                t["sources"].append(source)

rows_out, nested = [], []
for gid in sorted(tags):
    items = sorted(tags[gid].values(), key=lambda t: t["tag"].lower())
    nested.append({"anzsco_code": gid, "anzsco_title": titles[gid],
                   "tag_count": len(items), "tags": items})
    for t in items:
        rows_out.append({"anzsco_code": gid, "anzsco_title": titles[gid],
                         "tag": t["tag"], "sources": "; ".join(t["sources"])})

if rows_out:
    with open(OUTPUT_DIR / "skill_tags_by_anzsco.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
        w.writeheader()
        w.writerows(rows_out)
    with open(OUTPUT_DIR / "skill_tags_by_anzsco.json", "w", encoding="utf-8") as f:
        json.dump(nested, f, indent=2, ensure_ascii=False)
    print(f"written: skill_tags_by_anzsco.csv / .json ({len(rows_out)} tags, {len(nested)} groups)")
