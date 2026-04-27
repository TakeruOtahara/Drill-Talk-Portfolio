// --- v3-app/frontend/src/hooks/useManabu.ts ---
import { useState, useEffect, useCallback, useRef } from "react";

// 💡 TypeScript用の型定義：これがあることで page.tsx でのエラーが消えます
interface UseManabuReturn {
  notebook: string;
  setNotebook: (val: string) => void;
  missingPoints: string[];
  misconceptions: string[];
  emotion: "happy" | "neutral" | "excited" | "confused";
  isAnalyzing: boolean;
  setIsAnalyzing: (val: boolean) => void;
  isBackendThinking: boolean;
  setIsBackendThinking: (val: boolean) => void;
  isManabuSpeaking: boolean;
  setIsManabuSpeaking: (val: boolean) => void;
  questionQueue: React.MutableRefObject<string[]>;
  sendMessage: (type: string, payload: any) => void;
  speak: (text: string, onEnd?: () => void) => void;
  cancelSpeak: () => void;
  unlockAudio: () => Promise<void>;
}

export const useManabu = ({ 
  isListening, 
  onError 
}: { 
  isListening: boolean; 
  onError: () => void 
}): UseManabuReturn => {
  const [notebook, setNotebook] = useState("");
  const [missingPoints, setMissingPoints] = useState<string[]>([]);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [emotion, setEmotion] = useState<"happy" | "neutral" | "excited" | "confused">("neutral");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBackendThinking, setIsBackendThinking] = useState(false);
  const [isManabuSpeaking, setIsManabuSpeaking] = useState(false);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lectureHistory, setLectureHistory] = useState<string[]>([]);
  
  const questionQueue = useRef<string[]>([]);
  const messageQueue = useRef<string[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // 🔊 音声ロック解除（スマホ対応）
  const unlockAudio = useCallback(async () => {
    if (typeof window !== "undefined") {
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }
        const buffer = audioContextRef.current.createBuffer(1, 1, 22050);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start(0);
        console.log("🔊 Audio System Unlocked");
      } catch (e) {
        console.error("Audio unlock error:", e);
      }
    }
  }, []);

  // 🗣️ 音声合成（発話）
  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) return;
    
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = "ja-JP";
    uttr.rate = 1.1;
    uttr.pitch = 1.2;

    uttr.onend = () => {
      setIsManabuSpeaking(false);
      if (onEnd) onEnd();
    };

    uttr.onerror = () => {
      setIsManabuSpeaking(false);
    };

    setIsManabuSpeaking(true);
    window.speechSynthesis.speak(uttr);
  }, []);

  const cancelSpeak = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsManabuSpeaking(false);
  }, []);

  // 📡 WebSocket接続管理
  useEffect(() => {
    // 復元処理
    const savedHistory = localStorage.getItem("dt_history");
    if (savedHistory) setLectureHistory(JSON.parse(savedHistory));
    const savedNotebook = localStorage.getItem("dt_notebook");
    if (savedNotebook) setNotebook(savedNotebook);
    const savedMissing = localStorage.getItem("dt_missing");
    if (savedMissing) setMissingPoints(JSON.parse(savedMissing));
    const savedMisconceptions = localStorage.getItem("dt_misconception");
    if (savedMisconceptions) setMisconceptions(JSON.parse(savedMisconceptions));

    let socketInstance: WebSocket | null = null;
    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
      // 🛡️ 環境変数からAPI Keyを取得
      const apiKey = process.env.NEXT_PUBLIC_DRILLTALK_API_KEY;
      // URLにクエリパラメータとして付与
      const wsUrl = `ws://${process.env.NEXT_PUBLIC_WS_URL}/ws/manabu?api_key=${apiKey}`;

      const ws = new WebSocket(wsUrl);
      socketInstance = ws;

      ws.onopen = () => {
        setSocket(ws);
        const historyStr = localStorage.getItem("dt_history");
        const structuredStr = localStorage.getItem("dt_structured");
        const originalStr = localStorage.getItem("dt_original");

        const history = historyStr ? JSON.parse(historyStr) : [];
        const structured = structuredStr ? JSON.parse(structuredStr) : {};

        // セッション同期
        ws.send(JSON.stringify({
          type: "SYNC_SESSION",
          payload: {
            lecture_history: history,
            structured_original: structured,
            original_text: originalStr || "",
            chars_count: history.join("").length
          }
        }));

        // 未送信キューの処理
        while (messageQueue.current.length > 0) {
          ws.send(messageQueue.current.shift()!);
        }

        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 30000);
      };

      ws.onmessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);

        if (data.type === "ERROR") {
          setIsAnalyzing(false);
          setIsBackendThinking(false);
          setIsManabuSpeaking(false);
          alert(data.message);
          if (onError) onError();
          return;
        }

        if (data.type === "MATERIAL_READY") {
          setIsAnalyzing(false);
          localStorage.setItem("dt_structured", JSON.stringify(data.structured_original));
          localStorage.setItem("dt_original", data.original_text);
        }
        if (data.type === "STUDENT_QUESTION") {
          questionQueue.current.push(data.message);
          setIsBackendThinking(false);
        }
        if (data.type === "REACTION") {
          setEmotion(data.emotion);
          if (data.message) speak(data.message);
          setIsBackendThinking(false);
        }
        if (data.type === "FINAL_NOTE") {
          setNotebook(data.notebook);
          setMissingPoints(data.missing_points);
          setMisconceptions(data.misconceptions);
          localStorage.setItem("dt_notebook", data.notebook);
          localStorage.setItem("dt_missing", JSON.stringify(data.missing_points));
          localStorage.setItem("dt_misconception", JSON.stringify(data.misconceptions));
          setIsBackendThinking(false);
        }
      };

      ws.onclose = () => {
        setSocket(null);
        if (pingInterval) clearInterval(pingInterval);
        reconnectTimeout = setTimeout(connect, 5000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
      };
    };

    connect();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socketInstance) {
        socketInstance.onclose = null; // 再接続ループを停止
        socketInstance.close();
      }
    };
  }, [speak, onError]);

  // ✉️ メッセージ送信ロジック
  const sendMessage = useCallback((type: string, payload: any) => {
    if (type === "USER_TALK") {
      setLectureHistory(prev => {
        const newHistory = [...prev, payload.text];
        localStorage.setItem("dt_history", JSON.stringify(newHistory));
        return newHistory;
      });
    }

    if (type === "RESTART_LECTURE" || type === "RESTART_SESSION") {
      localStorage.removeItem("dt_history");
      localStorage.removeItem("dt_notebook");
      localStorage.removeItem("dt_missing");
      localStorage.removeItem("dt_misconception");
      setLectureHistory([]);
      setNotebook("");
      setMissingPoints([]);
      setMisconceptions([]);
    }

    const message = JSON.stringify({ type, ...payload });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      messageQueue.current.push(message);
    }
  }, [socket]);

  return { 
    notebook, setNotebook, missingPoints, misconceptions, 
    emotion, isAnalyzing, setIsAnalyzing, 
    isBackendThinking, setIsBackendThinking, 
    isManabuSpeaking, setIsManabuSpeaking,
    questionQueue, 
    sendMessage, speak, cancelSpeak,
    unlockAudio
  };
};