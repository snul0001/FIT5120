import pandas as pd


# Read the occupation AI exposure sheet.
file_path = "data/jsa_gen_ai_interactive_table_data_pack_20250903.xlsx"
sheet_name = "Occupation"
output_path = "jsa_ai_scores_clean.csv"

df = pd.read_excel(file_path, sheet_name=sheet_name, header=6)

rows_before = len(df)

# Keep only rows with a valid 4-digit ANZSCO unit code.
df["ANZSCO unit code"] = df["ANZSCO unit code"].astype(str).str.strip()
df = df[df["ANZSCO unit code"].str.fullmatch(r"\d{4}")].copy()

# Keep only the columns needed for this task.
df = df[
    [
        "ANZSCO unit code",
        "ANZSCO unit title",
        "Augmentation exposure score",
        "Automation exposure score",
    ]
].copy()

# Rename columns for easier use later.
df = df.rename(
    columns={
        "ANZSCO unit code": "anzsco_unit_code",
        "ANZSCO unit title": "anzsco_unit_title",
        "Augmentation exposure score": "augmentation_exposure_score",
        "Automation exposure score": "automation_exposure_score",
    }
)

# Keep the code as text and clean the title spacing.
df["anzsco_unit_code"] = df["anzsco_unit_code"].astype(str)
df["anzsco_unit_title"] = df["anzsco_unit_title"].astype(str).str.strip()
df["anzsco_unit_title"] = df["anzsco_unit_title"].str.replace(r" {2,}", " ", regex=True)

# Convert exposure scores to numbers.
df["augmentation_exposure_score"] = pd.to_numeric(df["augmentation_exposure_score"], errors="coerce")
df["automation_exposure_score"] = pd.to_numeric(df["automation_exposure_score"], errors="coerce")

# Remove exact duplicate rows only.
df = df.drop_duplicates()

rows_after = len(df)

# Save the cleaned data.
df.to_csv(output_path, index=False)

# Validate the cleaned data.
missing_values = df.isna().sum()
exact_duplicates = df.duplicated().sum()
unique_codes = df["anzsco_unit_code"].nunique()
duplicate_codes = df["anzsco_unit_code"].duplicated().sum()
all_codes_four_digits = df["anzsco_unit_code"].str.fullmatch(r"\d{4}").all()

print("JSA AI scores cleaning summary")
print("------------------------------")
print("Rows before cleaning:", rows_before)
print("Rows after cleaning:", rows_after)
print()

print("Missing values:")
print(missing_values)
print()

print("Exact duplicates remaining:")
print(exact_duplicates)
print()

print("Unique ANZSCO unit codes:")
print(unique_codes)
print()

print("Duplicate ANZSCO unit codes:")
print(duplicate_codes)
print()

print("All occupation codes are 4 digits:")
print(all_codes_four_digits)
print()

print("Minimum augmentation exposure score:")
print(df["augmentation_exposure_score"].min())
print("Maximum augmentation exposure score:")
print(df["augmentation_exposure_score"].max())
print()

print("Minimum automation exposure score:")
print(df["automation_exposure_score"].min())
print("Maximum automation exposure score:")
print(df["automation_exposure_score"].max())
print()

print("Sample cleaned rows:")
print(df.head(5).to_string(index=False))
print()

print("Cleaned file saved to:", output_path)
