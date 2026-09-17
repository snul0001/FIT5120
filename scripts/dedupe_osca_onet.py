"""
Each O*NET SOC code should map to exactly one OSCA occupation.
Where a SOC code appears against multiple OSCA codes, keep only the
row with the highest Match_score.
"""
import csv
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

SRC = DATA_DIR / "OSCA_ONET_full_ICT_candidates.csv"

with open(SRC, newline="", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

if not rows:
    raise ValueError(f"{SRC} has no data rows.")

# keep the highest Match_score row per O*NET_ID
best_by_soc = {}
for r in rows:
    soc = r["O*NET_ID"]
    score = float(r["Match_score"])
    if soc not in best_by_soc or score > float(best_by_soc[soc]["Match_score"]):
        best_by_soc[soc] = r

out_rows = sorted(best_by_soc.values(), key=lambda r: r["O*NET_ID"])

out_path = OUTPUT_DIR / "OSCA_ONET_deduped.csv"
with open(out_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(out_rows)

print(f"rows in: {len(rows)}")
print(f"rows out (1 per SOC code): {len(out_rows)}")
print(f"dropped as lower-score duplicates: {len(rows) - len(out_rows)}")
print(f"written to: {out_path}")

