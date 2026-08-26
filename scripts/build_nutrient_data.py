"""Flatten nutrient_targets.xlsx into JSON the app can import directly.

The workbook is the authority for every number in Gospel's nutrition engine.
This script does no interpretation - it transposes sheets to records, coerces
types, and writes them out. All resolution logic lives in TypeScript so it can
be tested against the golden vectors this script also emits.

Run:  python scripts/build_nutrient_data.py
Out:  src/data/generated/nutrition.json
      src/data/generated/golden_vectors.json
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
WORKBOOK = ROOT / "data-source" / "nutrient_targets.xlsx"
SOURCES_MD = ROOT / "data-source" / "SOURCES.md"
OUT_DIR = ROOT / "src" / "data" / "generated"

# Sheets copied through as plain record lists.
PASSTHROUGH_SHEETS = [
    "inputs",
    "enum_values",
    "nutrients",
    "modifiers",
    "activity_levels",
    "diet_spectrum",
    "sun_zones",
    "equations",
    "recommended_extra_inputs",
    "sources",
]

# Columns holding semicolon-delimited lists that should become arrays.
LIST_COLUMNS = {"source_ids", "affects_nutrient_ids", "allowed_values"}

# Columns that are booleans in the workbook but may arrive as strings.
BOOL_COLUMNS = {"scales_with_bodyweight", "required", "over_ul", "approaching_ul"}


def coerce(column: str, value):
    """Normalise one cell. Empty means NULL, per the workbook's _readme."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None

    if column in BOOL_COLUMNS:
        if isinstance(value, bool):
            return value
        return str(value).strip().upper() in {"TRUE", "1", "YES"}

    if column in LIST_COLUMNS:
        return [part.strip() for part in str(value).split(";") if part.strip()]

    if isinstance(value, str):
        return value.strip()

    return value


def read_sheet(workbook, name: str) -> list[dict]:
    sheet = workbook[name]
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []
    header = [str(cell).strip() for cell in rows[0]]
    records = []
    for row in rows[1:]:
        if all(cell is None for cell in row):
            continue
        records.append(
            {col: coerce(col, val) for col, val in zip(header, row)}
        )
    return records


def parse_sources_markdown() -> dict[str, str]:
    """Pull the full prose citation for each source_id out of SOURCES.md.

    The sources sheet has a short citation; SOURCES.md carries the full
    Vancouver-style reference. The nutrient detail screen shows the long form.
    """
    if not SOURCES_MD.exists():
        return {}

    text = SOURCES_MD.read_text(encoding="utf-8")
    citations: dict[str, str] = {}

    # Entries look like:  **[4]** `DRI_AA` - Institute of Medicine. ...
    pattern = re.compile(
        r"\*\*\[\d+\]\*\*\s+`([A-Z0-9_]+)`\s*[-—]\s*(.+?)(?=\n\s*\n|\n\*\*\[)",
        re.DOTALL,
    )
    for match in pattern.finditer(text):
        source_id = match.group(1)
        body = " ".join(match.group(2).split())
        citations[source_id] = body

    return citations


def build_golden_vectors(workbook) -> dict:
    """The expected_output sheet, grouped by persona, for resolver tests."""
    rows = read_sheet(workbook, "expected_output")
    personas: dict[str, dict] = {}

    for row in rows:
        pid = row["persona_id"]
        if pid not in personas:
            personas[pid] = {
                "persona_id": pid,
                "profile": {
                    "sex": row["sex"],
                    "weight_kg": row["weight_kg"],
                    "age_years": row["age_years"],
                    "diet_type": row["diet_type"],
                    "activity_level": row["activity_level"],
                    "sun_zone": row["sun_zone"],
                },
                "expected": [],
            }
        personas[pid]["expected"].append(
            {
                "nutrient_id": row["nutrient_id"],
                "unit": row["unit"],
                "value": row["value"],
                "ul_value": row["ul_value"],
                "pct_of_ul": row["pct_of_ul"],
                "over_ul": row["over_ul"],
                "approaching_ul": row["approaching_ul"],
                "rules_applied": (
                    [r.strip() for r in str(row["rules_applied"]).split(";") if r.strip()]
                    if row["rules_applied"]
                    else []
                ),
                "flags": (
                    [f.strip() for f in str(row["flags"]).split(";") if f.strip()]
                    if row["flags"]
                    else []
                ),
            }
        )

    return {"personas": list(personas.values())}


def main() -> None:
    if not WORKBOOK.exists():
        raise SystemExit(f"Workbook not found: {WORKBOOK}")

    workbook = openpyxl.load_workbook(WORKBOOK, read_only=True, data_only=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    payload = {sheet: read_sheet(workbook, sheet) for sheet in PASSTHROUGH_SHEETS}

    # Attach the long-form citations to each source record.
    long_citations = parse_sources_markdown()
    for source in payload["sources"]:
        source["full_citation"] = long_citations.get(source["source_id"])

    nutrition_path = OUT_DIR / "nutrition.json"
    nutrition_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    golden = build_golden_vectors(workbook)
    golden_path = OUT_DIR / "golden_vectors.json"
    golden_path.write_text(
        json.dumps(golden, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )

    print(f"nutrition.json      {nutrition_path.stat().st_size / 1024:8.1f} KB")
    for sheet in PASSTHROUGH_SHEETS:
        print(f"  {sheet:28} {len(payload[sheet]):5} rows")
    matched = sum(1 for s in payload["sources"] if s["full_citation"])
    print(f"  long citations matched       {matched}/{len(payload['sources'])}")
    print(
        f"golden_vectors.json {golden_path.stat().st_size / 1024:8.1f} KB"
        f"  {len(golden['personas'])} personas"
        f"  {sum(len(p['expected']) for p in golden['personas'])} assertions"
    )


if __name__ == "__main__":
    main()
