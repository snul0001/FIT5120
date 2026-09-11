-- ============================================================
-- Schema: ICT Skill Gap / Regional Insight feature
-- Consolidates everything built in this pipeline:
--   Table 6 regional distribution, jsa task-level AI exposure,
--   OSCA<->O*NET crosswalk, software/essential/transferable
--   skills, RIASEC interests, and their derived (tag/top-10)
--   views.
-- ============================================================

-- ---------- Reference / lookup ----------

CREATE TABLE states (
    state_code   VARCHAR(3) PRIMARY KEY,     -- nsw, vic, qld, sa, wa, tas, nt, act
    state_name   VARCHAR(30) NOT NULL
);

-- ---------- Occupation dimensions ----------

-- ANZSCO occupation (4- and 6-digit), source of truth for AU-side data
CREATE TABLE anzsco_occupation (
    anzsco_code       VARCHAR(6)  NOT NULL,
    anzsco_level      SMALLINT    NOT NULL CHECK (anzsco_level IN (4, 6)),
    occupation_name   VARCHAR(150) NOT NULL,
    PRIMARY KEY (anzsco_code, anzsco_level)
);

-- OSCA occupation (the granularity our ICT feature actually keys on)
CREATE TABLE osca_occupation (
    osca_id           VARCHAR(6)  PRIMARY KEY,
    occupation_title  VARCHAR(150) NOT NULL,
    anzsco_code       VARCHAR(6),
    anzsco_level      SMALLINT,
    FOREIGN KEY (anzsco_code, anzsco_level) REFERENCES anzsco_occupation (anzsco_code, anzsco_level)
);

-- O*NET/SOC occupation
CREATE TABLE onet_occupation (
    soc_code    VARCHAR(10) PRIMARY KEY,     -- e.g. 15-1211.00
    onet_title  VARCHAR(150) NOT NULL
);

-- OSCA <-> O*NET crosswalk (deduped: 1 OSCA per SOC code — current rule)
CREATE TABLE osca_onet_crosswalk (
    osca_id       VARCHAR(6)  NOT NULL,
    soc_code      VARCHAR(10) NOT NULL,
    match_score   NUMERIC(4,1) NOT NULL,
    PRIMARY KEY (soc_code),                  -- enforces "1 OSCA per SOC code"
    FOREIGN KEY (osca_id) REFERENCES osca_occupation (osca_id),
    FOREIGN KEY (soc_code) REFERENCES onet_occupation (soc_code)
);

-- ---------- Regional distribution (Table 6) ----------

CREATE TABLE occupation_regional_distribution (
    anzsco_code                    VARCHAR(6)  NOT NULL,
    anzsco_level                   SMALLINT    NOT NULL CHECK (anzsco_level IN (4, 6)),
    state_code                     VARCHAR(3)  NOT NULL,
    pct_of_occupation_employment   NUMERIC(4,1) NOT NULL,
    PRIMARY KEY (anzsco_code, anzsco_level, state_code),
    FOREIGN KEY (anzsco_code, anzsco_level) REFERENCES anzsco_occupation (anzsco_code, anzsco_level),
    FOREIGN KEY (state_code) REFERENCES states (state_code)
);

-- ---------- Skills (SOC-keyed; all three sources) ----------

-- Software Skills (O*NET Technology Skills): specific tools per SOC
CREATE TABLE software_skill (
    soc_code             VARCHAR(10) NOT NULL,
    element_id           VARCHAR(20) NOT NULL,     -- skill category id, e.g. 2.E.4.i
    element_name         VARCHAR(150) NOT NULL,     -- skill category, e.g. "Spreadsheet software"
    workplace_example    VARCHAR(150) NOT NULL,     -- specific tool, e.g. "Microsoft Excel"
    hot_technology        CHAR(1) NOT NULL CHECK (hot_technology IN ('Y','N')),
    in_demand              CHAR(1) NOT NULL CHECK (in_demand IN ('Y','N')),
    rank                    SMALLINT NOT NULL CHECK (rank BETWEEN 1 AND 4),
    PRIMARY KEY (soc_code, element_id, workplace_example),
    FOREIGN KEY (soc_code) REFERENCES onet_occupation (soc_code)
);

-- Essential Skills (O*NET Skills): abstract skill, importance/level rated
CREATE TABLE essential_skill (
    soc_code           VARCHAR(10) NOT NULL,
    element_id         VARCHAR(20) NOT NULL,
    element_name       VARCHAR(150) NOT NULL,
    importance         NUMERIC(3,2) NOT NULL,     -- 1-5
    level              NUMERIC(3,2) NOT NULL,     -- 0-7
    importance_score   NUMERIC(5,2) NOT NULL,     -- 0-100
    level_score        NUMERIC(5,2) NOT NULL,     -- 0-100
    priority_score      NUMERIC(5,2) NOT NULL,     -- entropy-weighted 0-100
    PRIMARY KEY (soc_code, element_id),
    FOREIGN KEY (soc_code) REFERENCES onet_occupation (soc_code)
);

-- Transferable Skills (same structure/source as essential, different O*NET element set)
CREATE TABLE transferable_skill (
    soc_code           VARCHAR(10) NOT NULL,
    element_id         VARCHAR(20) NOT NULL,
    element_name       VARCHAR(150) NOT NULL,
    importance         NUMERIC(3,2) NOT NULL,
    level              NUMERIC(3,2) NOT NULL,
    importance_score   NUMERIC(5,2) NOT NULL,
    level_score        NUMERIC(5,2) NOT NULL,
    priority_score      NUMERIC(5,2) NOT NULL,
    PRIMARY KEY (soc_code, element_id),
    FOREIGN KEY (soc_code) REFERENCES onet_occupation (soc_code)
);

