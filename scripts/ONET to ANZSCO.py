"""
O*NET-SOC -> ISCO-08 crosswalk (via ESCO, OSCA, ANZSCO)
=========================================================


Chain:  O*NET-SOC --(ESCO file)--> ISCO-08 unit group
        ISCO-08   --(OSCA Table 8)--> OSCA
        OSCA      --(OSCA Table 1)--> ANZSCO (unit group)


"""

import re
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------
DATA_DIR = Path("/Users/nghimeoo/Downloads/dataset_sofar/ONet to OSCA")
OUT_DIR = Path("./Outputs")

ESCO_TO_SOC_FILE = DATA_DIR / "ESCO_to_ONET-SOC.xlsx"
OSCA_TABLES_FILE = DATA_DIR / "OSCA_correspondence_tables_v2.xlsx"

# Keep a SOC link only if this % of the ANZSCO unit group's detailed
# occupations back it. Set to 0 to keep everything.
MIN_PCT_UNIT_SUPPORT = 50


# --------------------------------------------------------------------------
# Step 1: Load the ESCO/ISCO <-> O*NET-SOC crosswalk
# --------------------------------------------------------------------------
def load_esco_to_soc(path: Path) -> pd.DataFrame:
    raw = pd.read_excel(path, sheet_name=0, skiprows=3, dtype=str)
    raw.columns = [
        re.sub(r"[^0-9a-zA-Z]+", "_", c).strip("_").lower() for c in raw.columns
    ]

    raw = raw.dropna(subset=["esco_isco_code", "o_net_soc_2019_code"])

    df = pd.DataFrame(
        {
            "esco_code": raw["esco_isco_code"].str.strip(),
            "esco_name": raw["esco_isco_title"].str.strip(),
            "soc_code": raw["o_net_soc_2019_code"].str.strip(),
            "soc_name": raw["o_net_soc_2019_title"].str.strip(),
        }
    )
    df["isco_code"] = df["esco_code"].str.extract(r"^([^.]+)")[0].str.strip()
    df["isco_digits"] = df["isco_code"].str.len()
    df["link_level"] = df["esco_code"].apply(
        lambda x: "esco_occupation" if "." in x else "isco_unit_group"
    )
    return df


def keep_unit_level(df: pd.DataFrame) -> pd.DataFrame:
    # Rows at ISCO minor-group level (3 digits) are coarser than a unit
    # group and can't be placed -> dropped.
    unit = df[df["isco_digits"] == 4].copy()

    has_own_row = set(
        unit.loc[unit["link_level"] == "isco_unit_group", "isco_code"].unique()
    )

    # Prefer the direct unit-group mapping; fall back to occupation-level
    # rows only for groups that have no direct row.
    kept = unit[
        (unit["link_level"] == "isco_unit_group")
        | (~unit["isco_code"].isin(has_own_row))
    ]
    return kept


# --------------------------------------------------------------------------
# Step 2: Load the ABS OSCA correspondence tables
# --------------------------------------------------------------------------
def load_osca_to_isco(path: Path) -> pd.DataFrame:
    # Table 8 is published OSCA -> ISCO; header block starts at row 6 (0-indexed 5).
    raw = pd.read_excel(
        path,
        sheet_name="Table 8",
        header=None,
        names=["osca_code", "osca_name", "isco_code", "match_flag", "isco_name"],
        skiprows=5,
        dtype=str,
    )
    raw = raw[~raw["osca_code"].fillna("").str.contains("Commonwealth")]
    raw[["osca_code", "osca_name"]] = raw[["osca_code", "osca_name"]].ffill()
    raw = raw.dropna(subset=["isco_code"])
    raw = raw[(raw["osca_code"] != "xxxxxx") & (raw["isco_code"] != "xxxxxx")]
    raw["osca_code"] = raw["osca_code"].str.strip()
    raw["isco_code"] = raw["isco_code"].str.strip()
    return raw.drop_duplicates(subset=["osca_code", "osca_name", "isco_code", "isco_name"])


