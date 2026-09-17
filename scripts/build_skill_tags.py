"""
Build a per-occupation skill tag list for ICT, combining all three
skill sources (software, essential, transferable), each already
filtered/grouped to our 14 OSCA occupations by group_by_osca.py.

Tag field per source (all rows included, no filtering):
  software_skills   -> workplace_example  (specific tool/technology, e.g. "Microsoft Excel")
  essential_skills  -> element_name       (abstract skill, e.g. "Critical Thinking")
  transferable_skills -> element_name     (abstract skill, e.g. "Programming")

Output: one row per OSCA occupation, with a deduplicated tag list
tagged by which source(s) each tag came from.
"""
import csv
import json
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

SOURCES = [
    ("software_skills_soc15_ranked_by_osca.csv", "workplace_example", "software"),
    ("essential_skills_ict_ranked_by_osca.csv", "element_name", "essential"),
    ("transferable_skills_ict_ranked_by_osca.csv", "element_name", "transferable"),
]


def collect_tags():
    # osca_id -> occupation title
    titles = {}
    # osca_id -> tag -> set of source labels
    tags_by_osca = defaultdict(lambda: defaultdict(set))

    for filename, tag_field, source_label in SOURCES:
        path = OUTPUT_DIR / filename
        if not path.exists():
            print(f"skipping {filename} (not found)")
            continue
        with open(path, newline="", encoding="utf-8-sig") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            print(f"skipping {filename} (no data rows)")
            continue

        count = 0
        for r in rows:
            osca_id = r["osca_id"]
            titles[osca_id] = r["osca_occupation_title"]
            tag = r[tag_field].strip()
            if tag:
                tags_by_osca[osca_id][tag].add(source_label)
                count += 1
        print(f"[{filename}] {count} tag values read from '{tag_field}'")

    return titles, tags_by_osca


def main():
    titles, tags_by_osca = collect_tags()
    if not tags_by_osca:
        raise ValueError("No skill tag sources found — run group_by_osca.py first.")

    records = []
    for osca_id in sorted(tags_by_osca):
        tag_map = tags_by_osca[osca_id]
        tags_sorted = sorted(tag_map.keys())
        records.append({
            "osca_id": osca_id,
            "osca_occupation_title": titles[osca_id],
            "tag_count": len(tags_sorted),
            "skill_tags": tags_sorted,
        })

    # --- flat CSV: one row per (occupation, tag) ---
    csv_out = OUTPUT_DIR / "skill_tags_by_osca.csv"
    with open(csv_out, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["osca_id", "osca_occupation_title", "skill_tag", "sources"])
        for osca_id in sorted(tags_by_osca):
            for tag, sources in sorted(tags_by_osca[osca_id].items()):
                writer.writerow([osca_id, titles[osca_id], tag, "|".join(sorted(sources))])

    # --- nested JSON: one entry per occupation, tag list inside ---
    json_out = OUTPUT_DIR / "skill_tags_by_osca.json"
    with open(json_out, "w") as f:
        json.dump(records, f, indent=2)

    print(f"\nOSCA occupations tagged: {len(records)}")
    for r in records:
        print(f"  {r['osca_id']} {r['osca_occupation_title']}: {r['tag_count']} tags")
    print(f"\nwritten: {csv_out.name}, {json_out.name}")


if __name__ == "__main__":
    main()
