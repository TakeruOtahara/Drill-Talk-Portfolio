import { useCallback } from 'react';

export const useSpeechSynthesis = () => {
  const cancel = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined') return;
    cancel(); // 新しく喋る前に、再生中の音声をすべて止める

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
  }, [cancel]);

  return { speak, cancel };
};