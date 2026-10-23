import pandas as pd


# Read the occupation tasks sheet from the raw Excel file.
file_path = "data/ANZSCO Occupation data - February 2026.xlsx"
sheet_name = "Table_3"
output_path = "data/anzsco_occupation_tasks_clean.csv"

df = pd.read_excel(file_path, sheet_name=sheet_name, header=6)

rows_before = len(df)

# Keep only the columns needed for the user story.
df = df[["ANZSCO Code", "Occupation", "Tasks"]].copy()

# Treat occupation codes as identifiers.
df["ANZSCO Code"] = df["ANZSCO Code"].astype(str)

# Clean text spacing.
df["Occupation"] = df["Occupation"].str.strip()
df["Tasks"] = df["Tasks"].str.strip()
df["Tasks"] = df["Tasks"].str.replace(r" {2,}", " ", regex=True)

# Use simple database-friendly column names.
df = df.rename(
    columns={
        "ANZSCO Code": "anzsco_code",
        "Occupation": "occupation",
        "Tasks": "task",
    }
)

rows_after = len(df)

# Save the cleaned data.
df.to_csv(output_path, index=False)

# Validate the cleaned data.
text_columns = ["occupation", "task"]

missing_values = df.isna().sum()
duplicate_rows = df.duplicated().sum()

leading_trailing_spaces = {}
repeated_internal_spaces = {}

for column in text_columns:
    text_values = df[column].dropna().astype(str)
    leading_trailing_spaces[column] = (text_values != text_values.str.strip()).sum()
    repeated_internal_spaces[column] = text_values.str.contains(r" {2,}", regex=True).sum()

print("Occupation tasks cleaning summary")
print("---------------------------------")
print("Rows before cleaning:", rows_before)
print("Rows after cleaning:", rows_after)
print()

print("Missing values:")
print(missing_values)
print()

print("Duplicate rows:")
print(duplicate_rows)
print()

print("Remaining leading/trailing spaces:")
print(pd.Series(leading_trailing_spaces, dtype="int64"))
print()

print("Remaining repeated internal spaces:")
print(pd.Series(repeated_internal_spaces, dtype="int64"))
print()

print("Unique ANZSCO codes:")
print(df["anzsco_code"].nunique())
print()

print("Cleaned file saved to:", output_path)
