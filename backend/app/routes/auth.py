from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.models.user import User, UserRoleEnum
from app.schemas.master import UserCreate, UserResponse, TokenResponse, ChangePasswordRequest
from app.utils.security import get_password_hash, verify_password, create_access_token
from app.utils.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse, summary="Login dan dapatkan JWT token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, name=user.name, email=user.email, role=user.role),
    )


@router.get("/me", response_model=UserResponse, summary="Profil user yang sedang login")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password", summary="Ganti password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.old_password, current_user.password):
        raise HTTPException(status_code=400, detail="Password lama salah")
    current_user.password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password berhasil diubah"}


@router.post("/register", response_model=UserResponse, status_code=201, summary="Register user baru (admin only)")
def register(payload: UserCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=payload.name, email=payload.email,
        password=get_password_hash(payload.password), role=payload.role,
    )
    db.add(user); db.commit(); db.refresh(user)
    return user


@router.post("/logout", summary="Logout pengguna")
def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logout berhasil", "status": "success"}

