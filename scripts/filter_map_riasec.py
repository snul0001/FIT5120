"""
For each RIASEC interest file (Realistic, Investigative, Artistic,
Social, Enterprising, Conventional):
  1. Map each row's SOC code to OSCA via the crosswalk (OSCA_ONET_Map.csv).
     A SOC code can map to multiple OSCA occupations — one output row is
     written per match (same rule as map_skills_to_osca.py).
  2. Drop rows for OSCA occupations excluded by group_by_osca.py's rules
     (kept identical here so the two scripts never drift apart).

Source columns (O*NET Interest Profiler export):
  Interest Code, Job Zone, Code, Occupation, Featured

This replaces the previous version, which filtered to a hardcoded '15-'
SOC prefix, used a crosswalk that silently dropped SOC codes shared by
multiple OSCA occupations (1 row per SOC code), and referenced a fixed
count of "14 OSCA occupations" that no longer matches the crosswalk.
"""
import csv
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

CROSSWALK_SRC = DATA_DIR / "OSCA_ONET_Map.csv"

RIASEC_FILES = [
    "Realistic.csv",
    "Investigative.csv",
    "Artistic.csv",
    "Social.csv",
    "Enterprising.csv",
    "Conventional.csv",
]

# Keep identical to group_by_osca.py so the two scripts never drift apart.
EXCLUDED_OSCA_PREFIXES = ("13",)
EXCLUDED_OSCA_IDS = {
    "263299": "ICT Support and Test Engineer NEC — maps to retired SOC "
              "code 15-1299.00, no skill data available",
}


def is_excluded(osca_id: str) -> bool:
    if osca_id in EXCLUDED_OSCA_IDS:
        return True
    return any(osca_id.startswith(p) for p in EXCLUDED_OSCA_PREFIXES)


def load_crosswalk():
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found — run dedupe_osca_onet.py first.")
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    crosswalk = defaultdict(list)
    excluded_count = 0
    for r in rows:
        if is_excluded(r["OSCA_ID"]):
            excluded_count += 1
            continue
        crosswalk[r["O*NET_ID"]].append(r)

    in_scope_osca = {r["OSCA_ID"] for rows_ in crosswalk.values() for r in rows_}
    print(f"crosswalk: {len(rows)} total occupations, {excluded_count} excluded, "
          f"{len(in_scope_osca)} in scope across {len(crosswalk)} SOC codes\n")
    return crosswalk  # soc_code -> list of in-scope OSCA rows


def process(filename: str, crosswalk: dict):
    path = DATA_DIR / filename
    if not path.exists():
        print(f"skipping {filename} (not found in {DATA_DIR})")
        return

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {filename} (no data rows)")
        return

    matched = []
    for r in rows:
        cw_matches = crosswalk.get(r["Code"].strip())
        if not cw_matches:
            continue
        for cw in cw_matches:
            out = dict(r)
            out["osca_id"] = cw["OSCA_ID"]
            out["osca_occupation_title"] = cw["Occupation Title"]
            out["osca_match_score"] = cw["Match_score"]
            matched.append(out)

    if not matched:
        print(f"[{filename}] total rows: {len(rows)}, matched to in-scope OSCA occupations: 0 "
              f"(nothing to write)\n")
        return

    label = Path(filename).stem.lower()
    out_path = OUTPUT_DIR / f"riasec_{label}_ict_osca.csv"
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=matched[0].keys())
        writer.writeheader()
        writer.writerows(matched)

    print(f"[{filename}] total rows: {len(rows)}, matched to in-scope OSCA occupations: {len(matched)}")
    print(f"  OSCA occupations covered: {len({r['osca_id'] for r in matched})}")
    print(f"  written to: {out_path}\n")


if __name__ == "__main__":
    crosswalk = load_crosswalk()
    for filename in RIASEC_FILES:
        process(filename, crosswalk)
