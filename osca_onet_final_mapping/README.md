# OSCA to O*NET Final Mapping

This folder contains a simple rule-based final mapping from OSCA occupations to O*NET-SOC occupations for Data Task 2.1.

The existing `mapping_ONET_to_OSCA` folder is used only as read-only input. It was not modified.

## Inputs

The script uses these existing files:

- `../mapping_ONET_to_OSCA/output/osca_occupations.csv`
- `../mapping_ONET_to_OSCA/output/occupation_onet_match_candidates_ranked.csv`

## Mapping Rule

Each OSCA occupation is kept in the final output.

- If an OSCA occupation has exactly one O*NET candidate, that candidate is accepted.
- If an OSCA occupation has multiple O*NET candidates, rank 1 is accepted only when:
  - rank 1 similarity score is at least `0.30`
  - rank 1 score minus rank 2 score is at least `0.05`
- Otherwise, the occupation is marked as `manual_review`.
- If an OSCA occupation has no O*NET candidate, it is marked as `no_candidate`.

## Outputs

- `output/osca_onet_final_mapping.csv`
  - Contains all OSCA occupations and their mapping status.
  - Accepted rows include the selected O*NET code and title.
  - Manual-review and no-candidate rows are kept so every OSCA occupation is accounted for.

- `output/manual_review.csv`
  - Contains occupations that still need manual checking.
  - This includes occupations with no O*NET candidate.

## Script

- `scripts/create_final_mapping.py`
  - Reads the existing candidate data.
  - Applies the rule above.
  - Saves the two output CSV files.
  - Prints a validation summary.
