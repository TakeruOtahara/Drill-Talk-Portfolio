// --- v3-app/frontend/src/hooks/useSpeechToText.ts ---
import { useState, useEffect, useCallback, useRef } from "react";

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void,
  onSpeechStart?: () => void,
  onInterimResult?: (text: string) => void,
  isManabuSpeaking: boolean = false,
  onError?: (error: any) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 物理的にブラウザのマイクが「完全に動いているか」を追跡する鉄壁のフラグ
  const isEngineActiveRef = useRef(false);
  // 命令が衝突して壊れるのを防ぐためのトランザクションロック
  const isTransitioningRef = useRef(false);

  // 💡 修正ポイント①：isListening も Ref に含め、多重インスタンス生成の引き金を完全に排除
  const refs = useRef({ 
    onFinalTranscript, 
    onSpeechStart, 
    onInterimResult,
    isManabuSpeaking,
    onError,
    isListening 
  });

  useEffect(() => {
    refs.current = { 
      onFinalTranscript, 
      onSpeechStart, 
      onInterimResult, 
      isManabuSpeaking,
      onError,
      isListening // 👈 ユーザーの最新のON/OFF意思を常に同期
    };
  }, [onFinalTranscript, onSpeechStart, onInterimResult, isManabuSpeaking, onError, isListening]);

  // 物理的なマイク起動処理
  const safeStart = useCallback(() => {
    if (!recognitionRef.current || isEngineActiveRef.current || isTransitioningRef.current) return;
    try {
      isTransitioningRef.current = true;
      recognitionRef.current.start();
    } catch (e) {
      isTransitioningRef.current = false;
    }
  }, []);

  // 物理的なマイク停止処理
  const safeAbort = useCallback(() => {
    if (!recognitionRef.current || isTransitioningRef.current) return;
    try {
      isTransitioningRef.current = true;
      recognitionRef.current.abort();
    } catch (e) {
      isTransitioningRef.current = false;
    }
  }, []);

  // 🚀 修正の核心②：SpeechRecognition の初期化は、コンポーネント起動時の「最初の一回だけ」に完全固定！！
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isEngineActiveRef.current = true;
      isTransitioningRef.current = false;
    };

    recognition.onerror = (event: any) => {
      isTransitioningRef.current = false;
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

    recognition.onend = () => {
      isEngineActiveRef.current = false;
      isTransitioningRef.current = false;

      // 💡 修正ポイント③：生のステートではなく最新の Ref を見ることで、古いマシンのゾンビ化を徹底防御
      if (refs.current.isListening && !refs.current.isManabuSpeaking) {
        // 🔄 ブラウザにネットワークソケット解放の「一呼吸（50ms）」の猶予を与えて美しく安全に再起動
        setTimeout(() => {
          if (refs.current.isListening && !refs.current.isManabuSpeaking) {
            safeStart();
          }
        }, 50);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [safeStart]); // 👈 🚀 依存配列から isListening を完全に消滅させました！！！

  // 認識の開始・停止（ユーザー操作用）
  const toggleListening = useCallback(() => {
    if (isListening) {
      setIsListening(false);
      safeAbort();
    } else {
      setIsListening(true);
      safeStart();
    }
  }, [isListening, safeStart, safeAbort]);

  // マナブ君の発言状態（裏での自動ON/OFF）と物理マイクの完全同期
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