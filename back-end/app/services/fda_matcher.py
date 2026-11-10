"""Identify the medicine in OCR text using the FDA dataset, and find its FDA records."""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache

from rapidfuzz import process
from rapidfuzz.distance import Levenshtein
from starlette.concurrency import run_in_threadpool

from schemas.ocr import LinkedMedicineResponse
from services.search_service import (
    _load_fda_index,
    _normalize_strength,
    extract_registration_ids,
)


DOSAGE_PATTERN = re.compile(
    r"\b\d[\dOo,]*(?:\.\d+)?\s?(?:mcg|mg|ml|iu|g)\b|\b\d+(?:\.\d+)?\s?%",
    re.IGNORECASE,
)
_GLUED_DOSAGE_PATTERN = re.compile(
    r"(?<=[A-Za-z])(?=\d[\d.,]*\s?(?:mcg|mg|ml|iu|g)\b)",
    re.IGNORECASE,
)
_LABEL_WORDS = {
    "caplet", "caplets", "capsule", "capsules", "coated", "cream", "drops", "film",
    "ointment", "solution", "suspension", "syrup", "tablet", "tablets",
}
_MAX_NAME_WORDS = 4
_MIN_FUZZY_LENGTH = 6
_MAX_SUGGESTIONS = 5


def clean_ocr_text(raw_text: str) -> str:
    """Undo OCR habits that hide words: "Tablets|Watsons" and "Paracetamol500mg"."""
    return _GLUED_DOSAGE_PATTERN.sub(" ", raw_text.replace("|", " "))


def find_dosages(text: str) -> list[str]:
    """Return distinct dosages in source order, repairing "5OO mg" to "500 mg"."""
    dosages: dict[str, str] = {}
    for match in DOSAGE_PATTERN.finditer(text):
        number, unit = re.match(r"(.*?\d?[\dOo,.]*)\s*([A-Za-z%]+)$", match.group(0)).groups()
        dosage = f"{re.sub('[Oo]', '0', number)} {unit}".replace(" %", "%")
        dosages.setdefault(_normalize_strength(dosage), dosage)
    return list(dosages.values())


def _key(text: str | None) -> str:
    """Comparable name: lowercase words, without parentheticals like "(Orange Flavor)"."""
    without_notes = re.sub(r"\(.*?\)", " ", text or "")
    return " ".join(re.findall(r"[a-z0-9]+", without_notes.casefold()))


def _generic_parts(generic_name: str | None) -> frozenset[str]:
    """Split a combination generic into its ingredients."""
    parts = re.split(r"\+|/|,|\band\b", re.sub(r"\(.*?\)", " ", generic_name or ""))
    # Some CSV rows have shifted columns, which puts values like "500mg" in the generic name.
    return frozenset(key for key in map(_key, parts) if len(key) >= 5 and not key[0].isdigit())


def _strength_parts(strength: str | None) -> frozenset[str]:
    return frozenset(
        part for part in re.split(r"[/+]", _normalize_strength(strength)) if part
    )


@dataclass(frozen=True, slots=True)
class _Entry:
    fda_id: int  # position in the CSV, which has no numeric id
    record: dict
    brand: str
    generics: frozenset[str]
    strengths: frozenset[str]


@dataclass(frozen=True, slots=True)
class _Lexicon:
    entries: tuple[_Entry, ...]
    brands: tuple[str, ...]
    generics: tuple[str, ...]


@lru_cache(maxsize=1)
def _lexicon() -> _Lexicon:
    _, records = _load_fda_index()
    entries = tuple(
        _Entry(
            fda_id=index,
            record=record,
            brand=_key(record["brand_name"]),
            generics=_generic_parts(record["generic_name"]),
            strengths=_strength_parts(record["dosage_strength"]),
        )
        for index, record in enumerate(records, start=1)
    )
    generics = {part for entry in entries for part in entry.generics}
    # A "brand" equal to an ingredient is a generic-named product, not a brand on the label.
    brands = {entry.brand for entry in entries if len(entry.brand) >= 4} - generics
    return _Lexicon(entries, tuple(sorted(brands)), tuple(sorted(generics)))


@dataclass(slots=True)
class _Mention:
    count: int = 0
    exact: bool = False
    whole_line: bool = False  # the name was the only thing on its line


def _find_mentions(
    lines: list[str],
    names: tuple[str, ...],
    other_names: tuple[str, ...],
) -> dict[str, _Mention]:
    """Find dataset names in the OCR lines, tolerating small OCR misreads.

    A word that is exactly a name in other_names is never corrected, or "Paracetamol"
    (a generic) would be read as a misspelling of the brand "Pacetamol".
    """
    known = set(names)
    other_known = set(other_names)
    resolved: dict[str, tuple[str, bool] | None] = {}

    def resolve(gram: str, word_count: int) -> tuple[str, bool] | None:
        if gram in known:
            return gram, True
        if (
            gram in other_known
            or word_count > 2
            or len(gram) < _MIN_FUZZY_LENGTH
            or re.search(r"\d", gram)
        ):
            return None
        best = process.extractOne(
            gram, names, scorer=Levenshtein.distance, score_cutoff=1 if len(gram) < 10 else 2
        )
        return (best[0], False) if best else None

    mentions: dict[str, _Mention] = {}
    for line in lines:
        words = _key(line).split()
        core = " ".join(
            word for word in _key(DOSAGE_PATTERN.sub(" ", line)).split() if word not in _LABEL_WORDS
        )
        for size in range(1, _MAX_NAME_WORDS + 1):
            for start in range(len(words) - size + 1):
                gram = " ".join(words[start : start + size])
                if gram not in resolved:
                    resolved[gram] = resolve(gram, size)
                if resolved[gram] is None:
                    continue
                name, exact = resolved[gram]
                mention = mentions.setdefault(name, _Mention())
                mention.count += 1
                mention.exact |= exact
                mention.whole_line |= exact and gram == core
    return mentions


