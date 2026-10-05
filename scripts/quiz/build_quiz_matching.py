"""Build the IResi quiz and validate RIASEC interest-profile matching.

Requires pandas. Run:
  python build_quiz_matching.py --occupations /path/to/anzsco4_riasec_profiles.csv

Outputs default to this script's folder. Import score_responses and match_careers
to score a dictionary of question_id: answer_id selections. Use public_questions
for display options without scoring codes. Matching returns all occupations,
sorted by unrounded similarity; match_score is the one-decimal display value.
Exact dimension ties use R-I-A-S-E-C order. Career score ties use ANZSCO code.
"""

import argparse
from contextlib import redirect_stdout
from hashlib import sha256
from itertools import combinations
from pathlib import Path

import pandas as pd


CODES = list("RIASEC")
NAMES = ["Realistic", "Investigative", "Artistic", "Social", "Enterprising", "Conventional"]
DESCRIPTIONS = {
    "Realistic": "practical, hands-on activities",
    "Investigative": "investigating and analysing problems",
    "Artistic": "creating and expressing original ideas",
    "Social": "helping and supporting people",
    "Enterprising": "influencing decisions and creating opportunities",
    "Conventional": "organising information and following clear processes",
}

# Final wording is embedded below; no input documents are needed at runtime.
QUESTIONS = [('You have some free time. Which activity sounds most interesting to you?',
  ['Build, repair or improve something practical.',
   'Explore a question and find out how something works.',
   'Create something original, such as a design, story or image.',
   'Spend time helping or supporting someone.',
   'Start an activity and get other people involved.',
   'Organise a plan, collection or set of tasks.']),
 ('When working with other people, which role feels most natural to you?',
  ['Take care of the practical work.',
   'Analyse the problem and check the facts.',
   'Come up with creative ideas.',
   'Listen to others and help the group work together.',
   'Take the lead and move the group forward.',
   'Organise the tasks, details and deadlines.']),
 ('Which challenge would you be most interested in trying?',
  ['Build, repair or improve something useful.',
   'Solve a difficult problem using evidence and information.',
   'Create something new and different.',
   'Teach or support someone who needs help.',
   'Convince others to support an idea.',
   'Improve a process so it works smoothly.']),
 ('Something is not working as expected. What would you naturally do first?',
  ['Test it and try to fix it in practice.',
   'Investigate what caused the problem.',
   'Think of a completely different approach.',
   'Talk to the people involved and understand their needs.',
   'Make a decision and get things moving again.',
   'Review the steps and check what was missed.']),
 ('When learning something new, which approach do you prefer?',
  ['Try it myself and learn through practice.',
   'Research it and understand how it works.',
   'Experiment and find my own way of doing it.',
   'Learn by discussing and working with other people.',
   'Look for ways to use it to create new opportunities.',
   'Follow a clear process step by step.']),
 ('Which type of work would you enjoy doing most?',
  ['Practical work where I can see a clear result.',
   'Work that involves investigating and solving difficult questions.',
   'Work that gives me freedom to create original ideas.',
   'Work where I interact with and support people.',
   'Work where I can influence decisions and achieve goals.',
   'Work with clear procedures, details and structure.']),
 ('Which result would give you the most satisfaction?',
  ['Seeing something I made or fixed work well.',
   'Finding the answer to a difficult problem.',
   'Seeing people connect with something I created.',
   'Seeing someone make progress after I supported them.',
   'Seeing an idea I pushed forward become successful.',
   'Seeing a complicated process become clear and organised.']),
 ('Which work environment sounds most appealing to you?',
  ['A hands-on environment where I can work with equipment or practical tasks.',
   'An environment where I can investigate ideas, evidence and problems.',
   'A flexible environment where creativity is encouraged.',
   'An environment where I work closely with other people.',
   'A fast-moving environment where I can influence decisions and outcomes.',
   'A structured environment with clear processes and responsibilities.']),
 ('When you start a new task, what do you usually focus on first?',
  ['What needs to be done in practice.',
   'What I need to understand or investigate.',
   'How I can approach it in a new way.',
   'Who is involved and how I can work with them.',
   'What result I want to achieve.',
   'How I can organise the steps clearly.']),
 ('Ignore job titles for a moment. Which future sounds most interesting to you?',
  ['I do practical work and see clear results from what I do.',
   'I investigate problems and discover answers.',
   'I create and express original ideas.',
   'I work directly with people and support their progress.',
   'I influence decisions and create opportunities.',
   'I organise information and make processes work reliably.'])]

