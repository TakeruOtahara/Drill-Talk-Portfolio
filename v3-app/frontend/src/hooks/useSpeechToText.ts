// --- v3-app/frontend/src/hooks/useSpeechToText.ts ---
import { useState, useEffect, useCallback, useRef } from "react";

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void,
  onSpeechStart?: () => void,
  onInterimResult?: (text: string) => void,
  isManabuSpeaking: boolean = false // 💡 引数に追加：マナブ君の喋り状態
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 💡 コールバックと「喋り中フラグ」を Ref で保持（クロージャ問題/最新値参照の解決）
  const refs = useRef({ 
    onFinalTranscript, 
    onSpeechStart, 
    onInterimResult,
    isManabuSpeaking 
  });

  useEffect(() => {
    refs.current = { 
      onFinalTranscript, 
      onSpeechStart, 
      onInterimResult, 
      isManabuSpeaking 
    };
  }, [onFinalTranscript, onSpeechStart, onInterimResult, isManabuSpeaking]);

  // 認識オブジェクトの初期化
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onsoundstart = () => {
      // 🛡️ ガード：マナブが喋っている時はイベントを無視
      if (refs.current.isManabuSpeaking) return;
      refs.current.onSpeechStart?.();
    };

    recognition.onresult = (event: any) => {
      // 🛡️ 【ガード1】マナブが発言中なら、入力を即座に破棄
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

      if (finalTranscript) {
        refs.current.onFinalTranscript(finalTranscript);
      }
      if (interimTranscript) {
        refs.current.onInterimResult?.(interimTranscript);
      }
    };

    recognition.onend = () => {
      // 🛡️ 【ガード2】マナブが喋っていない、かつONの状態なら自動再開
      // (Speech APIは沈黙で切れるため、isListeningがtrueならループさせる)
      if (isListening && !refs.current.isManabuSpeaking) {
        try {
          recognition.start();
        } catch (e) {
          // すでに開始されている等のエラーは無視
        }
      }
    };

    recognitionRef.current = recognition;
  }, [isListening]); // isListeningが変わるたびにonendの挙動を最新にする

  // 認識の開始・停止（ユーザー操作用）
  const toggleListening = useCallback(() => {
    if (isListening) {
      // abort() を使うことで、中途半端なバッファを破棄して即座に止める
      recognitionRef.current?.abort();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition start error:", e);
      }
    }
  }, [isListening]);

  // 🛡️ 【ガード3】マナブが喋り始めた瞬間に、物理的にマイクの認識を制御する
  useEffect(() => {
    if (isManabuSpeaking) {
      // マナブが喋りだしたら即座に認識を強制中断（エコーバック防止）
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    } else {
      // マナブが喋り終わり、かつユーザーがONにしていたなら再開
      if (isListening && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // 重複スタート防止
        }
      }
    }
  }, [isManabuSpeaking, isListening]);

  return { isListening, toggleListening };
};