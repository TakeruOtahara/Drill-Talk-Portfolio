// --- v3-app/frontend/src/hooks/useManabu.ts ---
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

interface UseManabuProps {
  isListening: boolean;
  onError?: (msg: string) => void;
}

export const useManabu = ({ isListening, onError }: UseManabuProps) => {
  const { speak, cancel: cancelSpeak } = useSpeechSynthesis();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const messageQueue = useRef<string[]>([]);
  const questionQueue = useRef<string[]>([]);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // 💡 ステートでも履歴を保持
  const [lectureHistory, setLectureHistory] = useState<string[]>([]);
  const [notebook, setNotebook] = useState("");
  const [missingPoints, setMissingPoints] = useState<string[]>([]);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [emotion, setEmotion] = useState<'neutral' | 'happy' | 'excited' | 'confused'>('neutral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBackendThinking, setIsBackendThinking] = useState(false);
  const [isManabuSpeaking, setIsManabuSpeaking] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/manabu';
    let pingInterval: NodeJS.Timeout;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      const ws = new WebSocket(url);
      ws.onopen = () => {
        setSocket(ws);
        
        // 💡 記憶の自動復旧ロジック (localStorageから読み込み)
        const savedHistory = localStorage.getItem("dt_history");
        const savedStruct = localStorage.getItem("dt_struct");
        const savedOrig = localStorage.getItem("dt_orig");
        
        if (savedHistory && savedStruct) {
          console.log("🔄 記憶を同期中...");
          ws.send(JSON.stringify({
            type: "SYNC_SESSION",
            payload: {
              lecture_history: JSON.parse(savedHistory),
              structured_original: JSON.parse(savedStruct),
              original_text: savedOrig || ""
            }
          }));
          setLectureHistory(JSON.parse(savedHistory));
        }

        while (messageQueue.current.length > 0) {
          const msg = messageQueue.current.shift();
          if (msg) ws.send(msg);
        }

        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "PING" }));
        }, 30000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const unlockTypes = ["REACTION", "STUDENT_QUESTION", "FINAL_NOTE", "RESTARTED", "MATERIAL_READY", "ERROR", "SESSION_SYNCED"];
        if (unlockTypes.includes(data.type)) setIsBackendThinking(false);

        switch (data.type) {
          case "MATERIAL_READY":
            setIsAnalyzing(false);
            // 💡 解析結果を保存
            localStorage.setItem("dt_struct", JSON.stringify(data.structured_original));
            localStorage.setItem("dt_orig", data.original_text);
            break;
          case "REACTION":
            setEmotion(data.emotion);
            if (data.message) {
              setIsManabuSpeaking(true);
              speak(data.message, () => setIsManabuSpeaking(false));
            }
            break;
          case "STUDENT_QUESTION":
            setEmotion("confused");
            questionQueue.current.push(data.message);
            break;
          case "FINAL_NOTE":
            setNotebook(data.notebook || "");
            setMissingPoints(data.missing_points || []);
            setMisconceptions(data.misconceptions || []);
            // 💡 完了したら履歴をクリアして良い（任意）
            break;
          case "ERROR":
            setIsAnalyzing(false);
            setIsBackendThinking(false);
            setEmotion("confused");
            if (data.message) {
              setIsManabuSpeaking(true);
              speak(data.message, () => setIsManabuSpeaking(false));
            }
            if (onErrorRef.current) onErrorRef.current(data.message);
            break;
        }
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setSocket(null);
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      setSocket((prev) => { prev?.close(); return null; });
    };
  }, [speak]);

  // 💡 発話送信と保存をセットで行う
  const sendMessage = useCallback((type: string, payload: any) => {
    if (type === "USER_TALK") {
      const newHistory = [...lectureHistory, payload.text];
      setLectureHistory(newHistory);
      localStorage.setItem("dt_history", JSON.stringify(newHistory));
    }

    if (type === "RESTART_LECTURE") {
      localStorage.removeItem("dt_history");
      setLectureHistory([]);
    }

    const message = JSON.stringify({ type, ...payload });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      messageQueue.current.push(message);
    }
  }, [socket, lectureHistory]);

  return { 
    notebook, setNotebook, missingPoints, misconceptions, 
    emotion, isAnalyzing, setIsAnalyzing, 
    isBackendThinking, setIsBackendThinking, 
    isManabuSpeaking, setIsManabuSpeaking,
    questionQueue, 
    sendMessage, speak, cancelSpeak 
  };
};