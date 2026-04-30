# 🎓 Drill-Talk (v3.0)

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

> **「教えることは、二度学ぶこと（To teach is to learn twice）」**
> ファインマン・テクニックに基づく、アウトプット特化型・メタ認知学習プラットフォーム。

Drill-Talkは、独学者が陥りがちな「分かったつもり」を解消するためのAI学習支援アプリケーションです。ユーザーがAI生徒「マナブ」に対して音声でレクチャーを行うことで、自身の知識の欠落（ブラインドスポット）を可視化し、学習の定着率を飛躍的に高めます。

## ✨ Core Features

*   **🗣️ 完全な音声UI (VUI) と排他制御**
    *   Web Audio APIとVAD (Voice Activity Detection) を独自実装。エコーバックを物理的に防ぎ、ストレスフリーな対話環境を実現。
*   **🧠 メタ認知評価システム (Tripartite Matching)**
    *   「ユーザーの発話ログ」「原本教材」「忘れたことメモ」の3点を Gemini 2.5 Flash API でクロスチェック。説明が漏れた箇所と勘違いを分離して提示します。
*   **⚡ ステートフルなリアルタイム通信**
    *   WebSocket を用いたステート管理により、ブラウザのリフレッシュや瞬断が起きても学習セッションを即座に復元可能です。
*   **🛡️ エンタープライズ級の堅牢性**
    *   インフラ起因のエラー（HTTP 429/503）に対する指数バックオフ（自動リトライ）処理や、Pydanticを用いた厳格な環境変数バリデーションを実装。

---

## 🛠 Tech Stack & Environment

| Category | Technology | Version / Details |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 16.1.6**, **React 19.2.3** | TypeScript, Framer Motion, Tailwind CSS 4 |
| **Backend** | **FastAPI 0.136.0**, **Python 3.11.x** | Pydantic 2.13, uvicorn 0.44 |
| **AI / LLM** | **Google Gemini 2.5 Flash API** | google-genai 1.73 (JSON Mode / Multi-modal) |
| **DevOps** | **Docker**, **Docker Compose** | Multi-stage build (Standalone mode) |

---

## 🏗 System Architecture

全体システム構成図（System Architecture）
```mermaid
graph TD
    subgraph Client [フロントエンド / Next.js 16]
        UI[React / Tailwind CSS<br>Framer Motion]
        VAD[Voice Activity Detection<br>AudioContext / SpeechToText]
        Storage[(LocalStorage<br>セッション復元)]
        
        VAD <-->|マイク制御とエコー防止| UI
        Storage -.->|マウント時同期| UI
    end

    subgraph Gatekeeper [インフラ層 / セキュリティ境界]
        APIM{Azure API Management<br>API Key認証 / IP制限}
    end

    subgraph Server [バックエンド / FastAPI]
        Config[Pydantic Settings<br>CORS / 鍵管理]
        WS[WebSocket Endpoint<br>ステート管理 / セッション同期]
        Logic[GeminiProvider<br>指数バックオフ・リトライ処理]
        
        Config -.-> WS
        WS <--> Logic
    end

    subgraph External [外部AIサービス]
        LLM[Google Gemini 2.5 Flash API<br>メタ認知・4要素抽出]
    end

    Client <-->|WebSocket wss| APIM
    APIM <-->|通信トラフィック保護| Server
    Logic <-->|REST API 非同期| LLM

    classDef client fill:#e0f2fe,stroke:#2563eb,stroke-width:2px,color:#0f172a;
    classDef gatekeeper fill:#fecaca,stroke:#ef4444,stroke-width:2px,color:#0f172a;
    classDef server fill:#dcfce7,stroke:#059669,stroke-width:2px,color:#0f172a;
    classDef external fill:#fef08a,stroke:#d97706,stroke-width:2px,color:#0f172a;

    class UI,VAD,Storage client;
    class APIM gatekeeper;
    class WS,Logic,Config server;
    class LLM external;
```
リアルタイム通信シーケンス図（Real-time Sequence）
```mermaid
sequenceDiagram
    participant U as ユーザー(先生)
    participant F as フロントエンド(UI / VAD)
    participant B as バックエンド(FastAPI)
    participant G as Gemini 2.5 Flash

    Note over U, G: 【フェーズ0：接続と記憶の復元】
    U->>F: アプリにアクセス
    F->>F: LocalStorageから履歴を読込
    F->>B: WS接続 & SYNC_SESSION (履歴送信)
    B-->>F: SESSION_SYNCED

    Note over U, G: 【フェーズ1：教材の準備】
    U->>F: 画像アップロード (最大5枚)
    F->>F: SquirrelLoader 表示 (isAnalyzing=true)
    F->>B: INIT_MATERIAL (Base64)
    B->>G: 画像解析リクエスト (プロンプト制御)
    G-->>B: 4要素抽出 (視覚情報・ノイズを除外)
    B-->>F: MATERIAL_READY
    F->>F: SquirrelLoader 非表示

    Note over U, G: 【フェーズ2：ファインマン・テクニック特訓】
    U->>F: 音声で説明 (VADが検知)
    F->>B: USER_TALK (テキスト送信)
    
    alt 50文字未満の場合 (相槌ルート)
        B-->>F: REACTION (感情と相槌)
        F-->>U: アバターの表情変化 & 頷き
    else 50文字以上経過した場合 (質問ルート)
        F->>F: SquirrelLoader 表示 (isBackendThinking=true)
        B->>G: ログと教材の差分から質問生成
        G-->>B: 質問文
        B-->>F: STUDENT_QUESTION (質問文)
        F->>F: STTマイクを強制一時停止
        F-->>U: 音声発話 & SquirrelLoader 非表示
        F->>F: 発話終了後、STTマイク自動再開
    end

    Note over U, G: 【フェーズ3：最終評価（メタ認知）】
    U->>F: 終了ボタン押下 & 忘れたことメモ送信
    F->>F: SquirrelLoader 表示 (isFinishing=true)
    F->>B: FINISH_LECTURE
    B->>G: ログ・原本・メモの三者照合 (API混雑時は自動リトライ)
    G-->>B: 評価ノート生成 (リカバリー/ブラインドスポット分類)
    B-->>F: FINAL_NOTE (HTML / 勘違い / 漏れ)
    F->>F: DOMPurifyでサニタイズ
    F-->>U: 復習ノートModal表示 & SquirrelLoader 非表示
```
Azure デプロイメント構成図（Azure Infrastructure）
```mermaid
graph LR
    subgraph Local [ローカル開発環境]
        Dev[Local PC<br>Docker Compose]
    end

    subgraph AzureCloud [Microsoft Azure]
        ACR[Azure Container Registry<br>コンテナ保管庫]
        
        subgraph SecurityZone [セキュアネットワーク]
            APIM[Azure API Management<br>レート制限 / IPフィルタリング]
            ACA[Azure App Service<br>Web App for Containers]
            APIM -->|アクセス許可IPのみ| ACA
        end
        
        Monitor[Azure Monitor / Log Analytics<br>死活監視・エラー検知]
    end

    Dev -->|Docker Push| ACR
    ACR -->|Image Pull| ACA
    ACA -.->|ログ出力| Monitor

    User((ユーザー)) -->|HTTPS / WSS| APIM
    User -.->|直接アクセス拒否| ACA

    classDef azure fill:#bfdbfe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef secure fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#0f172a,stroke-dasharray: 5 5;
    
    class ACR,APIM,ACA,Monitor azure;
    class SecurityZone secure;
```

