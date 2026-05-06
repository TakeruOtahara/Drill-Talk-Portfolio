# --- v3-app/backend/config.py ---
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator, Field
from typing import List
import logging

logger = logging.getLogger("drilltalk.config")

class Settings(BaseSettings):
    # ==========================================
    # 🔑 秘密鍵：環境変数 (.env) から必須読み込み
    # ==========================================
    GEMINI_API_KEY: str
    
    # ==========================================
    # 🌐 ネットワーク設定
    # ==========================================
    # .env からは文字列として受け取る
    ALLOWED_ORIGINS_RAW: str = Field(default="http://localhost:3000", alias="ALLOWED_ORIGINS_RAW")
    
    # プログラム内部で「完全一致チェック」に使うためのリスト
    # 💡 default_factory を使うことで、不変なリストとして初期化
    ALLOWED_ORIGINS: List[str] = Field(default_factory=list)

    # ==========================================
    # 🛠️ バリデーター（精製ロジック）
    # ==========================================
    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v, info):
        """
        ALLOWED_ORIGINS_RAW をカンマで分割し、リスト化して ALLOWED_ORIGINS に格納する。
        これにより、main.py での 'in' 演算子が「部分一致」ではなく「完全一致」で動作する。
        """
        # すでにリストとして渡されている場合はそのまま（テスト時など）
        if isinstance(v, list) and len(v) > 0:
            return v
        
        # 💡 同一クラス内の他フィールド(ALLOWED_ORIGINS_RAW)を参照
        raw_origins = info.data.get("ALLOWED_ORIGINS_RAW", "")
        
        if raw_origins:
            # カンマ区切りをリスト化し、前後の空白を除去、空文字を排除
            origin_list = [o.strip() for o in raw_origins.split(",") if o.strip()]
            logger.info(f"✅ CORS許可リストを生成しました: {origin_list}")
            return origin_list
        
        # 何も設定がない場合のフォールバック（開発環境用）
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    # ==========================================
    # ⚙️ Pydantic 設定
    # ==========================================
    model_config = SettingsConfigDict(
        env_file=".env", 
        extra="ignore",  # 定義外の変数が .env にあっても無視する（堅牢性）
        case_sensitive=True # 大文字小文字を厳密に区別
    )

# インスタンスをエクスポート
# 💡 この一行で、アプリ全体で一つの設定（シングルトン）を共有する
settings = Settings()