// --- v3-app/frontend/src/hooks/useSpeechSynthesis.ts ---
import { useCallback } from 'react';

// ここに "export" がついていることを確認してください！
export const useSpeechSynthesis = () => {
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;

    // 前の音声をキャンセルして新しい音声を再生
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    
    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find(voice => voice.lang === 'ja-JP' || voice.lang === 'ja_JP');
    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    utterance.pitch = 1.2;
    utterance.rate = 1.0;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
};