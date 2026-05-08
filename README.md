# 🎓 Drill-Talk (v3.0)

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

> **「教えることは、二度学ぶこと（To teach is to learn twice）」**
> ファインマン・テクニックに基づく、アウトプット特化型・メタ認知学習プラットフォーム。

Drill-Talkは、独学者が陥りがちな「分かったつもり」を解消するためのAI学習支援アプリケーションです。ユーザーがAI生徒「マナブ」に対して音声でレクチャーを行うことで、自身の知識の欠落（ブラインドスポット）を可視化し、学習の定着率を飛躍的に高めます。

## ✨ Core Features

*   **🗣️ 完全な音声UI (VUI) とマイクの排他制御**
    *   ブラウザの音声認識APIと、AIの発話状態（TTS）を同期させる独自のステート管理を実装。マナブ君の発話中はマイク入力をソフトウェアレベルで強制遮断することでエコーバックを完封し、ストレスフリーな対話環境を実現。
*   **🧠 メタ認知評価システム (Tripartite Matching)**
    *   「ユーザーの発話ログ」「原本教材」「忘れたことメモ」の3点を Gemini 2.5 Flash API でクロスチェック。説明が漏れた箇所と勘違いを分離して提示します。
*   **⚡ クラウドネイティブな耐障害性 (Connection-scoped state)**
    *   コンテナインフラ（Azure Container Apps等）のエフェメラルな性質に対応するため、バックエンドは完全なステートレス設計を採用。WebSocketの切断・コンテナの再起動が発生しても、フロントエンドのLocalStorageから瞬時にセッションを再構築（SYNC_SESSION）し、学習データをロストしません。
*   **🛡️ BFFプロキシによるゼロ・シークレット・フロントエンド**
    *   Next.jsのサーバーサイド機能（Rewrites/API Routes）をBFF（Backend For Frontend）として活用。ブラウザ側にAPIキーを一切露出させず、サーバー間通信でのみ認証を行う強固なセキュリティ境界を構築しています。
*   **🔐 マネージドIDとRBACによるパスワードレス・アーキテクチャ**
    *   インフラのデプロイにおいて、Azure Managed IdentitiesとRBACを採用。コンテナからKey Vaultへのアクセスにおいて、パスワードやアクセスキーの管理を排除しました。APIキーはBicepのパラメータとして渡すのではなく、Key Vault内のシークレットを直接参照（Secret Reference）して環境変数に注入しています。
