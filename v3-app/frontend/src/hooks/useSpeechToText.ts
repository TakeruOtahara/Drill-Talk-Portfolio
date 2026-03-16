import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void, 
  onSpeechStart?: () => void,
  onInterimResult?: (text: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // コールバックを Ref で保持し、常に最新の関数が呼ばれるようにする
  const refs = useRef({ onFinalTranscript, onSpeechStart, onInterimResult });
  useEffect(() => {
    refs.current = { onFinalTranscript, onSpeechStart, onInterimResult };
  }, [onFinalTranscript, onSpeechStart, onInterimResult]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onsoundstart = () => {
      refs.current.onSpeechStart?.();
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          refs.current.onFinalTranscript(transcript);
        } else {
          interimTranscript += transcript;
        }
      }
      if (interimTranscript) {
        refs.current.onInterimResult?.(interimTranscript);
      }
    };

    // 自動停止対策：認識が切れても isListening が true なら再開
    recognition.onend = () => {
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Speech recognition restart error:", e);
        }
      }
    };

    recognitionRef.current = recognition;
  }, [isListening]);

  // 【修正】toggleListening: abort() の採用と try-catch による堅牢化
  const toggleListening = useCallback(() => {
    if (isListening) {
      // stop() ではなく abort() を使うことで、即座に認識を中断し、未確定の結果を破棄する
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

  return { isListening, toggleListening };
};