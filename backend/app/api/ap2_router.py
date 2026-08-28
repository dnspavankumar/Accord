from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..schemas.ap2_catalog import AP2Catalog
from ..services.catalog_service import get_catalog

router = APIRouter(prefix="/api/v1/ap2", tags=["AP2"])


@router.get("/catalog", response_model=AP2Catalog)
async def catalog(session: AsyncSession = Depends(get_session)) -> AP2Catalog:
    return await get_catalog(session)
