"""
Purpose: 
Cleaning OSCA occupations mapping from correspondence table with ANZSCO v1.3.

Note:
ABS watermark at the top is removed and the header starts rom row 5 in the dataset.

Input:  OSCA correspondence tables v2.xlsx
Output: osca_occupations.csv (osca_code, osca_title)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA = BASE_DIR.parent / "data" / "OSCA correspondence tables v2.xlsx" #where the data is located
SHEET_NAME = "Table 1"
HEADER_ROW = 5

OUTPUT_FILE = BASE_DIR.parent / "output" / "osca_occupations.csv"
OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)  #make an output folder to use.


def main():
    df = pd.read_excel(
        DATA, sheet_name=SHEET_NAME, header=None, skiprows=HEADER_ROW,
        usecols="C,E", names=["osca_code", "osca_title"],
    )
    df = df.dropna(how="all") # drop ALL NaN and Nulls

    df["osca_code"] = df["osca_code"].astype(str).str.strip().str.split(".").str[0]
    out = df.drop_duplicates(subset="osca_code") #Drop duplicates from OSCA code side,

    out.to_csv(OUTPUT_FILE, index=False) #output the df_csv
    print(f"{len(out)} unique OSCA occupations written to {OUTPUT_FILE}") #output to terminal to check for unique OSCA occupations after dropping duplicates.


if __name__ == "__main__":
    main()