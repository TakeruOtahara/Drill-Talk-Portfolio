// --- v3-app/frontend/src/components/TutorialOverlay.tsx ---
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Mic, Notebook, CheckCircle, ShieldCheck, X } from "lucide-react";

interface TutorialOverlayProps {
  onComplete: () => void;
}

export const TutorialOverlay = ({ onComplete }: TutorialOverlayProps) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Drill-Talkへようこそ！",
      description: "このアプリは『ファインマン・テクニック』を使い、AIのマナブ君に教えることであなたの理解を深める特訓ツールです。",
      icon: <BookOpen className="w-16 h-16 text-emerald-500" />,
      color: "bg-emerald-50"
    },
    {
      title: "STEP 1: 教材の準備",
      description: "教科書やノートの写真を最大5枚アップロードします。マナブ君が内容を読み取り、あなたの『生徒』になります。",
      icon: <CheckCircle className="w-16 h-16 text-blue-500" />,
      color: "bg-blue-50"
    },
    {
      title: "STEP 2: 5分間のアウトプット",
      description: "何も見ずに、マナブ君に内容を説明してください。話している間、マナブ君は頷きながらあなたの話を聴いています。",
      icon: <Mic className="w-16 h-16 text-amber-500" />,
      color: "bg-amber-50"
    },
    {
      title: "STEP 3: 特訓ノートの受け取り",
      description: "終了後、AIがあなたの説明を分析。『理解できている点』『教え漏れ』『勘違い』を整理したノートを作成します。",
      icon: <Notebook className="w-16 h-16 text-purple-500" />,
      color: "bg-purple-50"
    },
    {
      title: "安心のセキュリティ",
      description: "入力されたメモや音声は、その場のセッションでのみ利用されます。HTMLエスケープやバリデーションにより、安全に学習できます。",
      icon: <ShieldCheck className="w-16 h-16 text-slate-700" />,
      color: "bg-slate-100"
    },
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: -10 }}
          className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
        >
          {/* 背景の装飾 */}
          <div className={`absolute top-0 left-0 w-full h-32 ${steps[step].color} -z-10 transition-colors duration-500`} />
          
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex justify-center mb-6 mt-4">
            <motion.div
              initial={{ rotate: -10, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              {steps[step].icon}
            </motion.div>
          </div>

          <h2 className="text-2xl font-black mb-4 text-slate-800">{steps[step].title}</h2>
          <p className="text-slate-600 mb-10 leading-relaxed font-medium">
            {steps[step].description}
          </p>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={nextStep}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800 transition-all shadow-lg active:scale-[0.98]"
            >
              {step === steps.length - 1 ? "特訓を開始する" : "次へ進む"}
            </button>
          </div>

          {/* インジケーター */}
          <div className="flex justify-center gap-2 mt-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-slate-800" : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};