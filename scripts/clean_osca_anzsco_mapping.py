import pandas as pd


# Read the OSCA to ANZSCO 2022 correspondence sheet.
file_path = "data/OSCA correspondence tables v2.xlsx"
sheet_name = "Table 6"
output_path = "osca_anzsco_mapping_clean.csv"

column_names = [
    "osca_code",
    "osca_occupation",
    "anzsco_code",
    "match_flag",
    "anzsco_occupation",
]

df = pd.read_excel(file_path, sheet_name=sheet_name, header=None, skiprows=5, names=column_names)
df = df.dropna(how="all")

rows_before = len(df)

# Remove the footer row that is not a mapping.
df = df[~df["osca_code"].astype(str).str.startswith("©")].copy()

# Fill down OSCA details for rows that belong to the previous OSCA occupation.
df["osca_code"] = df["osca_code"].convert_dtypes().ffill()
df["osca_occupation"] = df["osca_occupation"].ffill()

# Treat codes as text identifiers.
df["osca_code"] = df["osca_code"].astype("Int64").astype(str)
df["anzsco_code"] = df["anzsco_code"].astype("Int64").astype(str)

# Clean text spacing.
text_columns = ["osca_occupation", "match_flag", "anzsco_occupation"]

for column in text_columns:
    df[column] = df[column].fillna("").astype(str).str.strip()
    df[column] = df[column].str.replace(r" {2,}", " ", regex=True)

# Keep official match flags as they are.
df["match_flag"] = df["match_flag"].replace("nan", "")

# Remove exact duplicate rows only.
df = df.drop_duplicates()

rows_after = len(df)

# Save the cleaned mapping.
df.to_csv(output_path, index=False)

# Validate the cleaned mapping.
exact_duplicates = df.duplicated().sum()
missing_values = df.isna().sum()
unique_osca_codes = df["osca_code"].nunique()
unique_anzsco_codes = df["anzsco_code"].nunique()
partial_match_rows = (df["match_flag"] == "p").sum()

pairs = df.drop_duplicates(subset=["osca_code", "anzsco_code"])
anzsco_per_osca = pairs.groupby("osca_code")["anzsco_code"].nunique()
osca_per_anzsco = pairs.groupby("anzsco_code")["osca_code"].nunique()

one_to_one_count = 0

for osca_code in anzsco_per_osca[anzsco_per_osca == 1].index:
    anzsco_code = pairs[pairs["osca_code"] == osca_code]["anzsco_code"].iloc[0]
    if osca_per_anzsco[anzsco_code] == 1:
        one_to_one_count = one_to_one_count + 1

one_to_many_count = (anzsco_per_osca > 1).sum()
many_to_one_count = (osca_per_anzsco > 1).sum()
no_anzsco_match_count = df[df["anzsco_code"].isna() | (df["anzsco_code"] == "")]["osca_code"].nunique()

all_osca_six_digits = (df["osca_code"].str.len() == 6).all()
all_anzsco_six_digits = (df["anzsco_code"].str.len() == 6).all()

print("OSCA to ANZSCO mapping cleaning summary")
print("---------------------------------------")
print("Rows before cleaning:", rows_before)
print("Rows after cleaning:", rows_after)
print()

print("Missing values:")
print(missing_values)
print()

print("Exact duplicates remaining:")
print(exact_duplicates)
print()

print("Unique OSCA codes:")
print(unique_osca_codes)
print()

print("Unique ANZSCO codes:")
print(unique_anzsco_codes)
print()

print("Rows with match_flag = p:")
print(partial_match_rows)
print()

print("One-to-one OSCA mappings:")
print(one_to_one_count)
print()

print("One-to-many OSCA mappings:")
print(one_to_many_count)
print()

print("Many-to-one ANZSCO mappings:")
print(many_to_one_count)
print()

print("OSCA codes with no ANZSCO match:")
print(no_anzsco_match_count)
print()

print("All OSCA codes are 6 digits:")
print(all_osca_six_digits)
print()

print("All ANZSCO codes are 6 digits:")
print(all_anzsco_six_digits)
print()

print("Sample rows:")
print(df.head(5).to_string(index=False))
print()

print("Cleaned file saved to:", output_path)
