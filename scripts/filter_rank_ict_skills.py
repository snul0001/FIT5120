"""
Filter O*NET essential/transferable skills down to the O*NET-SOC codes
that actually appear in the OSCA-O*NET crosswalk (OSCA_ONET_Map.csv),
then compute a standardised 0-100 priority score using entropy-based
weights between Importance and Level, so it can later be compared
directly against a student's own 0-100 self-rating.

Previously this filtered on a hardcoded '15-' SOC prefix, which silently
dropped any crosswalk occupation whose SOC code falls outside that prefix
(e.g. 11-3021.00 Chief Information Officer, 13-1151.00 Training and
Development Specialists). Filtering against the crosswalk's own SOC set
keeps this in sync with whatever occupations OSCA_ONET_Map.csv defines.

Source layout (standard O*NET Skills.xlsx/csv export): one row per
(O*NET-SOC Code, Element) per Scale ID, where Scale ID is 'IM'
(Importance, 1-5) or 'LV' (Level, 0-7), value in 'Data Value'.

  O*NET-SOC Code, Title, Element ID, Element Name, Scale ID, Data Value

Formula
-------
importance_score = (Importance - 1) / (5 - 1) * 100      # 1-5  -> 0-100
level_score       = (Level - 0) / (7 - 0) * 100           # 0-7  -> 0-100

Entropy weighting (option 3): a criterion that varies more across the
ICT skill set is more discriminating for ranking, so it earns more
weight automatically -- no manual weight guess needed.

  for each criterion j in {importance_score, level_score}:
      p_ij = x_ij / sum(x_ij)  across all rows i
      e_j  = -1/ln(n) * sum(p_ij * ln(p_ij))     # entropy, n = row count
      d_j  = 1 - e_j                              # degree of differentiation
  w_importance = d_importance / (d_importance + d_level)
  w_level      = d_level / (d_importance + d_level)

  priority_score = importance_score * w_importance + level_score * w_level
"""
import csv
import math
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

ESSENTIAL_SRC = DATA_DIR / "essential_skills.csv"
TRANSFERABLE_SRC = DATA_DIR / "transferable_skills.csv"
CROSSWALK_SRC = DATA_DIR / "OSCA_ONET_Map.csv"

IMPORTANCE_MIN, IMPORTANCE_MAX = 1, 5
LEVEL_MIN, LEVEL_MAX = 0, 7
EPS = 1e-9                  # avoids log(0) in entropy calc


def load_valid_soc_codes() -> set[str]:
    """SOC codes referenced anywhere in the OSCA-O*NET crosswalk."""
    if not CROSSWALK_SRC.exists():
        raise FileNotFoundError(f"{CROSSWALK_SRC} not found — needed to know which SOC codes to keep.")
    with open(CROSSWALK_SRC, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    codes = {r["O*NET_ID"].strip() for r in rows}
    print(f"crosswalk SOC codes to filter against: {len(codes)}")
    return codes


def find_col(headers, *candidates):
    norm = {h.strip().lower(): h for h in headers}
    for c in candidates:
        if c.strip().lower() in norm:
            return norm[c.strip().lower()]
    raise KeyError(f"None of {candidates} found in columns: {headers}")


def load_rows(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"{path} not found — put the file in {DATA_DIR}")
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        raise ValueError(f"{path} has no data rows.")
    return rows


def entropy_weights(values: list[float]) -> float:
    """Return the degree of differentiation d_j for one criterion's values."""
    n = len(values)
    total = sum(values)
    if total == 0:
        return 0.0
    entropy = 0.0
    for v in values:
        p = v / total
        entropy += p * math.log(p + EPS)
    entropy = -entropy / math.log(n)
    return 1 - entropy  # degree of differentiation


def pivot_ict_rows(rows, label, valid_soc_codes):
    headers = list(rows[0].keys())
    print(f"[{label}] columns detected:", headers)

    col_soc = find_col(headers, "O*NET-SOC Code", "SOC Code")
    col_title = find_col(headers, "Title")
    col_element_id = find_col(headers, "Element ID")
    col_element_name = find_col(headers, "Element Name")
    col_scale = find_col(headers, "Scale ID")
    col_value = find_col(headers, "Data Value")

    print(f"[{label}] sample SOC values:", [r[col_soc] for r in rows[:5]])
    print(f"[{label}] scale IDs seen:", sorted({r[col_scale] for r in rows}))

    soc_codes_seen = set()
    pivot = {}
    for r in rows:
        soc_code = r[col_soc].strip()
        soc_codes_seen.add(soc_code)
        if soc_code not in valid_soc_codes:
            continue
        key = (soc_code, r[col_element_id])
        rec = pivot.setdefault(key, {
            "soc_code": soc_code,
            "title": r[col_title],
            "element_id": r[col_element_id],
            "element_name": r[col_element_name],
            "importance": None,
            "level": None,
        })
        scale = r[col_scale].strip().upper()
        value = float(r[col_value])
        if scale == "IM":
            rec["importance"] = value
        elif scale == "LV":
            rec["level"] = value

    missing_from_source = valid_soc_codes - soc_codes_seen
    if missing_from_source:
        print(f"[{label}] WARNING: {len(missing_from_source)} crosswalk SOC code(s) not found in source at all:")
        for m in sorted(missing_from_source):
            print("   ", m)

    records = [rec for rec in pivot.values()
               if rec["importance"] is not None and rec["level"] is not None]
    return records


def process(path: Path, label: str, valid_soc_codes: set[str]):
    rows = load_rows(path)
    records = pivot_ict_rows(rows, label, valid_soc_codes)

    if not records:
        raise ValueError(f"[{label}] no matching rows with both Importance and Level found.")

    for rec in records:
        rec["importance_score"] = round(
            (rec["importance"] - IMPORTANCE_MIN) / (IMPORTANCE_MAX - IMPORTANCE_MIN) * 100, 2
        )
        rec["level_score"] = round(
            (rec["level"] - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN) * 100, 2
        )

    # entropy weights computed once, across all matched rows for this file
    importance_vals = [r["importance_score"] + EPS for r in records]
    level_vals = [r["level_score"] + EPS for r in records]
    d_importance = entropy_weights(importance_vals)
    d_level = entropy_weights(level_vals)
    denom = d_importance + d_level
    w_importance = d_importance / denom if denom else 0.5
    w_level = d_level / denom if denom else 0.5

    print(f"[{label}] entropy weights -> importance: {w_importance:.3f}, level: {w_level:.3f}")

    for rec in records:
        rec["priority_score"] = round(
            rec["importance_score"] * w_importance + rec["level_score"] * w_level, 2
        )

    records.sort(key=lambda r: r["priority_score"], reverse=True)

    out_path = OUTPUT_DIR / f"{label}_ict_ranked.csv"
    fieldnames = ["soc_code", "title", "element_id", "element_name",
                  "importance", "level", "importance_score", "level_score", "priority_score"]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    matched_soc_codes = {r["soc_code"] for r in records}
    print(f"[{label}] rows kept: {len(records)}")
    print(f"[{label}] distinct SOC codes matched: {len(matched_soc_codes)} of {len(valid_soc_codes)} in crosswalk")
    print(f"[{label}] written to: {out_path}\n")


if __name__ == "__main__":
    valid_soc_codes = load_valid_soc_codes()
    process(ESSENTIAL_SRC, "essential_skills", valid_soc_codes)
    process(TRANSFERABLE_SRC, "transferable_skills", valid_soc_codes)
