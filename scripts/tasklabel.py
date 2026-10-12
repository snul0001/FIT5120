"""
Extract the core meaning from JSA Gen-AI exposure Table 1 (automation) and
Table 2 (augmentation): strip background/framing words, keep the content.

Method
  1. spaCy (en_core_web_sm): tokenise, lemmatise, part-of-speech tag.
  2. Background words = general English stopwords + corpus framing words
     (words that frame every justification, e.g. "Generative AI can assist ...",
     and carry no row-specific meaning).
  3. Table 1: each justification is split into clauses, each labelled "AI can"
     or "human needed", then reduced to its content phrases.
     Table 2: justifications follow a template, so they are split into slots:
     AI action (what), AI method (how), benefit, human need.
  4. TF-IDF (scikit-learn) ranks the remaining terms so each row gets its
     most distinctive key terms.

Run:  python extract_core.py   (reads ../data/bespoketable.xlsx, writes ../output/)
Needs: pip install pandas openpyxl scikit-learn spacy
       python -m spacy download en_core_web_sm
"""
import re
import subprocess
import sys
from pathlib import Path


def _ensure(module, package=None):
    """Import a module; if it is missing, pip-install it into THIS Python and retry."""
    try:
        return __import__(module)
    except ImportError:
        print(f"Installing {package or module} into {sys.executable} ...")
        # --only-binary: take the newest version that has a ready-made build for this
        # Python, instead of trying (and failing) to compile the very latest from source
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--only-binary=:all:", package or module])
        return __import__(module)


pd = _ensure("pandas")
_ensure("openpyxl")
_ensure("sklearn", "scikit-learn")
spacy = _ensure("spacy")
from sklearn.feature_extraction.text import TfidfVectorizer

# ---- project layout:  <project>/scripts/extract_core.py, <project>/data, <project>/output
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR = BASE_DIR / "data"
SOURCE_XLSX = DATA_DIR / "bespoketable.xlsx"
MAPPING_CSV = DATA_DIR / "mapping.csv"      # occupations to keep (column ANZSCO_code); delete/rename to keep all
OUTPUT_FILE = OUTPUT_DIR / ("bespoketable_core_meaning_mapped.xlsx" if MAPPING_CSV.exists()
                            else "bespoketable_core_meaning.xlsx")

TOP_K = 6            # key terms kept per row
AUTOMATION_CUT = 0.6   # automation score at or above this -> "AI-automated"
AUGMENT_CUT = 0.7      # otherwise, augmentation score at or above this -> "AI-assisted"
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
score hence suited amenable related relate tailored necessitate necessitates quick inherently replicable faster fast quickly rate followed include includes including
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

try:
    nlp = spacy.load("en_core_web_sm", disable=["ner"])
except OSError:                                   # model not downloaded yet
    from spacy.cli import download
    download("en_core_web_sm")
    import en_core_web_sm
    nlp = en_core_web_sm.load(disable=["ner"])


def is_background(tok, framing=True):
    if tok.is_stop or not tok.is_alpha:
        return True
    return framing and (tok.lower_ in FRAMING or tok.lemma_.lower() in FRAMING)


def phrases(span, framing=True, lemma=False, bridge=False):
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
        elif bridge and cur and tok.lower_ == "of" and cur[-1] != "of" and i + 1 < len(toks):
            cur.append("of")                        # keep "analysis of cost variations" together
        elif cur:
            runs.append(cur); cur = []
        i += 1
    if cur: runs.append(cur)
    if lemma: return [[w for w in r if w != 'of'] for r in runs]
    res = []
    for p in runs:
        while p and p[-1] == "of": p = p[:-1]
        ph = " ".join(p)
        if ph and ph not in res: res.append(ph)
    return res


def title_pattern(title):
    """Regex matching the occupation's own name inside its justification (row-specific background)."""
    segs = [x.strip() for x in re.split(r",|\band\b|\(|\)|\bnec\b", str(title)) if x.strip()]
    not_people = {"systems", "applications", "telecommunications", "electronics", "services", "operations", "sales",
                  "arts", "crafts", "goods", "records", "programs", "relations", "logistics", "loans", "supply"}
    keep = [x for x in segs if len(x.split()) >= 2 or len(segs) == 1          # "Psychologists", "Midwives" ...
            or (x.lower().endswith("s") and len(x) >= 7 and x.lower() not in not_people)]
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


