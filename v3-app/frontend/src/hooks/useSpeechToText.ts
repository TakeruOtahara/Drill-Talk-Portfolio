import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechToText = (
  onFinalTranscript: (text: string) => void, 
  onSpeechStart?: () => void,
  onInterimResult?: (text: string) => void
) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 【修正】コールバックを Ref で保持し、常に最新の関数が呼ばれるようにする
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
      if (isListening) recognition.start();
    };

    recognitionRef.current = recognition;
  }, [isListening]); // 依存配列を最小限に

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isListening, toggleListening };
};