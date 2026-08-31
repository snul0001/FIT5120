"""
Clean ISCO-08 to OSCA correspondence (the sheet is on Table_7).

Note:
ABS uses the literal placeholder "xxxxxx" (as the OSCA code, with title
"No Correspondence") for ISCO codes that have no OSCA equivalent at all,
these are dropped entirely, not treated as a real match.

Input:  OSCA correspondence tables v2.xlsx (Table 7)
Output: isco08_to_osca.csv (occupation_id, isco08_code, match_type)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent #base directory
DATA = BASE_DIR.parent / "data" / "OSCA correspondence tables v2.xlsx" #location

OUTPUT = BASE_DIR.parent / "output" / "isco08_to_osca.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True) #incase the folder itself doesn't exist

SHEET_NAME = "Table 7"
HEADER_ROW = 5  # skip rows 1-5, data starts at row 6



def main():
    df = pd.read_excel(
        DATA, sheet_name=SHEET_NAME, header=None, skiprows=HEADER_ROW,
        usecols="A,B,C,D,E",
        names=["isco08_code", "isco08_title", "osca_code", "flag", "osca_title"],
    )

    df = df.dropna(how="all")

    # ABS's placeholder for "no OSCA equivalent exists", this is not a real match
    df = df[df["osca_code"].astype(str).str.strip().str.lower() != "xxxxxx"]
    df = df.dropna(subset=["osca_code"]) #drop genuine blank cells

    # Forward-fill the ISCO code/title into the blank continuation rows 
    # Reason is there's multiple occupations that can still match so next row gets filled with the previous row code
    df["isco08_code"] = df["isco08_code"].ffill()
    df["isco08_title"] = df["isco08_title"].ffill()

    df["isco08_code"] = df["isco08_code"].astype(str).str.strip().str.split(".").str[0]
    df["osca_code"] = df["osca_code"].astype(str).str.strip().str.split(".").str[0]

    df["match_type"] = df["flag"].apply(
        lambda f: "partial" if str(f).strip().lower() == "p" else "exact" #same as when checking ISCO08 to SOC2010 except p instead of *
    )

    out = df.rename(columns={"osca_code": "occupation_id"})
    out = out[["occupation_id", "isco08_code", "match_type"]]
    out = out.drop_duplicates()

    out.to_csv(OUTPUT, index=False)
    print(f"{len(out)} correspondence rows written to {OUTPUT}")
    print(out["match_type"].value_counts()) #note still same problem that they drop leading 0 in excel but its there in the csv


if __name__ == "__main__":
    main()