# The first six rows put every type in every position once.
DISPLAY_ORDERS = [
    "ASCRIE", "SCRIEA", "CRIEAS", "RIEASC", "IEASCR", "EASCRI",
    "ICESRA", "SARECI", "ERCIAS", "CAISER",
]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def build_quiz():
    rows = []
    for number, (question, answers) in enumerate(QUESTIONS, start=1):
        for position, code in enumerate(DISPLAY_ORDERS[number - 1], start=1):
            rows.append({
                "question_id": f"Q{number}", "question": question,
                "answer_id": f"Q{number}_{position}",
                "answer_text": answers[CODES.index(code)],
                "riasec_code": code, "display_order": position,
            })
    return pd.DataFrame(rows)


def validate_quiz(quiz):
    require(len(quiz) == 60, "Quiz must have exactly 60 rows.")
    require(set(quiz.question_id) == {f"Q{i}" for i in range(1, 11)}, "Expected Q1 to Q10.")
    require(quiz.answer_id.is_unique, "Answer IDs must be unique.")
    orders = []
    for question_id, group in quiz.groupby("question_id", sort=False):
        require(len(group) == 6 and group.question.nunique() == 1, f"Invalid question: {question_id}")
        require(sorted(group.riasec_code) == sorted(CODES), f"Invalid codes: {question_id}")
        require(sorted(group.display_order) == list(range(1, 7)), f"Invalid positions: {question_id}")
        orders.append("".join(group.sort_values("display_order").riasec_code))
    require(all(order != "RIASEC" for order in orders), "Unmixed answer order.")
    for code in CODES:
        require(len({order.index(code) for order in orders}) == 6, f"Position does not vary: {code}")


def public_questions(quiz):
    """Return user-facing fields only; never display riasec_code."""
    return quiz.drop(columns="riasec_code").copy()


def score_responses(quiz, responses):
    """Require one valid answer per question; return raw counts and proportions."""
    require(set(responses) == set(quiz.question_id), "Exactly one response to each of Q1–Q10 is required.")
    raw = pd.Series(0, index=NAMES, dtype="int64")
    lookup = quiz.set_index(["question_id", "answer_id"])["riasec_code"]
    for question_id, answer_id in responses.items():
        require((question_id, answer_id) in lookup.index, f"Invalid answer for {question_id}: {answer_id}")
        code = lookup.loc[(question_id, answer_id)]
        raw[NAMES[CODES.index(code)]] += 1
    require(raw.sum() == 10, "Raw scores must sum to 10.")
    return raw, raw / 10


def load_occupations(path):
    occupations = pd.read_csv(path, dtype={"ANZSCO_code": "string"})
    required = ["ANZSCO_code", "ANZSCO_title"] + NAMES
    require(set(required).issubset(occupations.columns), "Missing occupation columns.")
    require(len(occupations) == 81 and occupations.ANZSCO_code.nunique() == 81, "Expected 81 unique ANZSCO groups.")
    require(not occupations[required].isna().any().any(), "Missing occupation identifiers, titles or scores.")
    require(occupations.ANZSCO_code.str.fullmatch(r"\d{4}").all(), "Invalid ANZSCO code.")
    scores = occupations[NAMES].apply(pd.to_numeric, errors="raise")
    require(not scores.isin([float("inf"), float("-inf")]).any().any(), "Nonfinite scores.")
    require(scores.ge(0).all().all(), "Negative occupation scores.")
    totals = scores.sum(axis=1)
    require(totals.gt(0).all(), "Cannot normalise an occupation with a zero score total.")
    proportions = scores.div(totals, axis=0)
    require((proportions.sum(axis=1) - 1).abs().le(1e-12).all(), "Normalisation failed.")
    return occupations, proportions


