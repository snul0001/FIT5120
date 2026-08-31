"""
Purpose
transform match OSCA occupations to candidate O*NET-SOC occupations via
the full first-party chain: OSCA -> ISCO-08 -> SOC 2010 -> SOC 2018 ->
O*NET-SOC 2019.

Join path:
  from osca_occupations.csv
    to isco08_to_osca.csv        (occupation_id -> isco08_code)
    to isco08_to_soc2010.csv     (isco08_code -> soc_2010_code)
    to soc2010_to_soc2018.csv    (soc_2010_code -> soc_2018_code)
    to onet_soc_to_soc2018.csv   (soc_2018_code -> onet_soc_code, reversed)
    on onet_occupations.csv      (onet_soc_code -> onet_title)

Output: occupation_onet_match_candidates.csv (it should also be noted that there are duplicated groupings, main reason is
ISCO08 has less occupations and matching it through 5 different codes doesn't mean it matches at 100% how ever it matches 90%).
Run this last after other crosswalk
"""

import pandas as pd
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent #base directory resolve

OSCA_OCC = BASE_DIR.parent / "output" / "osca_occupations.csv"
ONET_OCC = BASE_DIR.parent / "output" / "onet_occupations.csv"
ISCO_OSCA_CROSSWALK = BASE_DIR.parent / "output" / "isco08_to_osca.csv"
ISCO_SOC2010_CROSSWALK = BASE_DIR.parent / "output" / "isco08_to_soc2010.csv"
SOC2018_SOC2010_CROSSWALK = BASE_DIR.parent / "output" / "soc2018_to_soc2010.csv"
ONET_SOC2018_CROSSWALK = BASE_DIR.parent / "output" / "onet_soc_to_soc2018.csv"

OUTPUT = BASE_DIR.parent / "output" / "occupation_onet_match_candidates.csv"


def combine_match_type(*match_types):
    return "partial" if "partial" in match_types else "exact"


def main():
    osca = pd.read_csv(OSCA_OCC, dtype=str)
    onet = pd.read_csv(ONET_OCC, dtype=str)
    isco_osca = pd.read_csv(ISCO_OSCA_CROSSWALK, dtype=str)
    isco_soc2010 = pd.read_csv(ISCO_SOC2010_CROSSWALK, dtype=str)
    soc2010_soc2018 = pd.read_csv(SOC2018_SOC2010_CROSSWALK, dtype=str)
    onet_soc2018 = pd.read_csv(ONET_SOC2018_CROSSWALK, dtype=str)

    # 1st crosswalk (Osca to ISCO, isco08_to_osca.csv)
    step1 = isco_osca.rename(columns={"match_type": "match_type_1"})

    # 2nd crosswalk (ISCO to SOC 2010, isco08_to_soc2010.csv)
    step2 = step1.merge(
        isco_soc2010.rename(columns={"match_type": "match_type_2"}),
        on="isco08_code", how="inner",
    )

    # 3rd crosswalk (SOC2018 to SOC2010, soc2018_to_soc2010.csv)
    step3 = step2.merge(
        soc2010_soc2018.rename(columns={"match_type": "match_type_3"}),
        on="soc_2010_code", how="inner",
    )

    # 4th crosswalk (SOC 2018 -> O*NET-SOC, onet_soc_to_soc2018.csv)
    # onet_soc_code to soc_2018_code, joining on soc_2018_code to find
    # matching onet_soc_code values)
    step4 = step3.merge(onet_soc2018, on="soc_2018_code", how="inner")

    # Combine per-hop match_type into one overall value (the above partial or exact)
    # if any hop was partial
    step4["match_type"] = step4.apply(
        lambda row: combine_match_type(row["match_type_1"], row["match_type_2"], row["match_type_3"]),
        axis=1,
    )

    # Attach titles to code to read side by side
    merged = step4.merge(
        osca.rename(columns={"osca_code": "occupation_id"}), on="occupation_id", how="left",
    )
    merged = merged.merge(
        onet.rename(columns={"onet_title": "candidate_onet_title"}), on="onet_soc_code", how="left",
    )

    out = merged.rename(columns={"onet_soc_code": "candidate_onet_soc_code"})
    out = out[["occupation_id", "osca_title", "candidate_onet_soc_code",
               "candidate_onet_title", "match_type"]]
    out = out.drop_duplicates(subset=["occupation_id", "candidate_onet_soc_code"])
    out = out.sort_values(["occupation_id", "match_type"])

    out.to_csv(OUTPUT, index=False)

    no_candidates_count = osca[~osca["osca_code"].isin(out["occupation_id"])].shape[0] #check if any non candidate
    total = out["occupation_id"].nunique() #check unique occupations 
    print(f"{len(out)} candidate rows written to {OUTPUT}")
    print(f"{total} OSCA occupations have at least one candidate")
    print(f"{no_candidates_count} OSCA occupations have zero candidates through this chain")


if __name__ == "__main__":
    main()