def load_anzsco_to_osca(path: Path) -> pd.DataFrame:
    # Table 1 is published ANZSCO -> OSCA.
    raw = pd.read_excel(
        path,
        sheet_name="Table 1",
        header=None,
        names=["anzsco_code", "anzsco_name", "osca_code", "match_flag", "osca_name"],
        skiprows=5,
        dtype=str,
    )
    raw = raw[~raw["anzsco_code"].fillna("").str.contains("Commonwealth")]
    raw[["anzsco_code", "anzsco_name"]] = raw[["anzsco_code", "anzsco_name"]].ffill()
    raw = raw.dropna(subset=["osca_code"])
    raw = raw[(raw["anzsco_code"] != "xxxxxx") & (raw["osca_code"] != "xxxxxx")]
    raw["anzsco_code"] = raw["anzsco_code"].str.strip()
    raw["osca_code"] = raw["osca_code"].str.strip()
    raw = raw.drop_duplicates(subset=["anzsco_code", "anzsco_name", "osca_code"])
    # ANZSCO codes are 6 digits (detailed occupation); first 4 = unit group,
    # which is the level the O*NET analysis reports at.
    raw["anzsco_unit_code"] = raw["anzsco_code"].str[:4]
    return raw


# --------------------------------------------------------------------------
# Step 3: Chain the joins  SOC -> ISCO -> OSCA -> ANZSCO
# --------------------------------------------------------------------------
def build_full_crosswalk(
    esco_soc_kept: pd.DataFrame,
    osca_to_isco: pd.DataFrame,
    anzsco_to_osca: pd.DataFrame,
) -> pd.DataFrame:
    isco_x_soc = esco_soc_kept[["isco_code", "soc_code", "soc_name"]].drop_duplicates()
 
    isco_x_soc_x_osca = isco_x_soc.merge(osca_to_isco, on="isco_code", how="inner")
 
    # anzsco_to_osca also has an 'osca_name' and 'match_flag' column, which
    # would otherwise clash with the ones already carried from osca_to_isco
    # (pandas would silently rename both to _x/_y suffixes). Keep only the
    # ANZSCO-specific columns plus the join key.
    anzsco_to_osca_slim = anzsco_to_osca[
        ["anzsco_code", "anzsco_name", "osca_code", "anzsco_unit_code"]
    ]
 
    full = isco_x_soc_x_osca.merge(anzsco_to_osca_slim, on="osca_code", how="inner")
 
    full = full[
        [
            "soc_code",
            "soc_name",
            "isco_code",
            "isco_name",
            "osca_code",
            "osca_name",
            "anzsco_code",
            "anzsco_name",
            "anzsco_unit_code",
        ]
    ].sort_values(["soc_code", "isco_code", "anzsco_code"])
    return full
 


# --------------------------------------------------------------------------
# Step 4: Collapse to ANZSCO unit-group level + a broad sanity check
# --------------------------------------------------------------------------
MAJOR_GROUP_MAP = {
    "0": {"55", "33"},                                     # armed forces
    "1": {"11"},                                           # managers
    "2": {"13", "15", "17", "19", "21", "23", "25", "27", "29"},  # professionals
    "3": {"13", "15", "17", "19", "21", "25", "29", "31", "33", "49"},  # technicians
    "4": {"41", "43"},                                     # clerical
    "5": {"31", "33", "35", "37", "39", "41"},              # service/sales
    "6": {"45"},                                            # agriculture
    "7": {"47", "49", "51"},                                 # trades
    "8": {"51", "53"},                                       # plant/machine
    "9": {"35", "37", "41", "45", "47", "53"},                # elementary
}