def strongest(profile):
    """Report the top two and expose any tie affecting their selection."""
    ordered = profile.reindex(NAMES).sort_values(ascending=False, kind="stable")
    top = ordered.index[:2].tolist()
    tied = any((ordered == value).sum() > 1 for value in ordered.iloc[:2])
    return top, tied


def match_careers(user, occupations, proportions):
    require(set(user.index) == set(NAMES), "User profile needs all six dimensions.")
    user = user.reindex(NAMES).astype(float)
    require(user.notna().all() and user.between(0, 1).all(), "Invalid user proportions.")
    require(abs(user.sum() - 1) <= 1e-12, "User proportions must sum to 1.")
    require(proportions.index.equals(occupations.index), "Occupation profile indices differ.")
    distance = proportions[NAMES].sub(user, axis=1).abs().sum(axis=1)
    similarity = (1 - distance / 2) * 100
    require(distance.between(-1e-12, 2 + 1e-12).all(), "Distance outside 0–2.")
    result = occupations[["ANZSCO_code", "ANZSCO_title"]].copy()
    result["distance"] = distance
    result["interest_similarity_unrounded"] = similarity.clip(0, 100)
    result["match_score"] = result.interest_similarity_unrounded.round(1)

    # Explain only observed dimensions, including ties and absent top-two overlap.
    user_top, user_tie = strongest(user)
    result["user_top_two"] = " + ".join(user_top)
    result["user_top_two_tied"] = bool(user_tie)
    for index, occupation in proportions.iterrows():
        occupation_top, occupation_tie = strongest(occupation)
        positive_top = [name for name in user_top if user[name] > 0]
        shared = [name for name in positive_top if name in occupation_top]
        result.loc[index, "occupation_top_two"] = " + ".join(occupation_top)
        result.loc[index, "occupation_top_two_tied"] = bool(occupation_tie)
        result.loc[index, "shared_top_dimensions"] = " + ".join(shared) if shared else "None"
        text = (
            f"Your leading expressed interests are {' + '.join(positive_top)}, associated with "
            f"{' and '.join(DESCRIPTIONS[name] for name in positive_top)}. "
            f"This occupation's leading dimensions are {' + '.join(occupation_top)}. "
        )
        text += f"Shared leading expressed interests: {' + '.join(shared)}. " if shared else "Your leading expressed interests do not overlap this occupation's top two dimensions. "
        if user_tie or occupation_tie:
            text += "A tie affects the top-two list; tied dimensions are listed in R-I-A-S-E-C order. "
        if user[user_top[1]] == 0:
            text += "Your second listed dimension has zero selections and is not a positive expressed interest. "
        text += "The score measures interest-profile similarity across all six dimensions."
        result.loc[index, "explanation"] = text
    return result.sort_values(
        ["interest_similarity_unrounded", "ANZSCO_code"], ascending=[False, True], kind="stable"
    ).reset_index(drop=True)


