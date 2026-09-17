"""
Group the ranked SOC 15- skills by occupation (soc_code), each occupation
listing its related skills ordered by rank (1 = best) then element_name.

Reads: software_skills_soc15_ranked.csv (output of filter_rank_soc15.py)
Writes:
  software_skills_grouped.csv   - same rows, sorted by soc_code then rank (flat/readable)
  software_skills_grouped.json  - nested: one record per occupation, skills list inside
"""
import csv
import io
import json
import os
import urllib.request
from pathlib import Path
from collections import defaultdict
 
# Folder layout (same repo, works after `git clone`):
#   FIT5120/
#     script/   <- this file lives here
#     data/     <- input CSV lives here
#     output/   <- outputs get written here
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
 
LOCAL_SRC = OUTPUT_DIR / "software_skills_soc15_ranked.csv"
 
# If the repo is public, set this to the raw GitHub URL of the same file.
# e.g. https://raw.githubusercontent.com/<user>/<repo>/main/data/software_skills_soc15_ranked.csv
# Can also be overridden without touching the code: export SOFTWARE_SKILLS_URL=...
GITHUB_RAW_URL = os.environ.get("SOFTWARE_SKILLS_URL", "")
 
def load_csv_text() -> str:
    """Read from the local data/ folder if present (normal case after
    cloning the repo); otherwise fall back to fetching the raw file
    straight from GitHub (useful in Colab or any environment with no
    local filesystem checkout, e.g. running the script standalone)."""
    if LOCAL_SRC.exists():
        return LOCAL_SRC.read_text(encoding="utf-8")
    if not GITHUB_RAW_URL:
        raise FileNotFoundError(
            f"{LOCAL_SRC} not found and no GITHUB_RAW_URL/SOFTWARE_SKILLS_URL set."
        )
    with urllib.request.urlopen(GITHUB_RAW_URL) as resp:
        return resp.read().decode("utf-8")
 
rows = list(csv.DictReader(io.StringIO(load_csv_text())))
 
if not rows:
    raise ValueError(
        f"No data rows read from {LOCAL_SRC if LOCAL_SRC.exists() else GITHUB_RAW_URL}. "
        "Check that this file is the actual output of filter_rank_soc15.py "
        "(header + rows), not empty or a placeholder."
    )
print(f"rows read from source: {len(rows)}")
 
for r in rows:
    r["rank"] = int(r["rank"])
 
# --- flat CSV: sorted by occupation, then rank ---
rows_sorted = sorted(rows, key=lambda r: (r["soc_code"], r["rank"], r["element_name"]))
with open(OUTPUT_DIR / "software_skills_grouped.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows_sorted[0].keys())
    writer.writeheader()
    writer.writerows(rows_sorted)
 
# --- nested JSON: one entry per occupation ---
by_soc = defaultdict(list)
title_by_soc = {}
for r in rows_sorted:
    by_soc[r["soc_code"]].append({
        "element_name": r["element_name"],
        "workplace_example": r["workplace_example"],
        "hot_technology": r["hot_technology"],
        "in_demand": r["in_demand"],
        "rank": r["rank"],
    })
    title_by_soc[r["soc_code"]] = r["title"]
 
grouped = [
    {"soc_code": soc, "title": title_by_soc[soc], "skills": skills}
    for soc, skills in by_soc.items()
]
grouped.sort(key=lambda o: o["soc_code"])
 
with open(OUTPUT_DIR / "software_skills_grouped.json", "w") as f:
    json.dump(grouped, f, indent=2)
 
print(f"occupations: {len(grouped)}")
print(f"total skill rows: {len(rows_sorted)}")