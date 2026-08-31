"""
Purpose:
Cleaning O*NET occupation reference data.

Extracts every distinct O*NET-SOC occupation (code + title). Pure cleaning
-- no joining, no matching. Output is meant to be trusted as-is by anything
downstream.

Input:  All_Occupations.csv (all unique occupations on the ONET side)
Output: onet_occupations.csv (final onet_soc_code, onet_title)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent #base directory
DATA = BASE_DIR.parent / "data" / "All_Occupations.csv" #where its located

OUTPUT = BASE_DIR.parent / "output" / "onet_occupations.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True) #incase it doesn't exist


def main():
    df = pd.read_csv(DATA, encoding="utf-8-sig") #Strips BOM characters, to avoid breaking
                                                # any code by checking column exact name
    
    df = df.rename(columns={
        "Code": "onet_soc_code",
        "Occupation": "onet_title",
    })
    out = df[["onet_soc_code", "onet_title"]].drop_duplicates()

    out.to_csv(OUTPUT, index=False)
    print(f"{len(out)} O*NET occupations written to {OUTPUT}")


if __name__ == "__main__":
    main()