# ---- Table 2 (augmentation): template-based slot split ----------------------
# Typical shape:  "Generative AI can assist in <ACTION> by <METHOD>, improving <BENEFIT>.
#                  This can <BENEFIT>, while still requiring <HUMAN NEED>."
T2_HUMAN_CUT = re.compile(r"(?:[,;]\s*|^)\s*(?:however|but|although|though|yet|whereas|nevertheless)\b,?\s*"
                          r"|,?\s*\bwhile (?:still |also )?(?:requiring|needing|maintaining|leaving|keeping|preserving)\b"
                          r"|,\s*while\b|,?\s*\bwithout\b", re.I)
T2_LEAD_WHILE = re.compile(r"^(?:while|although|though)\s+(.*?),\s+(?=(?:the|it|this|these|human|final|actual|"
                           r"physical|full|its|their|they|there)\b)(.*)", re.I | re.S)
T2_SUBJECT = re.compile(r"^\W*(generative ai|gen ?ai|ai|it|this(?: technology| tool)?|these tools?)\s+"
                        r"(?:can|could|may|might|will|also|allows?|enables?|helps?|leads?|results?|frees?|means)\b", re.I)
BENEFIT_VERB = r"(?:enhanc|improv|increas|lead|result|allow|enabl|reduc|free|sav|boost|minimi[sz]|speed|help|mak|ensur)\w*"
T2_THIS_BENEFIT = re.compile(r"^\W*this\s+(?:\w+\s+){0,3}?" + BENEFIT_VERB, re.I)
T2_BENEFIT_TAIL = re.compile(r",\s*(?:and\s+)?(?:(?:thereby|thus|ultimately|potentially|significantly|further|which"
                             r"(?: can| could| may)?)\s+)*" + BENEFIT_VERB + r"\b", re.I)
T2_METHOD = re.compile(r"\bby\s+(?:\w+ly\s+)?(?=\w+ing\b)|\bthrough\b|\bvia\b", re.I)
T2_LEAD_BY = re.compile(r"^\W*by\s+(\w+ing\b.*?),\s+(?=(?:generative ai|ai|it)\b)(.*)", re.I | re.S)

HUMAN_TYPES = [   # checked in this order on the human-need text only
    ("Physical / hands-on", r"physical|manual|hands-on|dexterity|on-site|in-person|skilled labou?r|craftsmanship"),
    ("Interpersonal", r"interpersonal|empath|interaction|relationship|emotional|rapport|trust|personal touch|human touch|compassion"),
    ("Judgment / expertise", r"judg|expertise|creativ|intuition|leadership|strateg|insight|nuance|accountab|interpret|experience"),
    ("Oversight / final check", r"oversight|review|verif|validat|supervis|intervention|input|involvement|decision|human"),
]


def human_type(text):
    t = text.lower()
    if not t.strip(): return "None stated"
    for name, rx in HUMAN_TYPES:
        if re.search(rx, t): return name
    return "Other"


def split_table2(text):
    """Split one augmentation justification into slot texts: action, method, benefit, human."""
    slot = {"action": [], "method": [], "benefit": [], "human": []}
    for sent in re.split(r"(?<=[.!?])\s+", text.strip()):
        sent = NOISE.sub("", sent).strip()
        if not sent: continue
        m = T2_LEAD_WHILE.match(sent)               # "While it can X, the role still requires Y"
        if m:
            ai_part, human_part = m.group(1), m.group(2)
        else:
            c = T2_HUMAN_CUT.search(sent)
            if c and c.start() == 0:                # "However, ..." -> whole sentence is the human side
                ai_part, human_part = "", sent[c.end():]
            elif c:
                ai_part, human_part = sent[:c.start()], sent[c.end():]
            elif not T2_SUBJECT.match(sent) and not T2_LEAD_BY.match(sent) and \
                    (HUMAN_STRONG.search(sent) or HUMAN_WORDS.search(sent)):
                ai_part, human_part = "", sent      # e.g. "The human element remains crucial."
            else:
                ai_part, human_part = sent, ""
        # a human part can swing back: "..., but AI can also ..."  (rare) -> keep as human
        if human_part.strip(): slot["human"].append(human_part)
        if not ai_part.strip(): continue

        lead = T2_LEAD_BY.match(ai_part)            # "By automating X, AI can improve Y"
        if lead:
            slot["method"].append(lead.group(1)); ai_part = lead.group(2)
        if T2_THIS_BENEFIT.match(ai_part):          # "This can enhance ... / This allows ..."
            slot["benefit"].append(ai_part); continue
        tail = T2_BENEFIT_TAIL.search(ai_part)      # "..., thereby improving ..."
        if tail:
            slot["benefit"].append(ai_part[tail.start():]); ai_part = ai_part[:tail.start()]
        how = T2_METHOD.search(ai_part)             # "... by processing large datasets"
        if how:
            slot["method"].append(ai_part[how.end():]); ai_part = ai_part[:how.start()]
        slot["action"].append(ai_part)
    return slot


