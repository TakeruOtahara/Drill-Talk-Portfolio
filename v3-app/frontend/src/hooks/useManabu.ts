// --- v3-app/frontend/src/hooks/useManabu.ts ---
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

interface UseManabuProps {
  isListening: boolean;
  onError?: (msg: string) => void; // メッセージを受け取れるように拡張
}

export const useManabu = ({ isListening, onError }: UseManabuProps) => {
  const { speak, cancel: cancelSpeak } = useSpeechSynthesis();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  const messageQueue = useRef<string[]>([]);
  const questionQueue = useRef<string[]>([]);
  
  // 💡 onError を Ref で管理することで、useEffect の再発火を防ぐ（重要！）
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

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
      console.log("🚀 マナブ君に回線をつなぎます...", url);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("✅ マナブ君とつながりました");
        setSocket(ws);
        
        // 溜まっていたメッセージを送信
        while (messageQueue.current.length > 0) {
          const msg = messageQueue.current.shift();
          if (msg) ws.send(msg);
        }

        // Azureのアイドルタイムアウト対策
        pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const unlockTypes = ["REACTION", "STUDENT_QUESTION", "FINAL_NOTE", "RESTARTED", "MATERIAL_READY", "ERROR"];
        if (unlockTypes.includes(data.type)) setIsBackendThinking(false);

        switch (data.type) {
          case "MATERIAL_READY":
            setIsAnalyzing(false);
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
            setEmotion("neutral");
            setIsManabuSpeaking(true);
            speak("まとめノートができました！", () => setIsManabuSpeaking(false));
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

      ws.onerror = () => {
        console.error("❌ 通信エラーが発生しました");
      };

      ws.onclose = () => {
        clearInterval(pingInterval);
        setSocket(null);
        console.log("🔌 接続が切れました。5秒後に再接続を試みます...");
        // 💡 すぐに再接続せず、5秒待つことで無限ループを防ぐ（バックオフ）
        reconnectTimeout = setTimeout(connect, 5000);
      };
    };

    connect();

    // クリーンアップ処理
    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      setSocket((prev) => {
        prev?.close();
        return null;
      });
    };
  }, [speak]); // speak は useCallback されている前提なので安全

  const sendMessage = useCallback((type: string, payload: any) => {
    const message = JSON.stringify({ type, ...payload });
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    } else {
      console.log("⏳ 接続待機中のためキューに保存しました");
      messageQueue.current.push(message);
    }
  }, [socket]);

  return { 
    notebook, setNotebook, missingPoints, misconceptions, 
    emotion, isAnalyzing, setIsAnalyzing, 
    isBackendThinking, setIsBackendThinking, 
    isManabuSpeaking, setIsManabuSpeaking,
    questionQueue, 
    sendMessage, speak, cancelSpeak 
  };
};