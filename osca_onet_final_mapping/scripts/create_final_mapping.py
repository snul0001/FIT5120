import pandas as pd
from pathlib import Path


# Input files from the existing mapping project.
base_dir = Path(__file__).resolve().parents[2]
input_dir = base_dir / "mapping_ONET_to_OSCA" / "output"
output_dir = base_dir / "osca_onet_final_mapping" / "output"

osca_file = input_dir / "osca_occupations.csv"
candidates_file = input_dir / "occupation_onet_match_candidates_ranked.csv"

final_output_file = output_dir / "osca_onet_final_mapping.csv"
manual_review_file = output_dir / "manual_review.csv"

min_rank1_score = 0.30
min_score_gap = 0.05

# Read existing cleaned outputs.
osca = pd.read_csv(osca_file, dtype=str)
candidates = pd.read_csv(candidates_file, dtype=str)

osca = osca.rename(columns={"osca_code": "osca_code", "osca_title": "osca_title"})
candidates["similarity_score"] = pd.to_numeric(candidates["similarity_score"], errors="coerce")

# Count real O*NET candidates for each OSCA occupation.
candidate_counts = candidates.groupby("occupation_id")["candidate_onet_soc_code"].count()

final = osca.copy()
final = final.merge(candidate_counts.rename("candidate_count"), left_on="osca_code", right_index=True, how="left")
final["candidate_count"] = final["candidate_count"].fillna(0).astype(int)

# Rank existing candidates by similarity score.
ranked = candidates[candidates["candidate_onet_soc_code"].notna()].copy()
ranked = ranked.sort_values(["occupation_id", "similarity_score"], ascending=[True, False])
ranked["rank"] = ranked.groupby("occupation_id").cumcount() + 1

rank1 = ranked[ranked["rank"] == 1][
    ["occupation_id", "candidate_onet_soc_code", "candidate_onet_title", "similarity_score"]
]
rank1 = rank1.rename(
    columns={
        "occupation_id": "osca_code",
        "candidate_onet_soc_code": "onet_code",
        "candidate_onet_title": "onet_title",
        "similarity_score": "similarity_score",
    }
)

rank2 = ranked[ranked["rank"] == 2][["occupation_id", "similarity_score"]]
rank2 = rank2.rename(
    columns={
        "occupation_id": "osca_code",
        "similarity_score": "second_similarity_score",
    }
)

final = final.merge(rank1, on="osca_code", how="left")
final = final.merge(rank2, on="osca_code", how="left")
final["score_gap"] = final["similarity_score"] - final["second_similarity_score"]

# Apply the mapping rules.
final["mapping_status"] = "manual_review"
final["mapping_method"] = "manual_review"

no_candidate = final["candidate_count"] == 0
single_candidate = final["candidate_count"] == 1
score_and_gap = (
    (final["candidate_count"] > 1)
    & (final["similarity_score"] >= min_rank1_score)
    & (final["score_gap"] >= min_score_gap)
)

final.loc[no_candidate, "mapping_status"] = "no_candidate"
final.loc[no_candidate, "mapping_method"] = "no_candidate"

final.loc[single_candidate, "mapping_status"] = "accepted"
final.loc[single_candidate, "mapping_method"] = "single_candidate"

final.loc[score_and_gap, "mapping_status"] = "accepted"
final.loc[score_and_gap, "mapping_method"] = "score_and_gap_rule"

# Do not keep an O*NET match for unresolved occupations.
unresolved = final["mapping_status"] != "accepted"
final.loc[unresolved, ["onet_code", "onet_title"]] = ""

final = final[
    [
        "osca_code",
        "osca_title",
        "onet_code",
        "onet_title",
        "similarity_score",
        "second_similarity_score",
        "score_gap",
        "candidate_count",
        "mapping_status",
        "mapping_method",
    ]
]

manual_review = final[final["mapping_status"].isin(["manual_review", "no_candidate"])].copy()

# Save the final mapping outputs.
output_dir.mkdir(parents=True, exist_ok=True)
final.to_csv(final_output_file, index=False)
manual_review.to_csv(manual_review_file, index=False)

# Validate the outputs.
total_osca = len(osca)
single_accepted = (final["mapping_method"] == "single_candidate").sum()
score_accepted = (final["mapping_method"] == "score_and_gap_rule").sum()
total_accepted = (final["mapping_status"] == "accepted").sum()
manual_count = (final["mapping_status"] == "manual_review").sum()
no_candidate_count = (final["mapping_status"] == "no_candidate").sum()
duplicate_osca_codes = final["osca_code"].duplicated().sum()
missing_from_final = total_osca - final["osca_code"].nunique()

print("Final OSCA to O*NET mapping summary")
print("-----------------------------------")
print("Total OSCA occupations in final output:", len(final))
print("Accepted by single candidate:", single_accepted)
print("Accepted by score + gap rule:", score_accepted)
print("Total automatically accepted:", total_accepted)
print("Requiring manual review:", manual_count)
print("No candidate:", no_candidate_count)
print("Duplicate OSCA codes:", duplicate_osca_codes)
print("OSCA occupations missing from final output:", missing_from_final)
print()
print("Final mapping saved to:", final_output_file)
print("Manual review file saved to:", manual_review_file)
