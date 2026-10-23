"""Filter Regional Opportunity to the team's 81 occupations; preserve raw values.

Run in the original cleaned-data folder with no arguments, or use --data-dir
and --output to build elsewhere. Requires pandas and an Excel reading engine.
The demand dataset is never written.
"""

import argparse
from hashlib import sha256
from pathlib import Path

import pandas as pd


SCOPE = {
    "ICT": "2611 2612 2613 2621 2631 2632 2633 3131 3132 2241 2232 2252 6212",
    "Health": "2511 2512 2515 2523 2524 2525 2527 2544 2541 2346 2723 4111 4112",
    "Business": "3112 4114 4231 4232 4233 3613 2211 2212 2221 2223 2231 2243 2244 2247 2251 2253 5111 5511 5512 5211 5311 5521 5522 5994 5911 6121",
    "Creative": "2111 2112 2113 2114 2121 2122 2124 2323 2324 2325 3995",
    "Trades": "3312 3341 3311 3322 3411 3421 3423 3424 3211 3212 3232 3223 3231 3513 3514 3941 3911 3622",
}
COLUMNS = [
    "month", "state_name", "sa4_code", "sa4_name", "anzsco4_code",
    "anzsco4_name", "anzsco2_code", "anzsco2_name", "employment_value",
]
SOURCE_COLUMNS = ["state_name", "sa4_code", "sa4_name", "anzsco4_code", "anzsco4_name", "date", "nsc_emp"]
CODE_TYPES = {"sa4_code": "string", "anzsco4_code": "string", "anzsco2_code": "string"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    result = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def classification_lookup(path):
    # Read actual hierarchy rows, not an ICT-only constant or guessed title.
    table = pd.read_excel(path, sheet_name="Table 4", header=None)
    rows = []
    parent_code = parent_title = None
    for _, row in table.iterrows():
        parent = str(row.iloc[1]).strip()
        if parent.isdigit() and len(parent) == 2:
            parent_code, parent_title = parent, str(row.iloc[2]).strip()
        code = str(row.iloc[3]).strip()
        if code.isdigit() and len(code) == 4:
            require(parent_code is not None and code.startswith(parent_code), "Invalid classification hierarchy.")
            title = str(row.iloc[4]).strip()
            # Some official titles list Australian and New Zealand alternatives.
            australian_title = title.split(" (Aus)")[0] if " (Aus)" in title else title
            rows.append([code, australian_title, parent_code, parent_title])
    lookup = pd.DataFrame(rows, columns=["anzsco4_code", "official_australian_title", "anzsco2_code", "anzsco2_name"])
    require(lookup.anzsco4_code.is_unique, "Duplicate classification unit groups.")
    return lookup.set_index("anzsco4_code")


def build(data_folder, output):
    raw_folder = data_folder / "regional raw data "
    raw_file = raw_folder / "regional_employment_opportunity_raw.csv"
    structure_file = raw_folder / "anzsco_v13_structure_raw.xlsx"
    reference_file = data_folder / "cleaned data" / "regional_employment_opportunity_clean.csv"
    demand_file = data_folder / "cleaned data" / "regional_employment_demand_clean.csv"
    protected = {p: digest(p) for p in [raw_file, structure_file, demand_file]}
    require(output.resolve() not in {p.resolve() for p in protected}, "Output would overwrite a protected source.")
    reference_bytes = reference_file.read_bytes()
    reference = pd.read_csv(reference_file, dtype=CODE_TYPES)
    require(list(reference.columns) == COLUMNS, "Reference schema differs from the required format.")
    require(not reference_bytes.startswith(b"\xef\xbb\xbf") and b"\r\n" not in reference_bytes, "Reference encoding/newline format changed; inspect before proceeding.")
    scope_list = [code for group in SCOPE.values() for code in group.split()]
    scope = set(scope_list)
    require(len(scope_list) == len(scope) == 81, "Team scope must contain 81 distinct codes.")
    lookup = classification_lookup(structure_file)
    require(scope <= set(lookup.index), "Scope codes missing from the classification.")

    # Preserve source row order and exact values; no averaging or filling.
    chunks = []
    raw_rows = 0
    for chunk in pd.read_csv(raw_file, usecols=SOURCE_COLUMNS, dtype=CODE_TYPES, chunksize=250000):
        raw_rows += len(chunk)
        chunks.append(chunk.loc[chunk.anzsco4_code.isin(scope), SOURCE_COLUMNS])
    source = pd.concat(chunks, ignore_index=True)
    require(set(source.anzsco4_code) == scope, "Missing required raw occupations.")
    require(source.anzsco4_name.eq(source.anzsco4_code.map(lookup.official_australian_title)).all(), "Occupation title differs from its official Australian classification title.")
    cleaned = source.rename(columns={"nsc_emp": "employment_value"}).copy()
    # Format each distinct source date once, then map it to every original row.
    dates = source.date.drop_duplicates()
    month_lookup = dict(zip(dates, pd.to_datetime(dates, errors="raise").dt.strftime("%Y-%m")))
    cleaned["month"] = source.date.map(month_lookup)
    for column in ["anzsco2_code", "anzsco2_name"]:
        cleaned[column] = source.anzsco4_code.map(lookup[column])
    cleaned = cleaned[COLUMNS].astype(CODE_TYPES)
    require(not cleaned.isna().any().any(), "Missing required fields.")
    require(not cleaned.select_dtypes(include=["object", "string"]).apply(lambda col: col.str.strip().eq("")).any().any(), "Blank required fields.")
    keys = ["anzsco4_code", "sa4_code", "month"]
    require(not cleaned.duplicated(keys).any(), "Duplicate occupation/SA4/month records.")
    require(cleaned.employment_value.ge(0).all(), "Negative employment values.")
    pd.testing.assert_series_equal(cleaned.employment_value, source.nsc_emp, check_names=False)
    geo = ["state_name", "sa4_code", "sa4_name"]
    pd.testing.assert_frame_equal(cleaned[geo], source[geo])
    require(set(cleaned.month) == set(reference.month), "Monthly coverage differs from existing output.")
    pd.testing.assert_frame_equal(cleaned[geo].drop_duplicates().sort_values("sa4_code").reset_index(drop=True), reference[geo].drop_duplicates().sort_values("sa4_code").reset_index(drop=True))
    expected_cells = cleaned.sa4_code.nunique() * cleaned.month.nunique()
    require(cleaned.groupby("anzsco4_code").size().eq(expected_cells).all(), "Incomplete occupation geography/month coverage.")
    # Existing occupation records must remain exactly the same after expansion.
    existing = cleaned.loc[cleaned.anzsco4_code.isin(reference.anzsco4_code)]
    pd.testing.assert_frame_equal(existing.sort_values(keys).reset_index(drop=True), reference.sort_values(keys).reset_index(drop=True))
    require(all(digest(p) == h for p, h in protected.items()), "A protected input changed.")

    # Validate a staged CSV before replacing the requested output.
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    try:
        cleaned.to_csv(temporary, index=False, encoding="utf-8", lineterminator="\n")
        saved = pd.read_csv(temporary, dtype=CODE_TYPES)
        pd.testing.assert_frame_equal(saved, cleaned)
        require(pd.read_csv(temporary, nrows=100).dtypes.equals(pd.read_csv(reference_file, nrows=100).dtypes), "CSV inferred types changed.")
        temporary.replace(output)
    finally:
        if temporary.exists():
            temporary.unlink()
    print(f"Raw rows: {raw_rows:,}; final rows: {len(cleaned):,}")
    print(f"Occupation coverage: {cleaned.anzsco4_code.nunique()}/81; outside scope: 0")
    print(f"Geography: {cleaned.sa4_code.nunique()} SA4 regions; {cleaned.state_name.nunique()} states/territories")
    print(f"Time: {cleaned.month.min()} to {cleaned.month.max()}; {cleaned.month.nunique()} months")
    print("Missing fields: 0; duplicate keys: 0; negative values: 0")
    print(f"Classification: all titles and {cleaned.anzsco2_code.nunique()} parent groups verified from Table 4")
    print("5522: retained raw Australian title; validated against the official Australian title alternative.")
    print("PASS: original values, existing records, geography, dates, schema, types, raw inputs and demand file preserved.")
    print("Output:", output.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    build(args.data_dir, args.output or args.data_dir / "cleaned data" / "regional_employment_opportunity_clean.csv")
