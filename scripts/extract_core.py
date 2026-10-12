"""
Extract the core meaning from JSA Gen-AI exposure Table 1 (automation) and
Table 2 (augmentation): strip background/framing words, keep the content.

Method
  1. spaCy (en_core_web_sm): tokenise, lemmatise, part-of-speech tag.
  2. Background words = general English stopwords + corpus framing words
     (words that frame every justification, e.g. "Generative AI can assist ...",
     and carry no row-specific meaning).
  3. Each justification is split into clauses and each clause is labelled
     "AI can" or "human needed", then reduced to its content phrases.
  4. TF-IDF (scikit-learn) ranks the remaining terms so each row gets its
     most distinctive key terms.

Run:  python extract_core.py   (reads ../data/bespoketable.xlsx, writes ../output/)
Needs: pip install pandas openpyxl scikit-learn spacy
       python -m spacy download en_core_web_sm
"""
import re
from pathlib import Path
import pandas as pd
import spacy
from sklearn.feature_extraction.text import TfidfVectorizer

# ---- project layout:  <project>/scripts/extract_core.py, <project>/data, <project>/output
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
SOURCE_XLSX = DATA_DIR / "bespoketable.xlsx"
OUTPUT_FILE = OUTPUT_DIR / "bespoketable_core_meaning.xlsx"   # .xlsx, not .xls (see note)

TOP_K = 6            # key terms kept per row
DF_REPORT = 0.05     # report words appearing in >=5% of justifications

# ---- framing words: say nothing about the specific task ---------------------
FRAMING = set("""
generative ai gen genai task tasks involve involves require requires requiring need needs
assist assists help helps provide provides providing enable allow allows
enhance enhances enhancing improve improves improving increase increases increasing optimize
optimise streamline lead leads leading make makes making thereby thus therefore
quality productivity efficiency efficient efficiently effectively effective output outputs
significantly significant potentially potential fully full completely entirely largely primarily
mainly easily currently current extent nature aspect aspects element elements area areas
limit limits limiting limited limitation remain remains remaining still however while although
automate automates automated automating automation automatable augment augmentation augmenting
replicate replace replaced replicated suitable capability capabilities ability able
challenge challenging difficult beyond certain various vast large amount amounts volume volumes
level high highly low well good great deep deeply specific particular overall
use using used utilise utilize base based perform performs performing performed
process processes role roles work job jobs occupation worker workers way ways thing
such also especially particularly can could may might would cannot
focus crucial essential necessary important key actual facilitate facilitates ensure ensures
score hence suited amenable related relate tailored inherently replicable faster fast quickly rate followed include includes including
""".split())

CONTRAST = re.compile(r"\s*(?:;|,)?\s*\b(?:however|but|although|though|yet|whereas|without)\b,?\s*", re.I)
AI_START = re.compile(r"^\W*(?:by \w+ing .*?,\s*)?(?:generative ai|gen ?ai|ai|it|this|these tools?)\s+"
                      r"(?:also\s+)?(?:can|could|may|might|is able to|allows?|enables?|helps?|leads?)\b(?!\s*not)", re.I)
AI_ANY = re.compile(r"\b(?:generative ai|ai|it)\s+(?:can|could|may|might)\b(?!\s*not)|"
                    r"(?:automated|augmented|assisted|supported) (?:with|by|using) (?:generative )?ai", re.I)
HUMAN_STRONG = re.compile(r"cannot|can not|unable|not (?:easily|fully|be|suitable|within|capable)|beyond the|"
                          r"challenging|difficult|limit(?:s|ed|ing)? (?:the|its|full)|still (?:requires?|needs?)|"
                          r"(?:may|might|would) (?:still )?require|remains? |need for human|"
                          r"human (?:oversight|judgment|intervention|input|expertise|involvement) is", re.I)
HUMAN_WORDS = re.compile(r"\b(?:human|physical|manual|hands-on|in-person|judgment|oversight|dexterity|empathy)\b", re.I)
NOISE = re.compile(r"\b(?:reduc\w+|replac\w+|eliminat\w+) the need for\b", re.I)

nlp = spacy.load("en_core_web_sm", disable=["ner"])


def is_background(tok, framing=True):
    if tok.is_stop or not tok.is_alpha:
        return True
    return framing and (tok.lower_ in FRAMING or tok.lemma_.lower() in FRAMING)


