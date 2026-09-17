import csv
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

CROSSWALK_SRC = DATA_DIR / "OSCA_ONET_Map.csv"

# skill files produced earlier, all keyed by `soc_code`
SKILL_FILES = [
    OUTPUT_DIR / "software_skills_soc15_ranked.csv",
    OUTPUT_DIR / "essential_skills_ict_ranked.csv",
    OUTPUT_DIR / "transferable_skills_ict_ranked.csv",
]


def load_crosswalk():
    """Load the OSCA <-> O*NET crosswalk, keeping ALL OSCA rows per SOC code
    (a single SOC code can map to multiple OSCA occupations)."""
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found — run dedupe_osca_onet.py first.")

    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    crosswalk = defaultdict(list)
    for r in rows:
        crosswalk[r["O*NET_ID"]].append(r)

    print(f"crosswalk rows read: {len(rows)}, "
          f"unique O*NET SOC codes: {len(crosswalk)}, "
          f"unique OSCA occupations: {len({r['OSCA_ID'] for r in rows})}\n")
    return crosswalk  # soc_code -> list of ALL matching OSCA rows


def map_file(path: Path, crosswalk: dict):
    """Join a skill file to the crosswalk on soc_code. If a soc_code matches
    multiple OSCA occupations, one output row is written per match."""
    if not path.exists():
        print(f"skipping {path.name} (not found)")
        return

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {path.name} (no data rows)")
        return

    out_rows = []
    matched_skill_rows = 0
    for r in rows:
        cw_matches = crosswalk.get(r["soc_code"])
        if cw_matches:
            matched_skill_rows += 1
            for cw in cw_matches:
                new_r = dict(r)
                new_r["osca_id"] = cw["OSCA_ID"]
                new_r["osca_occupation_title"] = cw["Occupation Title"]
                new_r["osca_match_score"] = cw["Match_score"]
                out_rows.append(new_r)
        else:
            new_r = dict(r)
            new_r["osca_id"] = ""
            new_r["osca_occupation_title"] = ""
            new_r["osca_match_score"] = ""
            out_rows.append(new_r)

    fieldnames = list(out_rows[0].keys())
    out_path = OUTPUT_DIR / f"{path.stem}_with_osca.csv"
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    print(f"[{path.name}] input rows: {len(rows)}, matched: {matched_skill_rows}, "
          f"unmatched: {len(rows) - matched_skill_rows}, "
          f"output rows (with duplicates from multi-matches): {len(out_rows)}")
    print(f"written to: {out_path}\n")


if __name__ == "__main__":
    crosswalk = load_crosswalk()
    for path in SKILL_FILES:
        map_file(path, crosswalk)
