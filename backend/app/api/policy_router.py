from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..schemas.policy import PolicySettings
from ..services.policy_service import get_policy, set_policy

router = APIRouter(prefix="/api/v1/accord/policy", tags=["Policy"])


@router.get("", response_model=PolicySettings)
async def read_policy(session: AsyncSession = Depends(get_session)) -> PolicySettings:
    return await get_policy(session)


@router.put("", response_model=PolicySettings)
async def update_policy(policy: PolicySettings, session: AsyncSession = Depends(get_session)) -> PolicySettings:
    return await set_policy(session, policy)
