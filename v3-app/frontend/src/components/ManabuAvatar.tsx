// --- v3-app/frontend/src/components/ManabuAvatar.tsx ---
import { motion } from "framer-motion";

interface ManabuAvatarProps {
  emotion?: 'neutral' | 'happy' | 'excited' | 'confused';
  isListening?: boolean;
  className?: string;
}

export const ManabuAvatar = ({ 
  emotion = 'neutral', 
  isListening = false, 
  className 
}: ManabuAvatarProps) => {
  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* 💡 全体のアニメーション：頷きを深く、テンポを速めてブースト */}
      <motion.div
        animate={
          isListening 
            ? { 
                // 頷き：15px沈み込み、7%潰れる（もちもち感を最大化）
                y: [0, 15, 0], 
                scaleY: [1, 0.93, 1], 
              } 
            : { 
                // 待機：ゆったりとした浮遊
                y: [0, -3, 0],
                scaleY: [1, 1, 1]
              }
        }
        transition={
          isListening
            ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } 
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
        className="relative"
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-auto drop-shadow-2xl"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* --- 影：体の沈み込みに合わせて濃く広く --- */}
          <motion.ellipse 
            cx="100" cy="185" rx="50" ry="10" 
            fill="rgba(0,0,0,0.1)"
            animate={isListening ? { rx: [50, 65, 50], opacity: [0.1, 0.25, 0.1] } : {}}
            transition={isListening ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : { duration: 3, repeat: Infinity }}
          />

          {/* --- 体・顔のベース --- */}
          <path
            d="M50 80 C50 40, 150 40, 150 80 L155 130 C155 160, 130 180, 100 180 C70 180, 45 160, 45 130 Z"
            fill="#FFF9F0"
            stroke="#4A3428"
            strokeWidth="4"
          />

          {/* --- 髪：オレンジ色のツンツン髪 --- */}
          <path d="M70 45 C60 20, 90 25, 100 40 C110 20, 140 25, 130 45" fill="#FFB74D" stroke="#4A3428" strokeWidth="4" strokeLinecap="round" />
          <path d="M100 40 L105 20 Q115 15, 110 25" fill="none" stroke="#4A3428" strokeWidth="3" strokeLinecap="round" />

          {/* --- ほっぺ：感情に合わせて赤らむ --- */}
          <motion.circle
            cx="65" cy="125" r="10" fill="#FFCDD2" opacity="0.6"
            animate={emotion === 'happy' || emotion === 'excited' ? { scale: [1, 1.3, 1], opacity: 0.8 } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <motion.circle
            cx="135" cy="125" r="10" fill="#FFCDD2" opacity="0.6"
            animate={emotion === 'happy' || emotion === 'excited' ? { scale: [1, 1.3, 1], opacity: 0.8 } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />

          {/* --- 目：瞬きアニメーション付き --- */}
          <g transform="translate(80, 105)">
            <motion.circle
              r="10" fill="#4A3428"
              animate={{ scaleY: [1, 0, 1] }}
              transition={{ delay: 2, duration: 0.15, repeat: Infinity, repeatDelay: 4 }}
            />
            <circle cx="-3" cy="-3" r="3" fill="white" />
          </g>

          <g transform="translate(120, 105)">
            <motion.circle
              r="10" fill="#4A3428"
              animate={{ scaleY: [1, 0, 1] }}
              transition={{ delay: 2, duration: 0.15, repeat: Infinity, repeatDelay: 4 }}
            />
            <circle cx="-3" cy="-3" r="3" fill="white" />
          </g>

          {/* --- 口：感情ごとの切り替え --- */}
          <motion.g transform="translate(100, 145)">
            {emotion === 'happy' && (
              <path d="M-10 -5 Q0 10, 10 -5" fill="none" stroke="#4A3428" strokeWidth="4" strokeLinecap="round" />
            )}
            {emotion === 'excited' && (
              <path d="M-12 -5 Q0 15, 12 -5 Z" fill="#FF8A65" stroke="#4A3428" strokeWidth="3" />
            )}
            {emotion === 'confused' && (
              <path d="M-8 2 Q0 -5, 8 2" fill="none" stroke="#4A3428" strokeWidth="3" strokeLinecap="round" />
            )}
            {emotion === 'neutral' && (
              <path d="M-10 0 L10 0" fill="none" stroke="#4A3428" strokeWidth="3" strokeLinecap="round" />
            )}
          </motion.g>

          {/* --- 小さな手：頷きに合わせてバタバタ動く --- */}
          <motion.path
            d="M40 130 Q30 140, 45 150" fill="none" stroke="#4A3428" strokeWidth="4" strokeLinecap="round"
            animate={isListening ? { rotate: [0, -25, 0] } : {}}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            d="M160 130 Q170 140, 155 150" fill="none" stroke="#4A3428" strokeWidth="4" strokeLinecap="round"
            animate={isListening ? { rotate: [0, 25, 0] } : {}}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </svg>

        {/* --- 名札：デザインアクセント --- */}
        <div className="absolute bottom-6 bg-white/80 px-3 py-0.5 rounded-full border border-orange-200 text-[10px] font-bold text-orange-400 tracking-widest shadow-sm">
          MANABU
        </div>
      </motion.div>
    </div>
  );
};