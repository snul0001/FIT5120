from datetime import date
from pathlib import Path

import pandas as pd


cleaned_folder = Path(__file__).resolve().parent
opportunity_file = cleaned_folder / "regional_employment_opportunity_clean.csv"
demand_file = cleaned_folder / "regional_employment_demand_clean.csv"
mapping_file = cleaned_folder / "regional_ict_occupation_mapping.csv"
report_file = cleaned_folder / "regional_employment_validation_report.txt"

expected_codes = {"2611", "2612", "2613", "2621", "2631", "2632", "2633"}

opportunity = pd.read_csv(
    opportunity_file,
    dtype={
        "sa4_code": "string",
        "anzsco4_code": "string",
        "anzsco2_code": "string",
    },
)
demand = pd.read_csv(
    demand_file,
    dtype={"region_code": "string", "anzsco2_code": "string"},
)
mapping = pd.read_csv(
    mapping_file,
    dtype={"anzsco4_code": "string", "anzsco2_code": "string"},
)

# Opportunity checks
opportunity_missing = opportunity.isna().sum()
opportunity_duplicates = opportunity.duplicated(
    ["month", "sa4_code", "anzsco4_code"]
).sum()
opportunity_months = set(opportunity["month"])
opportunity_codes = set(opportunity["anzsco4_code"])

opportunity_month_format = opportunity["month"].str.fullmatch(r"\d{4}-\d{2}").all()
opportunity_code_format = (
    opportunity["sa4_code"].str.fullmatch(r"\d{3}").all()
    and opportunity["anzsco4_code"].str.fullmatch(r"\d{4}").all()
    and opportunity["anzsco2_code"].str.fullmatch(r"\d{2}").all()
)
employment_numeric = pd.to_numeric(
    opportunity["employment_value"], errors="coerce"
).notna().all()

opportunity_pass = all(
    [
        len(opportunity) == 81312,
        len(opportunity_months) == 132,
        min(opportunity_months) == "2015-09",
        max(opportunity_months) == "2026-08",
        opportunity["sa4_code"].nunique() == 88,
        opportunity["anzsco4_code"].nunique() == 7,
        opportunity_missing.sum() == 0,
        opportunity_duplicates == 0,
        opportunity_month_format,
        opportunity_code_format,
        employment_numeric,
    ]
)

# Demand checks
demand_missing = demand.isna().sum()
demand_duplicates = demand.duplicated(
    ["month", "region_code", "anzsco2_code"]
).sum()
demand_months = set(demand["month"])
demand_regions = demand[["region_code", "region_name", "region_level"]].drop_duplicates()
demand_sa4 = demand_regions[demand_regions["region_level"] == "SA4"]
demand_gccsa = demand_regions[demand_regions["region_level"] == "GCCSA"]

demand_month_format = demand["month"].str.fullmatch(r"\d{4}-\d{2}").all()
demand_code_format = (
    demand_sa4["region_code"].str.fullmatch(r"\d{3}").all()
    and demand_gccsa["region_code"].str.fullmatch(r"[1-8][A-Z]{4}").all()
    and demand["anzsco2_code"].str.fullmatch(r"\d{2}").all()
)
vacancy_numeric = pd.to_numeric(
    demand["vacancy_3m_moving_average"], errors="coerce"
).notna().all()

demand_pass = all(
    [
        len(demand) == 4550,
        len(demand_months) == 91,
        min(demand_months) == "2019-01",
        max(demand_months) == "2026-07",
        len(demand_regions) == 50,
        len(demand_sa4) == 42,
        len(demand_gccsa) == 8,
        demand_missing.sum() == 0,
        demand_duplicates == 0,
        demand_month_format,
        demand_code_format,
        vacancy_numeric,
    ]
)