def run_validation(quiz, occupations, proportions):
    validate_quiz(quiz)
    print("PASS: 10 questions; 6 answers each; exactly one of each RIASEC code; 60 rows.")
    print("PASS: fixed mixed display orders; each type appears in all six positions.")
    print("Display orders:", ", ".join(f"Q{i}: {order}" for i, order in enumerate(DISPLAY_ORDERS, 1)))
    print("PASS: 81 unique ANZSCO groups; no missing RIASEC scores.")
    print("PASS: all normalised occupation profiles sum to 1 within 1e-12.")
    print("Formula: (1 - sum(abs(user proportion - occupation proportion)) / 2) * 100.")
    print("Scores describe RIASEC interest-profile similarity only.")
    print("Ranks use unrounded scores; displayed scores use one decimal place.")
    print("Dimension ties use R-I-A-S-E-C; career score ties use ANZSCO code.")
    print("Synthetic user responses below are software tests only, never project dataset rows.")

    patterns = {f"Strongly {name}": code * 10 for code, name in zip(CODES, NAMES)}
    patterns["Mixed"] = "RRIIIISECC"
    rankings = {}
    for label, pattern in patterns.items():
        responses = {}
        for number, code in enumerate(pattern, start=1):
            option = quiz.loc[(quiz.question_id == f"Q{number}") & (quiz.riasec_code == code)]
            responses[f"Q{number}"] = option.answer_id.iloc[0]
        raw, user = score_responses(quiz, responses)
        matches = match_careers(user, occupations, proportions)
        require(len(matches) == 81 and set(matches.ANZSCO_code) == set(occupations.ANZSCO_code), "Occupation dropped.")
        require(matches.match_score.between(0, 100).all(), "Match score outside 0–100.")
        # Independent identity: similarity equals the sum of overlapping proportions.
        overlap = proportions.apply(lambda row: sum(min(row[d], user[d]) for d in NAMES), axis=1) * 100
        actual = matches.set_index("ANZSCO_code").interest_similarity_unrounded
        expected = pd.Series(overlap.to_numpy(), index=occupations.ANZSCO_code)
        require((actual.sort_index() - expected.sort_index()).abs().le(1e-10).all(), "Independent score check failed.")
        rankings[label] = matches.ANZSCO_code.tolist()
        print(f"\n{label}: raw {raw.to_dict()}; proportions {user.to_dict()}")
        print(matches[["ANZSCO_code", "ANZSCO_title", "match_score"]].head(5).to_string(index=False))
        print("Top-result explanation:", matches.explanation.iloc[0])

    print("\nPairwise ranking comparison (six strong profiles):")
    suspicious = []
    for left, right in combinations(list(patterns)[:6], 2):
        first, second = rankings[left], rankings[right]
        overlap = len(set(first[:5]) & set(second[:5]))
        positions = {code: i for i, code in enumerate(second)}
        n = len(first)
        correlation = 1 - 6 * sum((i - positions[code]) ** 2 for i, code in enumerate(first)) / (n * (n * n - 1))
        print(f"{left} / {right}: top-five overlap {overlap}/5; rank correlation {correlation:.3f}")
        if overlap >= 4 or correlation >= 0.9:
            suspicious.append((left, right))
    print("Heuristic flag: at least 4/5 top-five overlap or rank correlation >= 0.9.")
    print(f"WARNING: similar rankings for {suspicious}" if suspicious else "PASS: rankings differ across all six strong profiles under this check.")
    print("PASS: all 567 test matches fall within 0–100; all 81 occupations retained in each test.")

    # Check incomplete selections and answers assigned to the wrong question.
    valid = {f"Q{i}": f"Q{i}_1" for i in range(1, 11)}
    invalid_cases = [dict(list(valid.items())[:-1]), {**valid, "Q1": "Q2_1"}]
    for invalid in invalid_cases:
        try:
            score_responses(quiz, invalid)
        except ValueError:
            pass
        else:
            raise ValueError("Invalid response was accepted.")
    print("PASS: incomplete responses and cross-question answer IDs rejected.")
    print("Software checks validate implementation, not psychometric validity of the quiz.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--occupations", type=Path, default=Path("anzsco4_riasec_profiles.csv"))
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    quiz_path = args.output_dir / "quiz_questions_riasec.csv"
    report_path = args.output_dir / "quiz_matching_validation.txt"
    require(args.occupations.resolve() not in {quiz_path.resolve(), report_path.resolve()}, "Output would overwrite source.")
    before = sha256(args.occupations.read_bytes()).hexdigest()
    quiz = build_quiz()
    validate_quiz(quiz)
    occupations, proportions = load_occupations(args.occupations)
    quiz.to_csv(quiz_path, index=False)
    with report_path.open("w", encoding="utf-8") as report, redirect_stdout(report):
        print("IResi quiz matching validation")
        print("Occupation source:", args.occupations.resolve())
        print("Source SHA-256:", before)
        print("Source rows/columns:", occupations.shape)
        print("Source data types:\n" + occupations.dtypes.to_string())
        run_validation(pd.read_csv(quiz_path), occupations, proportions)
        require(sha256(args.occupations.read_bytes()).hexdigest() == before, "Source file changed.")
        print("PASS: original occupation source unchanged (SHA-256 verified).")
    print(report_path.read_text(encoding="utf-8"))
    print("Created:", quiz_path, "and", report_path)


if __name__ == "__main__":
    main()
