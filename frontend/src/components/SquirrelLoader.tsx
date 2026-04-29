"use client";
import { motion, AnimatePresence } from "framer-motion";

export const SquirrelLoader = ({ isVisible, message = "解析中..." }: { isVisible: boolean, message?: string }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          // 💡 ボタンの裏側（中央）に隠れた状態から、上へシュッと飛び出す
          initial={{ y: 0, x: "-50%", opacity: 0, scale: 0.5 }}
          animate={{ y: -65, x: "-50%", opacity: 1, scale: 1 }}
          exit={{ y: 0, x: "-50%", opacity: 0, scale: 0.5 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="absolute left-1/2 z-0 pointer-events-none flex flex-col items-center"
        >
          {/* 💡 左右に細かく震えて「走っている感・焦っている感」を出す */}
          <motion.span 
            animate={{ x: [-2, 2, -2] }}
            transition={{ repeat: Infinity, duration: 0.15 }}
            className="text-4xl drop-shadow-md"
          >
            🐿️
          </motion.span>
          <motion.div 
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-blue-100 shadow-sm whitespace-nowrap mt-1"
          >
            <span className="text-[11px] font-black text-blue-600 tracking-wider">{message}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};