def phrases(span, framing=True, lemma=False):
    """Content phrases: runs of consecutive content tokens with background words removed.
    Hyphenated compounds (decision-making, real-time, hands-on) are kept whole."""
    runs, cur, toks = [], [], list(span)
    i = 0
    while i < len(toks):
        tok = toks[i]
        # hyphenated compound: X - Y  -> one unit
        if i + 2 < len(toks) and toks[i + 1].text == "-" and toks[i].is_alpha and toks[i + 2].is_alpha \
                and not toks[i].whitespace_ and not toks[i + 1].whitespace_:
            cur.append(f"{toks[i].lower_}-{toks[i + 2].lower_}"); i += 3; continue
        if tok.pos_ in ("NOUN", "PROPN", "ADJ", "VERB") and not is_background(tok, framing):
            cur.append(tok.lemma_.lower() if lemma else tok.lower_)
        elif cur:
            runs.append(cur); cur = []
        i += 1
    if cur: runs.append(cur)
    if lemma: return runs
    res = []
    for p in runs:
        ph = " ".join(p)
        if ph not in res: res.append(ph)
    return res


def title_pattern(title):
    """Regex matching the occupation's own name inside its justification (row-specific background)."""
    segs = [x.strip() for x in re.split(r",|\band\b|\(|\)|\bnec\b", str(title)) if x.strip()]
    keep = [x for x in segs if len(x.split()) >= 2 or len(segs) == 1]
    alts = [re.escape(x[:-1] if x.endswith("s") else x) + "s?" for x in keep]
    return re.compile(r"\b(?:" + "|".join(alts) + r")\b", re.I) if alts else None


def split_clauses(text, default):
    """Yield (label, clause); label 'ai' = what Gen AI does, 'human' = what stays with people."""
    last = default
    for sent in re.split(r"(?<=[.!?])\s+", text.strip()):
        m = re.match(r"(?:while|although|though)\s+(.*?),\s+(?=(?:the|it|this|these|human|final|actual|"
                     r"physical|full|generative|ai|its|their|they|there)\b)(.*)", sent, re.I | re.S)
        for part in ([m.group(1), m.group(2)] if m else [sent]):
            for cl in CONTRAST.split(part):
                # a clause may turn mid-way: "AI can X, the final decision requires Y"
                for c in re.split(r",\s+(?=(?:the (?:final|actual|physical|human|task|core|hands)|human|it still)\b)", cl):
                    c = NOISE.sub("", c).strip(" ,;.")
                    if not c: continue
                    if HUMAN_STRONG.search(c):   lab = "human"
                    elif AI_START.search(c):     lab = "ai"
                    elif HUMAN_WORDS.search(c):  lab = "human"
                    elif AI_ANY.search(c):       lab = "ai"
                    else:                        lab = last if c[:1].islower() else default
                    last = lab
                    yield lab, c


def process(df, table_name, default):
    df = df.copy()
    just = df["Justification"].astype(str).str.replace(r"\s+", " ", regex=True)

    # task core: general stopwords only (every task word is task-specific)
    df["Task core"] = [", ".join(phrases(d, framing=False)) for d in nlp.pipe(df["Tasks"].astype(str), batch_size=256)]

    ai_col, hu_col, feats = [], [], []
    for txt, title in zip(just, df["ANZSCO unit title"]):
        pat = title_pattern(title)
        if pat: txt = pat.sub(" ", txt)             # drop the occupation's own name
        ai, hu, f = [], [], []
        for lab, cl in split_clauses(txt, default):
            doc = nlp(cl)
            (ai if lab == "ai" else hu).extend(phrases(doc))
            for run in phrases(doc, lemma=True):    # TF-IDF features: words + within-phrase pairs
                f += run + [f"{x} {y}" for x, y in zip(run, run[1:])]
        ai_col.append("; ".join(dict.fromkeys(ai)))
        hu_col.append("; ".join(dict.fromkeys(hu)))
        feats.append(f)
    df["AI can (core)"] = ai_col
    df["Human still needed (core)"] = hu_col

    # TF-IDF: rank each row's terms by how distinctive they are across the table
    vec = TfidfVectorizer(analyzer=lambda x: x, min_df=2, sublinear_tf=True)
    X = vec.fit_transform(feats)
    vocab = vec.get_feature_names_out()
    keys = []
    for i in range(X.shape[0]):
        row = X.getrow(i)
        picked = []
        for j in row.indices[row.data.argsort()[::-1]]:
            term = vocab[j]
            if any(set(term.split()) & set(p.split()) for p in picked): continue   # no overlapping terms
            picked.append(term)
            if len(picked) == TOP_K: break
        keys.append(", ".join(picked))
    df["Key terms (TF-IDF)"] = keys
    just_docs = list(nlp.pipe(just, batch_size=256))

    wc = lambda s: len(str(s).split())
    df["Words: original"] = just.map(wc)
    df["Words: core"] = (df["AI can (core)"] + " " + df["Human still needed (core)"]).map(wc)

    # background-word report: document frequency of every removed word
    n = len(just_docs)
    cnt = {}
    for d in just_docs:
        for w in {t.lemma_.lower() for t in d if t.is_alpha and is_background(t)}:
            cnt[w] = cnt.get(w, 0) + 1
    bg = (pd.DataFrame({"Word (lemma)": list(cnt), f"% of {table_name} justifications": [round(c / n * 100, 1) for c in cnt.values()]})
          .sort_values(f"% of {table_name} justifications", ascending=False))
    bg["Type"] = bg["Word (lemma)"].map(lambda w: "Framing (corpus-specific)" if w in FRAMING else "General English stopword")
    return df, bg[bg.iloc[:, 1] >= DF_REPORT * 100]