-- ---------- RIASEC interests ----------

CREATE TABLE riasec_interest (
    soc_code          VARCHAR(10) NOT NULL,
    riasec_category   VARCHAR(20) NOT NULL CHECK (
        riasec_category IN ('realistic','investigative','artistic','social','enterprising','conventional')
    ),
    interest_code     VARCHAR(6)  NOT NULL,      -- e.g. 'RCI'
    job_zone          VARCHAR(5),                -- e.g. '1-2'
    featured          BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (soc_code, riasec_category),
    FOREIGN KEY (soc_code) REFERENCES onet_occupation (soc_code)
);

-- ---------- AI exposure (task-level, JSA) ----------

CREATE TABLE jsa_task_score (
    task_id                     SERIAL PRIMARY KEY,
    anzsco_unit_group           VARCHAR(4)  NOT NULL,   -- 4-digit ANZSCO
    task_text                   TEXT NOT NULL,
    automation_score            NUMERIC(3,2) NOT NULL,  -- 0-1
    automation_justification    TEXT,
    augmentation_score          NUMERIC(3,2) NOT NULL,  -- 0-1
    augmentation_justification  TEXT,
    FOREIGN KEY (anzsco_unit_group) REFERENCES anzsco_occupation (anzsco_code)
);

-- ---------- Workforce / demand (resilience inputs) ----------

CREATE TABLE occupation_workforce (
    anzsco_code               VARCHAR(4) PRIMARY KEY,   -- Table_1 is 4-digit
    employed                  INTEGER,
    part_time_share_pct       NUMERIC(4,1),
    female_share_pct          NUMERIC(4,1),
    median_age                NUMERIC(4,1),
    annual_employment_growth  INTEGER,
    FOREIGN KEY (anzsco_code) REFERENCES anzsco_occupation (anzsco_code)
);

-- Vacancy demand: monthly time series is too granular to model per-month
-- as columns; store as a snapshot (latest / recent-average), not the
-- full IVA history, unless the feature needs the trend itself.
CREATE TABLE occupation_demand_snapshot (
    anzsco_code      VARCHAR(4) NOT NULL,
    state_code       VARCHAR(3) NOT NULL,
    snapshot_month   DATE NOT NULL,
    vacancy_count    NUMERIC(10,2),
    PRIMARY KEY (anzsco_code, state_code, snapshot_month),
    FOREIGN KEY (anzsco_code) REFERENCES anzsco_occupation (anzsco_code),
    FOREIGN KEY (state_code) REFERENCES states (state_code)
);

-- Resilience score (computed; stores the inputs alongside the result
-- for traceability rather than only the final number)
CREATE TABLE occupation_resilience_score (
    anzsco_code             VARCHAR(4) PRIMARY KEY,
    automation_resistance   NUMERIC(5,2),   -- 0-100
    augmentation_index      NUMERIC(5,2),   -- 0-100
    demand_score            NUMERIC(5,2),   -- 0-100
    workforce_score         NUMERIC(5,2),   -- 0-100
    resilience_score        NUMERIC(5,2),   -- 0-100, weighted combination
    weight_method           VARCHAR(20),    -- 'entropy' | 'equal' | 'custom'
    FOREIGN KEY (anzsco_code) REFERENCES anzsco_occupation (anzsco_code)
);

-- ============================================================
-- Derived views (skill_tags_by_osca.csv / top10_skills_by_osca.csv
-- are the materialized exports of these — modelled as views here
-- since they're fully computable from the base tables above,
-- not independent facts that need their own storage)
-- ============================================================

-- All distinct skill tags per OSCA occupation, source-tagged
CREATE VIEW skill_tags_by_osca AS
SELECT c.osca_id, o.occupation_title, s.workplace_example AS skill_tag, 'software' AS source
FROM osca_onet_crosswalk c
JOIN osca_occupation o ON o.osca_id = c.osca_id
JOIN software_skill s ON s.soc_code = c.soc_code
UNION
SELECT c.osca_id, o.occupation_title, e.element_name, 'essential'
FROM osca_onet_crosswalk c
JOIN osca_occupation o ON o.osca_id = c.osca_id
JOIN essential_skill e ON e.soc_code = c.soc_code
UNION
SELECT c.osca_id, o.occupation_title, t.element_name, 'transferable'
FROM osca_onet_crosswalk c
JOIN osca_occupation o ON o.osca_id = c.osca_id
JOIN transferable_skill t ON t.soc_code = c.soc_code;

-- Top 10 essential skills per occupation (window function; software/
-- transferable follow the same pattern, ranked by rank / priority_score)
CREATE VIEW top10_essential_skills_by_osca AS
SELECT osca_id, occupation_title, element_name, priority_score, rnk
FROM (
    SELECT c.osca_id, o.occupation_title, e.element_name, e.priority_score,
           ROW_NUMBER() OVER (PARTITION BY c.osca_id ORDER BY e.priority_score DESC) AS rnk
    FROM osca_onet_crosswalk c
    JOIN osca_occupation o ON o.osca_id = c.osca_id
    JOIN essential_skill e ON e.soc_code = c.soc_code
) ranked
WHERE rnk <= 10;
