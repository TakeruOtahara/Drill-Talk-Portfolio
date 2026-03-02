import { motion, AnimatePresence } from 'framer-motion';

type Emotion = 'neutral' | 'happy' | 'excited' | 'confused';

interface ManabuAvatarProps {
  emotion: Emotion;
}

const emotionImages: Record<Emotion, string> = {
  neutral: '/manabu_neutral.png',  // ※後で画像を配置
  happy: '/manabu_happy.png',
  excited: '/manabu_excited.png',
  confused: '/manabu_confused.png',
};

export const ManabuAvatar = ({ emotion }: ManabuAvatarProps) => {
  return (
    <div className="relative w-64 h-64 mx-auto">
      <AnimatePresence mode="wait">
        <motion.img
          key={emotion}
          src={emotionImages[emotion]}
          alt={`マナブ君の表情: ${emotion}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.3 }}
          className="w-full h-full object-contain"
        />
      </AnimatePresence>
      
      {/* 喋っている時のちょっとしたエフェクト（任意） */}
      {emotion !== 'neutral' && (
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute -top-4 -right-4 bg-yellow-400 text-white p-2 rounded-full shadow-lg"
        >
          ✨
        </motion.div>
      )}
    </div>
  );
};