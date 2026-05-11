// --- v3-app/frontend/src/hooks/useManabu.ts ---
import { useState, useEffect, useCallback, useRef } from "react";
import { useSpeechSynthesis } from "./useSpeechSynthesis";

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
  isSleeping: boolean;
  pauseConnection: () => void;
  resumeConnection: () => void;
}

export const useManabu = ({ 
  isListening, 
  onError,
  onReset 
}: { 
  isListening: boolean; 
  onError: () => void;
  onReset: () => void; 
}): UseManabuReturn => {
  const { speak: synthSpeak, cancel: synthCancel } = useSpeechSynthesis();
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

  // スリープ機能用のStateとRef
  const [isSleeping, setIsSleeping] = useState(false);
  const isIntentionalClose = useRef(false);
  const socketInstanceRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  // 意図的に接続を切る関数
  const pauseConnection = useCallback(() => {
    if (socketInstanceRef.current) {
      isIntentionalClose.current = true;
      socketInstanceRef.current.close();
      setIsSleeping(true);
    }
  }, []);

  // 再接続する関数
  const resumeConnection = useCallback(() => {
    setIsSleeping(false);
    isIntentionalClose.current = false;
    if (connectRef.current) {
      connectRef.current(); // useEffect内のconnect関数を外から発火
    }
  }, []);

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
    setIsManabuSpeaking(true);
    synthSpeak(text, () => {
      setIsManabuSpeaking(false);
      if (onEnd) onEnd();
    });
  }, [synthSpeak]);

  const cancelSpeak = useCallback(() => {
    synthCancel();
    setIsManabuSpeaking(false);
  }, [synthCancel]);

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
      // 🛡️ APIキーも、外部のWS_URLも使わない。Next.js自身のプロキシを叩く。
      const wsUrl = `${protocol}//${window.location.host}/ws/manabu`;

      const ws = new WebSocket(wsUrl);
      socketInstance = ws;
      socketInstanceRef.current = ws; // 外から切断できるようにRefに保存

      ws.onopen = () => {
        setSocket(ws);
        const historyStr = localStorage.getItem("dt_history");
        const structuredStr = localStorage.getItem("dt_structured");
        const originalStr = localStorage.getItem("dt_original");

        const history = historyStr ? JSON.parse(historyStr) : [];
        const structured = structuredStr ? JSON.parse(structuredStr) : null;

        // 🛡️ 記憶の自己破壊防止：有効な教材データがなければ、同期せずに強制リセット
        if (!structured || Object.keys(structured).length === 0) {
          console.warn("⚠️ 有効な教材データがありません。セッションを強制リセットします。");
          onReset();
          return;
        }

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
        setIsAnalyzing(false);       // 💡 リスを強制停止
        setIsBackendThinking(false); // 💡 リスを強制停止
        if (pingInterval) clearInterval(pingInterval);
        
        // 💡 変更：意図的な切断でなければ自動再接続する
        if (!isIntentionalClose.current) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket Error:", err);
      };
    };

    connectRef.current = connect; // connect関数を外部から呼べるようにRefに保存

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
    unlockAudio,
    isSleeping,
    pauseConnection,
    resumeConnection
  };
};