# Mapping checks
mapping_missing = mapping.isna().sum()
mapping_duplicates = mapping.duplicated(["anzsco4_code"]).sum()
mapping_codes = set(mapping["anzsco4_code"])
mapping_parent_ok = (
    set(mapping["anzsco2_code"]) == {"26"}
    and set(mapping["anzsco2_name"]) == {"ICT Professionals"}
)

mapping_pass = all(
    [
        len(mapping) == 7,
        mapping_missing.sum() == 0,
        mapping_duplicates == 0,
        mapping_codes == expected_codes,
        mapping_parent_ok,
    ]
)

# Cross-file occupation checks
unmatched_opportunity_codes = sorted(opportunity_codes - mapping_codes)
unexpected_mapping_codes = sorted(mapping_codes - opportunity_codes)

opportunity_names = opportunity[
    ["anzsco4_code", "anzsco4_name"]
].drop_duplicates()
name_check = opportunity_names.merge(
    mapping[["anzsco4_code", "anzsco4_name"]],
    on="anzsco4_code",
    how="left",
    suffixes=("_opportunity", "_mapping"),
)
occupation_name_mismatches = name_check[
    name_check["anzsco4_name_opportunity"] != name_check["anzsco4_name_mapping"]
]

demand_pairs = set(zip(demand["anzsco2_code"], demand["anzsco2_name"]))
unexpected_demand_groups = sorted(demand_pairs - {("26", "ICT Professionals")})

occupation_consistency_pass = all(
    [
        not unmatched_opportunity_codes,
        not unexpected_mapping_codes,
        occupation_name_mismatches.empty,
        demand_pairs == {("26", "ICT Professionals")},
    ]
)

# Regional checks
opportunity_regions = opportunity[["sa4_code", "sa4_name"]].drop_duplicates()
opportunity_region_names = dict(
    zip(opportunity_regions["sa4_code"], opportunity_regions["sa4_name"])
)

matching_sa4_codes = 0
matching_sa4_names = 0
unmatched_sa4_codes = []
region_name_mismatches = []

for row in demand_sa4.itertuples(index=False):
    if row.region_code in opportunity_region_names:
        matching_sa4_codes += 1
        if opportunity_region_names[row.region_code] == row.region_name:
            matching_sa4_names += 1
        else:
            region_name_mismatches.append(
                f"{row.region_code}: {opportunity_region_names[row.region_code]} / {row.region_name}"
            )
    else:
        unmatched_sa4_codes.append(row.region_code)

regional_pass = all(
    [
        opportunity["sa4_code"].nunique() == 88,
        len(demand_sa4) == 42,
        len(demand_gccsa) == 8,
        matching_sa4_codes == 42,
        matching_sa4_names == 42,
        not unmatched_sa4_codes,
        not region_name_mismatches,
    ]
)

# Time and July checks
common_months = sorted(opportunity_months & demand_months)
earliest_common_month = common_months[0]
latest_common_month = common_months[-1]
july_in_both = "2026-07" in opportunity_months and "2026-07" in demand_months

july_opportunity_rows = len(opportunity[opportunity["month"] == "2026-07"])
july_demand_rows = len(demand[demand["month"] == "2026-07"])

time_pass = all(
    [
        len(common_months) == 91,
        earliest_common_month == "2019-01",
        latest_common_month == "2026-07",
        july_in_both,
        july_opportunity_rows == 616,
        july_demand_rows == 50,
    ]
)

issues = []
if not opportunity_pass:
    issues.append("Opportunity data did not meet all expected checks.")
if not demand_pass:
    issues.append("Demand data did not meet all expected checks.")
if not mapping_pass:
    issues.append("Occupation mapping did not meet all expected checks.")
if unmatched_opportunity_codes:
    issues.append(f"Opportunity codes missing from mapping: {unmatched_opportunity_codes}")
if unexpected_mapping_codes:
    issues.append(f"Mapping codes absent from opportunity data: {unexpected_mapping_codes}")
if not occupation_name_mismatches.empty:
    issues.append("One or more opportunity occupation names do not match the mapping.")
