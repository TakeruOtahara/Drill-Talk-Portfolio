// --- v3-app/frontend/src/app/page.tsx ---
"use client";

import { useManabu } from "@/hooks/useManabu";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ManabuAvatar } from "@/components/ManabuAvatar";
import { NotebookModal } from "@/components/NotebookModal";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { SquirrelLoader } from "@/components/SquirrelLoader"; // 💡 追加
import { useRef, useState, useEffect, useCallback } from "react";
import { RefreshCcw, ShieldCheck, BookOpen, Loader2, MessageSquareText, X } from "lucide-react";
import { useVoiceActivity } from "@/hooks/useVoiceActivity";

export default function Home() {
  const MAX_FILES = 5; 

  // --- States ---
  const [showTutorial, setShowTutorial] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isListeningState, setIsListeningState] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [memoText, setMemoText] = useState("");
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const isUserSpeaking = useVoiceActivity(isListeningState);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetCallbackRef = useRef<() => void>(() => {});

  // 💡 エラーハンドラ：解析失敗時に状態を戻す
  const handleLoadError = useCallback(() => {
    setLessonStarted(false);
  }, []);

  // --- Custom Hooks ---
  const { 
    notebook, missingPoints, misconceptions, setNotebook,
    emotion, isAnalyzing, setIsAnalyzing, 
    isBackendThinking, setIsBackendThinking, 
    isManabuSpeaking, setIsManabuSpeaking,
    questionQueue,
    sendMessage, speak, cancelSpeak,
    unlockAudio 
  } = useManabu({
    isListening: isListeningState, 
    onError: handleLoadError,
    onReset: () => resetCallbackRef.current()
  });

  const { isListening, toggleListening } = useSpeechToText(
    (text) => {
      // 🛡️ 内部ガードにより、マナブの発言中や終了処理中は送信しない
      if (isManabuSpeaking || isFinishing) return;
      
      const hasQueuedQuestion = questionQueue.current.length > 0;
      sendMessage("USER_TALK", { 
        text, 
        skip_reaction: hasQueuedQuestion || isBackendThinking 
      });

      if (hasQueuedQuestion) {
        const questionText = questionQueue.current.shift();
        
        // 🛡️ isManabuSpeaking を true にするだけで hooks が物理的にマイクを一時停止する。
        setIsManabuSpeaking(true);
        if (questionText) {
            speak(questionText, () => {
                // 🛡️ 喋り終われば hooks が isListening を見て自動でマイクを再開する
                setIsManabuSpeaking(false);
            });
        }
      } else if (!isBackendThinking) {
        setIsBackendThinking(true);
      }
    },
    // onSpeechStart: ユーザーが喋り始めたらマナブを黙らせる
    () => { 
      if (!isBackendThinking && isListening && !isManabuSpeaking) {
        cancelSpeak(); 
      }
    },
    undefined,       // onInterimResult
    isManabuSpeaking // 🛡️ 第4引数：現在の喋り状態を渡し、エコーバックを物理遮断
  );

  // --- Handlers ---
  const handleStartLesson = async () => {
    await unlockAudio(); 
    setLessonStarted(true);
    toggleListening(); // ユーザーの意思として「ON」にする
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    
    setIsAnalyzing(true);
    const previews: string[] = [];
    const base64Strings: string[] = [];
    let processedCount = 0;
    const targetFiles = files.slice(0, MAX_FILES);

    targetFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200; 
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          previews.push(compressedBase64);
          base64Strings.push(compressedBase64.split(",")[1]);
          processedCount++;
          if (processedCount === targetFiles.length) {
            setImagePreviews(previews);
            sendMessage("INIT_MATERIAL", { images_base64: base64Strings });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // --- 💡 ライフサイクル：LocalStorageからの最強復旧 ---
  useEffect(() => {
    const savedStructured = localStorage.getItem("dt_structured");
    const savedOriginal = localStorage.getItem("dt_original");
    const savedMemo = localStorage.getItem("dt_memo");
    const savedNotebook = localStorage.getItem("dt_notebook");
    const savedTime = localStorage.getItem("dt_time");

    if (savedMemo) setMemoText(savedMemo);
    if (savedTime) setTimeLeft(parseInt(savedTime));

    if (savedStructured && savedOriginal) {
      setLessonStarted(true);
      setImagePreviews(["/analyzed-placeholder.png"]); 
      if (savedNotebook) {
        setIsFinishing(true); 
      }
    }

    const hasSeenTutorial = localStorage.getItem("drilltalk_tutorial_v31");
    if (!hasSeenTutorial) setShowTutorial(true);
  }, []);

  const completeTutorial = () => {
    localStorage.setItem("drilltalk_tutorial_v31", "true");
    setShowTutorial(false);
  };

  // 意思としての isListening を state に同期
  useEffect(() => { setIsListeningState(isListening); }, [isListening]);

  // 💡 タイマー：毎秒保存してリフレッシュに耐える
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isListening && !isManabuSpeaking && !isFinishing && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const next = prev - 1;
          localStorage.setItem("dt_time", next.toString());
          return next;
        });
      }, 1000);
    }
    if (timeLeft === 0 && lessonStarted && !isFinishing) {
      handleFinish();
    }
    return () => clearInterval(timer);
  }, [isListening, isManabuSpeaking, timeLeft, lessonStarted, isFinishing]);

  const handleFinish = () => {
    if (isFinishing) return; 
    setIsFinishing(true); 
    if (isListening) toggleListening();
    sendMessage("FINISH_LECTURE", { user_memo: memoText });
  };

  const clearAllData = () => {
    const keys = ["dt_structured", "dt_original", "dt_history", "dt_notebook", "dt_missing", "dt_misconception", "dt_memo", "dt_time"];
    keys.forEach(k => localStorage.removeItem(k));
  };

  const handleRestartSession = () => {
    cancelSpeak();
    setNotebook("");
    setIsFinishing(false);
    setIsBackendThinking(false);
    setIsManabuSpeaking(false);
    setTimeLeft(300);
    setLessonStarted(false);
    setMemoText("");
    if (isListening) toggleListening();
    clearAllData();
    sendMessage("RESTART_LECTURE", {});
  };

  const handleForceReset = useCallback(() => {
    cancelSpeak();
    setNotebook("");
    setIsFinishing(false);
    setIsBackendThinking(false);
    setIsManabuSpeaking(false);
    setIsAnalyzing(false); 
    setTimeLeft(300);
    setLessonStarted(false); 
    setImagePreviews([]); 
    setMemoText("");
    if (isListening) toggleListening(); 
    clearAllData();
    sendMessage("RESTART_LECTURE", {}); 
  }, [cancelSpeak, isListening, toggleListening]); // 依存配列に注意
  
  useEffect(() => {
    resetCallbackRef.current = handleForceReset;
  }, [handleForceReset]);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-zinc-50 font-sans text-slate-900 overflow-x-hidden relative">
      
      {showTutorial && <TutorialOverlay onComplete={completeTutorial} />}

      <main className="flex-1 flex flex-col items-center justify-center p-4 min-h-screen relative bg-white order-1 lg:order-1">
        
        {/* ⏲️ タイマー表示 */}
        {lessonStarted && (
          <div className="absolute top-4 lg:top-8 text-4xl lg:text-5xl font-mono font-bold text-slate-300 tracking-tighter">
            {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, "0")}
          </div>
        )}

        <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-8 lg:gap-12 flex-1 py-12">
          
          <div className="text-center w-48 lg:w-64 flex-shrink-0 animate-in fade-in zoom-in duration-700 relative">
            <ManabuAvatar 
              emotion={isAnalyzing ? "confused" : (isBackendThinking || isFinishing ? "excited" : emotion)} 
              isListening={isUserSpeaking && !isBackendThinking && !isManabuSpeaking}
              className="w-full h-auto drop-shadow-2xl relative z-10" 
            />
            
            {/* 💡 青い光（ヒアリング中） */}
            {isListening && !isBackendThinking && !isManabuSpeaking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 lg:w-96 lg:h-96 bg-blue-600 rounded-full blur-[60px] opacity-30 animate-pulse z-0"></div>
            )}
            
            {/* 💡 緑の光（マナブ君発言中） */}
            {isManabuSpeaking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 lg:w-96 lg:h-96 bg-emerald-500 rounded-full blur-[60px] opacity-30 animate-pulse z-0"></div>
            )}
          </div>

          <div className="w-full max-w-md px-4 flex flex-col gap-4">
            {imagePreviews.length === 0 ? (
              <>
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="px-8 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95">
                  教材をアップロード
                </button>
              </>
            ) : !lessonStarted ? (
              <div className="relative w-full inline-flex justify-center">
                <SquirrelLoader isVisible={isAnalyzing} />
                <button 
                  disabled={isAnalyzing} 
                  onClick={handleStartLesson} 
                  className="relative z-10 w-full px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
                >
                  {isAnalyzing ? "マナブ君が読み込み中..." : "準備OK！特訓開始"}
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={toggleListening} 
                  disabled={isManabuSpeaking || isFinishing} 
                  className={`flex-1 px-6 py-5 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 ${
                    (isManabuSpeaking || isFinishing)
                      ? "bg-slate-300 shadow-none cursor-not-allowed" 
                      : isListening ? "bg-amber-500 shadow-amber-100" : "bg-blue-600 shadow-blue-100"
                  }`}
                >
                  {isManabuSpeaking ? "マナブ君が発言中..." : isFinishing ? "待機中..." : isListening ? "一時停止" : "説明を再開"}
                </button>
                <div className="relative flex-1 flex justify-center">
                  <SquirrelLoader isVisible={isFinishing} />
                  <button 
                    onClick={handleFinish} 
                    disabled={isFinishing} 
                    className={`relative z-10 w-full px-6 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl transition-all flex items-center justify-center gap-2 ${
                      isFinishing ? "opacity-70 cursor-wait" : "active:scale-95"
                    }`}
                  >
                    {isFinishing && <Loader2 className="w-5 h-5 animate-spin" />}
                    {isFinishing ? "書込中..." : "評価ノートへ"}
                  </button>
                </div>
              </div>
            )}
            
            {imagePreviews.length > 0 && (
              <button onClick={handleForceReset} className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-2">
                <RefreshCcw className="w-3.5 h-3.5" /> 最初からやり直す
              </button>
            )}
          </div>
        </div>
      </main>

      {/* 📱 モバイル用メモ展開ボタン */}
      {lessonStarted && (
        <button 
          onClick={() => setIsMemoOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform"
        >
          <MessageSquareText className="w-6 h-6" />
        </button>
      )}

      {/* 📝 サイドバー：メモ入力欄 */}
      <aside className={`
        fixed lg:static inset-y-0 right-0 w-full sm:w-80 bg-white lg:bg-slate-50/50 border-l p-6 flex flex-col z-50 transition-transform duration-300 ease-in-out
        ${isMemoOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-700">忘れたことメモ 📝</h2>
          <button onClick={() => setIsMemoOpen(false)} className="lg:hidden p-2 text-slate-400">
            <X className="w-6 h-6" />
          </button>
        </div>
        <textarea 
          value={memoText} 
          disabled={isFinishing}
          onChange={(e) => {
            const val = e.target.value;
            setMemoText(val);
            localStorage.setItem("dt_memo", val);
          }} 
          placeholder="言い忘れたことをメモしてください。" 
          className="flex-1 p-4 border rounded-2xl resize-none bg-white text-sm focus:ring-4 focus:ring-blue-100 outline-none font-medium disabled:bg-slate-50" 
        />
        <div className="mt-4 p-3 rounded-xl bg-blue-50/50 text-[10px] text-blue-500 font-bold">
          <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> 入力内容は自動保存されます
        </div>
      </aside>

      {/* 📚 チュートリアルボタン */}
      <button 
        onClick={() => setShowTutorial(true)}
        className="fixed bottom-8 lg:right-8 left-8 lg:left-auto p-3.5 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:scale-110 transition-all active:scale-90 z-50 text-slate-400 group"
      >
        <BookOpen className="w-6 h-6 group-hover:text-blue-500 transition-colors" />
      </button>

      {/* 📓 評価ノート（モーダル） */}
      {notebook && (
        <NotebookModal 
          notebook={notebook} 
          missingPoints={missingPoints} 
          misconceptions={misconceptions} 
          onRestart={handleRestartSession} 
          isRestarting={false} 
        />
      )}
    </div>
  );
}