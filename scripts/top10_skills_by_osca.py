"""
Top 10 most important skills per skill type, per OSCA occupation.

Reads the *_by_osca.csv files (already sorted within each occupation:
software by `rank` ascending, essential/transferable by `priority_score`
descending — done in group_by_osca.py) and takes the first 10 rows per
occupation from each.
"""
import csv
import json
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

TOP_N = 10

# (filename, skill_type label, field holding the skill/tag name, field holding the score to report)
SOURCES = [
    ("software_skills_soc15_ranked_by_osca.csv", "software", "workplace_example", "rank"),
    ("essential_skills_ict_ranked_by_osca.csv", "essential", "element_name", "priority_score"),
    ("transferable_skills_ict_ranked_by_osca.csv", "transferable", "element_name", "priority_score"),
]


def top_n_per_occupation(filename, skill_field, score_field):
    path = OUTPUT_DIR / filename
    if not path.exists():
        print(f"skipping {filename} (not found)")
        return {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {filename} (no data rows)")
        return {}

    by_osca = defaultdict(list)
    for r in rows:
        by_osca[r["osca_id"]].append(r)

    top = {}
    for osca_id, occ_rows in by_osca.items():
        # dedupe by skill name first, keeping the highest-scoring instance
        # (a skill can appear more than once if the occupation maps to
        # multiple SOC codes, each with its own rating for that skill)
        best_by_skill = {}
        for r in occ_rows:
            skill = r[skill_field]
            score = float(r[score_field])
            if skill not in best_by_skill or score > float(best_by_skill[skill][score_field]):
                best_by_skill[skill] = r

        # rank-type scores: lower is better (1 = best); priority scores: higher is better
        reverse = score_field != "rank"
        deduped_sorted = sorted(
            best_by_skill.values(),
            key=lambda r: float(r[score_field]),
            reverse=reverse,
        )

        top[osca_id] = [
            {
                "osca_occupation_title": r["osca_occupation_title"],
                "skill": r[skill_field],
                "score_field": score_field,
                "score": r[score_field],
            }
            for r in deduped_sorted[:TOP_N]
        ]
    print(f"[{filename}] occupations covered: {len(top)}")
    return top


def main():
    results = {}  # skill_type -> osca_id -> list of top-N dicts
    for filename, skill_type, skill_field, score_field in SOURCES:
        results[skill_type] = top_n_per_occupation(filename, skill_field, score_field)

    if not any(results.values()):
        raise ValueError("No *_by_osca.csv files found — run group_by_osca.py first.")

    # --- flat CSV ---
    csv_out = OUTPUT_DIR / "top10_skills_by_osca.csv"
    with open(csv_out, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["osca_id", "osca_occupation_title", "skill_type",
                          "top_rank", "skill", "score_field", "score"])
        for skill_type, by_osca in results.items():
            for osca_id, top_list in sorted(by_osca.items()):
                for i, item in enumerate(top_list, start=1):
                    writer.writerow([osca_id, item["osca_occupation_title"], skill_type,
                                      i, item["skill"], item["score_field"], item["score"]])

    # --- nested JSON: one entry per occupation, top-10 per skill type inside ---
    all_osca_ids = sorted({osca_id for by_osca in results.values() for osca_id in by_osca})
    titles = {}
    for by_osca in results.values():
        for osca_id, top_list in by_osca.items():
            if top_list:
                titles[osca_id] = top_list[0]["osca_occupation_title"]

    grouped = []
    for osca_id in all_osca_ids:
        entry = {"osca_id": osca_id, "osca_occupation_title": titles.get(osca_id, "")}
        for skill_type, by_osca in results.items():
            entry[skill_type] = [
                {"skill": item["skill"], item["score_field"]: item["score"]}
                for item in by_osca.get(osca_id, [])
            ]
        grouped.append(entry)

    json_out = OUTPUT_DIR / "top10_skills_by_osca.json"
    with open(json_out, "w") as f:
        json.dump(grouped, f, indent=2)

    print(f"\nOSCA occupations in output: {len(grouped)}")
    print(f"written: {csv_out.name}, {json_out.name}")


if __name__ == "__main__":
    main()