def tfidf_keys(feats):
    """Rank each row's terms by how distinctive they are across the table."""
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
    return keys


def process(df, table_name, mode):
    """mode='clauses' -> Table 1 (AI can / human needed);  mode='slots' -> Table 2 (template slots)."""
    df = df.copy()
    just = df["Justification"].astype(str).str.replace(r"\s+", " ", regex=True)

    # task core: general stopwords only (every task word is task-specific)
    df["Task core"] = [", ".join(phrases(d, framing=False)) for d in nlp.pipe(df["Tasks"].astype(str), batch_size=256)]

    join = lambda xs: "; ".join(dict.fromkeys(xs))
    rows, feats = [], []
    for txt, title in zip(just, df["ANZSCO unit title"]):
        pat = title_pattern(title)
        if pat: txt = pat.sub(" ", txt)             # drop the occupation's own name
        f = []

        def grab(clause, bridge=False):
            doc = nlp(clause)
            for run in phrases(doc, lemma=True):    # TF-IDF features: words + within-phrase pairs
                f.extend(run + [f"{x} {y}" for x, y in zip(run, run[1:])])
            return phrases(doc, bridge=bridge)

        if mode == "clauses":                       # ---- Table 1
            ai, hu, hu_raw = [], [], []
            for lab, cl in split_clauses(txt, "human"):
                if lab == "ai": ai += grab(cl)
                else: hu += grab(cl); hu_raw.append(cl)
            rows.append({"AI can (core)": join(ai), "Human still needed (core)": join(hu),
                         "Human need type": human_type(" ".join(hu_raw))})
        else:                                       # ---- Table 2
            sl = split_table2(txt)
            out = {k: join(p for cl in v for p in grab(cl, bridge=True)) for k, v in sl.items()}
            if not out["action"] and out["method"]:  # "AI can automate by X" -> X is the action
                out["action"], out["method"] = out["method"], ""
            rows.append({"AI action (what)": out["action"], "AI method (how)": out["method"],
                         "Benefit": out["benefit"], "Human need (detail)": out["human"],
                         "Human need type": human_type(" ".join(sl["human"]))})
        feats.append(f)
    core = pd.DataFrame(rows, index=df.index)
    df = pd.concat([df, core], axis=1)
    df["Key terms (TF-IDF)"] = tfidf_keys(feats)
    just_docs = list(nlp.pipe(just, batch_size=256))

    wc = lambda s: len(str(s).split())
    df["Words: original"] = just.map(wc)
    text_cols = [c for c in core.columns if c != "Human need type"]
    df["Words: core"] = df[text_cols].agg(" ".join, axis=1).map(wc)

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


def load_mapping():
    """ANZSCO -> O*NET mapping; returns None when there is no mapping file (keep every occupation)."""
    if not MAPPING_CSV.exists():
        return None
    m = pd.read_csv(MAPPING_CSV)
    m["ANZSCO_code"] = m["ANZSCO_code"].astype(int)
    return m


def load(sheet, mapping=None):
    df = pd.read_excel(SOURCE_XLSX, sheet_name=sheet, header=6).iloc[:, :5].dropna(how="all")
    if mapping is not None:
        df = df[df["ANZSCO unit code"].astype(int).isin(set(mapping["ANZSCO_code"]))].reset_index(drop=True)
    return df


def occupation_summary(t1, t2, mapping):
    """One row per kept occupation: task count, mean scores, and its O*NET matches."""
    a = t1.groupby(["ANZSCO unit code", "ANZSCO unit title"]).agg(
        **{"Tasks": ("Tasks", "size"), "Mean automation score": ("Automation task score", "mean")}).reset_index()
    b = t2.groupby("ANZSCO unit code")["Augmentation task score"].mean().rename("Mean augmentation score")
    out = a.merge(b, on="ANZSCO unit code", how="left").round(2)
    if mapping is not None:
        o = (mapping.sort_values("Match_score", ascending=False).groupby("ANZSCO_code")
             .apply(lambda g: "; ".join(f"{c} {t} ({w})" for c, t, w in
                                        zip(g["ONET_code"], g["ONET_title"], g["Match_score"])))
             .rename("O*NET matches (weight)"))
        out = out.merge(o, left_on="ANZSCO unit code", right_index=True, how="left")
    return out


