#!/usr/bin/env python3
"""Cleaning ABS's EQ08 workbook by tidy quarterly table for curated unit group.

Input: EQ08.xlsx, global_variable.py (pipeline for reading unit_group)

Output (one row per unit group per quarter), columns:
    category, code, unit_group, year, quarter, employed_k

Checks with
    - curated codes missing from the ABS file
    - curated codes listed in more than one category
    - unit_group-quarters with no value (blank/suppressed in the ABS file)
"""
import sys 
import pandas as pd
from global_variable import CLEAN_FILE, CURATED, INPUT_FILE, OUTPUT_DIR, QUARTER_MONTHS, YEARS
 
 
def read_pivot(xlsx_path: str) -> pd.DataFrame:
    """Read 'Table 1' and return unit-group rows with the original quarterly columns."""
    raw = pd.read_excel(xlsx_path, sheet_name="Table 1", header=None)
    header_idx = next(
        i for i in range(len(raw)) if raw.iloc[i].astype(str).str.contains("Quarter 20").any()
    ) #any 20xx year
    header = raw.iloc[header_idx].tolist()
    body = raw.iloc[header_idx + 1:].copy()
    body.columns = ["label"] + header[1:]
    body = body[body["label"].astype(str).str.match(r"^\d{4} ")]   # unit group (4 digits)
    return body.drop_duplicates("label")
 
 
def to_long(body: pd.DataFrame) -> pd.DataFrame:
    """Pivot columns (eg:'August Quarter 2023') into rows."""
    body = body.copy()
    body["code"] = body["label"].str[:4]
    body["unit_group"] = body["label"].str[5:].str.strip()
    long = body.drop(columns="label").melt(
        id_vars=["code", "unit_group"], var_name="period", value_name="employed_k"
    )
    parts = long["period"].astype(str).str.extract(r"^(\w+) Quarter (\d{4})$")
    long["quarter"], long["year"] = parts[0], pd.to_numeric(parts[1])
    long["employed_k"] = pd.to_numeric(long["employed_k"], errors="coerce")
    long = long[long["year"].isin(YEARS) & long["quarter"].isin(QUARTER_MONTHS)] #global variable referring mid_quarter months if applicable
    return long.drop(columns="period")
 
 
def main() -> None:
    if not INPUT_FILE.exists():
        sys.exit(f"Input file not found: {INPUT_FILE}")
    xlsx_path, out_path = INPUT_FILE, CLEAN_FILE
    OUTPUT_DIR.mkdir(exist_ok=True)
 
    curated = pd.DataFrame(
        [(cat, code) for cat, codes in CURATED.items() for code in codes.split()],
        columns=["category", "code"],
    )
    dupes = sorted(curated[curated.duplicated("code", keep=False)]["code"].unique())
    if dupes:
        print("Note: codes in more than one category:", dupes, file=sys.stderr)
 
    long = to_long(read_pivot(xlsx_path))
 
    missing = sorted(set(curated["code"]) - set(long["code"]))
    if missing:
        print("NOTICE: curated codes not found in ABS file:", missing, file=sys.stderr) #check to see if curated codes are missing
 
    df = curated.merge(long, on="code", how="inner")
 
    blanks = df[df["employed_k"].isna()]
    if len(blanks):
        print(f"WARNING: {len(blanks)} unit_group-quarters have no value:", file=sys.stderr)
        print(blanks[["code", "unit_group", "year", "quarter"]].to_string(index=False),
              file=sys.stderr)
 
    df["quarter"] = pd.Categorical(df["quarter"], QUARTER_MONTHS, ordered=True)
    df = df.sort_values(["category", "code", "year", "quarter"])
    df[["category", "code", "unit_group", "year", "quarter", "employed_k"]].to_csv(
        out_path, index=False
    )
    print(f"Wrote {len(df)} rows ({df['code'].nunique()} unit group) to {out_path}")
 
 
if __name__ == "__main__":
    main()
