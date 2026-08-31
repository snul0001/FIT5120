"""
Purpose
Cleaning O*NET-SOC 2019 to SOC 2018 crosswalk provided by ONET side.

Input:  2019_to_SOC_Crosswalk.xlsx (ONET's own crosswalk)
Output: onet_soc_to_soc2018.csv (onet_soc_code, soc_2018_code)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent #base directory
DATA = BASE_DIR.parent / "data" / "2019_to_SOC_Crosswalk.xlsx" #location

OUTPUT = BASE_DIR.parent / "output" / "onet_soc_to_soc2018.csv"
OUTPUT.parent.mkdir(parents=True, exist_ok=True) #incase it doesn't exist


def main():
    df = pd.read_excel(DATA, header=3)
    out = df.rename(columns={
        "O*NET-SOC 2019 Code": "onet_soc_code",
        "2018 SOC Code": "soc_2018_code",
    })[["onet_soc_code", "soc_2018_code"]]
    out = out.dropna().drop_duplicates()

    out.to_csv(OUTPUT, index=False)
    print(f"{len(out)} rows written to {OUTPUT}")


if __name__ == "__main__":
    main()