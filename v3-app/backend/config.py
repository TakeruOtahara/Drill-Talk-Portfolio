# --- v3-app/backend/config.py ---
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # 🛡️ 必須項目：設定がないと起動時にエラーを投げてシステムを守ります
    GEMINI_API_KEY: str
    DRILLTALK_API_KEY: str
    
    # 💡 許可オリジン：カンマ区切りの文字列をリストに自動変換
    ALLOWED_ORIGINS_RAW: str = ""

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        # スペース混じりのカンマ区切りにも対応するプロのパース処理
        return [o.strip() for o in self.ALLOWED_ORIGINS_RAW.split(",") if o.strip()]

    # .envファイルの読み込み設定
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

# インスタンスをエクスポート
settings = Settings()