from fastapi import APIRouter

from ..schemas.policy import PolicySettings
from ..services.policy_service import get_policy, set_policy

router = APIRouter(prefix="/api/v1/accord/policy", tags=["Policy"])


@router.get("", response_model=PolicySettings)
async def read_policy() -> PolicySettings:
    return get_policy()


@router.put("", response_model=PolicySettings)
async def update_policy(policy: PolicySettings) -> PolicySettings:
    return set_policy(policy)
