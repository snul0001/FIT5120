"""
Filter Software_Skills.xlsx down to the O*NET-SOC codes that actually
appear in the OSCA-O*NET crosswalk (OSCA_ONET_Map.csv), then rank each
skill row:

  rank 1 -> Hot Technology = Y  AND In Demand = Y
  rank 2 -> Hot Technology = N  AND In Demand = Y
  rank 3 -> Hot Technology = Y  AND In Demand = N
  rank 4 -> Hot Technology = N  AND In Demand = N   (neither flag set)

Previously this filtered on a hardcoded '15-' SOC prefix, which silently
dropped any crosswalk occupation whose SOC code falls outside that prefix
(e.g. 11-3021.00 Chief Information Officer, 13-1151.00 Training and
Development Specialists). Filtering against the crosswalk's own SOC set
keeps this in sync with whatever occupations OSCA_ONET_Map.csv defines.
"""
import csv
from pathlib import Path
from collections import Counter

# Folder layout (same repo, works after `git clone`):
#   FIT5120/
#     script/   <- this file lives here
#     data/     <- input .csv lives here
#     output/   <- outputs get written here
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

SRC = DATA_DIR / "software_skills.csv"
CROSSWALK_SRC = DATA_DIR / "OSCA_ONET_Map.csv"


def load_valid_soc_codes() -> set[str]:
    """SOC codes referenced anywhere in the OSCA-O*NET crosswalk."""
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found — needed to know which SOC codes to keep.")
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    codes = {r["O*NET_ID"].strip() for r in rows}
    print(f"crosswalk SOC codes to filter against: {len(codes)}")
    return codes


def rank(hot_tech: str, in_demand: str) -> int:
    hot = hot_tech.strip().upper() == "Y"
    demand = in_demand.strip().upper() == "Y"
    if hot and demand:
        return 1
    if demand and not hot:
        return 2
    if hot and not demand:
        return 3
    return 4


def find_col(headers, *candidates):
    norm = {h.strip().lower(): h for h in headers}
    for c in candidates:
        if c.strip().lower() in norm:
            return norm[c.strip().lower()]
    raise KeyError(f"None of {candidates} found in columns: {headers}")


if not SRC.exists():
    raise FileNotFoundError(f"{SRC} not found — put software_skills.csv in {DATA_DIR}")

valid_soc_codes = load_valid_soc_codes()

with open(SRC, newline="", encoding="utf-8-sig") as f:
    data = list(csv.DictReader(f))

if not data:
    raise ValueError(f"{SRC} has no data rows.")

# Match columns case/whitespace-insensitively so small header differences
# (extra spaces, different casing) don't silently produce 0 matches.
raw_headers = list(data[0].keys())

col_soc = find_col(raw_headers, "O*NET-SOC Code", "SOC Code", "O-NET-SOC Code")
col_title = find_col(raw_headers, "Title")
col_example = find_col(raw_headers, "Workplace Example", "Example")
col_element_id = find_col(raw_headers, "Element ID")
col_element_name = find_col(raw_headers, "Element Name")
col_hot = find_col(raw_headers, "Hot Technology")
col_demand = find_col(raw_headers, "In Demand")

print("columns detected:", raw_headers)
print("sample SOC values:", [r[col_soc] for r in data[:5]])

# Track which crosswalk SOC codes never actually show up in the source file,
# so a missing occupation is visible immediately rather than discovered later.
soc_codes_seen = set()

out_rows = []
for r in data:
    soc_code = r[col_soc].strip()
    soc_codes_seen.add(soc_code)
    if soc_code not in valid_soc_codes:
        continue
    hot_tech = r[col_hot]
    in_demand = r[col_demand]
    out_rows.append({
        "soc_code": soc_code,
        "title": r[col_title],
        "workplace_example": r[col_example],
        "element_id": r[col_element_id],
        "element_name": r[col_element_name],
        "hot_technology": hot_tech,
        "in_demand": in_demand,
        "rank": rank(hot_tech, in_demand),
    })

missing_from_source = valid_soc_codes - soc_codes_seen
if missing_from_source:
    print(f"WARNING: {len(missing_from_source)} crosswalk SOC code(s) not found in {SRC.name} at all:")
    for m in sorted(missing_from_source):
        print("   ", m)

# sort by rank (1 first), keep original order within each rank
out_rows.sort(key=lambda r: r["rank"])

fieldnames = ["soc_code", "title", "workplace_example", "element_id", "element_name",
              "hot_technology", "in_demand", "rank"]

OUT_PATH = OUTPUT_DIR / "software_skills_soc15_ranked.csv"
with open(OUT_PATH, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(out_rows)

matched_soc_codes = {r["soc_code"] for r in out_rows}
print(f"rows kept: {len(out_rows)}")
print(f"distinct SOC codes matched: {len(matched_soc_codes)} of {len(valid_soc_codes)} in crosswalk")
print("rank distribution:", Counter(r["rank"] for r in out_rows))
print(f"written to: {OUT_PATH}")
