// frontend/components/MicButton.tsx
"use client";

import { useState, useRef } from "react";
import { useDrillSocket } from "../../backend/hooks/useDrillSocket"; // ★新兵器

interface Props {
  onHistoryUpdate: (text: string) => void;
}

export default function MicButton({ onHistoryUpdate }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("Connecting...");
  const [aiReply, setAiReply] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // --- WebSocket Hook の利用 ---
  // サーバーからメッセージが来た時の処理をここに書く
  const { isConnected, sendAudioData } = useDrillSocket((data) => {
    setStatus("Replied via WS");
    setAiReply(data.reply);
    
    // 履歴更新
    onHistoryUpdate(`Teacher: (Voice)\nStudent: ${data.reply}`);

    // 音声再生
    if (data.audio) {
      const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
      audio.play();
    }
  });

  // --- 録音開始 ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        // ★重要: 録音が終わったら、即座にWebSocketで投げる！
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        if (isConnected) {
            setStatus("Sending via WS...");
            sendAudioData(blob); // 🚀 ロケット発射
        } else {
            alert("WebSocketがつながっていません");
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAiReply("");
      setStatus("Recording...");

    } catch (error) {
      console.error(error);
    }
  };

  // --- 録音停止 ---
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop(); // これがトリガーで onstop が動き、送信される
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* 接続ステータス表示 */}
      <div className={`absolute top-0 right-0 m-4 px-2 py-1 rounded text-xs font-mono ${
          isConnected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
      }`}>
        WS: {isConnected ? "CONNECTED" : "DISCONNECTED"}
      </div>

      <div className="relative mb-8 group">
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
            isRecording ? "bg-red-500/50 scale-150" : "bg-blue-500/30 scale-100 group-hover:scale-110"
        }`}></div>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConnected}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center text-4xl shadow-2xl transition-all duration-300 border-4 ${
            !isConnected 
              ? "bg-gray-700 border-gray-600 opacity-50 cursor-not-allowed"
              : isRecording
                ? "bg-red-600 border-red-400 animate-pulse-ring text-white"
                : "bg-gray-800 border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-white hover:scale-105"
          }`}
        >
          {isRecording ? "⏹️" : "🎙️"}
        </button>
      </div>

      <div className="px-4 py-1 rounded-full text-sm font-mono mb-6 bg-gray-800 text-gray-400">
        STATUS: {status}
      </div>

      {aiReply && (
        <div className="relative mt-4 p-6 bg-gray-800/80 rounded-2xl border border-blue-500/30 w-full animate-fade-in shadow-2xl">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[10px] border-b-gray-800/80"></div>
            <p className="text-xs text-blue-400 font-bold mb-2 tracking-wider">MANABU (AI STUDENT)</p>
            <p className="text-xl text-white font-medium leading-relaxed drop-shadow-md">
                "{aiReply}"
            </p>
        </div>
      )}
    </div>
  );
}