HUMAN_ROLE = {   # plain-language reading of each human-need type
    "Physical / hands-on": "the hands-on work stays with people",
    "Interpersonal": "the people side stays human",
    "Judgment / expertise": "human judgment and expertise are still needed",
    "Oversight / final check": "a person checks the result",
}


GENERIC_HUMAN = {"human", "oversight", "intervention", "hands-on", "physical", "manual", "labor", "labour",
                 "involvement", "input", "judgment", "expertise", "skilled", "presence", "interaction", "element",
                 "touch", "designed", "capable", "support", "skills", "skill", "nuanced", "complex"}


def _top(cell, n=3, drop_generic=False):
    """First n phrases of a '; '-separated cell, as a comma list ('' if empty)."""
    if not isinstance(cell, str) or not cell.strip(): return ""
    ps = [p for p in cell.split("; ") if p]
    if drop_generic:      # "human oversight" adds nothing once the role sentence has said it
        ps = [p for p in ps if not set(p.replace("-", " ").split()) <= GENERIC_HUMAN | {"hands", "on"}]
    return ", ".join(ps[:n])


def classify(row):
    """Three groups from the two scores, plus a one-or-two sentence explanation from the extracted slots."""
    A, G = row["Automation task score"], row["Augmentation task score"]
    if pd.isna(A) or pd.isna(G):
        return pd.Series(["Not classified", "Only one of the two scores is available for this task wording."])
    ai_auto = _top(row["Automation: AI can (core)"])
    ai_what = _top(row["Augmentation: AI action (what)"])
    ai_how = _top(row["Augmentation: AI method (how)"], 2)
    how = f" (by {ai_how})" if ai_how else ""
    if A >= AUTOMATION_CUT:
        group, htype = "AI-automated", row["Automation: Human need type"]
        hum = _top(row["Automation: Human still needed (core)"], 2, True)
        text = f"AI can do most of this itself: {ai_auto or ai_what}."
    elif G >= AUGMENT_CUT:
        group, htype = "AI-assisted", row["Augmentation: Human need type"]
        hum = _top(row["Augmentation: Human need (detail)"], 2, True)
        text = f"You do this with AI support: AI helps with {ai_what}{how}."
    else:
        group, htype = "Human-led", row["Automation: Human need type"]
        hum = _top(row["Automation: Human still needed (core)"], 3, True)
        text = "Mostly human work." + (f" AI's help is limited to {ai_what}." if ai_what else "")
    role = HUMAN_ROLE.get(htype)
    if role:              # oversight is boilerplate, so its detail is left out
        detail = hum if htype != "Oversight / final check" else ""
        text += f" {role[0].upper()}{role[1:]}" + (f": {detail}." if detail else ".")
    return pd.Series([group, text])


