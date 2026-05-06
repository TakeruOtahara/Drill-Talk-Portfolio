// --- v3-app/frontend/src/components/SquirrelLoader.tsx ---
"use client";
import { motion, AnimatePresence } from "framer-motion";

export const SquirrelLoader = ({ isVisible }: { isVisible: boolean }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          // 💡 ボタンの裏側（中央）に隠れた状態から、ボタンの上へ定位置につく（親の動き）
          initial={{ y: 0, x: "-50%", opacity: 0, scale: 0.5 }}
          animate={{ y: -50, x: "-50%", opacity: 1, scale: 1 }}
          exit={{ y: 0, x: "-50%", opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="absolute left-1/2 z-0 pointer-events-none flex flex-col items-center"
        >
          {/* 💡 リス本体：ボタンの上でピョンピョンと滑らかに跳ねる（子の動き） */}
          <motion.span 
            animate={{ 
              y: [0, -12, 0],         // 上に12pxジャンプして戻る
              rotate: [0, -8, 8, 0]   // ジャンプ中に少しだけ左右に首を傾げる
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 0.6,          // 痙攣をやめ、0.6秒の心地よいテンポに
              ease: "easeInOut"       // 動きを滑らかにする（ガタつきの排除）
            }}
            className="text-5xl drop-shadow-md origin-bottom" // 足元を支点に回転させる
          >
            🐿️
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};