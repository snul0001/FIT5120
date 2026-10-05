"""Build ANZSCO RIASEC profiles. Requires pandas.

Run from the folder containing the two source CSVs:
    python build_anzsco4_riasec_profiles.py
Or provide --interests, --mapping and --output paths.
Scores are weighted sums, without normalization or rescaling.
Exact ties use the RIASEC order below; scores are never rounded for ranking.
"""

import argparse
from pathlib import Path

import pandas as pd


RIASEC = [
    "Realistic", "Investigative", "Artistic",
    "Social", "Enterprising", "Conventional",
]
WEIGHT_TOLERANCE = 1e-6


def inspect_frame(name, frame):
    print(f"\n{name}: {len(frame)} rows, {len(frame.columns)} columns")
    print(frame.dtypes.to_string())


def build_profiles(interests_path, mapping_path, output_path):
    # Inspect inferred types before storing occupation identifiers as text.
    interests = pd.read_csv(interests_path)
    mapping = pd.read_csv(mapping_path)
    inspect_frame("Interest source", interests)
    inspect_frame("Mapping source", mapping)
    mapping = pd.read_csv(mapping_path, dtype={"ANZSCO_code": "string"})

    interest_columns = ["O*NET-SOC Code", "Title", "Element Name", "Data Value"]
    required_mapping = [
        "ANZSCO_code", "ANZSCO_title", "ONET_code", "ONET_title",
        "Match_score", "Rationale", "Review",
    ]
    for frame, required in [
        (interests, interest_columns + ["Scale ID"]),
        (mapping, required_mapping),
    ]:
        missing = set(required) - set(frame.columns)
        if missing:
            raise ValueError(f"Missing columns: {sorted(missing)}")

    # Retain all mapping rows, including partial mappings.
    print("\nMapping Review counts:")
    print(mapping["Review"].value_counts(dropna=False).to_string())
    keys = ["ANZSCO_code", "ANZSCO_title", "ONET_code", "Match_score"]
    if mapping[keys].isna().any().any():
        raise ValueError("Missing mapping identifiers, titles or weights.")
    if not mapping["ANZSCO_code"].str.fullmatch(r"\d{4}").all():
        raise ValueError("ANZSCO codes must contain exactly four digits.")
    mapping["Match_score"] = pd.to_numeric(mapping["Match_score"], errors="raise")
    weights = mapping["Match_score"]
    if weights.isin([float("inf"), float("-inf")]).any() or weights.lt(0).any():
        raise ValueError("Weights must be finite and nonnegative.")
    if mapping.groupby("ANZSCO_code")["ANZSCO_title"].nunique().gt(1).any():
        raise ValueError("Conflicting titles for the same ANZSCO code.")

    weight_sums = mapping.groupby("ANZSCO_code")["Match_score"].sum()
    exceptions = weight_sums[(weight_sums - 1.0).abs() > WEIGHT_TOLERANCE]
    print(f"\nWeight sums outside 1.00 +/- {WEIGHT_TOLERANCE}: {len(exceptions)}")
    if not exceptions.empty:
        print(exceptions.to_string())
    # Weight exceptions are reported, never normalized.

    # Use only OI records and pivot without averaging duplicate source rows.
    oi = interests.loc[interests["Scale ID"].eq("OI"), interest_columns].copy()
    print(f"\nOI source rows: {len(oi)}")
    if oi[interest_columns].isna().any().any():
        raise ValueError("Missing values in the OI source.")
    if set(oi["Element Name"]) != set(RIASEC):
        raise ValueError("OI dimensions differ from the six expected dimensions.")
    if oi.duplicated(["O*NET-SOC Code", "Element Name"]).any():
        raise ValueError("Duplicate OI occupation/dimension keys; inspect the source.")
    if oi.groupby("O*NET-SOC Code")["Title"].nunique().gt(1).any():
        raise ValueError("Conflicting titles for the same O*NET code.")
    oi["Data Value"] = pd.to_numeric(oi["Data Value"], errors="raise")
    if oi["Data Value"].isin([float("inf"), float("-inf")]).any():
        raise ValueError("Nonfinite OI scores.")
    profiles = oi.pivot(
        index="O*NET-SOC Code", columns="Element Name", values="Data Value"
    ).reindex(columns=RIASEC)
    profiles.columns.name = None
    titles = oi.drop_duplicates("O*NET-SOC Code").set_index("O*NET-SOC Code")["Title"]
    profiles.insert(0, "OI_title", titles)
    print(f"O*NET OI profiles: {len(profiles)}")

    # Join by code and stop if any mapping cannot receive a complete profile.
    joined = mapping.merge(
        profiles, left_on="ONET_code", right_index=True,
        how="left", validate="many_to_one", indicator=True,
    )
    unmatched = sorted(joined.loc[joined["_merge"].eq("left_only"), "ONET_code"].unique())
    print(f"\nUnmatched O*NET codes: {unmatched if unmatched else 'None'}")
    if unmatched:
        raise ValueError("Unmatched mappings; no incomplete output was exported.")
    incomplete = joined.loc[joined[RIASEC].isna().any(axis=1), "ONET_code"].unique()
    if len(incomplete):
        print("O*NET codes with missing RIASEC values:", sorted(incomplete))
        raise ValueError("Incomplete source profiles; no values were guessed.")
    if len(joined) != len(mapping):
        raise ValueError("Join changed the number of mapping rows.")

    # Multiply each source score by its mapping weight, then sum per ANZSCO.
    weighted = joined[RIASEC].mul(joined["Match_score"], axis=0)
    weighted["ANZSCO_code"] = joined["ANZSCO_code"]
    final = weighted.groupby("ANZSCO_code", sort=True)[RIASEC].sum()
    anzsco_titles = mapping.drop_duplicates("ANZSCO_code").set_index("ANZSCO_code")["ANZSCO_title"]
    final.insert(0, "ANZSCO_title", anzsco_titles)
    final = final.reset_index()

    # Stable sorting breaks exact ties using the RIASEC order above.
    ranks = final[RIASEC].apply(
        lambda row: row.sort_values(ascending=False, kind="stable").index[:3].tolist(),
        axis=1,
    )
    for position, column in enumerate(["Primary_RIASEC", "Secondary_RIASEC", "Tertiary_RIASEC"]):
        final[column] = ranks.str[position]
    ties = final[RIASEC].apply(lambda row: row.nunique() < 6, axis=1).sum()
    duplicates = int(final["ANZSCO_code"].duplicated().sum())
    missing_scores = int(final[RIASEC].isna().sum().sum())
    print(f"\nFinal ANZSCO groups: {len(final)}")
    print(f"Duplicate ANZSCO codes: {duplicates}")
    print(f"Missing RIASEC values: {missing_scores}")
    print(f"Groups with any exact score tie: {ties}")
    print("Tie-break order:", ", ".join(RIASEC))
    if duplicates or missing_scores or len(final) != mapping["ANZSCO_code"].nunique():
        raise ValueError("Output validation failed.")
    print("\nFive sample ANZSCO groups:")
    print(final[["ANZSCO_code", "ANZSCO_title"] + RIASEC].head(5).to_string(index=False))

    # Export without changing the source files or rounding the calculated scores.
    output_path = Path(output_path)
    if output_path.resolve() in {Path(interests_path).resolve(), Path(mapping_path).resolve()}:
        raise ValueError("Output must not overwrite a source file.")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    final.to_csv(output_path, index=False)
    print(f"\nExported: {output_path.resolve()}")
    return final


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--interests", default="career_interest_types.csv")
    parser.add_argument("--mapping", default="preprocessed_mapping.csv")
    parser.add_argument("--output", default="anzsco4_riasec_profiles.csv")
    args = parser.parse_args()
    build_profiles(args.interests, args.mapping, args.output)
