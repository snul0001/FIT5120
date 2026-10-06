"""Global variable to use for transforming data
    Including pathing to the data, and the output
"""

from pathlib import Path
 
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
 
INPUT_FILE = DATA_DIR / "EQ08.xlsx"
CLEAN_FILE = OUTPUT_DIR / "cleaned_quarterly_unitgroup.csv"
GROWTH_FILE = OUTPUT_DIR / "job_growth_unitgroup_2020_2025.csv"
 
YEARS = list(range(2020, 2026))
 
# Quarterly columns in the ABS file are labelled by mid-quarter month.
QUARTER_MONTHS = ["February", "May", "August", "November"]
 
CURATED = {
    "ICT": "2611 2612 2613 2621 2631 2632 2633 3131 3132 2241 2232 2252 6212",
    "Health": "2511 2512 2515 2523 2524 2525 2527 2544 2541 2346 2723 4111 4112 "
              "3112 4114 4231 4232 4233 3613",
    "Business": "2211 2212 2221 2223 2231 2243 2244 2247 2251 2253 5111 5511 5512 "
                "5211 5311 5521 5522 5994 5911 6121",
    "Creative": "2111 2112 2113 2114 2121 2122 2124 2323 2324 2325 3995",
    "Trades": "3312 3341 3311 3322 3411 3421 3423 3424 3211 3212 3232 3223 3231 "
              "3513 3514 3941 3911 3622",
}
 