## 📂 Directory Structure

```text
Drill-Talk-Portfolio/
├── frontend/                # Next.js 16 + TypeScript
│   ├── app/                 # App Router (Pages, Layouts)
│   ├── components/          # React components (VUI, Avatar, SquirrelLoader)
│   ├── hooks/               # Custom Hooks (useManabu, useVAD)
│   ├── package-lock.json    # 環境再現のための依存関係ロック
│   └── Dockerfile           # Next.js Standalone ビルド
├── backend/                 # FastAPI + Python 3.11
│   ├── main.py              # WebSocket handlers & routing
│   ├── logic.py             # Gemini API orchestration & Retry logic
│   ├── requirements.lock    # Python 依存関係ロック
│   └── Dockerfile           # Slim Python image
├── docker-compose.yml       # ローカル開発・本番共通環境
├── dev_log.md               # 開発・トラブルシューティング記録
└── README.md                # 本ドキュメント
```

## 🚀 Getting Started
本プロジェクトは Docker を用いてコンテナ化されており、環境変数を設定するだけで即座にローカル環境で実行可能です。

### 1. 環境変数 (.env) の設定
ルートディレクトリに `.env` ファイルを作成し、以下の内容を設定してください。

| 変数名 | 必須 | 説明 |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | ✅ | Google AI Studio で取得したAPIキー。 |
| `DRILLTALK_API_KEY` | ✅ | バックエンド側の認証用シークレットキー。 |
| `NEXT_PUBLIC_DRILLTALK_API_KEY` | ✅ | フロントエンド側の認証用。**`DRILLTALK_API_KEY` と同じ値**を設定してください。 |
| `ALLOWED_ORIGINS_RAW` | ❌ | CORS許可リスト。ローカル開発時は `http://localhost:3000` で固定。 |
| `NEXT_PUBLIC_WS_URL` | ❌ | WebSocket接続先。ローカル開発時は `localhost:8000` を指定。 |

### 2. アプリケーションの起動
Docker Compose を使用して、フロントエンド（3000番）とバックエンド（8000番）を一括でビルド・起動します。
`docker-compose up -d --build`

### 3. アクセス
ビルド完了後、ブラウザで以下のURLにアクセスしてください。
* Frontend (UI): http://localhost:3000
* Backend (API Docs): http://localhost:8000/docs

## 📓 Developer Log
詳細な技術選定の理由やトラブルシューティングの軌跡は、開発ログ (dev_log.md) を参照してください。