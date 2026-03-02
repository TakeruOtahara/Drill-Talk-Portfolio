import { useState, useEffect, useCallback } from 'react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

export const useManabu = () => {
  const { speak } = useSpeechSynthesis();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [themes, setThemes] = useState<string[]>([]);
  const [notebook, setNotebook] = useState("");
  const [currentScore, setCurrentScore] = useState(0);
  const [emotion, setEmotion] = useState<'neutral' | 'happy' | 'excited' | 'confused'>('neutral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/manabu');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "MATERIAL_READY":
          setThemes(data.themes);
          setIsAnalyzing(false);
          break;
        case "REACTION":
          setCurrentScore(data.score);
          setEmotion(data.emotion);
          // バックエンドからの相槌を喋らせる
          speak(data.message); 
          break;
        case "STUDENT_QUESTION":
          setEmotion("confused");
          // マナブ君の質問を喋らせる
          speak(data.message); 
          break;
        case "FINAL_NOTE":
          setNotebook(data.notebook);
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
    return () => ws.close();
  }, [speak]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, ...payload }));
    }
  }, [socket]);

  return { themes, currentScore, emotion, notebook, isAnalyzing, setIsAnalyzing, sendMessage };
};