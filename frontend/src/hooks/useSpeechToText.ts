// --- v3-app/frontend/src/hooks/useSpeechToText.ts ---
import { useState, useEffect, useCallback, useRef } from "react";

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void,
  onSpeechStart?: () => void,
  onInterimResult?: (text: string) => void,
  isManabuSpeaking: boolean = false,
  onError?: (error: any) => void // 💡 5つ目の引数としてエラーハンドラを拡張
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 💡 物理的にブラウザのマイクが「完全に動いているか」を追跡する鉄壁のフラグ
  const isEngineActiveRef = useRef(false);
  // 💡 命令が衝突して壊れるのを防ぐためのトランザクションロック
  const isTransitioningRef = useRef(false);

  const refs = useRef({ 
    onFinalTranscript, 
    onSpeechStart, 
    onInterimResult,
    isManabuSpeaking,
    onError 
  });

  useEffect(() => {
    refs.current = { 
      onFinalTranscript, 
      onSpeechStart, 
      onInterimResult, 
      isManabuSpeaking,
      onError 
    };
  }, [onFinalTranscript, onSpeechStart, onInterimResult, isManabuSpeaking, onError]);

  // 物理的なマイク起動処理（安全弁付き）
  const safeStart = useCallback(() => {
    if (!recognitionRef.current || isEngineActiveRef.current || isTransitioningRef.current) return;
    try {
      isTransitioningRef.current = true;
      recognitionRef.current.start();
    } catch (e) {
      console.warn("⚠️ 重複スタートを物理ガードで回避しました");
      isTransitioningRef.current = false;
    }
  }, []);

  // 物理的なマイク停止処理（安全弁付き）
  const safeAbort = useCallback(() => {
    if (!recognitionRef.current || isTransitioningRef.current) return;
    try {
      isTransitioningRef.current = true;
      recognitionRef.current.abort();
    } catch (e) {
      isTransitioningRef.current = false;
    }
  }, []);

  // 認識オブジェクトの初期化
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    // 物理的にエンジンが起動を完了した瞬間
    recognition.onstart = () => {
      isEngineActiveRef.current = true;
      isTransitioningRef.current = false;
    };

    recognition.onerror = (event: any) => {
      isTransitioningRef.current = false;
      // aborted（手動停止）以外の深刻なエラーだけを画面に通知
      if (event.error !== "aborted") {
        refs.current.onError?.(event);
      }
    };

    recognition.onsoundstart = () => {
      if (refs.current.isManabuSpeaking) return;
      refs.current.onSpeechStart?.();
    };

    recognition.onresult = (event: any) => {
      if (refs.current.isManabuSpeaking) return;

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) refs.current.onFinalTranscript(finalTranscript);
      if (interimTranscript) refs.current.onInterimResult?.(interimTranscript);
    };

    // 物理的にエンジンが完全に停止を完了した瞬間
    recognition.onend = () => {
      isEngineActiveRef.current = false;
      isTransitioningRef.current = false;

      // 🔄 ループ再開処理も、完全にエンジンが「空っぽ」になったこの安全な瞬間だけで判定する
      if (isListening && !refs.current.isManabuSpeaking) {
        safeStart();
      }
    };

    recognitionRef.current = recognition;
  }, [isListening, safeStart]);

  // 認識の開始・停止（ユーザーがボタンを押したとき）
  const toggleListening = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      safeAbort();
    } else {
      setIsListening(true);
      safeStart();
    }
  }, [isListening, safeStart, safeAbort]);

  // 🛡️ マナブ君の発言状態（裏での自動ON/OFF）と物理マイクを完全に同期
  useEffect(() => {
    if (isManabuSpeaking) {
      safeAbort();
    } else {
      if (isListening) {
        safeStart();
      }
    }
  }, [isManabuSpeaking, isListening, safeStart, safeAbort]);

  return { isListening, toggleListening };
};