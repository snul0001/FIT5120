#!/usr/bin/env python3
"""
Prepare the inputs for the ANZSCO -> O*NET matching preprocessing.

(Output):
  1. anzsco_groups.csv              one row per selected ANZSCO group (+ sector, task count)
  2. anzsco_tasks_for_gemini.txt    one block per group, tasks numbered T1, T2, ...
  3. onet_candidates.txt            "code | title | job_zone | description" lines (the closed list)
  4. report.txt                dropped / flagged from the code

Usage:
      bespoke bespoke_table_tracker_20251003.xlsx \
      onet-occupations "Occupation Data.txt" \
      onet-jobzones "Job Zones.txt" \
      onet-tasks task_statements.csv

The O*NET files can be the tab-separated .txt files from the O*NET database
download, or .csv / .xlsx versions. Use the same database release for all of them.
"""

import re
from pathlib import Path

import pandas as pd

# Curated list of groups
SECTORS = {
    "ICT": "2611 2612 2613 2621 2631 2632 2633 3131 3132 2241 2232 2252 6212",
    "Health": "2511 2512 2515 2523 2524 2525 2527 2544 2541 2346 2723 4111 4112 "
              "3112 4114 4231 4232 4233 3613",
    "Business": "2211 2212 2221 2223 2231 2243 2244 2247 2251 2253 5111 5511 5512 "
                "5211 5311 5521 5522 5994 5911 6121",
    "Creative": "2111 2112 2113 2114 2121 2122 2124 2323 2324 2325 3995",
    "Trades": "3312 3341 3311 3322 3411 3421 3423 3424 3211 3212 3232 3223 3231 "
              "3513 3514 3941 3911 3622",
} #Curated list of particular sector for diversity.
CODE_TO_SECTOR = {c: s for s, codes in SECTORS.items() for c in codes.split()}

# O*NET occupations that are never a sensible match for these entry-level groups
DROP_SOC_PREFIXES = ("11-", "55-")          # Management, Military, not relevant to end user
DROP_TITLE_REGEX = r"^First-Line Supervisors"  # supervisors, matched by title

# Data/output directory
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUT_DIR = BASE_DIR / "output"

BESPOKE_FILE = DATA_DIR / "bespoke_table_tracker_20251003.xlsx"
ONET_OCCUPATIONS_FILE = DATA_DIR / "occupation_data.csv"
ONET_JOBZONES_FILE = DATA_DIR / "job_zones.csv"
ONET_TASKS_FILE = DATA_DIR / "task_statements.csv"

# Function to help  
def clean(text):
    if pd.isna(text):
        return ""
    t = str(text).replace("\xa0", " ").replace("​", "")
    t = re.sub(r"\s*\\\s*", " / ", t)      # "Pathologists \ Therapists" -> " / "
    t = re.sub(r"\s+", " ", t).strip()
    return t


def read_any(path, **kw):
    p = Path(path)
    suf = p.suffix.lower()
    if suf in (".xlsx", ".xls"):
        return pd.read_excel(p, dtype=str, **kw)
    sep = "\t" if suf == ".txt" else ","
    return pd.read_csv(p, sep=sep, dtype=str, encoding="utf-8-sig", **kw)


def find_col(df, *candidates):
    low = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in low:
            return low[cand.lower()]
    raise KeyError(f"None of {candidates} found in columns {list(df.columns)}")


# ANZSCO (Focus only on Table_1)
def load_table1(path):
    raw = pd.read_excel(path, sheet_name="Table_1", header=None, dtype=str)
    mask = raw.apply(lambda r: r.astype(str).str.contains("ANZSCO unit code").any(), axis=1)
    hdr = raw.index[mask][0]
    df = raw.iloc[hdr + 1:, :3].copy()
    df.columns = ["code", "title", "task"]
    df = df.dropna(subset=["code"])
    df["code"] = df["code"].astype(str).str.strip()
    df["title"] = df["title"].map(clean)
    df["task"] = df["task"].map(clean)
    df = df[df["task"] != ""].drop_duplicates(subset=["code", "task"])
    return df


