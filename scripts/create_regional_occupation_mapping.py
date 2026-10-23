from pathlib import Path

import pandas as pd


cleaned_folder = Path(__file__).resolve().parent
data_folder = cleaned_folder.parent

structure_file = data_folder / "regional raw data " / "anzsco_v13_structure_raw.xlsx"
opportunity_file = cleaned_folder / "regional_employment_opportunity_clean.csv"
demand_file = cleaned_folder / "regional_employment_demand_clean.csv"
output_file = cleaned_folder / "regional_ict_occupation_mapping.csv"

expected_codes = {"2611", "2612", "2613", "2621", "2631", "2632", "2633"}

# Table 4 contains the hierarchy down to four-digit unit groups.
structure = pd.read_excel(structure_file, sheet_name="Table 4", header=None)

parent_rows = structure[
    (structure.iloc[:, 1].astype("string").str.strip() == "26")
    & (structure.iloc[:, 2].astype("string").str.strip() == "ICT Professionals")
]

if len(parent_rows) != 1:
    raise ValueError("Could not find one official 26 ICT Professionals group.")

parent_index = parent_rows.index[0]
parent_code = "26"
parent_name = str(structure.iloc[parent_index, 2]).strip()

mapping_rows = []
for row_index in range(parent_index + 1, len(structure)):
    row = structure.iloc[row_index]

    # The next value in column B starts a new sub-major group.
    if pd.notna(row.iloc[1]):
        break

    if pd.isna(row.iloc[3]) or pd.isna(row.iloc[4]):
        continue

    try:
        unit_code = str(int(row.iloc[3]))
    except (TypeError, ValueError):
        continue

    if len(unit_code) == 4:
        mapping_rows.append(
            {
                "anzsco4_code": unit_code,
                "anzsco4_name": str(row.iloc[4]).strip(),
                "anzsco2_code": parent_code,
                "anzsco2_name": parent_name,
            }
        )

mapping = pd.DataFrame(mapping_rows)
mapping["anzsco4_code"] = mapping["anzsco4_code"].astype("string")
mapping["anzsco2_code"] = mapping["anzsco2_code"].astype("string")

official_codes = set(mapping["anzsco4_code"])
if official_codes != expected_codes:
    raise ValueError("The official Group 26 codes do not match the expected seven codes.")

opportunity = pd.read_csv(
    opportunity_file,
    usecols=["anzsco4_code", "anzsco4_name"],
    dtype={"anzsco4_code": "string"},
)
demand = pd.read_csv(
    demand_file,
    usecols=["anzsco2_code", "anzsco2_name"],
    dtype={"anzsco2_code": "string"},
)

opportunity_codes = set(opportunity["anzsco4_code"].str.strip())
missing_opportunity_codes = sorted(official_codes - opportunity_codes)
unexpected_opportunity_codes = sorted(opportunity_codes - official_codes)

demand_pairs = set(
    zip(
        demand["anzsco2_code"].str.strip(),
        demand["anzsco2_name"].astype("string").str.strip(),
    )
)
demand_group_found = (parent_code, parent_name) in demand_pairs
unexpected_demand_groups = sorted(
    demand_pairs - {(parent_code, parent_name)}
)

mapping.to_csv(output_file, index=False)

print(f"Mapping rows: {len(mapping)}")
print(mapping.to_string(index=False))
print(f"Parent group: {parent_code} {parent_name}")
print(f"All 7 codes found in opportunity data: {not missing_opportunity_codes}")
print(f"Code 26 found in demand data: {demand_group_found}")
print(f"Missing opportunity codes: {missing_opportunity_codes}")
print(f"Unexpected opportunity codes: {unexpected_opportunity_codes}")
print(f"Unexpected demand groups: {unexpected_demand_groups}")
