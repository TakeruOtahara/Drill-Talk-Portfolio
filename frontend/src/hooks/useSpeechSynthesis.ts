// --- v3-app/frontend/src/hooks/useSpeechSynthesis.ts ---
import { useCallback } from 'react'; // 追加

export const useSpeechSynthesis = () => {
  
  // useCallback で包むことで、再レンダリングされても関数の実体が変わりません
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
      console.warn("このブラウザは音声合成に対応していません。");
      if (onEnd) onEnd();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => { if (onEnd) onEnd(); };
    utterance.onerror = (e) => {
      console.error("音声合成エラー:", e);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }, []); // 依存配列は空でOK

  const cancel = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  return { speak, cancel };
};