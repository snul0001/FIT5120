"""
Combine all riasec_<category>_ict_osca.csv files (output of
filter_map_riasec.py) into one file, tagged with which RIASEC
category each row came from.
"""
import csv
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BASE_DIR / "output"

files = sorted(OUTPUT_DIR.glob("riasec_*_ict_osca.csv"))

if not files:
    raise FileNotFoundError(
        f"No riasec_*_ict_osca.csv files found in {OUTPUT_DIR} — run filter_map_riasec.py first."
    )

combined = []
for path in files:
    # riasec_realistic_ict_osca.csv -> "realistic"
    category = path.stem.replace("riasec_", "").replace("_ict_osca", "")
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["riasec_category"] = category
    combined.extend(rows)
    print(f"[{path.name}] {len(rows)} rows -> category '{category}'")

if not combined:
    raise ValueError("All riasec_*_ict_osca.csv files were empty — nothing to combine.")

fieldnames = list(combined[0].keys())
out_path = OUTPUT_DIR / "riasec_ict_osca_combined.csv"
with open(out_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(combined)

print(f"\ncombined rows: {len(combined)}")
print(f"OSCA occupations covered: {len({r['osca_id'] for r in combined})}")
print(f"written to: {out_path}")
