from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Merchant
from ..security import get_current_merchant
from ..schemas.policy import PolicySettings
from ..services.policy_service import get_policy, set_policy

router = APIRouter(prefix="/api/v1/accord/policy", tags=["Policy"])


@router.get("", response_model=PolicySettings)
async def read_policy(merchant: Merchant = Depends(get_current_merchant), session: AsyncSession = Depends(get_session)) -> PolicySettings:
    return await get_policy(session, merchant.id)


@router.put("", response_model=PolicySettings)
async def update_policy(policy: PolicySettings, merchant: Merchant = Depends(get_current_merchant), session: AsyncSession = Depends(get_session)) -> PolicySettings:
    return await set_policy(session, merchant.id, policy)
