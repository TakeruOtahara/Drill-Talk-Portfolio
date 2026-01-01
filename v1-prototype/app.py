import streamlit as st
import streamlit.components.v1 as components
from logic import get_ai_client
from PIL import Image
from streamlit_mic_recorder import mic_recorder
import time

st.set_page_config(page_title="Drill-Talk (Dev)", page_icon="🎓", layout="wide")

# --- 定数設定 ---
TIME_LIMIT_MINUTES = 10 # 10分
TIME_LIMIT_SECONDS = TIME_LIMIT_MINUTES * 60

# --- 1. セッション状態の初期化 ---
if "ai_client" not in st.session_state:
    try:
        st.session_state.ai_client = get_ai_client()
    except Exception as e:
        st.error(f"AI Error: {e}"); st.stop()

if "messages" not in st.session_state:
    st.session_state.messages = [{"role": "assistant", "content": "ういーっす。授業？それともドリルやる？"}]
if "answer_key_image" not in st.session_state:
    st.session_state.answer_key_image = None
if "uploader_key" not in st.session_state:
    st.session_state.uploader_key = 0
if "class_started" not in st.session_state:
    st.session_state.class_started = False
if "start_time" not in st.session_state:
    st.session_state.start_time = None

# =========================================
# 画面1: ロビー（待機画面）
# =========================================
if not st.session_state.class_started:
    st.title("🏫 Drill-Talk: 教室の入り口")
    st.markdown(f"""
    ようこそ、先生。
    本日の授業時間は **{TIME_LIMIT_MINUTES}分** です。
    準備ができたら開始してください。
    """)
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("🔔 チャイムを鳴らして授業開始", type="primary", use_container_width=True):
            st.session_state.class_started = True
            st.session_state.start_time = time.time()
            st.rerun()
    st.stop()

# =========================================
# 画面2: 授業画面（Classroom）
# =========================================
st.title("🎓 Drill-Talk: 授業中")

# --- 時間管理ロジック (Python) ---
elapsed_time = time.time() - st.session_state.start_time
remaining_time = TIME_LIMIT_SECONDS - elapsed_time

