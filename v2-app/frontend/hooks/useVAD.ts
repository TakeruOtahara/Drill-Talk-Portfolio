import { useState, useEffect, useRef } from "react";

// 設定値
const VAD_THRESHOLD = 0.02; // 音量の閾値
const SILENCE_DURATION = 1000; // 無音判定時間(ms)

export const useVAD = (
  onSpeechEnd: (audioBlob: Blob) => void, 
  isEnabled: boolean 
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      stopVAD();
      return;
    }
    startVAD();
    return () => stopVAD();
  }, [isEnabled]);

  const startVAD = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        chunksRef.current = [];
        onSpeechEnd(blob);
      };

      const checkVolume = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const x = (dataArray[i] - 128) / 128;
          sum += x * x;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVolume(rms);

        if (rms > VAD_THRESHOLD) {
          if (mediaRecorder.state === "inactive") {
            mediaRecorder.start();
            setIsSpeaking(true);
            console.log("🗣️ Speaking started");
          }
          
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (mediaRecorder.state === "recording") {
              mediaRecorder.stop();
              setIsSpeaking(false);
              console.log("🤫 Silence detected, sending...");
            }
          }, SILENCE_DURATION);
        }

        if (isEnabled) requestAnimationFrame(checkVolume);
      };

      checkVolume();

    } catch (e) {
      console.error("VAD Error:", e);
    }
  };

  const stopVAD = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    
    // ★ここが修正箇所（エラー防止）
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsSpeaking(false);
    setVolume(0);
  };

  // ★以前のエラー原因：この return 文が消えていた可能性があります
  return { isSpeaking, volume };
};