if unexpected_demand_groups:
    issues.append(f"Unexpected demand occupation groups: {unexpected_demand_groups}")
if unmatched_sa4_codes:
    issues.append(f"Demand SA4 codes missing from opportunity data: {unmatched_sa4_codes}")
if region_name_mismatches:
    issues.append(f"SA4 name mismatches: {region_name_mismatches}")
if not regional_pass:
    issues.append("Regional consistency did not meet all expected checks.")
if not time_pass:
    issues.append("Time compatibility did not meet all expected checks.")

status = lambda passed: "PASS" if passed else "ISSUE"
issue_text = "None" if not issues else "\n  - " + "\n  - ".join(issues)

report = f"""Iteration 2 Regional Employment Insights - Validation Report
Validation date: {date.today().isoformat()}

Files checked:
- regional_employment_opportunity_clean.csv
- regional_employment_demand_clean.csv
- regional_ict_occupation_mapping.csv

Opportunity data: {status(opportunity_pass)}
- Rows: {len(opportunity):,}
- Months: {len(opportunity_months)} ({min(opportunity_months)} to {max(opportunity_months)})
- SA4 regions: {opportunity['sa4_code'].nunique()}
- ANZSCO4 occupations: {opportunity['anzsco4_code'].nunique()}
- Missing values: {int(opportunity_missing.sum())}
- Duplicate keys: {int(opportunity_duplicates)}
- July 2026 rows: {july_opportunity_rows} (expected 616)
- Month format valid: {opportunity_month_format}
- Code formats valid: {opportunity_code_format}
- Employment values numeric: {employment_numeric}

Demand data: {status(demand_pass)}
- Rows: {len(demand):,}
- Months: {len(demand_months)} ({min(demand_months)} to {max(demand_months)})
- Regions: {len(demand_regions)} ({len(demand_sa4)} SA4, {len(demand_gccsa)} GCCSA)
- Missing values: {int(demand_missing.sum())}
- Duplicate keys: {int(demand_duplicates)}
- July 2026 rows: {july_demand_rows} (expected 50)
- Month format valid: {demand_month_format}
- Code formats valid: {demand_code_format}
- Vacancy values numeric: {vacancy_numeric}

Occupation mapping: {status(mapping_pass)}
- Rows: {len(mapping)}
- Codes: {', '.join(sorted(mapping_codes))}
- Parent: 26 ICT Professionals
- Missing values: {int(mapping_missing.sum())}
- Duplicate ANZSCO4 codes: {int(mapping_duplicates)}

Cross-file occupation consistency: {status(occupation_consistency_pass)}
- Opportunity codes missing from mapping: {unmatched_opportunity_codes}
- Unexpected mapping codes: {unexpected_mapping_codes}
- Occupation name mismatches: {len(occupation_name_mismatches)}
- Unexpected demand groups: {unexpected_demand_groups}

Regional consistency: {status(regional_pass)}
- Matching demand SA4 codes: {matching_sa4_codes} of 42
- Matching demand SA4 names: {matching_sa4_names} of 42
- Unmatched demand SA4 codes: {unmatched_sa4_codes}
- SA4 name mismatches: {region_name_mismatches}
- GCCSA regions retained separately: {len(demand_gccsa)}

Time compatibility: {status(time_pass)}
- Shared months: {len(common_months)}
- Common period: {earliest_common_month} to {latest_common_month}
- July 2026 exists in both: {july_in_both}

Final summary:
- Opportunity data: {status(opportunity_pass)}
- Demand data: {status(demand_pass)}
- Occupation mapping: {status(mapping_pass)}
- Cross-file occupation consistency: {status(occupation_consistency_pass)}
- Regional consistency: {status(regional_pass)}
- Time compatibility: {status(time_pass)}

Issues found: {issue_text}
"""

report_file.write_text(report, encoding="utf-8")
print(report)