# --- JavaScriptによるカウントダウン (最強版: iframe埋め込み) ---
if remaining_time > 0:
    # 終了時刻（Unixタイムスタンプ）を計算してJSに渡す
    # これならページをリロードしてもズレない
    end_time = st.session_state.start_time + TIME_LIMIT_SECONDS
    
    # HTML/JSコード（完全に独立した時計コンポーネント）
    # widthやheightで枠のサイズを調整可能
    timer_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
    <style>
        body {{
            font-family: "Source Sans Pro", sans-serif;
            margin: 0;
            padding: 10px;
            background-color: #f0f2f6;
            border: 2px solid #ff4b4b;
            border-radius: 10px;
            text-align: center;
        }}
        h3 {{ margin: 0 0 5px 0; color: #31333F; font-size: 16px; }}
        #timer {{ font-size: 32px; font-weight: bold; color: #ff4b4b; }}
    </style>
    </head>
    <body>
        <h3>残り時間</h3>
        <div id="timer">--:--</div>

        <script>
            // Pythonから受け取った終了時刻
            const endTime = {end_time};

            function updateTimer() {{
                const now = Date.now() / 1000; // 現在時刻（秒）
                const diff = endTime - now;

                if (diff <= 0) {{
                    document.getElementById("timer").innerHTML = "終了！";
                    return;
                }}

                const m = Math.floor(diff / 60);
                const s = Math.floor(diff % 60);
                // 0埋め処理
                const mStr = m;
                const sStr = s < 10 ? "0" + s : s;
                
                document.getElementById("timer").innerHTML = mStr + "分 " + sStr + "秒";
            }}

            // 1秒ごとに更新
            setInterval(updateTimer, 1000);
            // 起動直後にも一回実行
            updateTimer();
        </script>
    </body>
    </html>
    """
    
    # サイドバーに「独立したHTML」として埋め込む
    with st.sidebar:
        components.html(timer_html, height=120)

else:
    st.sidebar.error("⏰ 授業終了")

# --- サイドバー：ドリル & システム操作 ---
with st.sidebar:
    st.divider()
    # ▼▼▼ ドリル機能（ここを強制終了より前に配置） ▼▼▼
    st.header("📝 ドリル実行")
    answer_key_file = st.file_uploader("答えの画像", type=["jpg", "png"], key=f"ans_{st.session_state.uploader_key}")
    if answer_key_file: st.session_state.answer_key_image = Image.open(answer_key_file)
    
    problem_file = st.file_uploader("問題の画像", type=["jpg", "png"], key=f"prob_{st.session_state.uploader_key}")
    run_drill = st.button("マナブに解かせる！", type="primary", use_container_width=True)

    if run_drill:
        # ★ここで「時間切れチェック」をしない！いつでも実行可能にする
        if not st.session_state.answer_key_image or not problem_file:
            st.error("画像が足りません")
        else:
            problem_image = Image.open(problem_file)
            conversation_context = ""
            for msg in st.session_state.messages:
                if msg["role"] in ["user", "assistant"]:
                    role_name = "先生" if msg["role"] == "user" else "マナブ"
                    conversation_context += f"{role_name}: {msg.get('content', '')}\n"

            with st.status("マナブが挑戦中...", expanded=True):
                solution, score, reaction, knowledge_summary = st.session_state.ai_client.execute_drill(
                    problem_image, 
                    st.session_state.answer_key_image,
                    conversation_context
                )
            
            st.session_state.messages.append({
                "role": "drill_result", "problem": problem_image, "solution": solution,
                "score": score, "reaction": reaction, "knowledge": knowledge_summary
            })
            st.rerun()
    
    # --- システムボタン ---
    st.divider()
    if st.button("🗑️ 次の科目へ (リセット)", use_container_width=True):
        st.session_state.messages = [{"role": "assistant", "content": "お、次はなんの勉強する？"}]
        st.session_state.answer_key_image = None
        st.session_state.uploader_key += 1
        st.session_state.start_time = time.time()
        st.rerun()
    
    if st.button("🚪 帰る", use_container_width=True):
        st.session_state.class_started = False
        st.session_state.messages = [{"role": "assistant", "content": "ういーっす。"}]
        st.rerun()

# --- チャット履歴の表示 (時間切れでも表示する) ---
for msg in st.session_state.messages:
    role = msg["role"]
    if role == "user":
        with st.chat_message("user"): 
            st.write(msg["content"])
            if "image" in msg and msg["image"]: st.image(msg["image"], width=200)
    elif role == "assistant":
        with st.chat_message("assistant", avatar="🧑‍🎓"): st.write(msg["content"])
    elif role == "drill_result":
        with st.chat_message("assistant", avatar="📝"):
            st.subheader("ドリル結果")
            st.image(msg["problem"], caption="問題", width=250)
            with st.expander("答案用紙"): st.write(msg["solution"])
            score = msg["score"]
            color = "green" if score >= 80 else "orange" if score >= 40 else "red"
            st.markdown(f"### 点数: :{color}[{score}点]")
            st.info(f"「{msg['reaction']}」")

# --- 時間判定による入力制御 ---
st.write("---")

if remaining_time > 0:
    # ▼▼▼ 時間内の場合：入力フォームを表示 ▼▼▼
    with st.expander("🖼️ 教材画像"):
        teaching_image_file = st.file_uploader("画像", type=["jpg", "png"], key=f"teach_{st.session_state.uploader_key}")
        teaching_image = Image.open(teaching_image_file) if teaching_image_file else None
        if teaching_image: st.image(teaching_image, width=150)

    col1, col2 = st.columns([1, 5])
    with col1:
        audio_input = mic_recorder(start_prompt="●", stop_prompt="■", just_once=True, key='recorder')
    with col2:
        user_text = st.chat_input("マナブに教える...")
        
    # --- 送信処理 (時間内のみ実行) ---
    input_content = None
    input_type = None
    if user_text:
        input_content = user_text; input_type = "text"
    elif audio_input:
        input_content = audio_input['bytes']; input_type = "audio"

    if input_content:
        # メッセージ表示
        with st.chat_message("user"):
            if input_type == "text": st.write(user_text)
            else: st.audio(input_content, format="audio/wav"); st.write("（音声）")
            if teaching_image: st.image(teaching_image, width=200)
        
        user_msg_log = {"role": "user", "content": user_text if user_text else "（音声入力）"}
        if teaching_image: user_msg_log["image"] = teaching_image
        st.session_state.messages.append(user_msg_log)

        # AI応答の表示
        with st.chat_message("assistant", avatar="🧑‍🎓"):
            with st.spinner("思考中..."):
                if input_type == "text":
                    resp = st.session_state.ai_client.generate_response(user_input=user_text, image=teaching_image)
                else:
                    resp = st.session_state.ai_client.generate_response(user_input=None, image=teaching_image, audio_bytes=input_content)
                
                st.write(resp)

                # ▼▼▼ 追加: 音声再生ロジック ▼▼▼
                # AIがしゃべる！
                audio_data = st.session_state.ai_client.text_to_speech(resp)
                if audio_data:
                    # autoplay=True で自動再生（ブラウザによってはブロックされる可能性あり）
                    st.audio(audio_data, format="audio/mp3", autoplay=True)
                # ▲▲▲ 追加終わり ▲▲▲

        st.session_state.messages.append({"role": "assistant", "content": resp})

else:
    # ▼▼▼ 時間切れの場合：終了メッセージのみ表示 ▼▼▼
    st.error("⏰ **キーンコーンカーンコーン！ 授業終了です。**")
    st.info("これ以上話しかけることはできませんが、**「ドリル実行」は可能です**。左のサイドバーからテストを行ってください。")