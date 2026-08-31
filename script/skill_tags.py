"""
Build skill tags and work style tags reference tables from O*NET's data files.

Output:
  - skill_tag.csv   (from essential_skills.csv, transferable_skills.csv, software_skills.csv)
  - workstyle_tag.csv  (from work_style.csv)

Kept as seperate to handle for epic 5 later where we address skill gap within the iteration

Inputs:  all four CSVs, downloaded from https://www.onetcenter.org/database.html
Outputs: skill_tag.csv, work_style.csv
"""

import re
import pandas as pd

from pathlib import Path
 
BASE_DIR = Path(__file__).resolve().parent  # base directory
DATA_DIR = BASE_DIR.parent / "data"  # location of the data
 
OUTPUT_DIR = BASE_DIR.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)  # incase the folder itself doesn't exist
 
SKILL_CATEGORY_FILES = {
    DATA_DIR / "essential_skills.csv": "foundational",
    DATA_DIR / "transferable_skills.csv": "transferable",
} #changing the naming of skills to fit with the name, note that skills repeated many times in these 2 files.
TECHNICAL_FILE = DATA_DIR / "software_skills.csv"
WORK_STYLE_FILE = DATA_DIR / "work_styles.csv"
 
SKILL_OUTPUT = OUTPUT_DIR / "skill_tag.csv"
WORK_STYLE_OUTPUT = OUTPUT_DIR / "workstyle_tag.csv"



def slugify(label: str, prefix: str) -> str:
    slug = label.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return f"{prefix}_{slug}"


def build_skill_tag():
    frames = []
    for filename, category in SKILL_CATEGORY_FILES.items():
        df = pd.read_csv(filename)
        distinct = df[["Element Name"]].drop_duplicates() #skills are reused many times
        distinct["category"] = category
        distinct = distinct.rename(columns={"Element Name": "label"}) #where the skills name are located
        frames.append(distinct)

    # Software Skills uses the concrete tool name in "Workplace Example"
    # Hot Technology / In Demand to keep the list to a manageable, relevant size.
    tech = pd.read_csv(TECHNICAL_FILE)
    tech = tech[(tech["Hot Technology"] == "Y") | (tech["In Demand"] == "Y")] #Y means Yes, blank is No
    tech_distinct = tech[["Workplace Example"]].drop_duplicates()
    tech_distinct["category"] = "technical"
    tech_distinct = tech_distinct.rename(columns={"Workplace Example": "label"})
    frames.append(tech_distinct)

    skills = pd.concat(frames, ignore_index=True).drop_duplicates(subset="label")
    skills["skill_id"] = skills["label"].apply(lambda l: slugify(l, "skill"))

    out = skills[["skill_id", "label", "category"]].sort_values("category")
    out.to_csv(SKILL_OUTPUT, index=False)

    print(f"{len(out)} distinct skills written to {SKILL_OUTPUT}")
    print(out["category"].value_counts())


def build_work_style():
    df = pd.read_csv(WORK_STYLE_FILE)

    distinct = df[["Element Name"]].drop_duplicates()
    distinct = distinct.rename(columns={"Element Name": "label"})
    distinct["work_style_id"] = distinct["label"].apply(lambda l: slugify(l, "work_style"))

    out = distinct[["work_style_id", "label"]].sort_values("label")
    out.to_csv(WORK_STYLE_OUTPUT, index=False)

    print(f"{len(out)} distinct work styles written to {WORK_STYLE_OUTPUT}")


def main():
    build_skill_tag()
    build_work_style()


if __name__ == "__main__":
    main()