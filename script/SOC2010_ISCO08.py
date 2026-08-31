"""
Clean ISCO-08 <-> SOC 2010 crosswalk. Provided by BLS of US
Similar to other clean, strip white spaces, duplicates and NaN

Input:  ISCO_SOC_Crosswalk.xls
Output: isco08_to_soc2010.csv (isco08_code, soc_2010_code, match_type)
"""

import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent #base directory
DATA = BASE_DIR.parent / "data" / "ISCO_SOC_Crosswalk.xls" #location

OUTPUT = BASE_DIR.parent / "output" / "isco08_to_soc2010.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True) #incase the folder itself doesn't exist

HEADER_ROW = 6


def main():
    df = pd.read_excel(DATA, header=HEADER_ROW, dtype = str)
    df = df.rename(columns={
        "ISCO-08 Code": "isco08_code",
        "2010 SOC Code": "soc_2010_code",
        "part": "part_flag",
    })

    df["soc_2010_code"] = df["soc_2010_code"].astype(str).str.strip().str.zfill(4) #match 4 digts and forced excel to not delete the first 0
    df["isco08_code"] = df["isco08_code"].astype(str).str.strip()
    df["match_type"] = df["part_flag"].apply(
        lambda f: "partial" if str(f).strip() == "*" else "exact" #In the input csv * is partial otherwise its empty so its exact match
    )

    out = df[["isco08_code", "soc_2010_code", "match_type"]].dropna(subset=["isco08_code", "soc_2010_code"])
    out = out.drop_duplicates()

    out.to_csv(OUTPUT, index=False)
    print(f"{len(out)} rows written to {OUTPUT}")
    print(out["match_type"].value_counts())


if __name__ == "__main__":
    main()