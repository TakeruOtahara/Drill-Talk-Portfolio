"use client";

import { useManabu } from "@/hooks/useManabu";
import { useSpeechToText } from "@/hooks/useSpeechToText";
import { ManabuAvatar } from "@/components/ManabuAvatar";
import { NotebookModal } from "@/components/NotebookModal";
import { useRef, useState, useEffect } from "react";

export default function Home() {
  const { themes, emotion, notebook, isAnalyzing, setIsAnalyzing, sendMessage } = useManabu();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 5分タイマーの状態 ---
  const [timeLeft, setTimeLeft] = useState(300); // 300秒 = 5分
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { isListening, toggleListening } = useSpeechToText((text) => {
    sendMessage("USER_TALK", { text });
  });

  // タイマーのカウントダウン処理
  useEffect(() => {
    if (isListening && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    // 0秒になったら自動終了
    if (timeLeft === 0) {
      handleFinish();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isListening, timeLeft]);

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
    if (isListening) toggleListening();
    sendMessage("FINISH_LECTURE", {});
  };

  const handleRestart = () => {
    setTimeLeft(300); // タイマーリセット
    sendMessage("RESTART_LECTURE", {});
  };

  // 秒数を「分:秒」に変換
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 font-sans text-slate-900 overflow-hidden">
      {/* メインエリア */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* タイマー表示 */}
        {themes.length > 0 && (
          <div className={`absolute top-8 text-4xl font-mono font-bold ${timeLeft < 60 ? "text-red-500 animate-pulse" : "text-slate-400"}`}>
            {formatTime(timeLeft)}
          </div>
        )}

        <div className="mb-12 text-center">
          <ManabuAvatar emotion={isAnalyzing ? "confused" : emotion} />
          {isAnalyzing && (
            <p className="mt-4 text-blue-600 font-bold animate-pulse">教材を読み取っています...</p>
          )}
        </div>

        <div className="flex gap-4">
          {themes.length === 0 ? (
            <>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-emerald-600 text-white rounded-full font-bold shadow-lg hover:bg-emerald-700 transition-all">
                教材を読み込ませる
              </button>
            </>
          ) : (
            <>
              <button
                onClick={toggleListening}
                className={`px-8 py-4 rounded-full font-bold text-white transition-all shadow-lg ${
                  isListening ? "bg-red-500 scale-105" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isListening ? "授業を一時停止" : "授業をはじめる"}
              </button>
              
              <button onClick={handleFinish} className="px-8 py-4 bg-slate-800 text-white rounded-full font-bold shadow-lg hover:bg-slate-900 transition-all">
                本領発揮！（終了）
              </button>
            </>
          )}
        </div>
      </main>

      {/* サイドバー：テーマリスト */}
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

      {/* ノートモーダル */}
      {notebook && <NotebookModal notebook={notebook} onRestart={handleRestart} />}
    </div>
  );
}