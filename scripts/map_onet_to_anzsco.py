"""
Map the ranked skills files (SOC-code based) to ANZSCO unit groups using the new crosswalk (data/mapping.csv).

New crosswalk layout:
    ANZSCO_code, ANZSCO_title, ONET_code, ONET_title, Match_score,
    Rationale, Review

The crosswalk is many-to-many:
  - one occupation group maps to 1-4 O*NET codes (Match_score sums to 1
    within each group, so it acts as a weight), and
  - one O*NET code can belong to several occupation groups.

So the crosswalk is loaded as soc_code -> LIST of occupation rows, and a
skill row is written once per occupation group it maps to. Nothing is
collapsed.

Left join: every skill row is kept. Where its soc_code isn't in the
crosswalk, the occupation columns are left blank rather than the row
being dropped.
"""
import csv
from collections import defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

CROSSWALK_SRC = DATA_DIR / "mapping.csv"

# skill files produced earlier, all keyed by `soc_code`
SKILL_FILES = [
    OUTPUT_DIR / "software_skills_soc15_ranked.csv",
    OUTPUT_DIR / "essential_skills_ict_ranked.csv",
    OUTPUT_DIR / "transferable_skills_ict_ranked.csv",
]

# Which crosswalk rows to use. {"matches", "partial"} keeps everything;
# {"matches"} alone leaves 5 groups (2612, 2613, 2621, 3995, 5911) unmapped.
KEEP_REVIEW = {"matches", "partial"}

# Output column names (4-digit ANZSCO unit groups).
COL_ID = "anzsco_code"
COL_TITLE = "anzsco_title"
COL_SCORE = "match_score"
COL_REVIEW = "match_review"
OUT_SUFFIX = "_with_anzsco"


def load_crosswalk():
    """Return soc_code -> list of crosswalk rows (many-to-many safe)."""
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found.")
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    crosswalk = defaultdict(list)
    for r in rows:
        review = r["Review"].strip().lower()
        if review not in KEEP_REVIEW:
            continue
        crosswalk[r["ONET_code"].strip()].append({
            COL_ID: r["ANZSCO_code"].strip(),
            COL_TITLE: r["ANZSCO_title"].strip(),
            COL_SCORE: r["Match_score"].strip(),
            COL_REVIEW: review,
        })
    return crosswalk


def map_file(path: Path, crosswalk: dict):
    if not path.exists():
        print(f"skipping {path.name} (not found)")
        return

    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        print(f"skipping {path.name} (no data rows)")
        return

    blank = {COL_ID: "", COL_TITLE: "", COL_SCORE: "", COL_REVIEW: ""}
    out_rows, matched, unmatched = [], 0, 0
    for r in rows:
        hits = crosswalk.get(r["soc_code"].strip())
        if hits:
            matched += 1
            for cw in hits:              # one output row per occupation group
                out_rows.append({**r, **cw})
        else:
            unmatched += 1
            out_rows.append({**r, **blank})

    fieldnames = list(rows[0].keys()) + [c for c in blank if c not in rows[0]]
    out_path = OUTPUT_DIR / f"{path.stem}{OUT_SUFFIX}.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(out_rows)

    # coverage check: which side of the crosswalk has no skill data
    soc_in_file = {r["soc_code"].strip() for r in rows}
    missing_soc = sorted(set(crosswalk) - soc_in_file)
    all_groups = {cw[COL_ID] for hits in crosswalk.values() for cw in hits}
    covered = {r[COL_ID] for r in out_rows if r[COL_ID]}
    partial_groups = {cw[COL_ID] for s in missing_soc for cw in crosswalk[s]} & covered

    print(f"[{path.name}]")
    print(f"  skill rows in: {len(rows)}  matched: {matched}  unmatched: {unmatched}")
    print(f"  rows out: {len(out_rows)} (matched rows repeat once per occupation group)")
    print(f"  occupation groups with skills: {len(covered)} of {len(all_groups)}")
    print(f"  groups with NO skills: {sorted(all_groups - covered)}")
    print(f"  groups missing some of their O*NET codes: {sorted(partial_groups)}")
    print(f"  crosswalk O*NET codes absent from this file: {len(missing_soc)}")
    print(f"  written to: {out_path}\n")


if __name__ == "__main__":
    crosswalk = load_crosswalk()
    n_groups = len({cw[COL_ID] for hits in crosswalk.values() for cw in hits})
    n_pairs = sum(len(hits) for hits in crosswalk.values())
    print(f"crosswalk: {n_pairs} rows, {len(crosswalk)} O*NET codes, "
          f"{n_groups} occupation groups\n")
    for path in SKILL_FILES:
        map_file(path, crosswalk)
