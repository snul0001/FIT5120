"""IResi Interest Code matching. Requires pandas; see README.md for usage.

This project quiz, recency tie rule and position-aware ranking formula are not
official O*NET scoring methods. Outputs describe career interest similarity only.
"""

import argparse
from contextlib import redirect_stdout
from hashlib import sha256
from itertools import combinations
from pathlib import Path

import pandas as pd


CODES = "RIASEC"
NAMES = dict(zip(CODES, [
    "Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"
]))
QUESTIONS = [f"Q{i}" for i in range(1, 11)]
MAPPING_COLUMNS = [
    "ANZSCO_code", "ANZSCO_title", "ONET_code", "ONET_title",
    "Interest_Code", "Match_score", "Rationale", "Review",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_csv(path, **kwargs):
    frame = pd.read_csv(path, **kwargs)
    print(f"\nInput: {path} — {len(frame)} rows, {len(frame.columns)} columns")
    print(frame.dtypes.to_string())
    return frame


def require_columns(frame, columns):
    missing = set(columns) - set(frame.columns)
    require(not missing, f"Missing columns: {sorted(missing)}")


def validate_quiz(quiz):
    require_columns(quiz, ["question_id", "question", "answer_id", "answer_text", "riasec_code"])
    require(not quiz.isna().any().any(), "Quiz contains missing values.")
    require(len(quiz) == 60 and set(quiz.question_id) == set(QUESTIONS), "Expected 60 answers across Q1–Q10.")
    require(quiz.answer_id.is_unique, "Quiz answer IDs must be unique.")
    for question_id, group in quiz.groupby("question_id"):
        require(len(group) == 6 and sorted(group.riasec_code) == sorted(CODES),
                f"{question_id} needs exactly one R, I, A, S, E and C answer.")
        require(group.question.nunique() == 1, f"Inconsistent question text for {question_id}.")
    return quiz


def validate_responses(quiz, responses):
    """Accept a list of (question_id, answer_id) pairs so duplicates are detectable.

    Return selections in Q1–Q10 order, regardless of submission order.
    """
    validate_quiz(quiz)
    require(isinstance(responses, (list, tuple)), "Submit a list of (question_id, answer_id) pairs.")
    require(all(isinstance(pair, (list, tuple)) and len(pair) == 2 for pair in responses),
            "Each response must contain a question ID and an answer ID.")
    require(all(isinstance(value, str) for pair in responses for value in pair), "Response IDs must be strings.")
    submitted_questions = [pair[0] for pair in responses]
    require(len(submitted_questions) == len(set(submitted_questions)), "Duplicate answer selection for one question.")
    require(len(responses) == 10 and set(submitted_questions) == set(QUESTIONS),
            "Incomplete or invalid quiz: exactly one answer to each of Q1–Q10 is required.")
    lookup = quiz.set_index(["question_id", "answer_id"])["riasec_code"]
    for question_id, answer_id in responses:
        require((question_id, answer_id) in lookup.index, f"Invalid answer ID {answer_id!r} for {question_id}.")
    selected = dict(responses)
    return [lookup.loc[(question_id, selected[question_id])] for question_id in QUESTIONS]


def calculate_riasec_counts(quiz, responses):
    letters = validate_responses(quiz, responses)
    counts = {code: letters.count(code) for code in CODES}
    require(sum(counts.values()) == 10, "RIASEC counts must sum to 10.")
    return counts


def generate_user_interest_code(quiz, responses):
    letters = validate_responses(quiz, responses)
    counts = calculate_riasec_counts(quiz, responses)
    latest = {code: max((i for i, letter in enumerate(letters, 1) if letter == code), default=0)
              for code in CODES}
    # Project rule: count, then latest question position, then fixed RIASEC order.
    ranked = sorted(CODES, key=lambda code: (-counts[code], -latest[code], CODES.index(code)))
    # Keep at most three positive-count categories; never pad with zero counts.
    positive = [code for code in ranked if counts[code] > 0]
    return "".join(positive[:3])


def valid_interest_code(code):
    return isinstance(code, str) and 1 <= len(code) <= 3 and set(code) <= set(CODES) and len(set(code)) == len(code)


def score_onet_similarity(user_code, occupation_code):
    require(valid_interest_code(user_code), "User Interest Code needs one to three distinct RIASEC letters.")
    require(valid_interest_code(occupation_code), f"Invalid occupation Interest Code: {occupation_code!r}")
    # Index differences are identical for zero-based and one-based positions.
    return sum(4 - abs(user_code.index(letter) - occupation_code.index(letter))
               for letter in user_code if letter in occupation_code)


def combine_interest_files(paths):
    frames = []
    for path in paths:
        frame = read_csv(path, dtype="string")
        require_columns(frame, ["Code", "Occupation", "Interest Code"])
        if "Job Zone" not in frame:
            frame["Job Zone"] = pd.NA
        # Read official fields only; filenames never determine interest labels.
        frames.append(frame[["Code", "Occupation", "Interest Code", "Job Zone"]].rename(columns={
            "Code": "ONET_code", "Occupation": "ONET_title",
            "Interest Code": "Interest_Code", "Job Zone": "Job_Zone",
        }))
    combined = pd.concat(frames, ignore_index=True)
    print("\nCombined interest rows:", len(combined))
    print("Missing interest fields:", combined.isna().sum().to_dict())
    require(not combined[["ONET_code", "ONET_title", "Interest_Code"]].isna().any().any(), "Missing official occupation identifiers, titles or Interest Codes.")
    invalid = combined.loc[~combined.Interest_Code.map(valid_interest_code)]
    require(invalid.empty, "Invalid Interest Codes:\n" + invalid.to_string(index=False))
    conflict_counts = combined.groupby("ONET_code").Interest_Code.nunique()
    conflicts = combined.loc[combined.ONET_code.isin(conflict_counts[conflict_counts > 1].index)]
    print("Conflicting official Interest Codes:", "None" if conflicts.empty else "\n" + conflicts.to_string(index=False))
    require(conflicts.empty, "Conflicting official Interest Codes; resolve source differences before building.")
    # Repeated downloads must also agree on nonmissing metadata.
    for column in ["ONET_title", "Job_Zone"]:
        counts = combined.groupby("ONET_code")[column].nunique()
        require(not counts.gt(1).any(), f"Conflicting {column} for codes: {counts[counts > 1].index.tolist()}")
    duplicates = combined.duplicated(["ONET_code", "Interest_Code"]).sum()
    # Prefer an observed Job Zone over a missing one; never invent a value.
    clean = combined.sort_values("Job_Zone", na_position="last").drop_duplicates(["ONET_code", "Interest_Code"])
    clean = clean.sort_values("ONET_code").reset_index(drop=True)
    print("Repeated occupation/Interest Code rows removed:", duplicates)
    print("Unique O*NET occupations:", clean.ONET_code.nunique())
    print("Official code lengths:", clean.Interest_Code.str.len().value_counts().sort_index().to_dict())
    print("PASS: one official Interest Code per O*NET occupation.")
    return clean


def join_mapping(mapping, clean):
    require_columns(mapping, [column for column in MAPPING_COLUMNS if column != "Interest_Code"])
    print("\nMapping missing values:", mapping.isna().sum().to_dict())
    print("Exact duplicate mapping rows:", int(mapping.duplicated().sum()))
    repeated = mapping.duplicated(["ANZSCO_code", "ONET_code"], keep=False)
    print("Repeated ANZSCO/O*NET pairs:", int(repeated.sum()))
    if repeated.any():
        print(mapping.loc[repeated].to_string(index=False))
    require(not repeated.any(), "Duplicate mapping pairs would double-count weights; review the source.")
    require(not mapping[["ANZSCO_code", "ANZSCO_title", "ONET_code", "Match_score"]].isna().any().any(), "Missing mapping identifiers, titles or weights.")
    require(mapping.ANZSCO_code.str.fullmatch(r"\d{4}").all(), "ANZSCO codes must contain four digits.")
    require(not mapping.groupby("ANZSCO_code").ANZSCO_title.nunique().gt(1).any(), "Conflicting ANZSCO titles.")
    weights = pd.to_numeric(mapping.Match_score, errors="raise")
    require(weights.ge(0).all() and not weights.isin([float("inf"), float("-inf")]).any(), "Weights must be finite and nonnegative.")
    # Retain the team's title, weight, rationale and review; join only by code.
    joined = mapping.merge(clean[["ONET_code", "Interest_Code"]], on="ONET_code", how="left", validate="many_to_one")
    require(len(joined) == len(mapping), "Join changed mapping row count.")
    unmatched = joined.loc[joined.Interest_Code.isna(), "ONET_code"].unique().tolist()
    available = joined.Interest_Code.notna()
    print("Review counts (all retained):", joined.Review.value_counts(dropna=False).to_dict())
    print(f"Mapped O*NET coverage: {joined.loc[available, 'ONET_code'].nunique()}/{mapping.ONET_code.nunique()} unique occupations; {available.sum()}/{len(mapping)} rows")
    print(f"ANZSCO group coverage: {joined.loc[available, 'ANZSCO_code'].nunique()}/{mapping.ANZSCO_code.nunique()}")
    print("Unmatched O*NET codes:", unmatched or "None")
    print("Joined missing values:", joined.isna().sum().to_dict())
    print("Mapping weight sums:\n" + joined.groupby("ANZSCO_code").Match_score.sum().to_string())
    return joined[MAPPING_COLUMNS]


def aggregate_to_anzsco(mapping, user_code):
    available = mapping.loc[mapping.Interest_Code.notna()].copy()
    available["ONET_interest_match_score"] = available.Interest_Code.map(lambda code: score_onet_similarity(user_code, code))
    available["weighted_points"] = available.ONET_interest_match_score * available.Match_score
    total = mapping.groupby("ANZSCO_code").agg(
        ANZSCO_title=("ANZSCO_title", "first"), mapped_rows=("ONET_code", "size"))
    scored = available.groupby("ANZSCO_code").agg(
        available_rows=("ONET_code", "size"), available_weight_sum=("Match_score", "sum"),
        weighted_points=("weighted_points", "sum"))
    result = total.join(scored)
    result["available_rows"] = result.available_rows.fillna(0).astype(int)
    result["available_weight_sum"] = result.available_weight_sum.fillna(0)
    result["ANZSCO_interest_score"] = result.weighted_points / result.available_weight_sum.where(result.available_weight_sum.gt(0))
    result["coverage_status"] = "complete"
    result.loc[result.available_rows.lt(result.mapped_rows), "coverage_status"] = "partial"
    result.loc[result.available_weight_sum.eq(0), "coverage_status"] = "unscorable"
    # Unscorable groups remain visible with a missing score, never a fabricated zero.
    return result.drop(columns="weighted_points").reset_index()


def generate_explanation(user_code, group, counts=None):
    connected = {letter for code in group.loc[group.Interest_Code.notna() & group.Match_score.gt(0), "Interest_Code"] for letter in code}
    shared = [letter for letter in user_code if letter in connected and (counts is None or counts[letter] > 0)]
    positive = [letter for letter in user_code if counts is None or counts[letter] > 0]
    text = "Your leading selected interests are " + ", ".join(NAMES[letter] for letter in positive) + ". "
    if shared:
        text += "This career is connected with " + ", ".join(NAMES[letter] for letter in shared) + " interests in the mapped O*NET occupations."
    else:
        text += "The mapped O*NET occupations have no shared letters with these selected leading interests."
    if group.Interest_Code.isna().any():
        text += " Some mappings lack an Interest Code; only available mappings contribute to the score."
    return text


def rank_careers(quiz, responses, mapping):
    counts = calculate_riasec_counts(quiz, responses)
    user_code = generate_user_interest_code(quiz, responses)
    result = aggregate_to_anzsco(mapping, user_code)
    groups = {code: group for code, group in mapping.groupby("ANZSCO_code")}
    result["explanation"] = result.ANZSCO_code.map(lambda code: generate_explanation(user_code, groups[code], counts))
    result.loc[result.coverage_status.eq("unscorable"), "explanation"] = "No score is available because this group has no mapped Interest Codes with positive total weight."
    # Rank full-precision project scores; ANZSCO code breaks career-score ties.
    return result.sort_values(["ANZSCO_interest_score", "ANZSCO_code"], ascending=[False, True], na_position="last").reset_index(drop=True)


def responses_for_letters(quiz, letters):
    return [(question_id, quiz.loc[(quiz.question_id == question_id) & (quiz.riasec_code == letter), "answer_id"].iloc[0])
            for question_id, letter in zip(QUESTIONS, letters)]


def run_tests(quiz, mapping):
    print("\nSynthetic responses are software validation inputs only, not saved dataset rows.")
    patterns = {"Strong " + NAMES[code]: code * 10 for code in CODES}
    patterns.update({"Mixed 1": "RRIIIISECC", "Mixed 2": "AASSEEAASC", "Mixed 3": "RRCCEEIRCS"})
    rankings = {}
    for label, letters in patterns.items():
        responses = responses_for_letters(quiz, letters)
        counts = calculate_riasec_counts(quiz, responses)
        user_code = generate_user_interest_code(quiz, responses)
        require(all(counts[code] > 0 for code in user_code), "Zero-count category inserted into user code.")
        require(len(user_code) == min(3, sum(value > 0 for value in counts.values())), "Incorrect positive user code length.")
        if label.startswith("Strong "):
            require(user_code == letters[0], "Strong profile must generate its single interest letter.")
            for occupation_code in mapping.Interest_Code.dropna().unique():
                if user_code not in occupation_code:
                    require(score_onet_similarity(user_code, occupation_code) == 0, "Unshared interest earned points.")
        result = rank_careers(quiz, responses, mapping)
        require(not result.explanation.str.contains("zero-count", regex=False).any(), "Stale explanation wording.")
        require(set(result.ANZSCO_code) == set(mapping.ANZSCO_code), "ANZSCO group silently dropped.")
        require(result.ANZSCO_code.is_unique, "Duplicate career result.")
        scored = result.loc[result.ANZSCO_interest_score.notna()]
        require(scored.ANZSCO_interest_score.between(0, 4 * len(user_code)).all(), "Project score outside user-code score bounds.")
        # Independently calculate weighted means with a plain loop.
        actual = result.set_index("ANZSCO_code").ANZSCO_interest_score
        for code, group in mapping.groupby("ANZSCO_code"):
            numerator, denominator = 0.0, 0.0
            for row in group.itertuples():
                if pd.notna(row.Interest_Code):
                    points = sum(4 - abs(i - j) for i, a in enumerate(user_code, 1)
                                 for j, b in enumerate(row.Interest_Code, 1) if a == b)
                    numerator += points * row.Match_score
                    denominator += row.Match_score
            require(abs(actual[code] - numerator / denominator) < 1e-10 if denominator else pd.isna(actual[code]), "Weighted aggregation check failed.")
        rankings[label] = scored.ANZSCO_code.tolist()
        print(f"\n{label}: counts={counts}; user Interest Code={user_code}")
        for row in scored.head(5).itertuples():
            print(f"{row.ANZSCO_code} | {row.ANZSCO_title} | ANZSCO interest score={row.ANZSCO_interest_score:.4f}")
            print("  " + row.explanation)
        print(f"PASS: {len(result)} groups retained; {len(scored)} scored; independent weighted calculations agree.")
        print("PASS: user code contains positive-count categories only; no zero-count letters inserted.")
        if label.startswith("Strong "):
            print(f"PASS: {label} -> {user_code}; O*NET codes without {user_code} score zero.")

    strong = list(patterns)[:6]
    print("\nStrong-profile ranking comparisons:")
    for left, right in combinations(strong, 2):
        overlap = len(set(rankings[left][:5]) & set(rankings[right][:5]))
        print(f"{left} / {right}: top-five overlap {overlap}/5")
        if overlap >= 4:
            print("WARNING: these different profiles have very similar top careers; formula/data unchanged.")
    distinct = len({tuple(rankings[label][:5]) for label in strong})
    print(f"{'PASS' if distinct > 1 else 'WARNING'}: {distinct} distinct top-five lists across six strong profiles.")

    valid = responses_for_letters(quiz, "RRIIIISECC")
    bad_cases = {
        "incomplete quiz": valid[:-1],
        "duplicate selection": valid + [valid[0]],
        "invalid answer ID": [("Q1", "INVALID")] + valid[1:],
        "wrong question answer": [("Q1", valid[1][1])] + valid[1:],
    }
    for label, responses in bad_cases.items():
        try:
            validate_responses(quiz, responses)
        except ValueError as error:
            print(f"PASS: rejected {label}: {error}")
        else:
            raise ValueError(f"FAIL: accepted {label}")
    # R and I tie at 3; C and S tie at 2. Latest selected question resolves both.
    for letters, expected in [
        ("RRRIIISSCC", "IRC"), ("IIIRRRCCSS", "RIS"),
        ("SSSSSSSSSS", "S"), ("IIIIIIICCC", "IC"),
        ("IIIIICCCCC", "CI"), ("CCCCCIIIII", "IC"),
    ]:
        responses = responses_for_letters(quiz, letters)
        require(generate_user_interest_code(quiz, responses) == expected, "Tie rule failed.")
        require(generate_user_interest_code(quiz, list(reversed(responses))) == expected, "Tie rule depended on submission order.")
        require(all(calculate_riasec_counts(quiz, responses)[code] > 0 for code in expected), "Zero-count code in edge test.")
        print(f"PASS: code/tie test {letters} -> {expected}; reversed submission order gives same result.")
    for occupation_code, expected in [("RIA", 12), ("AIR", 8), ("RI", 8), ("R", 4), ("A", 2), ("SEC", 0)]:
        require(score_onet_similarity("RIA", occupation_code) == expected, "Position scoring check failed.")
    for user_code, occupation_code, expected in [
        ("R", "R", 4), ("R", "IR", 3), ("R", "AIR", 2), ("A", "RIC", 0),
        ("IC", "IC", 8), ("IC", "CI", 6), ("IC", "RIC", 6), ("IC", "I", 4),
    ]:
        require(score_onet_similarity(user_code, occupation_code) == expected, "Short user-code scoring failed.")
    print("PASS: hand-calculated position scores for one-, two- and three-letter user and occupation codes.")
    for invalid in ["", "RR", "RIAS", "X"]:
        try:
            score_onet_similarity(invalid, "RIC")
        except ValueError:
            pass
        else:
            raise ValueError(f"Accepted invalid user code: {invalid!r}")
    print("PASS: empty, repeated-letter, overlength and invalid-letter user codes rejected.")


SCHEMA_COLUMNS = [
    "ANZSCO_code", "ANZSCO_title", "Interest_Code", "source_ONET_code",
    "source_ONET_title", "source_Match_score", "selection_status",
]
TEAM_CONFIRMED_CODES = {
    "2112": "AE", "2122": "ACE", "2527": "IS", "2541": "SR",
    "2621": "CI", "2632": "ICR", "3995": "RAC", "4231": "SCR",
}


def select_schema_rows(detailed, official):
    """Select source rows without changing the detailed weighted mapping."""
    require_columns(detailed, MAPPING_COLUMNS)
    require(detailed.ANZSCO_code.nunique() == 81, "Expected 81 source ANZSCO groups; inspect changed input.")
    require(not detailed[MAPPING_COLUMNS].isna().any().any(), "Missing detailed mapping fields.")
    require(not detailed.duplicated(["ANZSCO_code", "ONET_code"]).any(), "Duplicate source mapping pairs.")
    require(official.ONET_code.is_unique, "Official O*NET codes are not unique.")
    official_codes = official.set_index("ONET_code").Interest_Code
    require(detailed.ONET_code.map(official_codes).eq(detailed.Interest_Code).all(), "Detailed Interest Codes disagree with official O*NET rows.")
    sizes = detailed.groupby("ANZSCO_code").size()
    columns = ["ANZSCO_code", "ANZSCO_title", "ONET_code", "ONET_title", "Interest_Code", "Match_score", "Review"]
    print("\nSCHEMA SELECTION AUDIT — before selection")
    print(f"Original rows: {len(detailed)}; unique ANZSCO codes: {len(sizes)}; groups with multiple rows: {sizes.gt(1).sum()}")
    print("All rows for every ANZSCO group with multiple mappings:")
    print(detailed.loc[detailed.ANZSCO_code.isin(sizes[sizes > 1].index), columns]
          .sort_values(["ANZSCO_code", "ONET_code"]).to_string(index=False))
    selected = []
    exact_ties = []
    for code, group in detailed.groupby("ANZSCO_code", sort=True):
        highest = group.loc[group.Match_score.eq(group.Match_score.max())]
        if len(highest) > 1:
            exact_ties.append(code)
            print(f"\nExact highest-weight tie: {code}")
            print(highest[columns].sort_values("ONET_code").to_string(index=False))
        if code in TEAM_CONFIRMED_CODES:
            candidates = group.loc[group.Interest_Code.eq(TEAM_CONFIRMED_CODES[code])]
            require(not candidates.empty, f"{code}: team-confirmed code has no existing official mapped source.")
            # The confirmed code is fixed. If several sources share it, retain
            # the highest-weight source, then lowest O*NET code for provenance.
            row = candidates.sort_values(["Match_score", "ONET_code"], ascending=[False, True]).iloc[0].copy()
            status = "team_confirmed"
        else:
            require(len(highest) == 1, f"{code}: new unresolved highest-weight tie requires team review.")
            row = highest.sort_values("ONET_code").iloc[0].copy()
            status = "unique_highest"
        row["selection_status"] = status
        selected.append(row)
    final = pd.DataFrame(selected).rename(columns={
        "ONET_code": "source_ONET_code", "ONET_title": "source_ONET_title",
        "Match_score": "source_Match_score",
    })[SCHEMA_COLUMNS].reset_index(drop=True)
    require(len(final) == 81 and final.ANZSCO_code.is_unique, "Expected 81 unique schema rows.")
    require(set(final.ANZSCO_code) == set(detailed.ANZSCO_code), "Schema selection dropped an ANZSCO group.")
    require(not final.isna().any().any(), "Missing schema fields.")
    require(final.Interest_Code.map(valid_interest_code).all(), "Invalid selected Interest Code.")
    require(final.source_ONET_code.map(official_codes).eq(final.Interest_Code).all(), "Selected code does not match its official O*NET source.")
    # Validate every selected field against its actual ANZSCO/O*NET source pair.
    source = detailed.set_index(["ANZSCO_code", "ONET_code"])
    for row in final.itertuples():
        original = source.loc[(row.ANZSCO_code, row.source_ONET_code)]
        require(row.ANZSCO_title == original.ANZSCO_title
                and row.Interest_Code == original.Interest_Code
                and row.source_ONET_title == original.ONET_title
                and row.source_Match_score == original.Match_score, "Selected row differs from detailed source.")
    confirmed = final.loc[final.selection_status.eq("team_confirmed")]
    require(dict(zip(confirmed.ANZSCO_code, confirmed.Interest_Code)) == TEAM_CONFIRMED_CODES, "Team-confirmed decisions were not preserved exactly.")
    require(not final.selection_status.eq("tie_requires_review").any(), "Unresolved review rows remain.")
    for row in final.loc[final.selection_status.eq("unique_highest")].itertuples():
        group = detailed.loc[detailed.ANZSCO_code.eq(row.ANZSCO_code)]
        highest = group.loc[group.Match_score.eq(group.Match_score.max())]
        require(len(highest) == 1 and highest.iloc[0].ONET_code == row.source_ONET_code, "Nonconfirmed selection is not its unique highest-weight source.")
    print("\nAll eight team-confirmed existing sources:\n" + confirmed.to_string(index=False))
    print("PASS: exactly eight team-confirmed codes preserved; remaining 73 selections use unique highest weights; zero unresolved reviews.")
    print("Exact highest-weight ties in source:", len(exact_ties), exact_ties)
    print("Selection counts:", final.selection_status.value_counts().to_dict())
    print("Manual review required:", final.loc[final.selection_status.eq("tie_requires_review"), "ANZSCO_code"].tolist())
    print("PASS: 81 unique schema rows; no missing titles/codes; every selected source pair, code and weight matches detailed and official data.")
    return final


def load_schema_interest_codes(path):
    """Load the one-row-per-career dataset for database/frontend use."""
    final = pd.read_csv(path, dtype={"ANZSCO_code": "string", "source_ONET_code": "string"})
    require(list(final.columns) == SCHEMA_COLUMNS, "Unexpected schema-ready columns.")
    require(len(final) == 81 and final.ANZSCO_code.is_unique, "Schema file must have 81 unique ANZSCO codes.")
    require(not final.isna().any().any(), "Schema file contains missing values.")
    require(final.Interest_Code.map(valid_interest_code).all(), "Invalid schema Interest Code.")
    require(final.selection_status.isin(["unique_highest", "tie_requires_review", "team_confirmed"]).all(), "Invalid selection status.")
    return final


def rank_schema_careers(quiz, responses, final):
    """Explicit simplified mode, separate from rank_careers' weighted results.

    Keep selection_status visible: provisional tied selections need team review.
    source_Match_score is provenance only, not an extra ranking weight here.
    """
    user_code = generate_user_interest_code(quiz, responses)
    result = final.copy()
    result["schema_interest_score"] = result.Interest_Code.map(lambda code: score_onet_similarity(user_code, code))
    return result.sort_values(["schema_interest_score", "ANZSCO_code"], ascending=[False, True]).reset_index(drop=True)


def build_schema_only(args):
    """Revalidate in memory, writing only the schema CSV and validation report."""
    folder = Path(__file__).resolve().parent
    detailed_path = args.detailed_mapping or folder / "anzsco4_interest_mapping.csv"
    official_path = args.official_codes or folder / "onet_interest_codes_clean.csv"
    raw_paths = [args.interest_dir / f"{NAMES[code]}.csv" for code in CODES]
    inputs = [args.quiz, args.mapping, detailed_path, official_path] + raw_paths
    final_path = args.output_dir / "anzsco4_interest_codes_final.csv"
    report_path = args.output_dir / "quiz_interest_matching_validation.txt"
    require(not {p.resolve() for p in inputs} & {final_path.resolve(), report_path.resolve()}, "Output would overwrite protected input.")
    hashes = {p: sha256(p.read_bytes()).hexdigest() for p in inputs}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with report_path.open("w", encoding="utf-8") as report, redirect_stdout(report):
        try:
            print("IResi detailed quiz validation and schema-ready selection audit")
            quiz = validate_quiz(read_csv(args.quiz))
            require(quiz.loc[quiz.question_id.eq("Q1"), "question"].eq("Which activity sounds most interesting to you?").all(), "Unexpected Q1 text.")
            print("PASS: 10 questions, 60 answers, six RIASEC choices each; Q1 remains 'Which activity sounds most interesting to you?'")
            official = read_csv(official_path, dtype="string")
            detailed = read_csv(detailed_path, dtype={"ANZSCO_code": "string", "ONET_code": "string", "Interest_Code": "string"})
            # Rebuild in memory to verify the existing files, without overwriting them.
            rebuilt_official = combine_interest_files(raw_paths)
            pd.testing.assert_frame_equal(official, rebuilt_official)
            mapping = read_csv(args.mapping, dtype={"ANZSCO_code": "string", "ONET_code": "string"})
            rebuilt_detailed = join_mapping(mapping, official)
            pd.testing.assert_frame_equal(detailed, rebuilt_detailed)
            final = select_schema_rows(detailed, official)
            # Selection must not depend on source row ordering.
            with redirect_stdout(None):
                reversed_final = select_schema_rows(detailed.iloc[::-1], official)
            pd.testing.assert_frame_equal(final, reversed_final)
            print("PASS: schema selection is unchanged when source row order is reversed.")
            run_tests(quiz, detailed)
            final.to_csv(final_path, index=False)
            loaded = load_schema_interest_codes(final_path)
            pd.testing.assert_frame_equal(loaded.astype({"ANZSCO_code": "object", "source_ONET_code": "object"}), final)
            responses = responses_for_letters(quiz, "RRIIIISECC")
            simplified = rank_schema_careers(quiz, responses, loaded)
            require(len(simplified) == 81 and simplified.selection_status.eq("tie_requires_review").sum() == final.selection_status.eq("tie_requires_review").sum(), "Schema ranking dropped careers or review flags.")
            print("PASS: schema file loads; optional schema ranking retains 81 careers and all review flags. Detailed weighted matching remains separate.")
            require(all(sha256(p.read_bytes()).hexdigest() == h for p, h in hashes.items()), "A protected input changed.")
            print("PASS: quiz wording/answers, raw O*NET CSVs, preprocessed mapping, clean official codes and detailed mapping unchanged (SHA-256).")
            for path, digest in hashes.items():
                print(path, digest)
            print("OVERALL PASS: all validations passed; all eight team decisions preserved; zero unresolved reviews.")
        except Exception as error:
            print(f"FAIL: {type(error).__name__}: {error}")
            raise
    print(f"Original mapping: {len(detailed)} rows; final: {len(final)} rows and {final.ANZSCO_code.nunique()} unique ANZSCO codes.")
    print("Selection counts:", final.selection_status.value_counts().to_dict())
    print("Review codes:", final.loc[final.selection_status.eq("tie_requires_review"), "ANZSCO_code"].tolist())
    print("Team-confirmed mappings:", TEAM_CONFIRMED_CODES)
    print("Created:", final_path.resolve())
    print("Updated:", report_path.resolve())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiz", type=Path, default=Path("quiz_questions_riasec.csv"))
    parser.add_argument("--mapping", type=Path, default=Path("preprocessed_mapping.csv"))
    parser.add_argument("--interest-dir", type=Path, default=Path("."))
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument("--schema-only", action="store_true", help="Create schema-ready CSV and report without overwriting detailed datasets.")
    parser.add_argument("--detailed-mapping", type=Path, help="Existing detailed joined mapping for schema mode.")
    parser.add_argument("--official-codes", type=Path, help="Existing clean official codes for schema mode.")
    args = parser.parse_args()
    if args.schema_only:
        build_schema_only(args)
        return
    interest_paths = [args.interest_dir / f"{NAMES[code]}.csv" for code in CODES]
    inputs = [args.quiz, args.mapping] + interest_paths
    output_names = ["onet_interest_codes_clean.csv", "anzsco4_interest_mapping.csv", "quiz_interest_matching_validation.txt"]
    outputs = [args.output_dir / name for name in output_names]
    require(not {path.resolve() for path in inputs} & {path.resolve() for path in outputs}, "Outputs must not overwrite inputs.")
    hashes = {path: sha256(path.read_bytes()).hexdigest() for path in inputs}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with outputs[2].open("w", encoding="utf-8") as report, redirect_stdout(report):
        try:
            print("IResi Interest Code pipeline validation")
            print("Project ranking scores; no percentages or official O*NET quiz scoring.")
            quiz = validate_quiz(read_csv(args.quiz))
            print("PASS: 10 questions, six answers each, one of every RIASEC label, no missing labels, unique answer IDs.")
            require(quiz.loc[quiz.question_id.eq("Q1"), "question"].eq("Which activity sounds most interesting to you?").all(), "Q1 wording is not the final reviewed version.")
            print("PASS: Q1 reads 'Which activity sounds most interesting to you?' in all six answer rows.")
            clean = combine_interest_files(interest_paths)
            mapping = read_csv(args.mapping, dtype={"ANZSCO_code": "string", "ONET_code": "string"})
            joined = join_mapping(mapping, clean)
            run_tests(quiz, joined)
            require(all(sha256(path.read_bytes()).hexdigest() == digest for path, digest in hashes.items()), "An input file changed.")
            clean.to_csv(outputs[0], index=False)
            joined.to_csv(outputs[1], index=False)
            pd.testing.assert_frame_equal(pd.read_csv(outputs[0], dtype="string"), clean.astype("string"))
            reread = pd.read_csv(outputs[1], dtype={"ANZSCO_code": "string", "ONET_code": "string", "Interest_Code": "string"})
            pd.testing.assert_frame_equal(reread, joined)
            print("\nPASS: exported CSVs reread correctly; all source hashes unchanged; quiz text never rewritten.")
            print("Source SHA-256 hashes:")
            for path, digest in hashes.items():
                print(path, digest)
            print("OVERALL PASS: all required checks passed. Review any coverage warnings above.")
        except Exception as error:
            print(f"FAIL: {type(error).__name__}: {error}")
            raise
    print(f"Created {len(clean)} clean O*NET records and {len(joined)} mapping rows covering {joined.ANZSCO_code.nunique()} ANZSCO groups.")
    print("Validation passed: nine synthetic profiles, response errors, tie rules and position scores.")
    for path in outputs:
        print(path.resolve())


if __name__ == "__main__":
    main()
