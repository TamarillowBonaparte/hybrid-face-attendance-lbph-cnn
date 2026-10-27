from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from sqlalchemy.engine import URL
from functools import lru_cache
from pathlib import Path


class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "skripsi_presensi"

    # JWT
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # App
    APP_NAME: str = "Face Recognition Attendance API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # ML - Path Configuration
    # ModelBaru folder location (4 parent levels: config -> app -> backend -> root)
    MODELBARU_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent / "ModelBaru"
    MODELS_DIR: Path = MODELBARU_DIR / "models"
    FACE_MAHASISWA_DIR: Path = MODELBARU_DIR / "face_mahasiswa"

    # ML
    PRELOAD_ML_MODEL: bool = False
    # Model type: "classification", "arcface", atau "enhanced"
    # Enhanced = Score-Level Fusion (ModelBaru) - default
    FACE_MODEL_TYPE: str = "enhanced"

    # File Paths
    UPLOAD_DIR: str = "uploads"
    DATASET_DIR: str = "datasets"

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret(cls, value: str) -> str:
        if value.startswith("GANTI_"):
            raise ValueError("Ganti SECRET_KEY contoh dengan kunci acak sendiri")
        return value

    @property
    def DATABASE_URL(self) -> str:
        return URL.create(
            "mysql+pymysql", username=self.DB_USER, password=self.DB_PASSWORD,
            host=self.DB_HOST, port=self.DB_PORT, database=self.DB_NAME,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
