"""
From each *_with_osca.csv file (output of map_skills_to_osca.py):
  1. Drop rows with no OSCA match (blank osca_id).
  2. Drop rows for any OSCA occupation matched by EXCLUDED_OSCA_PREFIXES
     or listed in EXCLUDED_OSCA_IDS (see below).
  3. Group the remaining rows by osca_id, skills ordered by rank/priority
     within each occupation.

Writes, per input file:
  {name}_by_osca.csv   - matched rows only, sorted by osca_id
  {name}_by_osca.json  - nested: one record per OSCA occupation

This is the single place in the pipeline where occupations are excluded —
every script downstream of this one (top10_skills_by_osca.py,
build_skill_tags.py, etc.) reads *_by_osca.csv/json, so excluded occupations
are simply absent from their inputs and need no exclusion logic of their own.

Also reports, per input file, which OSCA occupations from the crosswalk
(OSCA_ONET_Map.csv) still have no skill data at this stage — so a gap
introduced further upstream (missing SOC code in the raw O*NET source,
a retired SOC code, etc.) is visible here rather than only showing up
as a smaller-than-expected count several scripts later. Deliberately
excluded occupations are reported separately and are not counted as
a gap.
"""
import csv
import json
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

CROSSWALK_SRC = DATA_DIR / "OSCA_ONET_Map.csv"

SRC_FILES = [
    OUTPUT_DIR / "software_skills_soc15_ranked_with_osca.csv",
    OUTPUT_DIR / "essential_skills_ict_ranked_with_osca.csv",
    OUTPUT_DIR / "transferable_skills_ict_ranked_with_osca.csv",
]

# osca_id prefixes to exclude from the pipeline entirely (root-cause fix:
# excluded here so no downstream script needs to filter these out again).
# "13" covers ANZSCO Specialist Managers, e.g. Chief Information Officer
# (135111) and ICT Managers NEC (135199).
EXCLUDED_OSCA_PREFIXES = ("13",)

# specific osca_ids to exclude, for occupations that don't fit a clean
# prefix rule (osca_id -> reason, for the log).
EXCLUDED_OSCA_IDS = {
    "263299": "ICT Support and Test Engineer NEC — maps to retired SOC "
              "code 15-1299.00, no skill data available",
}


def is_excluded(osca_id: str) -> bool:
    if osca_id in EXCLUDED_OSCA_IDS:
        return True
    return any(osca_id.startswith(p) for p in EXCLUDED_OSCA_PREFIXES)


def load_all_osca_occupations() -> dict:
    """osca_id -> occupation title, for every occupation in the crosswalk."""
    if not CROSSWALK_SRC.exists():
        print(f"note: {CROSSWALK_SRC} not found — skipping missing-occupation diagnostics.")
        return {}
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return {r["OSCA_ID"]: r["Occupation Title"] for r in rows}


def sort_key(row):
    # rank (software skills file) or priority_score (essential/transferable) if present
    if "rank" in row:
        return int(row["rank"])
    if "priority_score" in row:
        return -float(row["priority_score"])  # higher priority first
    return 0


def process(path: Path, all_osca: dict, excluded_osca_ids: set):
    if not path.exists():
        print(f"skipping {path.name} (not found)")
        return

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {path.name} (no data rows)")
        return

    matched = [r for r in rows if r.get("osca_id") and not is_excluded(r["osca_id"])]
    unmatched_count = sum(1 for r in rows if not r.get("osca_id"))
    excluded_count = sum(1 for r in rows if r.get("osca_id") and is_excluded(r["osca_id"]))

    matched.sort(key=lambda r: (r["osca_id"], sort_key(r)))

    # --- flat CSV ---
    csv_out = OUTPUT_DIR / f"{path.stem.replace('_with_osca', '')}_by_osca.csv"
    with open(csv_out, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=matched[0].keys())
        writer.writeheader()
        writer.writerows(matched)

    # --- nested JSON: one entry per OSCA occupation ---
    by_osca = defaultdict(list)
    title_by_osca = {}
    for r in matched:
        rec = {k: v for k, v in r.items() if k not in ("osca_id", "osca_occupation_title")}
        by_osca[r["osca_id"]].append(rec)
        title_by_osca[r["osca_id"]] = r["osca_occupation_title"]

    grouped = [
        {"osca_id": osca, "osca_occupation_title": title_by_osca[osca], "skills": skills}
        for osca, skills in by_osca.items()
    ]
    grouped.sort(key=lambda o: o["osca_id"])

    json_out = OUTPUT_DIR / f"{path.stem.replace('_with_osca', '')}_by_osca.json"
    with open(json_out, "w") as f:
        json.dump(grouped, f, indent=2)

    print(f"[{path.name}] matched rows kept: {len(matched)} "
          f"(dropped unmatched: {unmatched_count}, excluded: {excluded_count})")
    print(f"[{path.name}] OSCA occupations: {len(grouped)}")

    if all_osca:
        missing = set(all_osca) - set(by_osca) - excluded_osca_ids
        if missing:
            print(f"[{path.name}] WARNING: {len(missing)} of {len(all_osca)} crosswalk "
                  f"occupations have no skill data in this file:")
            for m in sorted(missing):
                print(f"    {m} {all_osca[m]}")

    print(f"  written: {csv_out.name}, {json_out.name}\n")


if __name__ == "__main__":
    all_osca = load_all_osca_occupations()
    excluded_osca_ids = {osca_id for osca_id in all_osca if is_excluded(osca_id)}
    if excluded_osca_ids:
        print(f"Excluded {len(excluded_osca_ids)} occupation(s):")
        for osca_id in sorted(excluded_osca_ids):
            reason = EXCLUDED_OSCA_IDS.get(osca_id, f"prefix match {EXCLUDED_OSCA_PREFIXES}")
            print(f"    {osca_id} {all_osca[osca_id]} — {reason}")
        print()
    for path in SRC_FILES:
        process(path, all_osca, excluded_osca_ids)
