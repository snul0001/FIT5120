"""
Purpose:
Clean BLS SOC 2010 to SOC 2018 transition crosswalk. Provided by BLS when the new SOC 2018 released

Input:  soc_2010_to_2018_crosswalk.xlsx
Output: soc2010_to_soc2018.csv (soc_2010_code, soc_2018_code, match_type)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent #base directory
DATA = BASE_DIR.parent / "data" / "soc_2010_to_2018_crosswalk.xlsx" #location

OUTPUT = BASE_DIR.parent / "output" / "soc2010_to_soc2018.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True) #incase the folder itself doesn't exist

HEADER_ROW = 8


def main():
    df = pd.read_excel(DATA, header=HEADER_ROW)
    df = df.rename(columns={
        "2010 SOC Code": "soc_2010_code",
        "2010 SOC Title": "soc_2010_title",
        "2018 SOC Code": "soc_2018_code",
        "2018 SOC Title": "soc_2018_title",
    })

    df = df.dropna(subset=["soc_2010_code", "soc_2018_code"])

    df["soc_2010_code"] = df["soc_2010_code"].astype(str).str.strip()
    df["soc_2018_code"] = df["soc_2018_code"].astype(str).str.strip()

    has_marker = (
        df["soc_2010_title"].astype(str).str.contains("#", na=False) |
        df["soc_2018_title"].astype(str).str.contains("#", na=False)
    )
    df["match_type"] = has_marker.apply(lambda m: "partial" if m else "exact")

    out = df[["soc_2010_code", "soc_2018_code", "match_type"]].drop_duplicates()

    out.to_csv(OUTPUT, index=False)
    print(f"{len(out)} rows written to {OUTPUT}")
    print(out["match_type"].value_counts())


if __name__ == "__main__":
    main()