@dataclass(frozen=True, slots=True)
class LabelIdentity:
    """The medicine named on a label, using dataset keys."""

    brand: str | None
    generics: frozenset[str]
    brand_exact: bool
    display_name: str


@lru_cache(maxsize=8)
def identify_medicine(raw_text: str) -> LabelIdentity | None:
    """Pick the dataset medicine best supported by the OCR text, if any."""
    lines = [line for line in clean_ocr_text(raw_text).splitlines() if line.strip()]
    lexicon = _lexicon()
    brands = _find_mentions(lines, lexicon.brands, lexicon.generics)
    generics = _find_mentions(lines, lexicon.generics, lexicon.brands)

    best_score: tuple[int, ...] = (0,)
    best: LabelIdentity | None = None
    for entry in lexicon.entries:
        brand = brands.get(entry.brand)
        found = [generics[part] for part in entry.generics if part in generics]
        all_found = bool(entry.generics) and len(found) == len(entry.generics)
        evidence = sum(mention.count for mention in found)

        if brand and all_found:
            tier = 3  # brand and its ingredients on one label: the strongest signal
        elif brand and brand.whole_line:
            tier = 2
        elif all_found and (any(m.exact for m in found) or evidence >= 2):
            tier = 1
        else:
            continue

        score = (
            tier,
            int(bool(brand and brand.exact)),
            len(found) if all_found else 0,
            (brand.count if brand else 0) + evidence,
            len(entry.brand) if brand else 0,  # "Klaz OD" over "Klaz" when both were read
        )
        if score <= best_score:
            continue
        best_score = score
        generic_name = entry.record["generic_name"] if all_found else None
        brand_name = entry.record["brand_name"] if tier >= 2 else None
        best = LabelIdentity(
            brand=entry.brand if tier >= 2 else None,
            generics=entry.generics if all_found else frozenset(),
            brand_exact=bool(brand and brand.exact),
            display_name=" ".join(
                re.sub(r"\s*\(.*?\)", "", name) for name in (brand_name, generic_name) if name
            ),
        )
    return best


def _confidence(identity: LabelIdentity, strength_found: bool) -> tuple[int, str, str]:
    """Only a brand plus a strength read from the label is confident enough to be verified."""
    if identity.brand and strength_found:
        if identity.brand_exact and identity.generics:
            return 100, "max", "Brand, generic name and strength all match the label."
        if identity.brand_exact:
            return 95, "high", "Brand and strength match the label."
        return 90, "high", "Generic name and strength match, and the brand is a close read."
    if identity.brand:
        return 80, "medium", "The brand matches. Include the strength in the photo to confirm the product."
    if strength_found:
        return 80, "medium", "Generic name and strength match. Capture the brand name to identify the product."
    return 65, "medium", "Only the generic name was read. Capture the brand name and strength."


def _to_response(entry: _Entry, confidence: tuple[int, str, str]) -> LinkedMedicineResponse:
    percentage, level, guidance = confidence
    record = entry.record
    return LinkedMedicineResponse(
        fda_id=entry.fda_id,
        fda_registration_id=record["registration_number"],
        fda_approval_id=record["approval_id"] or record["registration_number"],
        fda_brandname=record["brand_name"],
        fda_genericname=record["generic_name"] or record["brand_name"] or "Unknown",
        fda_dosage_form=record["dosage_form"],
        fda_dosage_strength=record["dosage_strength"],
        fda_manufacturer=record["manufacturer"],
        fda_pharmacologic_category=record["pharmacologic_category"],
        fda_classification=record["classification"],
        match_type="exact" if percentage == 100 else "fuzzy",
        match_score=percentage / 100,
        confidence_percentage=percentage,
        confidence_level=level,
        accuracy_guidance=guidance,
    )


def _find_matches_sync(raw_text: str) -> list[LinkedMedicineResponse]:
    text = clean_ocr_text(raw_text)
    by_registration, _ = _load_fda_index()
    entries = _lexicon().entries

    for registration_id in extract_registration_ids(raw_text=text):
        record = by_registration.get(registration_id)
        if record is not None:
            entry = next(item for item in entries if item.record is record)
            return [_to_response(entry, (100, "max", "The FDA registration number matches the label."))]

    identity = identify_medicine(raw_text)
    if identity is None:
        return []

    candidates = [
        entry
        for entry in entries
        if (entry.brand == identity.brand if identity.brand else entry.generics == identity.generics)
        and (not identity.brand or not identity.generics or entry.generics == identity.generics)
    ]
    label_strengths = {_normalize_strength(dosage) for dosage in find_dosages(text)}
    with_strength = [entry for entry in candidates if entry.strengths and entry.strengths <= label_strengths]
    confidence = _confidence(identity, bool(with_strength))
    return [_to_response(entry, confidence) for entry in (with_strength or candidates)[:_MAX_SUGGESTIONS]]


async def find_fda_matches(raw_text: str) -> list[LinkedMedicineResponse]:
    """Return FDA records for OCR text, best first, without needing a database."""
    return await run_in_threadpool(_find_matches_sync, raw_text)
