"use client";

import { useState, useRef } from "react";

// 親から関数を受け取るための型定義
interface Props {
  onHistoryUpdate: (text: string) => void;
}

export default function MicButton({ onHistoryUpdate }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState("Standby");
  const [aiReply, setAiReply] = useState("");
  const [loading, setLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setStatus("Ready to Send");
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioUrl(null);
      setAiReply("");
      setStatus("Recording...");

    } catch (error) {
      console.error(error);
      alert("Microphone permission required");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const sendAudioToBackend = async () => {
    if (!audioBlob) return;
    setStatus("Processing...");
    setLoading(true);
    setAiReply("");

    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.wav");

    try {
      const res = await fetch("http://127.0.0.1:8000/talk", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setLoading(false);
      
      if (data.reply) {
          setAiReply(data.reply);
          setStatus("Replied");
          
          // ★ 親に会話内容を報告！
          onHistoryUpdate(`Teacher: (Voice)\nStudent: ${data.reply}`);

          if (data.audio) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
            audio.play();
          }
      } else {
          setStatus("Error: No reply");
      }

    } catch (error) {
      console.error(error);
      setLoading(false);
      setStatus("Network Error");
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative mb-8 group">
        <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-500 ${
            isRecording ? "bg-red-500/50 scale-150" : "bg-blue-500/30 scale-100 group-hover:scale-110"
        }`}></div>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center text-4xl shadow-2xl transition-all duration-300 border-4 ${
            isRecording
              ? "bg-red-600 border-red-400 animate-pulse-ring text-white"
              : "bg-gray-800 border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-white hover:scale-105"
          }`}
        >
          {isRecording ? "⏹️" : "🎙️"}
        </button>
      </div>

      <div className={`px-4 py-1 rounded-full text-sm font-mono mb-6 transition-all ${
          loading ? "bg-yellow-500/20 text-yellow-300 animate-pulse" : "bg-gray-800 text-gray-400"
      }`}>
        STATUS: {status}
      </div>

      {audioUrl && !loading && !aiReply && (
        <div className="flex flex-col items-center gap-3 animate-fade-in w-full">
            <button
                onClick={sendAudioToBackend}
                className="w-full max-w-xs py-3 bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white rounded-lg font-bold shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-1"
            >
                🚀 Send to MANABU
            </button>
        </div>
      )}

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