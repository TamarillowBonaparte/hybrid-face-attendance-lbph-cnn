from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.utils.security import decode_access_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token tidak valid atau kadaluarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise exc
    user_id = payload.get("sub")
    if user_id is None:
        raise exc
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise exc
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.value not in ("admin", "dosen"):
        raise HTTPException(status_code=403, detail="Akses Admin diperlukan")
    return current_user


def require_dosen(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role.value not in ("admin", "dosen"):
        raise HTTPException(
            status_code=403, detail="Akses Dosen atau Admin diperlukan")
    return current_user


def require_mahasiswa(current_user: User = Depends(get_current_user)) -> User:
    return current_user  # semua role bisa
