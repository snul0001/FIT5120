"""
Build jsa_task_score.csv by merging JSA's automation and augmentation task-score
sheets into one row per (ANZSCO unit group, task).

Both sheets is in the bespoke table. Unit group and task are merge together and not used
fuzzy matching.

Note:
Uses Column letter because it is not correctly mapping the header when specifying the header row.

Input:  bespoke_table_tracker_20251003.xlsx (Table_1 = automation, Table_2 =
        augmentation
Output: jsa_task_score.csv (provide scoring and description of task)
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA = BASE_DIR.parent / "data" / "bespoke_table_tracker_20251003.xlsx"
AUTOMATION = "Table_1" #where automation score lives
AUGMENTATION = "Table_2" #where augmentatoin score lives

OUTPUT = BASE_DIR.parent / "data" / "jsa_task_score.csv"

HEADER_ROW = 0


def load_sheet(sheet_name, out_score_name, out_justification_name):
    df = pd.read_excel(
        DATA, sheet_name=sheet_name, header=HEADER_ROW, usecols="A,C,D,E"
    )
    df.columns = ["anzsco_unit_group", "task_text", out_score_name, out_justification_name]
    # Excel read numeric and then trim it to int number, force read strings
    df["anzsco_unit_group"] = df["anzsco_unit_group"].astype(str)
    return df


def main():
    automation = load_sheet(
        AUTOMATION, "automation_score", "automation_justification"
    )
    augmentation = load_sheet(
        AUGMENTATION, "augmentation_score", "augmentation_justification"
    )

    merged = pd.merge(
        automation, augmentation,
        on=["anzsco_unit_group", "task_text"],
        how="outer",  # keep rows even if a task only appears on one side
        indicator=True,
    )

    unmatched = merged[merged["_merge"] != "both"]
    if len(unmatched):
        print(f"{len(unmatched)} rows didn't match on both sheets — "
              f"check task wording before rely on output")
        print(unmatched[["anzsco_unit_group", "task_text", "_merge"]].head(10))

    merged = merged.drop(columns="_merge")
    merged.to_csv(OUTPUT, index=False)
    print(f"{len(merged)} task rows written to {OUTPUT}")


if __name__ == "__main__":
    main()