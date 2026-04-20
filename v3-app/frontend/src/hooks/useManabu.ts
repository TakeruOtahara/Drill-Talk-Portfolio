// --- v3-app/frontend/src/hooks/useManabu.ts ---
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

interface UseManabuProps {
  isListening: boolean;
  onError?: () => void;
}

export const useManabu = ({ isListening, onError }: UseManabuProps) => {
  const { speak, cancel: cancelSpeak } = useSpeechSynthesis();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  
  const messageQueue = useRef<string[]>([]);
  const questionQueue = useRef<string[]>([]);
  
  const [notebook, setNotebook] = useState("");
  const [missingPoints, setMissingPoints] = useState<string[]>([]);
  const [misconceptions, setMisconceptions] = useState<string[]>([]);
  const [emotion, setEmotion] = useState<'neutral' | 'happy' | 'excited' | 'confused'>('neutral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBackendThinking, setIsBackendThinking] = useState(false);

  const [isManabuSpeaking, setIsManabuSpeaking] = useState(false);

  const isListeningRef = useRef(isListening);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  useEffect(() => {
    // 💡【Azure対応】URLのハードコードを廃止し、環境変数を利用
    const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/manabu';
    console.log("🚀 マナブ君に回線をつなぎます...", url);
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log("✅ マナブ君とつながりました");
      while (messageQueue.current.length > 0) {
        const msg = messageQueue.current.shift();
        if (msg) ws.send(msg);
      }

      // 💡【Azure対応】通信のアイドルタイムアウトを防ぐためのPing送信（30秒ごと）
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "PING" }));
        }
      }, 30000);

      // 💡 切断時にPingタイマーをクリアする設定
      ws.onclose = () => {
        clearInterval(pingInterval);
        console.log("🔌 接続終了");
      };
    };

    ws.onmessage = (event) => {
      console.log("📥 受信データ:", event.data);
      const data = JSON.parse(event.data);
      
      const unlockTypes = ["REACTION", "STUDENT_QUESTION", "FINAL_NOTE", "RESTARTED", "MATERIAL_READY", "ERROR"];
      if (unlockTypes.includes(data.type)) {
        setIsBackendThinking(false);
      }

      switch (data.type) {
        case "MATERIAL_READY":
          setIsAnalyzing(false);
          break;
        case "REACTION":
          setEmotion(data.emotion);
          if (data.message) {
            console.log("🗣️ 相槌を発声します:", data.message);
            setIsManabuSpeaking(true);
            speak(data.message, () => {
                setIsManabuSpeaking(false);
            });
          }
          break;
        case "STUDENT_QUESTION":
          setEmotion("confused");
          console.log("📥 マナブ君が質問を思いつきました。先生が話し終わるのを待ちます。");
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
        case "RESTARTED":
          setNotebook("");
          setIsManabuSpeaking(true);
          speak(data.message, () => setIsManabuSpeaking(false));
          break;
        case "ERROR":
          setIsAnalyzing(false);
          setIsBackendThinking(false);
          setEmotion("confused");
          setIsManabuSpeaking(true);
          speak(data.message, () => setIsManabuSpeaking(false));
          if (onError) onError();
          break;
      }
    };

    ws.onerror = (e) => console.error("❌ 通信エラー:", e);

    setSocket(ws);
    return () => { ws.close(); };
  }, [speak, onError]);

  const sendMessage = useCallback((type: string, payload: any) => {
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
    sendMessage, speak, cancelSpeak 
  };
};