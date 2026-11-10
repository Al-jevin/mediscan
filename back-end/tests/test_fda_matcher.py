import asyncio
import sys
from pathlib import Path

APP_DIRECTORY = Path(__file__).resolve().parents[1] / "app"
if str(APP_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(APP_DIRECTORY))

from services.fda_matcher import find_dosages, find_fda_matches, identify_medicine
from services.nlp_service import extract_entities


# Real OCR output from a phone photo of a browser showing a Biogesic box.
SCREEN_PHOTO = """UntitledX
From Tra X
Justin Bie X
MediscarMInbox1MInbox1
Blogesic Paracetamol 500mg 10 Tablets |Watsons Phllippines
com.ph11000x 100Q.pegZyrs.ago1
Search wit
HOGESIC
Related searche
Paracetamol
10 TABLETS
PARACETAMOL
Biogesic 500
BIOGESIC
500 mg TABLET
Related searche
BIOGESIC
PARACETAMOL
ACETAMOL
PARACETANOL
Paracetam
OGESIC
PARACETAMO
SIOGESIC
BIOGESIO
aracetamo
Biogesic
500M
TOGESC
Q Search
ADAPTIVE
SYNC"""


def _matches(text):
    return asyncio.run(find_fda_matches(text))


def test_screen_photo_ignores_browser_text_and_verifies_biogesic():
    entities = asyncio.run(extract_entities(SCREEN_PHOTO))
    matches = _matches(SCREEN_PHOTO)

    assert entities.medicine_name == "Biogesic Paracetamol"
    assert entities.dosage == "500 mg"
    assert matches[0].fda_brandname == "Biogesic"
    assert matches[0].fda_dosage_strength == "500 mg"
    assert matches[0].fda_dosage_form == "Tablet"
    assert matches[0].confidence_percentage == 100


def test_glued_tokens_from_page_titles_are_split():
    entities = asyncio.run(extract_entities("Paracetamol500mg Tablets|Watsons Philippines"))

    assert entities.medicine_name == "Paracetamol"
    assert entities.dosage == "500 mg"


def test_exact_generic_is_not_mistaken_for_a_similar_brand():
    identity = identify_medicine("Paracetamol\n500 mg")

    assert identity.brand is None
    assert identity.display_name == "Paracetamol"


def test_misread_brand_is_corrected_when_generic_confirms_it():
    identity = identify_medicine("Blogesic\nParacetamol\n500 mg")

    assert identity.brand == "biogesic"
    assert identity.brand_exact is False
    assert _matches("Blogesic\nParacetamol\n500 mg")[0].confidence_percentage == 90


def test_brand_without_strength_needs_verification():
    matches = _matches("BIOGESIC\nPARACETAMOL")

    assert matches
    assert all(match.confidence_percentage == 80 for match in matches)


def test_generic_only_is_not_verified():
    matches = _matches("Paracetamol\n500 mg Tablet")

    assert matches
    assert all(match.confidence_percentage < 90 for match in matches)


def test_registration_number_wins():
    matches = _matches("Some unreadable box\nReg. No. DR-XY39670")

    assert [match.fda_registration_id for match in matches] == ["DR-XY39670"]
    assert matches[0].confidence_percentage == 100


def test_text_without_a_medicine_matches_nothing():
    text = "Untitled\nInbox\nRelated searches\nThe quick brown fox\nADAPTIVE SYNC"

    assert identify_medicine(text) is None
    assert _matches(text) == []


def test_dosage_repairs_and_expiry_formats():
    assert find_dosages("5OO mg and 500mg") == ["500 mg"]
    for text, expected in [
        ("EXP 12/2027", "12/2027"),
        ("EXP: OCT 2027", "OCT 2027"),
        ("Exp. Date 2027-10", "2027-10"),
        ("EXP 01/02/2027", "01/02/2027"),
    ]:
        assert asyncio.run(extract_entities(text)).expiry_date == expected
