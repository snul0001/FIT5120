from pathlib import Path

import pandas as pd


ict_codes = ["2611", "2612", "2613", "2621", "2631", "2632", "2633"]

data_folder = Path(__file__).resolve().parent.parent
raw_file = data_folder / "regional raw data " / "regional_employment_opportunity_raw.csv"
output_file = Path(__file__).resolve().parent / "regional_employment_opportunity_clean.csv"

columns_to_keep = [
    "state_name",
    "sa4_code",
    "sa4_name",
    "anzsco4_code",
    "anzsco4_name",
    "date",
    "nsc_emp",
]

cleaned_chunks = []
raw_row_count = 0

# Read in chunks because the raw file is large.
for chunk in pd.read_csv(
    raw_file,
    dtype={"sa4_code": "string", "anzsco4_code": "string"},
    chunksize=250000,
):
    raw_row_count += len(chunk)

    index_columns = [
        column
        for column in chunk.columns
        if not str(column).strip() or str(column).startswith("Unnamed:")
    ]
    chunk = chunk.drop(columns=index_columns)

    chunk["sa4_code"] = chunk["sa4_code"].str.strip()
    chunk["anzsco4_code"] = chunk["anzsco4_code"].str.strip()
    chunk = chunk[chunk["anzsco4_code"].isin(ict_codes)]
    cleaned_chunks.append(chunk[columns_to_keep])

cleaned = pd.concat(cleaned_chunks, ignore_index=True)

cleaned["date"] = pd.to_datetime(cleaned["date"], errors="raise")
cleaned.insert(0, "month", cleaned["date"].dt.strftime("%Y-%m"))
cleaned = cleaned.rename(columns={"nsc_emp": "employment_value"})

cleaned["sa4_code"] = cleaned["sa4_code"].astype("string")
cleaned["anzsco4_code"] = cleaned["anzsco4_code"].astype("string")
cleaned["anzsco2_code"] = "26"
cleaned["anzsco2_name"] = "ICT Professionals"

cleaned = cleaned[
    [
        "month",
        "state_name",
        "sa4_code",
        "sa4_name",
        "anzsco4_code",
        "anzsco4_name",
        "anzsco2_code",
        "anzsco2_name",
        "employment_value",
    ]
]

missing_values = cleaned.isna().sum()
duplicate_keys = cleaned.duplicated(
    subset=["month", "sa4_code", "anzsco4_code"]
).sum()

cleaned.to_csv(output_file, index=False)

print(f"Raw rows: {raw_row_count:,}")
print(f"Cleaned rows: {len(cleaned):,}")
print(f"Rows removed: {raw_row_count - len(cleaned):,}")
print(f"Unique occupations: {cleaned['anzsco4_code'].nunique()}")
print(f"Unique SA4 regions: {cleaned['sa4_code'].nunique()}")
print(f"Date range: {cleaned['month'].min()} to {cleaned['month'].max()}")
print("Missing values:")
print(missing_values.to_string())
print(f"Duplicate key count: {duplicate_keys}")
