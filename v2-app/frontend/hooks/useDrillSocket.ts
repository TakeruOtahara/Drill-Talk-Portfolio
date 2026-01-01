// frontend/hooks/useDrillSocket.ts
import { useState, useEffect, useRef, useCallback } from 'react';

// サーバーから送られてくるデータの型
type ServerResponse = {
  reply: string;
  audio?: string;
};

export const useDrillSocket = (onMessageReceived: (data: ServerResponse) => void) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. コンポーネントがマウントされたら接続開始
    const ws = new WebSocket("ws://127.0.0.1:8000/ws");
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WS Connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      // サーバーからデータが来たらここが動く
      try {
        const data: ServerResponse = JSON.parse(event.data);
        onMessageReceived(data); // 親にデータを渡す
      } catch (e) {
        console.error("Parse Error:", e);
      }
    };

    ws.onclose = () => {
      console.log("❌ WS Disconnected");
      setIsConnected(false);
    };

    // クリーンアップ（画面遷移時などに切断）
    return () => {
      ws.close();
    };
  }, []); // 最初の1回だけ実行

  // データを送る関数
  const sendAudioData = useCallback((audioBlob: Blob) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(audioBlob); // バイナリを直接ぶん投げる
    } else {
      console.error("Socket not ready");
    }
  }, []);

  return { isConnected, sendAudioData };
};