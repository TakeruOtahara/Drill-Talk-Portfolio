"use client";

import { useState, useEffect, useRef } from "react"; // ★修正: useRefを追加
import { useDrillSocket } from "../hooks/useDrillSocket";
import { useVAD } from "../hooks/useVAD";

interface Props {
  onHistoryUpdate: (text: string) => void;
  onClassFinished: () => void;
  onReset: () => void;
}

const CLASS_TIME_SEC = 20 * 60;

export default function Classroom({ onHistoryUpdate, onClassFinished, onReset }: Props) {
  const [isStarted, setIsStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CLASS_TIME_SEC);
  const [aiStatus, setAiStatus] = useState("Ready");
  const [aiReply, setAiReply] = useState("");
  
  // ★修正: 再生中の音声を管理するための箱（Ref）を作成
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // WebSocket Logic
  const { isConnected, sendAudioData } = useDrillSocket((data) => {
    setAiStatus("Speaking...");
    setAiReply(data.reply);
    // ★修正: サーバーから summary が送られてきたら、それを履歴に残す
    // summaryが空（挨拶など）の場合は、とりあえず "(Voice)" としておくか、何も残さない
    const teacherText = (data as any).summary ? (data as any).summary : "(Voice)";
    onHistoryUpdate(`Teacher: ${teacherText}\nStudent: ${data.reply}`);

    if (data.audio) {
      // ★修正: すでに鳴っている声があれば止める
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audioRef.current = audio; // ★修正: 今から鳴らす声を箱に入れる

      audio.onended = () => {
        setAiStatus("Listening...");
        audioRef.current = null; // 終わったら箱を空にする
      };
      audio.play();
    }
  });

  // VAD Logic
  const { isSpeaking, volume } = useVAD((audioBlob) => {
    if (isConnected) {
      setAiStatus("Thinking...");
      sendAudioData(audioBlob);
    }
  }, isStarted);

  // Timer Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isStarted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsStarted(false);
      onClassFinished();
      // ★修正: 時間切れの際も声を止める
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      alert("授業終了！お疲れ様でした。");
    }
    return () => clearInterval(timer);
  }, [isStarted, timeLeft, onClassFinished]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleReset = () => {
    if (confirm("授業を中断してリセットしますか？\n会話履歴も消去されます。")) {
      // ★修正: リセットボタンが押された瞬間に声を止める
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }

      setIsStarted(false);
      setTimeLeft(CLASS_TIME_SEC);
      setAiReply("");
      onReset();
    }
  };

  // --- 以降のReturn文（UI部分）は変更なし ---
  return (
    <div className="w-full max-w-2xl flex flex-col items-center py-4">
      {/* ... (既存のUIコード) ... */}
      <div className="w-full bg-slate-800/50 backdrop-blur-md rounded-3xl border border-slate-700 p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="flex justify-between items-center mb-10">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                isConnected 
                ? "bg-green-500/10 border-green-500/30 text-green-400" 
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                <span className="text-xs font-bold tracking-wider">{isConnected ? aiStatus.toUpperCase() : "OFFLINE"}</span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">REMAINING TIME</span>
                <span className={`font-mono text-2xl font-bold tracking-tight ${timeLeft < 60 ? "text-red-400" : "text-white"}`}>
                    {formatTime(timeLeft)}
                </span>
            </div>
        </div>
        <div className="flex justify-center mb-10 relative z-10">
          {!isStarted ? (
            <button
              onClick={() => setIsStarted(true)}
              className="group relative w-36 h-36 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 transition-all shadow-xl hover:shadow-blue-500/40 flex flex-col items-center justify-center active:scale-95"
            >
              <div className="absolute inset-0 rounded-full animate-pulse-glow opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="text-5xl mb-2 filter drop-shadow-md">🎙️</span>
              <span className="text-sm font-bold text-white tracking-widest">START</span>
            </button>
          ) : (
            <div className="relative w-40 h-40 flex items-center justify-center">
              {isSpeaking && (
                <>
                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping"></div>
                  <div className="absolute inset-2 rounded-full bg-cyan-400/10 animate-ping delay-75"></div>
                </>
              )}
              <div className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl border-4 ${
                isSpeaking 
                  ? "bg-cyan-500 border-cyan-200 shadow-cyan-500/50 scale-105" 
                  : "bg-slate-700 border-slate-600"
              }`}>
                <span className="text-5xl transition-transform duration-100" style={{ transform: `scale(${1 + volume * 1.5})` }}>
                  {isSpeaking ? "🗣️" : "👂"}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="relative w-full">
          {aiReply ? (
             <div className="bg-slate-900/50 rounded-2xl border-l-4 border-blue-500 p-6 shadow-inner animate-fade-in">
                <p className="text-xs text-blue-400 font-bold mb-2 tracking-widest uppercase">Student Response</p>
                <p className="text-lg text-slate-100 font-medium leading-relaxed">
                    "{aiReply}"
                </p>
             </div>
          ) : (
             <div className="text-center py-6">
                <p className="text-slate-500 text-sm">
                   {!isStarted ? "STARTボタンを押して授業を始めましょう" : "あなたの言葉を聞いています..."}
                </p>
             </div>
          )}
        </div>
      </div>
      <div className="flex gap-6 mt-6 opacity-70 hover:opacity-100 transition-opacity">
        <button 
          onClick={handleReset}
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          <span className="text-lg">↺</span> 最初から
        </button>
        {isStarted && (
          <button 
            onClick={() => { 
              // ★修正: 終了して採点ボタンでも声を止める
              if (audioRef.current) audioRef.current.pause();
              setIsStarted(false); 
              onClassFinished(); 
            }}
            className="flex items-center gap-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="text-lg">⏹</span> 終了して採点
          </button>
        )}
      </div>
    </div>
  );
}