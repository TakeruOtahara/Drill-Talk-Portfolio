// --- v3-app/frontend/src/app/page.tsx ---
"use client";

import { useManabu } from "@/hooks/useManabu";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ManabuAvatar } from "@/components/ManabuAvatar";
import { NotebookModal } from "@/components/NotebookModal";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { useRef, useState, useEffect, useCallback } from "react";
import { RefreshCcw, ShieldCheck, BookOpen } from "lucide-react";

export default function Home() {
  const MAX_MEMO_LENGTH = 1000;
  const MAX_FILES = 5; 
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const [showTutorial, setShowTutorial] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isListeningState, setIsListeningState] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [memoText, setMemoText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadError = useCallback(() => {
    setImagePreviews([]);
    setLessonStarted(false);
  }, []);

  const { 
    notebook, missingPoints, misconceptions, setNotebook,
    emotion, isAnalyzing, setIsAnalyzing, 
    isBackendThinking, setIsBackendThinking, 
    isManabuSpeaking, setIsManabuSpeaking,
    questionQueue,
    sendMessage, speak, cancelSpeak 
  } = useManabu({ 
    isListening: isListeningState, 
    onError: handleLoadError 
  });

  const { isListening, toggleListening } = useSpeechToText(
    (text) => {
      if (isManabuSpeaking) return;

      const hasQueuedQuestion = questionQueue.current.length > 0;

      sendMessage("USER_TALK", { 
        text, 
        skip_reaction: hasQueuedQuestion || isBackendThinking 
      });

      if (hasQueuedQuestion) {
        const questionText = questionQueue.current.shift();
        
        if (isListening) toggleListening(); 
        setIsManabuSpeaking(true);

        if (questionText) {
            speak(questionText, () => {
                setIsManabuSpeaking(false);
                toggleListening(); 
            });
        }
      } else if (!isBackendThinking) {
        setIsBackendThinking(true);
      }
    },
    () => { 
      if (!isBackendThinking && isListening && !isManabuSpeaking) cancelSpeak(); 
    },
    () => {} 
  );

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("drilltalk_tutorial_v31");
    if (!hasSeenTutorial) setShowTutorial(true);
  }, []);

  const completeTutorial = () => {
    localStorage.setItem("drilltalk_tutorial_v31", "true");
    setShowTutorial(false);
  };

  useEffect(() => { setIsListeningState(isListening); }, [isListening]);

  // 💡【修正箇所1】タイマー終了時の重複実行を isFinishing フラグで確実に防ぐ
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isListening && !isManabuSpeaking && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    if (timeLeft === 0 && lessonStarted && !isFinishing) {
      handleFinish();
    }
    return () => clearInterval(timer);
  }, [isListening, isManabuSpeaking, timeLeft, lessonStarted, isFinishing]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`${file.name} は未対応の形式です。`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name} は10MBを超えています。`);
        continue;
      }
      validFiles.push(file);
    }

    const finalFiles = validFiles.slice(0, MAX_FILES);
    if (finalFiles.length === 0) return;

    setIsAnalyzing(true);
    const previews: string[] = [];
    const base64Strings: string[] = [];
    let processedCount = 0;

    finalFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        previews.push(result);
        base64Strings.push(result.split(",")[1]);
        processedCount++;
        if (processedCount === finalFiles.length) {
          setImagePreviews(previews);
          sendMessage("INIT_MATERIAL", { images_base64: base64Strings });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // 💡【修正箇所2】二重クリックやタイマーとの衝突を防ぐガード節を追加
  const handleFinish = () => {
    if (isFinishing) return; // すでに終了処理中なら弾く
    
    setIsFinishing(true); 
    if (isListening) toggleListening();
    sendMessage("FINISH_LECTURE", { user_memo: memoText });
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
    sendMessage("RESTART_LECTURE", {});
  };

  const handleForceReset = () => {
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
    sendMessage("RESTART_LECTURE", {}); 
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-slate-900 overflow-hidden relative">
      
      {showTutorial && <TutorialOverlay onComplete={completeTutorial} />}

      <main className="flex-1 flex flex-col items-center justify-center p-4 relative bg-white">
        
        {lessonStarted && (
          <div className="absolute top-8 text-5xl font-mono font-bold text-slate-300 tracking-tighter">
            {Math.floor(timeLeft/60)}:{(timeLeft%60).toString().padStart(2, "0")}
          </div>
        )}

        <div className="w-full max-w-4xl flex flex-col items-center justify-center gap-12 flex-1 py-12">
          
          <div className="text-center w-64 flex-shrink-0 animate-in fade-in zoom-in duration-700 relative">
            <ManabuAvatar 
              emotion={isAnalyzing ? "confused" : (isBackendThinking || isFinishing ? "excited" : emotion)} 
              isListening={isListening && !isBackendThinking && !isManabuSpeaking} 
              className="w-full h-auto drop-shadow-2xl relative z-10" 
            />
            
            {/* 先生が話している時の青いオーラ */}
            {isListening && !isBackendThinking && !isManabuSpeaking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full blur-[80px] opacity-10 animate-pulse z-0"></div>
            )}

            {/* マナブ君が話している時の緑のオーラ */}
            {isManabuSpeaking && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500 rounded-full blur-[80px] opacity-20 animate-pulse z-0"></div>
            )}
          </div>

          {/* 教材プレビュー */}
          {imagePreviews.length > 0 && !lessonStarted && (
            <div className="flex flex-wrap gap-3 justify-center animate-in slide-in-from-bottom-4 duration-500 max-w-lg">
              {imagePreviews.map((src, i) => (
                <div key={i} className="p-1.5 bg-white rounded-xl shadow-sm border border-slate-100 ring-1 ring-slate-200/50">
                  <img src={src} className="h-20 sm:h-24 object-contain rounded-lg" alt={`教材${i+1}`} />
                </div>
              ))}
            </div>
          )}

          <div className="w-full max-w-md flex flex-col gap-4">
            {imagePreviews.length === 0 ? (
              <>
                <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="px-8 py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all active:scale-95">
                  教材をアップロード (最大5枚)
                </button>
              </>
            ) : !lessonStarted ? (
              <button disabled={isAnalyzing} onClick={() => { setLessonStarted(true); toggleListening(); }} className="px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 active:scale-95">
                {isAnalyzing ? "マナブ君が読み込み中..." : "画像を見ずに授業を開始"}
              </button>
            ) : (
              <div className="flex gap-4">
                <button onClick={toggleListening} disabled={isManabuSpeaking} className={`flex-1 px-6 py-5 rounded-2xl font-black text-white shadow-xl ${isManabuSpeaking ? "bg-slate-300 shadow-none cursor-not-allowed" : isListening ? "bg-amber-500 shadow-amber-100 hover:bg-amber-600" : "bg-blue-600 shadow-blue-100 hover:bg-blue-700"} transition-all active:scale-95`}>
                  {isManabuSpeaking ? "マナブ君が発言中..." : isListening ? "一時停止" : "説明を再開"}
                </button>
                <button onClick={handleFinish} className="flex-1 px-6 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95">
                  評価ノートへ
                </button>
              </div>
            )}
            
            {imagePreviews.length > 0 && (
              <button onClick={handleForceReset} className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors py-2">
                <RefreshCcw className="w-3.5 h-3.5" /> 教材を破棄して最初から
              </button>
            )}
          </div>
        </div>
      </main>

      <aside className="w-80 bg-slate-50/50 border-l p-6 flex flex-col shadow-inner flex-shrink-0">
        <h2 className="text-lg font-black mb-4 flex items-center justify-between text-slate-700">
          <span className="flex items-center gap-2">忘れたことメモ 📝</span>
          <span className={`text-[10px] font-mono px-2 py-1 rounded-md ${memoText.length >= MAX_MEMO_LENGTH ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
            {memoText.length}/{MAX_MEMO_LENGTH}
          </span>
        </h2>
        <textarea 
          value={memoText} 
          onChange={(e) => { if (e.target.value.length <= MAX_MEMO_LENGTH) setMemoText(e.target.value); }} 
          placeholder="説明中に「あ、これ言い忘れた！」と思ったことを自由にメモしてください。マナブ君が評価に反映します。" 
          className="flex-1 p-4 border-none rounded-2xl resize-none bg-white text-sm leading-relaxed focus:ring-4 focus:ring-blue-100 outline-none shadow-sm placeholder:text-slate-300 font-medium" 
        />
        <div className="mt-4 p-3 rounded-xl bg-blue-50/50 border border-blue-100">
          <p className="text-[10px] text-blue-500/80 leading-tight flex items-center gap-1.5 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" /> 
            安全な入力保護：HTMLタグは自動的にエスケープされ、セッション終了後にデータは破棄されます。
          </p>
        </div>
      </aside>

      <button 
        onClick={() => setShowTutorial(true)}
        className="fixed bottom-8 left-8 p-3.5 bg-white rounded-full shadow-lg border border-slate-100 hover:bg-slate-50 hover:scale-110 transition-all active:scale-90 z-50 text-slate-400 group"
        title="使い方を見る"
      >
        <BookOpen className="w-6 h-6 group-hover:text-blue-500 transition-colors" />
      </button>

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