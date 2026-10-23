import pandas as pd


# Read the cleaned occupation tasks data.
file_path = "data/anzsco_occupation_tasks_clean.csv"
df = pd.read_csv(file_path, dtype={"anzsco_code": str})

# Ask the user for an ANZSCO code.
anzsco_code = input("Enter an ANZSCO code: ").strip()

# Find matching rows.
matches = df[df["anzsco_code"] == anzsco_code]

if len(matches) > 0:
    occupation = matches["occupation"].iloc[0]

    print()
    print("Occupation:", occupation)
    print("ANZSCO code:", anzsco_code)
    print()
    print("Tasks:")

    for number, task in enumerate(matches["task"], start=1):
        print(f"{number}. {task}")
else:
    print()
    print("Occupation code was not found.")
