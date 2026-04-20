// --- v3-app/frontend/src/components/NotebookModal.tsx ---
import { motion } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2, MessageSquareOff } from "lucide-react";

interface NotebookModalProps {
  notebook: string;
  missingPoints: string[];
  misconceptions: string[];
  onRestart: () => void;
  isRestarting?: boolean;
}

export const NotebookModal = ({ 
  notebook, 
  missingPoints, 
  misconceptions, 
  onRestart, 
  isRestarting 
}: NotebookModalProps) => {
  if (!notebook) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#fdfdfd] w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-8 border-t-8 border-blue-500"
      >
        <h2 className="text-2xl font-bold text-blue-800 mb-8 flex justify-between items-center border-b-2 border-blue-100 pb-4">
          <span>マナブの復習結果 📝</span>
        </h2>

        <div className="space-y-10 text-slate-800">
          
          {/* 1. マナブの理解（メインノート） */}
          <section>
            <h3 className="flex items-center gap-2 text-lg font-bold text-emerald-700 mb-4">
              <CheckCircle2 className="w-5 h-5" />
              マナブの理解
            </h3>
            <div 
              className="prose prose-blue max-w-none font-medium leading-relaxed bg-white p-6 rounded-xl border border-slate-100 shadow-sm"
              style={{
                backgroundImage: "linear-gradient(#f1f5f9 1px, transparent 1px)",
                backgroundSize: "100% 2rem",
                lineHeight: "2rem",
              }}
              dangerouslySetInnerHTML={{ __html: notebook }}
            />
          </section>

          {/* 2. 教えてくれなかったこと（Missing Points） */}
          {missingPoints.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-amber-700 mb-4">
                <MessageSquareOff className="w-5 h-5" />
                教えてくれなかったこと
              </h3>
              <ul className="grid gap-3">
                {missingPoints.map((point, idx) => (
                  <li key={idx} className="bg-amber-50/50 border border-amber-100 p-4 rounded-lg text-sm flex gap-3">
                    <span className="text-amber-500 font-bold">・</span>
                    {point}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 3. マナブの勘違い（Misconceptions） */}
          {misconceptions.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-lg font-bold text-red-700 mb-4">
                <AlertCircle className="w-5 h-5" />
                マナブの勘違い（説明ミス）
              </h3>
              <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                <p className="text-xs text-red-500 mb-3 font-bold uppercase tracking-wider">先生の説明からマナブが間違えて覚えたこと：</p>
                <ul className="grid gap-3">
                  {misconceptions.map((item, idx) => (
                    <li key={idx} className="text-sm flex gap-3 text-red-900">
                      <span className="text-red-400 font-bold">！</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* 下部アクション */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
          <p className="text-sm text-slate-500 italic">「教えてくれなかったこと」を意識して、もう一度説明してみましょう！</p>
          <button
            onClick={onRestart}
            disabled={isRestarting}
            className="px-12 py-4 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-lg"
          >
            {isRestarting && <Loader2 className="w-5 h-5 animate-spin" />}
            {isRestarting ? "準備中..." : "もう一度教える"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};