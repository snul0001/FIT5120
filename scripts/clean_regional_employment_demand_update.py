"""Expand Demand to 15 approved parent groups using existing raw records only.

Run without arguments from the original cleaned-data folder, or supply
--data-dir and --output-dir. Requires pandas and an Excel reading engine.
"""

import argparse
from hashlib import sha256
from pathlib import Path

import pandas as pd


GROUPS = "21 26 27 31 32 33 34 35 36 41 42 55 59 61 62".split()
UNAVAILABLE = "22 23 25 39 51 52 53".split()
COLUMNS = [
    "month", "state_name", "region_code", "region_name", "region_level",
    "anzsco2_code", "anzsco2_name", "vacancy_3m_moving_average",
]
IDS = ["Level", "State", "region_name", "region_code", "region_level", "ANZSCO_CODE", "ANZSCO_TITLE"]
TYPES = {"region_code": "string", "anzsco2_code": "string"}
KEYS = ["month", "region_code", "anzsco2_code"]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    result = sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def build(data_dir, output_dir):
    raw_dir = data_dir / "regional raw data "
    raw_file = raw_dir / "regional_employment_demand_raw.xlsx"
    reference_file = data_dir / "cleaned data" / "regional_employment_demand_clean.csv"
    opportunity_file = data_dir / "cleaned data" / "regional_employment_opportunity_clean.csv"
    output_file = output_dir / "regional_employment_demand_clean.csv"
    report_file = output_dir / "regional_employment_demand_validation_report.txt"
    protected = {p: digest(p) for p in raw_dir.iterdir() if p.is_file()}
    protected[opportunity_file] = digest(opportunity_file)
    require(not {output_file.resolve(), report_file.resolve()} & {p.resolve() for p in protected}, "Output overlaps a protected source.")
    reference = pd.read_csv(reference_file, dtype=TYPES)
    require(list(reference.columns) == COLUMNS, "Reference columns or column order changed.")
    reference_bytes = reference_file.read_bytes()
    require(not reference_bytes.startswith(b"\xef\xbb\xbf") and b"\r\n" not in reference_bytes, "Reference UTF-8/LF format changed.")
    source = pd.read_excel(raw_file, sheet_name="Averaged", dtype={"region_code": "string", "ANZSCO_CODE": "string"})
    require(set(IDS) <= set(source.columns), "Missing raw identifier columns.")
    months = [col for col in source.columns if col not in IDS]
    dates = pd.to_datetime(pd.Index(months), errors="raise")
    month_labels = dates.strftime("%Y-%m")
    require(len(months) == 91 and month_labels.is_unique, "Unexpected raw monthly structure.")
    require(not set(UNAVAILABLE) & set(source.ANZSCO_CODE), "Previously unavailable groups now exist; review scope before proceeding.")
    selected = source.loc[source.ANZSCO_CODE.isin(GROUPS)].copy()
    require(set(selected.ANZSCO_CODE) == set(GROUPS), "Required demand groups missing from raw source.")
    require(not selected.duplicated(["region_code", "ANZSCO_CODE"]).any(), "Duplicate raw region/group rows.")
    require(not selected[IDS + months].isna().any().any(), "Missing raw data.")
    require(selected.groupby("ANZSCO_CODE").ANZSCO_TITLE.nunique().eq(1).all(), "Conflicting raw group titles.")

    # Reshape existing monthly cells only; no aggregation or occupation expansion.
    cleaned = selected.melt(id_vars=IDS, value_vars=months, var_name="month", value_name="vacancy_3m_moving_average")
    cleaned["month"] = cleaned.month.map(dict(zip(months, month_labels)))
    cleaned = cleaned.rename(columns={"State": "state_name", "ANZSCO_CODE": "anzsco2_code", "ANZSCO_TITLE": "anzsco2_name"})
    cleaned = cleaned[COLUMNS].astype(TYPES)
    require(len(cleaned) == 68250 and cleaned.anzsco2_code.nunique() == 15, "Unexpected final size.")
    require(not cleaned.isna().any().any(), "Missing output values.")
    require(not cleaned.select_dtypes(include=["object", "string"]).apply(lambda s: s.str.strip().eq("")).any().any(), "Blank required fields.")
    require(not cleaned.duplicated(KEYS).any(), "Duplicate composite keys.")
    require(cleaned.vacancy_3m_moving_average.ge(0).all(), "Negative demand values.")
    require(cleaned.groupby("anzsco2_code").size().eq(4550).all(), "Incomplete group coverage.")
    require(set(cleaned.month) == set(reference.month), "Time coverage differs from existing file.")
    geo = ["state_name", "region_code", "region_name", "region_level"]
    expected_geo = reference[geo].drop_duplicates().sort_values("region_code").reset_index(drop=True)
    for _, group in cleaned.groupby("anzsco2_code"):
        pd.testing.assert_frame_equal(group[geo].drop_duplicates().sort_values("region_code").reset_index(drop=True), expected_geo)
    require(len(expected_geo) == 50 and expected_geo.region_level.value_counts().to_dict() == {"SA4": 42, "GCCSA": 8}, "Geographic levels changed.")
    # Check every value by reversing the reshape and comparing to raw cells.
    restored = cleaned.pivot(index=["region_code", "anzsco2_code"], columns="month", values="vacancy_3m_moving_average")
    original = selected.set_index(["region_code", "ANZSCO_CODE"])[months].copy()
    original.columns = month_labels
    original.index.names = restored.index.names
    original.columns.name = restored.columns.name
    pd.testing.assert_frame_equal(restored.sort_index().sort_index(axis=1), original.sort_index().sort_index(axis=1))
    # Existing ICT rows must remain identical, including their relative order.
    pd.testing.assert_frame_equal(cleaned.loc[cleaned.anzsco2_code.eq("26")].reset_index(drop=True), reference.loc[reference.anzsco2_code.eq("26")].reset_index(drop=True))
    require(all(digest(p) == value for p, value in protected.items()), "Protected input changed.")

    output_dir.mkdir(parents=True, exist_ok=True)
    temporary = output_file.with_name(output_file.name + ".tmp")
    try:
        cleaned.to_csv(temporary, index=False, encoding="utf-8", lineterminator="\n")
        pd.testing.assert_frame_equal(pd.read_csv(temporary, dtype=TYPES), cleaned)
        require(pd.read_csv(temporary).dtypes.equals(pd.read_csv(reference_file).dtypes), "CSV inferred types changed.")
        temporary.replace(output_file)
    finally:
        if temporary.exists():
            temporary.unlink()
    report = [
        "Regional Employment Demand — Iteration 3 validation",
        f"Raw input: {raw_file.resolve()} (Averaged sheet)",
        f"Raw rows: {len(source):,}; selected source rows: {len(selected):,}",
        "Final rows: 68,250; occupation groups: 15",
        "Included groups: " + ", ".join(GROUPS),
        "Excluded/unavailable numeric parent groups: " + ", ".join(UNAVAILABLE),
        "Coverage: 15/22 relevant parent groups; broader-group context for 49/81 scoped occupations.",
        "The other 32 occupations have unavailable numeric parent groups. No alternative grouping or four-digit values were invented.",
        "Geography: 50 regions, comprising 42 SA4 and 8 GCCSA; 8 states/territories.",
        f"Time: {cleaned.month.min()} to {cleaned.month.max()}; 91 months; YYYY-MM.",
        "Missing/blank required values: 0; duplicate month/region/group keys: 0; negative values: 0.",
        "PASS: every demand value verified against its original raw group/region/month cell.",
        "PASS: existing ICT group 26 rows and their relative order unchanged.",
        "PASS: exact column names/order, CSV data types, UTF-8 without BOM and LF newlines preserved.",
        "PASS: all raw files and the Opportunity CSV unchanged (SHA-256 verified). Quiz files are not accessed or written.",
        "Schema: " + ",".join(COLUMNS),
        "Source groups and titles:\n" + selected[["ANZSCO_CODE", "ANZSCO_TITLE"]].drop_duplicates().sort_values("ANZSCO_CODE").to_string(index=False),
        "Protected file SHA-256 hashes:\n" + "\n".join(f"{p}: {value}" for p, value in protected.items()),
        "OVERALL VALIDATION: PASS",
    ]
    report_file.write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report[:17]))
    print("Output:", output_file.resolve())
    print("Validation report:", report_file.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    build(args.data_dir, args.output_dir or args.data_dir / "cleaned data")
