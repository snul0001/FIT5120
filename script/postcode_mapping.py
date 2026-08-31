"""
Purpose:
Build postcode_region.csv, region.csv and state_territory.csv from ABS
ASGS Edition 3 allocation files. This code aims to joins the two files through
their shared Mesh Block code, then resolves each postcode down to a single
state/SA4 by picking whichever has the largest total area within that postcode.
This is not a boundary claim just an approximation of the location where students can be OR
help with Regional Employment Insight Epic in Iteration 2
Note:
ABS POA (Postal Area) is approximation of the postal code registered most often
, Australia Post has the accurate Postcode but is not open data we can't use it.
Inputs:
  POA_2021_AUST.xlsx  -- MB_CODE_2021, POA_CODE_2021, POA_NAME_2021
  MB_2021_AUST.xlsx   -- MB_CODE_2021, SA4_CODE_2021, SA4_NAME_2021,
                         STATE_CODE_2021, STATE_NAME_2021, AREA_ALBERS_SQKM

Outputs:
  postcode_region.csv -- postcode, state_code, region_id
  region.csv           -- region_id, label   (distinct Statistical Area 4s according to ABS)
  state_territory.csv  -- state_code, label   (distinct states/territories)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
POA_XLSX = BASE_DIR.parent / "data" / "POA_2021_AUST.xlsx"
MB_XLSX = BASE_DIR.parent / "data" / "MB_2021_AUST.xlsx"


POSTCODE_REGION_OUTPUT = BASE_DIR.parent / "output" / "postcode_region.csv"
REGION_OUTPUT = BASE_DIR.parent / "output" / "region.csv"
STATE_OUTPUT = BASE_DIR.parent / "output" / "state_territory.csv"


def main():
    poa = pd.read_excel(POA_XLSX, usecols=["MB_CODE_2021", "POA_CODE_2021"])
    mb = pd.read_excel(
        MB_XLSX,
        usecols=["MB_CODE_2021", "SA4_CODE_2021", "SA4_NAME_2021",
                 "STATE_CODE_2021", "STATE_NAME_2021", "AREA_ALBERS_SQKM"],
    ) #mesh block

    merged = poa.merge(mb, on="MB_CODE_2021", how="left")

    # Mesh code doesn't always mean the same
    # Resolve each postcode to which has combined largest area.
    area_by_group = (
        merged.groupby(["POA_CODE_2021", "SA4_CODE_2021", "SA4_NAME_2021",
                         "STATE_CODE_2021", "STATE_NAME_2021"])["AREA_ALBERS_SQKM"]
        .sum()
        .reset_index()
    )
    dominant = (
        area_by_group.sort_values("AREA_ALBERS_SQKM", ascending=False)
        .drop_duplicates(subset="POA_CODE_2021", keep="first")
    )

    postcode_region = dominant.rename(columns={
        "POA_CODE_2021": "postcode",
        "STATE_CODE_2021": "state_code",
        "SA4_CODE_2021": "region_id",
    })[["postcode", "state_code", "region_id"]]
    postcode_region.to_csv(POSTCODE_REGION_OUTPUT, index=False)
    print(f"{len(postcode_region)} postcodes written to {POSTCODE_REGION_OUTPUT}")

    region = (
        mb[["SA4_CODE_2021", "SA4_NAME_2021"]]
        .drop_duplicates()
        .rename(columns={"SA4_CODE_2021": "region_id", "SA4_NAME_2021": "label"})
    )
    region.to_csv(REGION_OUTPUT, index=False)
    print(f"{len(region)} SA4 regions written to {REGION_OUTPUT}")

    state = (
        mb[["STATE_CODE_2021", "STATE_NAME_2021"]]
        .drop_duplicates()
        .rename(columns={"STATE_CODE_2021": "state_code", "STATE_NAME_2021": "label"})
    )
    state.to_csv(STATE_OUTPUT, index=False)
    print(f"{len(state)} states/territories written to {STATE_OUTPUT}")
    

if __name__ == "__main__":
    main()