def load(sheet):
    return pd.read_excel(SOURCE_XLSX, sheet_name=sheet, header=6).iloc[:, :5].dropna(how="all")


def write_excel(t1, t2, bg, path):
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    keys = ["ANZSCO unit code", "ANZSCO unit title", "Tasks"]
    core = ["Task core", "AI can (core)", "Human still needed (core)", "Key terms (TF-IDF)"]
    a = t1.drop_duplicates(keys)[keys + ["Automation task score"] + core]
    b = t2.drop_duplicates(keys)[keys + ["Augmentation task score"] + core[1:]]
    comb = a.merge(b, on=keys, how="outer", suffixes=(" - automation", " - augmentation"))
    comb = comb[keys + ["Task core", "Automation task score", "Augmentation task score"]
                + [c for c in comb.columns if " - " in c]].sort_values(keys[:1], kind="stable")
    readme = pd.DataFrame({"Sheet / column": [
        "Table_1_core", "Table_2_core", "Combined", "Background_words", "",
        "Task core", "AI can (core)", "Human still needed (core)", "Key terms (TF-IDF)",
        "Words: original / core", "", "Method"],
        "What it holds": [
        "Table 1 (automation) - every original row plus the extracted core meaning.",
        "Table 2 (augmentation) - same layout.",
        "One row per occupation-task with both scores and both sets of core phrases side by side.",
        "Every word that was removed as background, with the % of justifications it appears in.",
        "",
        "The task with general stopwords removed.",
        "Content phrases from the clauses describing what Gen AI does for the task.",
        "Content phrases from the clauses describing what stays with people (physical work, judgment, oversight).",
        f"The {TOP_K} most distinctive terms in the justification, ranked by TF-IDF across the table.",
        "Word count of the justification before and after background removal.",
        "",
        "spaCy en_core_web_sm for tokens, lemmas and part of speech; background = English stopwords + "
        "corpus framing words + the occupation's own title; rule-based clause split on contrast markers "
        "(however, but, while...); scikit-learn TF-IDF on words and within-phrase word pairs."]})
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        for name, d in [("README", readme), ("Table_1_core", t1), ("Table_2_core", t2),
                        ("Combined", comb), ("Background_words", bg)]:
            d.to_excel(xw, sheet_name=name, index=False)
            ws = xw.sheets[name]
            ws.freeze_panes = "A2"
            if name != "README": ws.auto_filter.ref = ws.dimensions
            for i, col in enumerate(d.columns, 1):
                long = d[col].astype(str).str.len().quantile(0.9) if len(d) else 10
                w = min(max(len(str(col)) * 0.9, long * 0.85, 10), 60)
                if name == "README": w = [24, 110][i - 1]
                ws.column_dimensions[get_column_letter(i)].width = w
                c = ws.cell(1, i)
                c.font = Font(bold=True, color="FFFFFF", name="Arial")
                c.fill = PatternFill("solid", fgColor="1F4E78")
                c.alignment = Alignment(wrap_text=True, vertical="center")
            ws.row_dimensions[1].height = 32
            for row in ws.iter_rows(min_row=2):
                for c in row:
                    c.alignment = Alignment(wrap_text=True, vertical="top")
                    c.font = Font(name="Arial", size=10)


if __name__ == "__main__":
    t1, bg1 = process(load("Table_1"), "Table 1", default="human")
    t2, bg2 = process(load("Table_2"), "Table 2", default="ai")
    bg = bg1.merge(bg2, on=["Word (lemma)", "Type"], how="outer").fillna(0)
    bg = bg[["Word (lemma)", "Type", "% of Table 1 justifications", "% of Table 2 justifications"]]
    bg = bg.sort_values("% of Table 1 justifications", ascending=False)
    write_excel(t1, t2, bg, OUTPUT_FILE)
    for n, t in [("Table 1", t1), ("Table 2", t2)]:
        o, c = t["Words: original"].sum(), t["Words: core"].sum()
        print(f"{n}: {len(t)} rows, {o:,} -> {c:,} words ({1 - c / o:.0%} removed)")
    print("saved", OUTPUT_FILE)