def collapse_to_unit_group(full: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    unit_detail = (
        full.drop_duplicates(subset=["anzsco_unit_code", "anzsco_code", "anzsco_name"])
        .sort_values("anzsco_code")
        .groupby("anzsco_unit_code")
        .agg(
            nmb_unit_occs=("anzsco_code", "nunique"),
            # No ANZSCO unit-group titles in these files, only occupation
            # titles, so the lowest-numbered occupation stands in as label.
            anzsco_unit_name=("anzsco_name", "first"),
        )
        .reset_index()
    )

    by_unit = (
        full.groupby(["soc_code", "soc_name", "isco_code", "anzsco_unit_code"])
        .agg(nmb_occ_support=("anzsco_code", "nunique"))
        .reset_index()
        .merge(unit_detail, on="anzsco_unit_code", how="left")
    )
    by_unit["pct_unit_support"] = (
        100 * by_unit["nmb_occ_support"] / by_unit["nmb_unit_occs"]
    ).round(1)
    by_unit["isco_major"] = by_unit["isco_code"].str[0]
    by_unit["soc_major"] = by_unit["soc_code"].str[:2]
    by_unit["broad_group_match"] = by_unit.apply(
        lambda r: r["soc_major"] in MAJOR_GROUP_MAP.get(r["isco_major"], set()), axis=1
    )
    by_unit = by_unit.drop(columns=["isco_major", "soc_major"]).sort_values(
        ["soc_code", "anzsco_unit_code"]
    )
    return by_unit, unit_detail


# --------------------------------------------------------------------------
# Step 5: Filter out weakly-supported matches
# --------------------------------------------------------------------------
def filter_final(by_unit: pd.DataFrame, min_pct: float = MIN_PCT_UNIT_SUPPORT) -> pd.DataFrame:
    kept = by_unit[by_unit["pct_unit_support"] >= min_pct].copy()

    final = (
        kept.groupby(["anzsco_unit_code", "anzsco_unit_name", "soc_code", "soc_name"])
        .agg(
            isco_codes=("isco_code", lambda s: "; ".join(sorted(set(s)))),
            pct_unit_support=("pct_unit_support", "max"),
            broad_group_match=("broad_group_match", "any"),
        )
        .reset_index()
        .rename(
            columns={
                "anzsco_unit_code": "anzsco_code",
                "anzsco_unit_name": "label_4digit",
                "soc_code": "soc",
                "soc_name": "soc_label",
            }
        )
        .sort_values(["anzsco_code", "soc"])
    )

    dupes = final.duplicated(subset=["anzsco_code", "soc"]).sum()
    assert dupes == 0, (
        "Duplicate anzsco_code x soc rows would double-weight a SOC "
        "in any downstream O*NET average"
    )
    return final


# --------------------------------------------------------------------------
# Step 6: Reporting -- how many codes survive each hop
# --------------------------------------------------------------------------
def coverage_report(
    esco_soc_raw: pd.DataFrame,
    esco_soc_unitlevel: pd.DataFrame,
    osca_to_isco: pd.DataFrame,
    anzsco_to_osca: pd.DataFrame,
    full: pd.DataFrame,
    final: pd.DataFrame,
) -> pd.DataFrame:
    rows = []
    specs = [
        (
            "O*NET-SOC",
            esco_soc_raw["soc_code"].nunique(),
            full["soc_code"].nunique(),
            final["soc"].nunique(),
        ),
        (
            "ISCO-08",
            pd.concat([esco_soc_unitlevel["isco_code"], osca_to_isco["isco_code"]]).nunique(),
            full["isco_code"].nunique(),
            final["isco_codes"].str.split("; ").explode().nunique(),
        ),
        (
            "OSCA",
            pd.concat([osca_to_isco["osca_code"], anzsco_to_osca["osca_code"]]).nunique(),
            full["osca_code"].nunique(),
            None,
        ),
        (
            "ANZSCO (unit group)",
            anzsco_to_osca["anzsco_unit_code"].nunique(),
            full["anzsco_unit_code"].nunique(),
            final["anzsco_code"].nunique(),
        ),
    ]
    for name, in_source, after_joins, in_final in specs:
        dropped = None if in_final is None else in_source - in_final
        pct_kept = None if in_final is None else round(100 * in_final / in_source, 1)
        rows.append(
            {
                "classification": name,
                "nmb_in_source": in_source,
                "nmb_after_joins": after_joins,
                "nmb_in_final": in_final,
                "nmb_dropped": dropped,
                "pct_kept": pct_kept,
            }
        )
    return pd.DataFrame(rows)


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main():
    OUT_DIR.mkdir(exist_ok=True)

    esco_soc_raw = load_esco_to_soc(ESCO_TO_SOC_FILE)
    esco_soc_unitlevel = keep_unit_level(esco_soc_raw)

    osca_to_isco = load_osca_to_isco(OSCA_TABLES_FILE)
    anzsco_to_osca = load_anzsco_to_osca(OSCA_TABLES_FILE)

    full = build_full_crosswalk(esco_soc_unitlevel, osca_to_isco, anzsco_to_osca)
    by_unit, unit_detail = collapse_to_unit_group(full)
    final = filter_final(by_unit)

    report = coverage_report(
        esco_soc_raw, esco_soc_unitlevel, osca_to_isco, anzsco_to_osca, full, final
    )
    print(report.to_string(index=False))

    stamp = pd.Timestamp.today().strftime("%y%m%d")
    full.to_csv(OUT_DIR / f"{stamp} - crosswalk_full.csv", index=False)
    by_unit.to_csv(OUT_DIR / f"{stamp} - crosswalk_unit.csv", index=False)
    final.to_csv(OUT_DIR / f"{stamp} - crosswalk_for_onet.csv", index=False)


if __name__ == "__main__":
    main()