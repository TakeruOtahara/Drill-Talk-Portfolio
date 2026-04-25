import { useState, useEffect, useCallback, useRef } from "react";

export const useManabu = ({ isListening, onError }: { isListening: boolean; onError: () => void }) => {
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

  // 🔊 スマホ用：音声システムのロック解除
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
        
        console.log("🔊 Audio System Unlocked for Mobile");
      } catch (e) {
        console.error("Audio unlock error:", e);
      }
    }
  }, []);

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

  useEffect(() => {
    // 💡 起動時に物置(localStorage)から全てのデータを復元
    const savedHistory = localStorage.getItem("dt_history");
    if (savedHistory) setLectureHistory(JSON.parse(savedHistory));

    const savedNotebook = localStorage.getItem("dt_notebook");
    if (savedNotebook) setNotebook(savedNotebook);

    const savedMissing = localStorage.getItem("dt_missing");
    if (savedMissing) setMissingPoints(JSON.parse(savedMissing));

    const savedMisconceptions = localStorage.getItem("dt_misconception");
    if (savedMisconceptions) setMisconceptions(JSON.parse(savedMisconceptions));

    let pingInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_WS_URL || window.location.host;
      const wsUrl = `${protocol}//${host}/ws/manabu`;

      console.log(`📡 Attempting connection to: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("🚀 WebSocket Connected");
        setSocket(ws);
        
        const history = localStorage.getItem("dt_history");
        const structured = localStorage.getItem("dt_structured");
        const original = localStorage.getItem("dt_original");

        if (history || structured || original) {
          ws.send(JSON.stringify({
            type: "SYNC_SESSION",
            payload: {
              lecture_history: history ? JSON.parse(history) : [],
              structured_original: structured ? JSON.parse(structured) : {},
              original_text: original || ""
            }
          }));
        }

        while (messageQueue.current.length > 0) {
          ws.send(messageQueue.current.shift()!);
        }

        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "ERROR") {
          console.error("🚨 Backend Error:", data.message);
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
          // 💡 状態を更新
          setNotebook(data.notebook);
          setMissingPoints(data.missing_points);
          setMisconceptions(data.misconceptions);

          // 💡 物置(localStorage)に保存
          localStorage.setItem("dt_notebook", data.notebook);
          localStorage.setItem("dt_missing", JSON.stringify(data.missing_points));
          localStorage.setItem("dt_misconception", JSON.stringify(data.misconceptions));
          
          setIsBackendThinking(false);
        }
      };

      ws.onclose = () => {
        console.log("❌ WebSocket Closed. Reconnecting...");
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
      setSocket((prev) => { prev?.close(); return null; });
    };
  }, [speak, onError]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (type === "USER_TALK") {
      const newHistory = [...lectureHistory, payload.text];
      setLectureHistory(newHistory);
      localStorage.setItem("dt_history", JSON.stringify(newHistory));
    }

    if (type === "RESTART_LECTURE" || type === "RESTART_SESSION") {
      // 💡 レッスンやり直し時は物置を掃除する
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
      console.warn("⚠️ WebSocket not open. Queuing message.");
      messageQueue.current.push(message);
    }
  }, [socket, lectureHistory]);

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