*   **🕰️ FinOps と Silent Drop による徹底したコスト保護**
    *   バックエンドコンテナにKEDA (Kubernetes Event-driven Autoscaling) のCronスケーラーを導入し、「営業時間（8:00-24:00）のみ1台稼働、深夜帯はゼロスケール」というコスト最適化を実現。さらに、DDoSやスパムによるAPI課金増大を防ぐため、アプリケーション層で異常な連続送信を検知し、エラーすら返さずに無音で破棄する「Silent Drop」を実装しています。
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
    subgraph Client ["ブラウザ (React / UI層)"]
        UI["React / Tailwind CSS"]
        VAD["Voice Activity Detection"]
        Storage[("LocalStorage<br>真実のマスター")]
        
        VAD -->|"マイク制御とエコー防止"| UI
        Storage -.->|"再接続時同期"| UI
    end

    subgraph BFF ["Next.js サーバーサイド"]
        Proxy["API Rewrites<br>BFFプロキシ"]
    end

    subgraph Server ["バックエンド / FastAPI (Internal)"]
        WS["WebSocket Endpoint<br>ステートレス・接続スコープ<br>※Silent Drop スパム防御"]
        Logic["GeminiProvider<br>指数バックオフ・リトライ処理"]
        
        WS <--> Logic
    end

    subgraph External ["外部AIサービス"]
        LLM["Google Gemini 2.5 Flash API"]
    end

    Client -->|"WebSocket ws"| Proxy
    Proxy -->|"内部VNet通信<br>秘匿APIキー付与"| Server
    Logic -->|"REST API 非同期"| LLM

    classDef client fill:#e0f2fe,stroke:#2563eb,stroke-width:2px,color:#0f172a;
    classDef bff fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#0f172a;
    classDef server fill:#dcfce7,stroke:#059669,stroke-width:2px,color:#0f172a;
    classDef external fill:#fef08a,stroke:#d97706,stroke-width:2px,color:#0f172a;

    class UI,VAD,Storage client;
    class Proxy bff;
    class WS,Logic server;
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
    subgraph Local ["ローカル開発環境"]
        Dev["Local PC<br>Docker Compose"]
    end

    subgraph AzureCloud ["Microsoft Azure"]
        
        subgraph FrontendZone ["フロントエンド層 / BFF"]
            ACA_Front["Azure Container Apps<br>Next.js Frontend<br>Scale: 0-2 / External"]
        end

        subgraph BackendZone ["バックエンド層 / 内部通信"]
            ACA_Back["Azure Container Apps<br>FastAPI Backend<br>Scale: 0-1 / Internal<br>※KEDA Cron Scaling"]
        end

        subgraph StorageZone ["機密・コンテナ保管"]
            ACR["Azure Container Registry<br>Dockerイメージ保管庫"]
            AKV["Azure Key Vault<br>APIキー等シークレット管理"]
        end
        
        subgraph FinOpsZone ["監視・予算統制層"]
            AppInsights["Application Insights<br>パフォ監視 / AI通信計測"]
            LogAnalytics["Log Analytics<br>統合ログデータレイク"]
            Budget["Cost Management<br>予算アラート制御"]
        end
    end

    %% デプロイメントフロー
    Dev -->|"Docker Push"| ACR
    ACR -.->|"Image Pull"| ACA_Front
    ACR -.->|"Image Pull"| ACA_Back
    AKV -.->|"Managed Identity経由でSecretRef注入"| ACA_Back
    AKV -.->|"シークレット参照"| ACA_Front

    %% トラフィックフロー
    User(("ユーザー")) -->|"HTTPS / WSS"| ACA_Front
    ACA_Front -->|"内部VNet通信<br>(Secret Key付与)"| ACA_Back

    %% テレメトリと監視フロー
    ACA_Front -->|"テレメトリ送信"| AppInsights
    ACA_Back -->|"テレメトリ送信"| AppInsights
    AppInsights -->|"データ格納"| LogAnalytics
    ACA_Front -->|"コンテナログ出力"| LogAnalytics
    ACA_Back -->|"コンテナログ出力"| LogAnalytics
    LogAnalytics -.->|"利用料監視"| Budget
    Budget -.->|"閾値超過で通知"| Admin(("管理者 / メール"))

    classDef azure fill:#bfdbfe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef finops fill:#fef08a,stroke:#d97706,stroke-width:2px,color:#0f172a;
    classDef storage fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#0f172a;
    classDef internal fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#0f172a,stroke-dasharray: 5 5;
    
    class ACR,ACA_Front azure;
    class AKV storage;
    class AppInsights,LogAnalytics,Budget finops;
    class ACA_Back internal;

    %% サブグラフへのスタイル直接指定
    style BackendZone fill:#f8fafc,stroke:#94a3b8,stroke-width:2px,color:#0f172a,stroke-dasharray: 5 5;
    style FinOpsZone fill:#fef08a,stroke:#d97706,stroke-width:2px,color:#0f172a;
