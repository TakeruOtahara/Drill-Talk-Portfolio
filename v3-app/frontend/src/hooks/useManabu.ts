import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

export const useManabu = (isListening: boolean) => {
  const { speak, cancel: cancelSpeak } = useSpeechSynthesis();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [notebook, setNotebook] = useState("");
  const [currentScore, setCurrentScore] = useState(0);
  const [emotion, setEmotion] = useState<'neutral' | 'happy' | 'excited' | 'confused'>('neutral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  // 【修正】最新の isListening を WebSocket 内で参照するための Ref
  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const lastReactionTimeRef = useRef<number>(0);
  const REACTION_COOLDOWN = 15000;

  useEffect(() => {
    // 接続先URL。環境変数がない場合はローカル
    const url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/manabu';
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const now = Date.now();

      // 何かメッセージが届いたら考え中を解除（ガード強化）
      const unlockTypes = ["REACTION", "STUDENT_QUESTION", "FINAL_NOTE", "RESTARTED"];
      if (unlockTypes.includes(data.type)) {
        setIsThinking(false);
      }

      switch (data.type) {
        case "MATERIAL_READY":
          setThemes(data.themes);
          setIsAnalyzing(false);
          break;

        case "REACTION":
          // Refを使って現在のマイク状態を確認（接続は切らない）
          if (isListeningRef.current || (now - lastReactionTimeRef.current) < REACTION_COOLDOWN) {
            setEmotion(data.emotion);
            return; 
          }
          lastReactionTimeRef.current = now;
          setCurrentScore(data.score);
          setEmotion(data.emotion);
          speak(data.message); 
          break;

        case "STUDENT_QUESTION":
          setEmotion("confused");
          speak(data.message); 
          break;

        case "FINAL_NOTE":
          const noteData = data.notebook || data.notebook_html || "";
          setNotebook(noteData);
          setThemes(data.themes);
          setEmotion("neutral");
          speak("まとめノートができました！");
          break;

        case "RESTARTED":
          setThemes(data.themes);
          setNotebook("");
          setCurrentScore(0);
          speak(data.message);
          break;
      }
    };

    setSocket(ws);
    // クリーンアップ：コンポーネントが消える時だけ切断する
    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [speak]); // isListening を外したことで接続が安定します

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, ...payload }));
    }
  }, [socket]);

  return { themes, currentScore, emotion, notebook, setNotebook, isAnalyzing, setIsAnalyzing, isThinking, setIsThinking, sendMessage, cancelSpeak };
};