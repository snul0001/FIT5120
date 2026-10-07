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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiz", type=Path, default=Path("quiz_questions_riasec.csv"))
    parser.add_argument("--mapping", type=Path, default=Path("preprocessed_mapping.csv"))
    parser.add_argument("--interest-dir", type=Path, default=Path("."))
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
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
