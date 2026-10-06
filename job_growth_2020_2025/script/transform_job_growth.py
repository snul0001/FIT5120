#!/usr/bin/env python3
"""STEP 2 - TRANSFORM: cleaned quarterly table -> year-by-year growth table.

Input: cleaned_quarterly_unitgroup.csv, global_variable.py 
Reads   output/cleaned_quarterly_unitgroup.csv
Writes  output/job_growth_unitgroup_2020_2025.csv   (paths set in config.py)

Method:
    - Annual level = mean of the four quarterly estimates (Feb, May, Aug, Nov), thousand persons.
    - A year with fewer than 4 quarterly values is left blank (NaN), not averaged on what is left.
    - change_Y0_Y1 = level_Y1 - level_Y0;  pct_change = change / level_Y0, in other words [(current - previous)/ previous] * 100
    - cagr_2020_2025 = (level_2025 / level_2020) ** (1/5) - 1
"""
import sys
import pandas as pd

from global_variable import CLEAN_FILE, GROWTH_FILE, OUTPUT_DIR, YEARS


def annual_levels(quarterly: pd.DataFrame) -> pd.DataFrame:
    g = quarterly.groupby(["category", "code", "unit_group", "year"])["employed_k"]
    annual = g.agg(mean="mean", n="count").reset_index()
    annual.loc[annual["n"] < 4, "mean"] = float("nan")
    wide = annual.pivot(index=["category", "code", "unit_group"], columns="year", values="mean")
    return wide.reset_index()


def add_growth(df: pd.DataFrame) -> pd.DataFrame:
    """
    Pairing each year by year (eg 2020-2021,2021-2022..., employed values are in thousansd)
    General formula for change is current year - previous year
    pct change is [(current year - previous year)/ previous year], or in another way
    (current year/previous year) - 1 
    """
    for prev, cur in zip(YEARS[:-1], YEARS[1:]):
        df[f"change_{prev}_{cur}"] = df[cur] - df[prev] 
    for prev, cur in zip(YEARS[:-1], YEARS[1:]):
        df[f"pct_change_{prev}_{cur}"] = df[cur] / df[prev] - 1
    df["total_change_2020_2025"] = df[2025] - df[2020]
    df["total_pct_change_2020_2025"] = df[2025] / df[2020] - 1
    df["cagr_2020_2025"] = (df[2025] / df[2020]) ** (1 / 5) - 1 # compound annual growth rate 
    return df.rename(columns={y: f"employed_{y}_k" for y in YEARS}) #refers back to global_variable


def main() -> None:
    if not CLEAN_FILE.exists():
        sys.exit(f"Cleaned file not found: {CLEAN_FILE}. Run clean.py first.")
    OUTPUT_DIR.mkdir(exist_ok=True)
    quarterly = pd.read_csv(CLEAN_FILE, dtype={"code": str})
    table = add_growth(annual_levels(quarterly))
    table.columns.name = None
    table.round(4).to_csv(GROWTH_FILE, index=False)
    print(f"Wrote {len(table)} rows to {GROWTH_FILE}")


if __name__ == "__main__":
    main()