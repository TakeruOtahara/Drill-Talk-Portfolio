// frontend/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Classroom from "../components/Classroom";
import DrillMode from "../components/DrillMode";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState("Connecting...");
  const [conversationHistory, setConversationHistory] = useState("");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then(() => setBackendStatus("ONLINE"))
      .catch(() => setBackendStatus("OFFLINE"));
  }, []);

  return (
    // ★修正ポイント: bg-[url...] を削除し、Tailwindの色クラスで背景を指定
    <main className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black flex flex-col items-center font-sans text-slate-200 overflow-x-hidden selection:bg-blue-500/30">
      
      {/* ヘッダーエリア */}
      <header className="w-full max-w-5xl flex justify-between items-center p-6 border-b border-white/5 mb-8 backdrop-blur-sm sticky top-0 z-50 bg-slate-950/80">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Drill-Talk <span className="text-slate-500 font-normal text-xs ml-1">v2.0</span>
          </h1>
        </div>
        <div className={`text-[10px] font-mono px-3 py-1 rounded-full border ${
            backendStatus === "ONLINE" 
            ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" 
            : "border-rose-500/20 text-rose-400 bg-rose-500/5"
        }`}>
          SYSTEM: {backendStatus}
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="w-full max-w-3xl px-4 pb-20 space-y-16">
        
        {/* SECTION 1: 会話モード */}
        <section className="flex flex-col items-center w-full animate-fade-in">
            <div className="flex items-center gap-4 mb-6 w-full">
                <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
                <h2 className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">Phase 1: Communication</h2>
                <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
            </div>
            
            {/* ★ここに、さっき更新した新しいClassroomが表示されます */}
            <Classroom 
              onHistoryUpdate={(text) => setConversationHistory(prev => prev + "\n" + text)} 
              onClassFinished={() => {
                alert("授業終了！下のドリルに進んでください。");
              }}
              onReset={() => setConversationHistory("")}
            />
        </section>

        {/* SECTION 2: ドリルモード */}
        <section className="flex flex-col items-center w-full">
            <div className="flex items-center gap-4 mb-6 w-full">
                <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
                <h2 className="text-slate-500 text-xs font-bold tracking-[0.2em] uppercase">Phase 2: Examination</h2>
                <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent flex-1"></div>
            </div>
            
            <DrillMode history={conversationHistory} />
        </section>

      </div>
      
      {/* フッター */}
      <footer className="w-full py-8 text-center border-t border-white/5 mt-auto">
        <p className="text-slate-600 text-xs tracking-wider">Drill-Talk System © 2026</p>
      </footer>
    </main>
  );
}