def build_anzsco_outputs(table1_path, out, report):
    t1 = load_table1(table1_path)
    wanted = list(CODE_TO_SECTOR)
    missing = [c for c in wanted if c not in set(t1["code"])]
    if missing:
        report.append(f"WARNING: codes not found in Table_1: {missing}")

    sel = t1[t1["code"].isin(wanted)].copy()
    groups, blocks = [], []
    for code in wanted:                       # keep the sector order above
        g = sel[sel["code"] == code]
        if g.empty:
            continue
        title = g["title"].iloc[0]
        tasks = g["task"].tolist()
        groups.append({"ANZSCO_code": code, "ANZSCO_title": title,
                       "sector": CODE_TO_SECTOR[code], "n_tasks": len(tasks)})
        lines = [f"ANZSCO unit group: {code} | {title}", "Tasks:"]
        lines += [f"T{i}. {t}" for i, t in enumerate(tasks, 1)]
        blocks.append("\n".join(lines))
        if len(tasks) < 5:
            report.append(f"FLAG: {code} {title} has only {len(tasks)} task(s) - weak match likely")

    pd.DataFrame(groups).to_csv(out / "anzsco_groups.csv", index=False)
    (out / "anzsco_tasks_for_gemini.txt").write_text("\n\n---\n\n".join(blocks), encoding="utf-8")
    report.append(f"ANZSCO: {len(groups)} of {len(wanted)} requested groups written")


# O*NET
def build_onet_outputs(occ_path, jz_path, tasks_path, out, report):
    occ = read_any(occ_path)
    code_c = find_col(occ, "O*NET-SOC Code")
    title_c = find_col(occ, "Title")
    desc_c = find_col(occ, "Description")
    occ = occ[[code_c, title_c, desc_c]].rename(
        columns={code_c: "code", title_c: "title", desc_c: "desc"})

    jz = read_any(jz_path)
    jz = jz[[find_col(jz, "O*NET-SOC Code"), find_col(jz, "Job Zone")]]
    jz.columns = ["code", "job_zone"]

    df = occ.merge(jz, on="code", how="left")
    for c in ("code", "title", "desc"):
        df[c] = df[c].map(clean)
    n0 = len(df)

    drop = df["code"].str.startswith(DROP_SOC_PREFIXES) | df["title"].str.contains(
        DROP_TITLE_REGEX, regex=True)
    dropped = df[drop]
    df = df[~drop].copy()
    report.append(f"O*NET: {n0} occupations -> {len(df)} after removing management, "
                  f"military and first-line supervisors ({len(dropped)} removed)")

    no_zone = df[df["job_zone"].isna()]
    if len(no_zone):
        report.append(f"NOTE: {len(no_zone)} occupations have no Job Zone "
                      f"(shown as 'n/a'); they are kept.")
    df["job_zone"] = df["job_zone"].fillna("n/a")
    
  # Write the closed candidate list, one line per occupation for faster prompting
    df = df.sort_values("code")
    lines = [f"{r.code} | {r.title} | {r.job_zone} | {r.desc}" for r in df.itertuples()]
    (out / "onet_candidates.txt").write_text("\n".join(lines), encoding="utf-8")
    report.append(f"O*NET candidate list: {len(lines)} lines")



# main
def main():
    for f in (BESPOKE_FILE, ONET_OCCUPATIONS_FILE, ONET_JOBZONES_FILE):
        if not Path(f).exists():
            raise FileNotFoundError(f"Missing input file: {f}")
    tasks_file = ONET_TASKS_FILE if ONET_TASKS_FILE and Path(ONET_TASKS_FILE).exists() else None
 
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = []
    build_anzsco_outputs(BESPOKE_FILE, OUT_DIR, report)
    build_onet_outputs(ONET_OCCUPATIONS_FILE, ONET_JOBZONES_FILE, tasks_file, OUT_DIR, report)
    (OUT_DIR / "prep_report.txt").write_text("\n".join(report), encoding="utf-8")
    print("\n".join(report))
    print(f"\nFiles written to {OUT_DIR}")



if __name__ == "__main__":
    main()