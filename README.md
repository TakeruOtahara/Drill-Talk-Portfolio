全体システム構成図（System Architecture）
```mermaid
graph TD
    subgraph Client [フロントエンド / Next.js 16]
        UI[React / Tailwind CSS<br>Framer Motion (Squirrel/Avatar)]
        VAD[Voice Activity Detection<br>AudioContext / SpeechToText]
        Storage[(LocalStorage<br>セッション復元)]
        
        VAD <-->|マイク制御/エコー防止| UI
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

    Client <-->|WebSocket (wss://)| APIM
    APIM <-->|通信トラフィック保護| Server
    Logic <-->|REST API (非同期)| LLM

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
        F->>F: STT(マイク)を強制一時停止
        F-->>U: 音声発話 & SquirrelLoader 非表示
        F->>F: 発話終了後、STT(マイク)自動再開
    end

    Note over U, G: 【フェーズ3：最終評価（メタ認知）】
    U->>F: 終了ボタン押下 & 忘れたことメモ送信
    F->>F: SquirrelLoader 表示 (isFinishing=true)
    F->>B: FINISH_LECTURE
    B->>G: ログ・原本・メモの三者照合 (API混雑時は自動リトライ)
    G-->>B: 評価ノート生成 (リカバリー/ブラインドスポット分類)
    B-->>F: FINAL_NOTE (HTML / 勘違い / 漏れ)
    F->>F: DOMPurifyでサニタイズ
    F-->>U: 復習ノート(Modal)表示 & SquirrelLoader 非表示
```
Azure デプロイメント構成図（Azure Infrastructure）
```mermaid
graph LR
    subgraph Local [ローカル開発環境]
        Dev[Local PC<br>Docker Compose]
    end

    subgraph Azure Cloud [Microsoft Azure]
        ACR[Azure Container Registry<br>コンテナ保管庫]
        
        subgraph Security Zone [セキュアネットワーク]
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
    User -.->|直接アクセス (拒否)| ACA

    classDef azure fill:#bfdbfe,stroke:#0284c7,stroke-width:2px,color:#0f172a;
    classDef secure fill:#f0fdf4,stroke:#16a34a,stroke-width:2px,color:#0f172a,stroke-dasharray: 5 5;
    
    class ACR,APIM,ACA,Monitor azure;
    class Security Zone secure;
```
