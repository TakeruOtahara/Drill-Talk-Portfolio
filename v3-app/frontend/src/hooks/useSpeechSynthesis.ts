// --- v3-app/frontend/src/hooks/useSpeechSynthesis.ts ---
export const useSpeechSynthesis = () => {
  
  // 💡 onEnd コールバックを追加（話し終わったことを呼び出し元に伝える）
  const speak = (text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) {
      console.warn("このブラウザは音声合成に対応していません。");
      // 音声が出ない環境でも処理を止めないために onEnd を即座に呼ぶ
      if (onEnd) onEnd();
      return;
    }

    // 既に話している場合は一旦キャンセルして新しい言葉を話す
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 1.0; // 読み上げ速度（必要に応じて調整）
    utterance.pitch = 1.0; // 声の高さ

    // 💡 話し終わった瞬間に実行されるイベント
    utterance.onend = () => {
      if (onEnd) {
        onEnd();
      }
    };

    // 万が一エラーが起きた場合もマイクがフリーズしないように onEnd を呼ぶ（保身設計）
    utterance.onerror = (e) => {
      console.error("音声合成エラー:", e);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  };

  const cancel = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  return { speak, cancel };
};