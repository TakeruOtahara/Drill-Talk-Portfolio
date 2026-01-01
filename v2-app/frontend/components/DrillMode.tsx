"use client";

import { useState } from "react";

// ★ここが重要！親(page.tsx)から会話履歴を受け取るための設定
interface Props {
  history: string;
}

export default function DrillMode({ history }: Props) {
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!problemFile || !answerFile) {
      alert("問題と答えの画像両方をセットしてください！");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("p", problemFile);
    formData.append("a", answerFile);
    // ★親から貰った本物の履歴を送るように修正
    formData.append("c", history || "会話履歴なし"); 

    try {
      const res = await fetch("http://127.0.0.1:8000/run-drill", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);

    } catch (error) {
      console.error(error);
      alert("採点に失敗しました...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl bg-slate-900/60 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
      
      {/* 装飾用の光 */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full"></div>

      <h2 className="text-xl font-bold mb-8 text-slate-100 flex items-center gap-3">
        <span className="p-2 bg-orange-500/20 rounded-lg text-orange-400">📝</span>
        Drill Execution Mode
      </h2>

      {/* --- 画像アップロードエリア (オレンジ/イエローのカード型) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <label className={`relative group cursor-pointer flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all duration-300 ${
          problemFile ? "border-orange-500 bg-orange-500/10" : "border-slate-700 hover:border-slate-500 bg-slate-800/50"
        }`}>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setProblemFile(e.target.files?.[0] || null)} />
          <div className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center text-xl ${problemFile ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-400"}`}>
            {problemFile ? "✓" : "📷"}
          </div>
          <p className="text-sm font-bold text-slate-300">問題の画像</p>
          <p className="text-[10px] text-slate-500 mt-1 truncate max-w-full">{problemFile ? problemFile.name : "クリックして選択"}</p>
        </label>

        <label className={`relative group cursor-pointer flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all duration-300 ${
          answerFile ? "border-yellow-500 bg-yellow-500/10" : "border-slate-700 hover:border-slate-500 bg-slate-800/50"
        }`}>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => setAnswerFile(e.target.files?.[0] || null)} />
          <div className={`w-12 h-12 mb-3 rounded-full flex items-center justify-center text-xl ${answerFile ? "bg-yellow-500 text-white" : "bg-slate-700 text-slate-400"}`}>
            {answerFile ? "✓" : "🔑"}
          </div>
          <p className="text-sm font-bold text-slate-300">正解の画像</p>
          <p className="text-[10px] text-slate-500 mt-1 truncate max-w-full">{answerFile ? answerFile.name : "クリックして選択"}</p>
        </label>
      </div>

      {/* --- 実行ボタン (巨大なオレンジ) --- */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className={`w-full py-5 rounded-2xl font-black text-xl tracking-widest transition-all relative overflow-hidden group ${
          loading
            ? "bg-slate-700 text-slate-500 cursor-not-allowed"
            : "bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-95"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>
            ANALYZING...
          </span>
        ) : "🔥 START DRILL"}
        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
      </button>

      {/* --- 結果表示エリア --- */}
      {result && (
        <div className="mt-10 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex justify-between items-end mb-6">
            <h3 className="text-slate-400 text-xs font-bold tracking-widest uppercase">Score Result</h3>
            <span className={`text-6xl font-black font-mono leading-none ${
              result.score >= 80 ? "text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" : 
              result.score >= 40 ? "text-yellow-400" : "text-rose-500"
            }`}>
              {result.score}
            </span>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-800/80 p-5 rounded-2xl border-l-4 border-orange-500">
              <p className="text-[10px] text-orange-400 font-bold mb-2 tracking-widest uppercase">AI Feedback</p>
              <p className="text-lg text-slate-100 font-medium italic">「{result.reaction}」</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Student solution</p>
                <p className="text-xs text-slate-300 whitespace-pre-wrap font-mono">{result.solution}</p>
              </div>
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700">
                <p className="text-[10px] text-slate-500 font-bold mb-2 uppercase">Knowledge Summary</p>
                <p className="text-xs text-slate-300">{result.knowledge_summary}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}