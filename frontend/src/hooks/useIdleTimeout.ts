// --- v3-app/frontend/src/hooks/useIdleTimeout.ts ---
import { useEffect, useRef, useCallback } from "react";

export const useIdleTimeout = (
  timeoutMs: number,
  isUserSpeaking: boolean,
  onTimeout: () => void
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    // timeoutMs 経過後に onTimeout (切断処理) を実行
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, timeoutMs);
  }, [timeoutMs, onTimeout]);

  useEffect(() => {
    // ① Page Visibility API の監視
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetTimer(); // 画面が戻ってきたらタイマーリセット
      }
    };

    // ② 物理的な入力の監視
    const events = ["mousemove", "keydown", "click", "touchstart"];
    const handleActivity = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handleActivity));
    document.addEventListener("visibilitychange", handleVisibilityChange);

    resetTimer(); // 初期起動

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  // ③ 音声入力（isUserSpeaking）が true の間もタイマーをリセット
  useEffect(() => {
    if (isUserSpeaking) resetTimer();
  }, [isUserSpeaking, resetTimer]);
};