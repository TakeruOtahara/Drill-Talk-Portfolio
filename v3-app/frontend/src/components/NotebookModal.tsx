import { motion } from "framer-motion";
import { Loader2 } from "lucide-react"; // アイコンを追加

interface NotebookModalProps {
  notebook: string;
  onRestart: () => void;
  isRestarting?: boolean; // 読み込み状態を受け取るための追加
}

export const NotebookModal = ({ notebook, onRestart, isRestarting }: NotebookModalProps) => {
  if (!notebook) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#fdfdfd] w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg shadow-2xl p-8 border-t-8 border-blue-500"
        style={{
          backgroundImage: "linear-gradient(#e1e1e1 1px, transparent 1px)",
          backgroundSize: "100% 2rem",
          lineHeight: "2rem",
        }}
      >
        <h2 className="text-2xl font-bold text-blue-800 mb-6 flex justify-between items-center border-b-2 border-blue-100 pb-2">
          <span>マナブの復習ノート 📝</span>
        </h2>
        
        {/* AIから届いたHTMLを流し込む */}
        <div 
          className="prose prose-blue max-w-none text-slate-800 font-medium"
          dangerouslySetInnerHTML={{ __html: notebook }}
        />

        <div className="mt-12 flex justify-center">
          <button
            onClick={onRestart}
            disabled={isRestarting}
            className="px-10 py-4 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isRestarting && <Loader2 className="w-5 h-5 animate-spin" />}
            {isRestarting ? "準備中..." : "もう一度教える（2回目スタート）"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};