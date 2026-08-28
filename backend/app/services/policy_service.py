"""Runtime policy configuration shared by the policy API and transaction engine."""

from ..schemas.policy import PolicySettings

_policy = PolicySettings()


def get_policy() -> PolicySettings:
    return _policy


def set_policy(policy: PolicySettings) -> PolicySettings:
    global _policy
    _policy = policy
    return _policy
