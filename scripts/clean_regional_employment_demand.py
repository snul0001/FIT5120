from pathlib import Path

import pandas as pd


data_folder = Path(__file__).resolve().parent.parent
raw_file = data_folder / "regional raw data " / "regional_employment_demand_raw.xlsx"
output_file = Path(__file__).resolve().parent / "regional_employment_demand_clean.csv"

source = pd.read_excel(
    raw_file,
    sheet_name="Averaged",
    dtype={"region_code": "string", "ANZSCO_CODE": "string"},
)

print("Source columns:")
print(source.columns.tolist())

id_columns = [
    "Level",
    "State",
    "region_name",
    "region_code",
    "region_level",
    "ANZSCO_CODE",
    "ANZSCO_TITLE",
]

missing_columns = [column for column in id_columns if column not in source.columns]
if missing_columns:
    raise ValueError(f"Missing expected columns: {missing_columns}")

month_columns = [column for column in source.columns if column not in id_columns]
parsed_months = pd.to_datetime(pd.Index(month_columns), errors="coerce")
if parsed_months.isna().any():
    raise ValueError("One or more monthly columns could not be read as dates.")

source["region_code"] = source["region_code"].str.strip()
source["ANZSCO_CODE"] = source["ANZSCO_CODE"].str.strip()
source["ANZSCO_TITLE"] = source["ANZSCO_TITLE"].astype("string").str.strip()

ict = source[
    (source["ANZSCO_CODE"] == "26")
    & (source["ANZSCO_TITLE"] == "ICT Professionals")
].copy()

cleaned = ict.melt(
    id_vars=id_columns,
    value_vars=month_columns,
    var_name="month",
    value_name="vacancy_3m_moving_average",
)

cleaned["month"] = pd.to_datetime(cleaned["month"]).dt.strftime("%Y-%m")
cleaned = cleaned.rename(
    columns={
        "State": "state_name",
        "ANZSCO_CODE": "anzsco2_code",
        "ANZSCO_TITLE": "anzsco2_name",
    }
)

cleaned["region_code"] = cleaned["region_code"].astype("string")
cleaned["anzsco2_code"] = cleaned["anzsco2_code"].astype("string")

cleaned = cleaned[
    [
        "month",
        "state_name",
        "region_code",
        "region_name",
        "region_level",
        "anzsco2_code",
        "anzsco2_name",
        "vacancy_3m_moving_average",
    ]
]

missing_values = cleaned.isna().sum()
duplicate_keys = cleaned.duplicated(
    subset=["month", "region_code", "anzsco2_code"]
).sum()
region_counts = ict[["region_code", "region_level"]].drop_duplicates()

cleaned.to_csv(output_file, index=False)

print(f"Source sheet: Averaged")
print(f"Source rows: {len(source):,}")
print(f"Filtered ICT rows: {len(ict):,}")
print(f"Cleaned rows: {len(cleaned):,}")
print(f"Unique regions: {region_counts['region_code'].nunique()}")
print(f"SA4 regions: {(region_counts['region_level'] == 'SA4').sum()}")
print(f"GCCSA regions: {(region_counts['region_level'] == 'GCCSA').sum()}")
print(f"Date range: {cleaned['month'].min()} to {cleaned['month'].max()}")
print("Missing values:")
print(missing_values.to_string())
print(f"Duplicate key count: {duplicate_keys}")
print("Final columns:")
print(cleaned.columns.tolist())
