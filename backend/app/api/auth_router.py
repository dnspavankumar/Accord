"""Authentication and merchant onboarding endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session, seed_demo_data_for_merchant
from ..models import Merchant, MerchantRole, MerchantUser, PolicyConfig, Product, User
from ..security import get_current_user, hash_password, issue_token, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=256)
    email: str = Field(min_length=5, max_length=320)
    password: str = Field(min_length=12, max_length=256)
    merchant_name: str = Field(min_length=1, max_length=256)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=320)
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    merchant_id: str


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    email = str(request.email).lower()
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="A valid email address is required.")
    if await session.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists.")
    merchant = Merchant(name=request.merchant_name)
    user = User(email=email, name=request.name, password_hash=hash_password(request.password))
    session.add_all([merchant, user])
    await session.flush()
    session.add(MerchantUser(merchant_id=merchant.id, user_id=user.id, role=MerchantRole.OWNER))
    await session.execute(update(Product).where(Product.merchant_id.is_(None)).values(merchant_id=merchant.id))
    await seed_demo_data_for_merchant(session, merchant.id)
    session.add(PolicyConfig(
        merchant_id=merchant.id, max_transaction_limit_inr=25000,
        max_quantity_per_item=5, allowed_currency="INR", velocity_limit=30,
        velocity_window_seconds=3600,
    ))
    await session.commit()
    return AuthResponse(access_token=issue_token(user.id), user_id=str(user.id), merchant_id=str(merchant.id))


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)) -> AuthResponse:
    user = await session.scalar(select(User).where(User.email == str(request.email).lower()))
    if user is None or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    membership = await session.scalar(select(MerchantUser).where(MerchantUser.user_id == user.id))
    if membership is None:
        raise HTTPException(status_code=403, detail="User is not assigned to a merchant.")
    return AuthResponse(access_token=issue_token(user.id), user_id=str(user.id), merchant_id=str(membership.merchant_id))


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"user_id": str(user.id), "name": user.name, "email": user.email}
