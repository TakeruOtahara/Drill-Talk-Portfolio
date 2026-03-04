"use client";

import { useManabu } from "@/hooks/useManabu";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ManabuAvatar } from "@/components/ManabuAvatar";
import { NotebookModal } from "@/components/NotebookModal";
import { useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function Home() {
  // --- 状態管理 ---
  const [timeLeft, setTimeLeft] = useState(300);
  const [isListeningState, setIsListeningState] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    themes, emotion, notebook, setNotebook, 
    isAnalyzing, setIsAnalyzing, isThinking, setIsThinking, 
    sendMessage, cancelSpeak 
  } = useManabu(isListeningState);

  // --- 修正された音声認識：考え中のシャットアウトと2回目以降の安定化 ---
  const { isListening, toggleListening } = useSpeechToText(
    // 確定結果（Final）
    (text) => {
      if (isThinking) return;

      // 質問キーワード検知（より確実に配列でチェック）
      const isQuestion = ["質問ある", "しつもんある", "わからないところ"].some(q => text.includes(q));
      
      if (isQuestion) {
        setIsThinking(true);      // 1. ロック開始
        setCurrentTranscript(""); // 2. 字幕を即座にクリア
        sendMessage("USER_TALK", { text }); // 3. バックエンドに送信
        return; // 思考モードに入るため、ここから下の通常処理は行わない
      }
      
      // 通常の発話処理
      sendMessage("USER_TALK", { text });
      setCurrentTranscript(text);
      
      // 3秒後に「その言葉がまだ最新なら」字幕を消す（歯切れの良さを向上）
      setTimeout(() => {
        setCurrentTranscript(prev => prev === text ? "" : prev);
      }, 3000);
    },
    // 発話開始（Sound Start）
    () => {
      // 考え中でなければ、マナブ君の相槌を即座に止める
      if (!isThinking) cancelSpeak(); 
    },
    // 暫定結果（Interim：パタパタ書き換わっている時）
    (interimText) => {
      // 考え中なら字幕を表示させない（シャットアウト感の演出）
      if (!isThinking) {
        setCurrentTranscript(interimText);
      }
    }
  );

  // ステート同期
  useEffect(() => {
    setIsListeningState(isListening);
  }, [isListening]);

  // ノートが届いた時の処理
  useEffect(() => {
    if (notebook) {
      setIsFinishing(false);
      setIsRestarting(false);
      setIsThinking(false);
      setCurrentTranscript(""); 
    }
  }, [notebook]);

  // タイマー管理
  useEffect(() => {
    if (isListening && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    if (timeLeft === 0) handleFinish();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isListening, timeLeft]);

  // --- ハンドラー ---
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      sendMessage("INIT_MATERIAL", { image_base64: base64String });
    };
    reader.readAsDataURL(file);
  };

  const handleFinish = () => {
    setIsFinishing(true); 
    if (isListening) toggleListening();
    sendMessage("FINISH_LECTURE", {});
  };

  // 【強化版】handleRestart：2回目以降も確実に動作させるためのクリーンアップ
  const handleRestart = () => {
    cancelSpeak(); // マナブ君の声を物理的に停止
    setNotebook(""); 
    setIsRestarting(false);
    setIsFinishing(false);
    setIsThinking(false);
    setCurrentTranscript(""); // 字幕を確実に消去
    setTimeLeft(300); // タイマーリセット
    sendMessage("RESTART_LECTURE", {});
    
    // 1秒待ってからマイクをオンにする（WebSocketのセッション安定化のため）
    setTimeout(() => {
      if (!isListening) toggleListening();
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-slate-900 overflow-hidden">
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* タイマー表示 */}
        {themes.length > 0 && (
          <div className={`absolute top-8 text-4xl font-mono font-bold ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        <div className="mb-12 text-center w-full max-w-2xl">
          <ManabuAvatar 
            emotion={isAnalyzing ? "confused" : (isThinking || isFinishing ? "excited" : emotion)} 
            isListening={isListening && !isThinking} 
          />
          
          {/* 字幕エリア：考え中は透明にする */}
          <div className="mt-4 min-h-[3rem] px-6">
            <p className={`text-lg font-medium transition-all duration-200 ${isThinking ? "opacity-0" : "opacity-100 text-slate-600"}`}>
              {currentTranscript || (isListening ? "マナブ君が聴いています..." : "")}
            </p>
          </div>

          <div className="h-12 flex flex-col items-center justify-center">
            {isAnalyzing && <p className="text-blue-600 font-bold animate-pulse">教材を読み取っています...</p>}
            {isThinking && (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <p className="text-purple-600 font-bold animate-pulse">マナブが考え中...</p>
              </div>
            )}
            {isFinishing && <p className="text-purple-600 font-bold animate-pulse">マナブがノートをまとめています...</p>}
          </div>
        </div>

        <div className="flex gap-4">
          {themes.length > 0 ? (
            <>
              <button
                disabled={isFinishing || isThinking || isRestarting}
                onClick={toggleListening}
                className={`px-8 py-4 rounded-full font-bold text-white transition-all shadow-lg ${
                  isListening ? "bg-red-500 scale-105" : "bg-blue-600 hover:bg-blue-700"
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {isListening ? "授業を一時停止" : "授業をはじめる"}
              </button>
              
              <button 
                disabled={isFinishing || isThinking || isRestarting}
                onClick={handleFinish} 
                className="px-8 py-4 bg-slate-800 text-white rounded-full font-bold shadow-lg hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isFinishing && <Loader2 className="w-5 h-5 animate-spin" />}
                {isFinishing ? "本領発揮中..." : "本領発揮！（終了）"}
              </button>
            </>
          ) : (
            <>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-emerald-600 text-white rounded-full font-bold shadow-lg hover:bg-emerald-700 transition-all">
                教材を読み込ませる
              </button>
            </>
          )}
        </div>
      </main>

      <aside className="w-80 bg-white border-l border-zinc-200 p-6 flex flex-col shadow-sm">
        <h2 className="text-xl font-bold mb-6 border-b pb-2">今日のテーマ</h2>
        <ul className="space-y-4">
          {themes.map((theme, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className={`text-xl ${theme.includes("[OK]") ? "text-green-500" : "text-zinc-300"}`}>
                {theme.includes("[OK]") ? "●" : "○"}
              </span>
              <span className={`text-sm font-medium ${theme.includes("[OK]") ? "text-slate-400 line-through" : "text-slate-700"}`}>
                {theme.replace("[?]", "").replace("[OK]", "")}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {notebook && <NotebookModal notebook={notebook} onRestart={handleRestart} isRestarting={isRestarting} />}
    </div>
  );
}