def write_excel(t1, t2, bg, path, occ=None):
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    keys = ["ANZSCO unit code", "ANZSCO unit title", "Tasks"]
    c1 = ["AI can (core)", "Human still needed (core)", "Human need type", "Key terms (TF-IDF)"]
    c2 = ["AI action (what)", "AI method (how)", "Benefit", "Human need (detail)", "Human need type", "Key terms (TF-IDF)"]
    a = t1.drop_duplicates(keys)[keys + ["Task core", "Automation task score"] + c1]
    a = a.rename(columns={c: f"Automation: {c}" for c in c1})
    b = t2.drop_duplicates(keys)[keys + ["Augmentation task score"] + c2]
    b = b.rename(columns={c: f"Augmentation: {c}" for c in c2})
    comb = a.merge(b, on=keys, how="outer")
    comb[["AI impact group", "Short explanation"]] = comb.apply(classify, axis=1)
    comb = comb[keys + ["Task core", "Automation task score", "Augmentation task score",
                        "AI impact group", "Short explanation"]
                + [c for c in comb.columns if ": " in c]].sort_values(keys[:1], kind="stable")
    if occ is not None:      # share of each occupation's tasks in each group
        g = (pd.crosstab(comb["ANZSCO unit code"], comb["AI impact group"], normalize="index") * 100).round(0)
        g = g.reindex(columns=["AI-automated", "AI-assisted", "Human-led"], fill_value=0).add_prefix("% tasks ")
        occ = occ.merge(g, left_on="ANZSCO unit code", right_index=True, how="left")
        cols = list(occ.columns); onet = [c for c in cols if c.startswith("O*NET")]
        occ = occ[[c for c in cols if c not in onet] + onet]
    readme = pd.DataFrame([
        ("Occupations", "One row per occupation kept: task count, mean scores and its O*NET matches from mapping.csv."),
        ("Table_1_core", "Table 1 (automation) - every original row plus the extracted core meaning (clause split)."),
        ("Table_2_core", "Table 2 (augmentation) - every original row plus the template slots."),
        ("Combined", "One row per occupation-task with both scores and both extractions side by side."),
        ("Background_words", "Every word removed as background, with the % of justifications it appears in."),
        ("", ""),
        ("Task core", "The task with general stopwords removed."),
        ("TABLE 1", ""),
        ("AI can (core)", "Content phrases from the clauses describing what Gen AI does for the task."),
        ("Human still needed (core)", "Content phrases from the clauses describing what stays with people."),
        ("TABLE 2", "Justifications follow a template: 'Gen AI can assist in <action> by <method>, improving <benefit> ... however <human need>'."),
        ("AI action (what)", "What Gen AI helps with (text after 'can assist in / enhance / automate')."),
        ("AI method (how)", "How it does it (text after 'by ...ing', 'through', 'via')."),
        ("Benefit", "The stated gain, with generic words (productivity, quality, efficiency) removed. Blank = only generic benefits."),
        ("Human need (detail)", "Content phrases from the part after however / but / while still requiring / without."),
        ("COMBINED", ""),
        ("AI impact group", f"AI-automated: automation score >= {AUTOMATION_CUT}.  AI-assisted: automation below that and "
                            f"augmentation score >= {AUGMENT_CUT}.  Human-led: both below."),
        ("Short explanation", "One or two sentences built from the extracted columns: what AI does, then what stays human."),
        ("BOTH", ""),
        ("Human need type", "The human-side text classed as: Physical / hands-on > Interpersonal > Judgment / expertise > "
                            "Oversight / final check > Other > None stated (first match in that order)."),
        ("Key terms (TF-IDF)", f"The {TOP_K} most distinctive terms in the justification, ranked by TF-IDF across the table."),
        ("Words: original / core", "Word count of the justification before and after background removal."),
        ("", ""),
        ("Method", "spaCy en_core_web_sm for tokens, lemmas and part of speech; background = English stopwords + corpus "
                   "framing words + the occupation's own title; rule-based splitting; scikit-learn TF-IDF."),
    ], columns=["Sheet / column", "What it holds"])
    with pd.ExcelWriter(path, engine="openpyxl") as xw:
        sheets = [("README", readme), ("Combined", comb), ("Table_1_core", t1), ("Table_2_core", t2),
                  ("Background_words", bg)]
        if occ is not None: sheets.insert(1, ("Occupations", occ))
        for name, d in sheets:
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
    mapping = load_mapping()
    if mapping is not None:
        print(f"Filtering to {mapping['ANZSCO_code'].nunique()} occupations in {MAPPING_CSV.name}")
    print("Processing Table 1 ..."); t1, bg1 = process(load("Table_1", mapping), "Table 1", mode="clauses")
    print("Processing Table 2 ..."); t2, bg2 = process(load("Table_2", mapping), "Table 2", mode="slots")
    if mapping is not None:
        missing = sorted(set(mapping["ANZSCO_code"]) - set(t1["ANZSCO unit code"].astype(int)))
        if missing: print("WARNING - mapping codes not found in Table 1:", missing)
    bg = bg1.merge(bg2, on=["Word (lemma)", "Type"], how="outer").fillna(0)
    bg = bg[["Word (lemma)", "Type", "% of Table 1 justifications", "% of Table 2 justifications"]]
    bg = bg.sort_values("% of Table 1 justifications", ascending=False)
    print("Writing Excel ...")
    write_excel(t1, t2, bg, OUTPUT_FILE, occupation_summary(t1, t2, mapping))
    for n, t in [("Table 1", t1), ("Table 2", t2)]:
        o, c = t["Words: original"].sum(), t["Words: core"].sum()
        print(f"{n}: {len(t)} rows, {t['ANZSCO unit code'].nunique()} occupations, "
              f"{o:,} -> {c:,} words ({1 - c / o:.0%} removed)")
    print("saved", OUTPUT_FILE)