```

## 📂 Directory Structure

```text
Drill-Talk-Portfolio/
├── frontend/                # Next.js 16 + TypeScript
│   ├── app/                 # App Router (Pages, Layouts)
│   ├── components/          # React components (ManabuAvatar, NotebookModal, etc.)
│   ├── hooks/               # Custom Hooks (useManabu, useSpeechToText, etc.)
│   ├── proxy.ts             # WebSocketプロキシ＆認証ヘッダー付与 (Next.js 16仕様)
│   ├── next.config.ts       # Standaloneコンテナビルド最適化設定
│   ├── package-lock.json    # 環境再現のための依存関係ロック
│   └── Dockerfile           # Next.js Standalone ビルド
├── backend/                 # FastAPI + Python 3.11
│   ├── main.py              # WebSocket handlers & routing
│   ├── logic.py             # Gemini API orchestration & Retry logic
│   ├── config.py            # Pydanticによる環境変数・CORSの堅牢なバリデーション
│   ├── requirements.lock    # Python 依存関係ロック
│   └── Dockerfile           # Slim Python image (非root実行・セキュリティ強化)
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
| `GEMINI_API_KEY` | ✅ | Google AI Studio で取得したAPIキー。本番環境ではAzure Key Vaultから安全に注入されます。 |
| `DRILLTALK_API_KEY` | ✅ |バックエンド認証用。本番(Azure)では Key Vault シークレットから自動注入されます。|
| `ALLOWED_ORIGINS_RAW` | ❌ | CORS許可リスト。ローカル開発時は `http://localhost:3000` で固定。 |

### 2. アプリケーションの起動
Docker Compose を使用して、フロントエンド（3000番）とバックエンド（8000番）を一括でビルド・起動します。
`docker-compose up -d --build`

### 3. アクセス
ビルド完了後、ブラウザで以下のURLにアクセスしてください。
* Frontend (UI): http://localhost:3000
* Backend (API Docs): http://localhost:8000/docs

## 🗺️ Future Roadmap (v4.0 and beyond)

本プロジェクトは現在、ブラウザの `localStorage` とコンテナの接続スコープを利用したスタンドアロン環境として稼働していますが、次期バージョン（v4.0以降）では、データ駆動型のパーソナル学習プラットフォームへの進化を計画しています。

### 1. ユーザー認証の導入とゼロトラストセキュリティ
現在のBFF（Backend For Frontend）プロキシにおけるAPIキー管理の技術的負債を解消し、エンタープライズ水準のセキュリティを確保します。
*   **Auth.js (NextAuth) / Azure Entra ID の導入:** OAuth2.0ベースのログイン機能（Google/GitHub/Microsoftアカウント連携）を実装します。

### 2. 学習データの永続化（Cloud Database）
揮発性の高いステート管理から脱却し、マルチテナント対応のデータストアを導入します。
*   **Azure Database for PostgreSQL の統合:** ユーザープロファイル、アップロードされた教材データ（BLOBストレージとの連携）、過去の発話ログ、および生成された評価ノートをリレーショナルデータベースで一元管理します。
*   **デバイス間のシームレスな学習:** PCでアップロードした教材を使って、移動中にスマートフォンで音声レクチャーを行うなど、クロスデバイスでの学習再開を可能にします。

### 3. エビングハウスの忘却曲線に基づく復習システム (Spaced Repetition)
「分かったつもり」を解消した後の、「記憶の定着」までをシステムがカバーします。
*   **インテリジェント・リマインダー:** 評価ノートで抽出された「勘違い (Misconceptions)」やユーザー自身が書き残した「忘れたことメモ」をデータベースに蓄積。エビングハウスの忘却曲線をアルゴリズムに応用し、記憶が薄れる最適なタイミング（1日後、3日後、1週間後など）で復習を促す通知（Email/Push）を自動送信します。

### 4. メタ認知ダッシュボード（Learning Analytics）
ユーザー自身の成長を可視化し、モチベーションを維持する機能を提供します。
*   **学習傾向の分析:** 過去の評価ノートを横断的に解析し、「論理展開の飛躍が多い」「特定のキーワードを忘れがちである」といったユーザー固有のブラインドスポットの傾向をグラフ化してフィードバックします。

## 📓 Developer Log
詳細な技術選定の理由やトラブルシューティングの軌跡は、開発ログ (dev_log.md) を参照してください。