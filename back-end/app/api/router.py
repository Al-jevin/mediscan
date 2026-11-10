from fastapi import APIRouter
from api.v1.auth import router as auth_router
from api.v1.profiles import router as profiles_router
from api.v1.medicines import router as medicines_router
from api.v1.ocr import router as ocr_router
from api.v1.vault import router as vault_router
from api.v1.schedules import router as schedules_router

router = APIRouter()

# Mount Auth
router.include_router(auth_router, prefix="/auth", tags=["auth"])

# Mount Profiles
router.include_router(profiles_router, prefix="/accounts/me/profiles", tags=["profiles"])
router.include_router(vault_router, prefix="/accounts/me/profiles", tags=["vault"])
router.include_router(schedules_router, prefix="/accounts/me/profiles", tags=["schedules"])

# Mount Medicines
router.include_router(medicines_router, prefix="/medicines", tags=["medicines"])
router.include_router(ocr_router, prefix="/ocr", tags=["ocr"])


@router.get("/", tags=["health"])
async def api_status():
    return {"status": "Mediscan Vault API is running"}


@router.get("/health", tags=["health"])
async def health_check():
    return {"status": "Mediscan Vault API is running"}