"""
Map the ranked skills files (SOC-code based) back to OSCA occupation
codes, using the deduped OSCA<->O*NET crosswalk (1 OSCA per SOC code,
highest match_score). An OSCA occupation may appear against multiple
skill rows if it has more than one SOC code, which is expected.

Left join: every skill row is kept. Where its soc_code isn't present
in the crosswalk, osca_id / osca_occupation_title / match_score are
left blank and the row is flagged unmatched, rather than dropped.
"""
import csv
from pathlib import Path

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
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found — run dedupe_osca_onet.py first.")
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    return {r["O*NET_ID"]: r for r in rows}  # 1 OSCA row per SOC code


def map_file(path: Path, crosswalk: dict):
    if not path.exists():
        print(f"skipping {path.name} (not found)")
        return

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {path.name} (no data rows)")
        return

    matched = 0
    for r in rows:
        cw = crosswalk.get(r["soc_code"])
        if cw:
            r["osca_id"] = cw["OSCA_ID"]
            r["osca_occupation_title"] = cw["Occupation Title"]
            r["osca_match_score"] = cw["Match_score"]
            matched += 1
        else:
            r["osca_id"] = ""
            r["osca_occupation_title"] = ""
            r["osca_match_score"] = ""

    fieldnames = list(rows[0].keys())
    out_path = OUTPUT_DIR / f"{path.stem}_with_osca.csv"
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"[{path.name}] rows: {len(rows)}, matched to OSCA: {matched}, "
          f"unmatched: {len(rows) - matched}")
    print(f"written to: {out_path}\n")


if __name__ == "__main__":
    crosswalk = load_crosswalk()
    print(f"crosswalk SOC codes available: {len(crosswalk)} "
          f"(covering {len({r['OSCA_ID'] for r in crosswalk.values()})} OSCA occupations)\n")
    for path in SKILL_FILES:
        map_file(path, crosswalk)
