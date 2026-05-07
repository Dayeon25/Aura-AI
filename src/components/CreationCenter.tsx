import React, { useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { 
  Camera, RefreshCw, Check, Loader2, 
  Sparkles, Upload, Plus,
  ArrowRight
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { geminiModel } from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';

export default function CreationCenter({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<'chooser' | 'uploader' | 'scanner'>('chooser');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isRefining, setIsRefining] = useState(false);
  const [fileName, setFileName] = useState<string>('');

  // Scanner State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isWatching, setIsWatching] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsWatching(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("카메라 접근을 허용해주세요.");
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const imageData = canvasRef.current.toDataURL('image/png');
        stopCamera();
        processImage(imageData);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsWatching(false);
    }
  };

  const processImage = async (image: string) => {
    setIsProcessing(true);
    try {
      const worker = await createWorker('kor+eng');
      const ret = await worker.recognize(image);
      setExtractedText(ret.data.text);
      setFileName(`스캔 문서 ${new Date().toLocaleDateString()}`);
      await worker.terminate();
    } catch (err) {
      console.error("OCR Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name.replace(/\.[^/.]+$/, ""));
    const content = await file.text();
    setExtractedText(content);
    setIsProcessing(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 
      'text/plain': ['.txt'], 
      'text/markdown': ['.md']
    }
  });

  const refineText = async () => {
    if (!extractedText) return;
    setIsRefining(true);
    try {
      const prompt = `다음 텍스트를 깨끗하고 읽기 좋은 오디오북용 한국어 원고로 다듬어줘. 오타를 수정하고 문맥을 매끄럽게 연결해줘. 텍스트: ${extractedText}`;
      const result = await geminiModel.generateContent(prompt);
      setExtractedText(result.response.text());
    } catch (err) {
      console.error("Refine Error:", err);
    } finally {
      setIsRefining(false);
    }
  };

  const saveBook = async () => {
    if (!extractedText || !auth.currentUser) return;
    const path = 'books';
    try {
      await addDoc(collection(db, path), {
        title: fileName || "제목 없음",
        author: 'Aura AI 오디오북',
        content: extractedText,
        ownerId: auth.currentUser.uid,
        category: mode === 'scanner' ? 'scanned' : 'upload',
        source: mode,
        createdAt: serverTimestamp()
      });
      onComplete();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">새 오디오북 만들기</h2>
        <p className="text-slate-500 font-medium">실제 책을 스캔하거나 파일을 업로드하여 AI 오디오북으로 변환하세요</p>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'chooser' && (
          <motion.div 
            key="chooser"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <button 
              onClick={() => { setMode('uploader'); }}
              className="group p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all text-left space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">파일 업로드</h3>
                <p className="text-slate-500">텍스트, 마크다운 파일을 오디오북으로 직접 변환합니다.</p>
              </div>
              <div className="flex items-center gap-2 text-indigo-600 font-bold pt-4">
                <span>시작하기</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            <button 
              onClick={() => { setMode('scanner'); startCamera(); }}
              className="group p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:border-indigo-100 transition-all text-left space-y-6"
            >
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-slate-900">도서 스캔</h3>
                <p className="text-slate-500">카메라로 실제 책 페이지를 스캔하여 텍스트를 추출합니다.</p>
              </div>
              <div className="flex items-center gap-2 text-indigo-600 font-bold pt-4">
                <span>시작하기</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </motion.div>
        )}

        {(mode === 'uploader' || mode === 'scanner') && (
          <motion.div 
            key="interface"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[500px]"
          >
            {/* Interface Header */}
            <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { 
                    setMode('chooser'); 
                    setExtractedText(''); 
                    stopCamera(); 
                  }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5 text-slate-400 rotate-180" />
                </button>
                <span className="font-bold text-slate-700">
                  {mode === 'uploader' ? '파일 업로드' : '도서 스캔'}
                </span>
              </div>
            </div>

            {/* Main Interface Area */}
            <div className="flex-1 p-8">
              {!isProcessing && !extractedText && (
                <div className="h-full flex flex-col items-center justify-center">
                  {mode === 'uploader' ? (
                    <div {...getRootProps()} className={`w-full max-w-xl h-64 border-4 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-4 transition-all ${isDragActive ? 'border-indigo-400 bg-indigo-50/50 scale-[1.02]' : 'border-slate-100 hover:border-indigo-200'}`}>
                      <input {...getInputProps()} />
                      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-slate-900">파일을 드래그하세요</p>
                        <p className="text-slate-500 font-medium mt-1">또는 클릭하여 파일 선택 (txt, md 지원)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-xl aspect-video bg-slate-900 rounded-[2rem] overflow-hidden relative shadow-2xl">
                      {isWatching ? (
                        <>
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-8 flex justify-center">
                            <button 
                              onClick={captureFrame}
                              className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full border-4 border-white flex items-center justify-center shadow-xl active:scale-90 transition-all hover:scale-110"
                            >
                              <div className="w-14 h-14 bg-white rounded-full shadow-inner" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4">
                          <Loader2 className="w-10 h-10 text-white animate-spin" />
                          <p className="text-white font-medium">카메라 준비 중...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="h-full flex flex-col items-center justify-center gap-6 py-12">
                  <div className="relative">
                    <div className="w-32 h-32 bg-indigo-600 rounded-full animate-pulse blur-2xl absolute -inset-4 opacity-20" />
                    <div className="w-32 h-32 bg-white rounded-full shadow-2xl border border-indigo-50 flex items-center justify-center relative">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-2xl font-black text-indigo-900">AI가 문석을 분석 중입니다</h3>
                    <p className="text-indigo-500 font-medium">잠시만 기다려주세요...</p>
                  </div>
                </div>
              )}

              {!isProcessing && extractedText && (
                <div className="h-full flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                        <Check className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">텍스트 추출 완료</h3>
                        <p className="text-xs text-slate-500 font-medium">{fileName}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setExtractedText(''); if(mode==='scanner') startCamera(); }}
                      className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      다시 하기
                    </button>
                  </div>

                  <div className="flex-1 bg-slate-50 rounded-3xl p-8 border border-slate-100 overflow-y-auto max-h-[400px]">
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                      {extractedText}
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={refineText}
                      disabled={isRefining}
                      className="flex-1 flex items-center justify-center gap-2 py-4 px-6 bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-2xl font-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {isRefining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                      AI 오디오북 최적화
                    </button>
                    <button 
                      onClick={saveBook}
                      className="flex-[1.5] flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 text-white hover:bg-indigo-700 rounded-2xl font-black shadow-xl shadow-indigo-200 transition-all active:scale-95 translate-y-0 hover:-translate-y-1"
                    >
                      <Plus className="w-5 h-5" />
                      오디오북 서재에 저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
