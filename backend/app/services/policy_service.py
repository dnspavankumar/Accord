"""Persistence helpers for merchant policy configuration."""

from sqlalchemy.ext.asyncio import AsyncSession

from ..models.policy import PolicyConfig
from ..schemas.policy import PolicySettings


async def get_policy(session: AsyncSession) -> PolicySettings:
    config = await session.get(PolicyConfig, 1)
    if config is None:
        return PolicySettings()
    return PolicySettings.model_validate(config, from_attributes=True)


async def set_policy(session: AsyncSession, policy: PolicySettings) -> PolicySettings:
    config = await session.get(PolicyConfig, 1)
    if config is None:
        config = PolicyConfig(id=1)
        session.add(config)
    for field in ("max_transaction_limit_inr", "max_quantity_per_item", "allowed_currency", "velocity_limit", "velocity_window_seconds"):
        setattr(config, field, getattr(policy, field))
    await session.commit()
    return await get_policy(session)
