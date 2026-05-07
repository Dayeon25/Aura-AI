import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { 
  Play, Pause, SkipForward, SkipBack, 
  Settings, Bookmark, Mic, MessageSquare, 
  Sparkles, Languages, ChevronLeft, Loader2,
  Clock, Share2, Info, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeText, askQuestion, geminiModel } from '../services/gemini';
import Markdown from 'react-markdown';

interface BookData {
  title: string;
  author: string;
  content: string;
  category: string;
}

interface Interaction {
  type: string;
  timestamp: number;
  content: string;
  aiAnswer?: string;
}

export default function Reader({ bookId, onBack }: { bookId: string, onBack: () => void }) {
  const [book, setBook] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [activeVoice, setActiveVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [notes, setNotes] = useState<Interaction[]>([]);

  // Refs for speech
  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const fetchBook = async () => {
      const path = `books/${bookId}`;
      try {
        const d = await getDoc(doc(db, 'books', bookId));
        if (d.exists()) {
          setBook(d.data() as BookData);
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, path);
      }
      setLoading(false);
    };
    fetchBook();

    if (auth.currentUser) {
      const path = 'interactions';
      const q = query(collection(db, path), where('bookId', '==', bookId), where('userId', '==', auth.currentUser?.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotes(snapshot.docs.map(doc => doc.data() as Interaction));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
      });

      return () => {
        unsubscribe();
        synth.cancel();
      };
    } else {
      return () => synth.cancel();
    }
  }, [bookId]);

  useEffect(() => {
    const voices = synth.getVoices();
    if (voices.length > 0) setActiveVoice(voices[0]);
  }, [synth]);

  const togglePlayback = () => {
    if (isPlaying) {
      synth.pause();
    } else {
      if (synth.paused) {
        synth.resume();
      } else {
        playFrom(currentPosition);
      }
    }
    setIsPlaying(!isPlaying);
  };

  const playFrom = (startTextIndex: number) => {
    if (!book) return;
    synth.cancel();
    const textToSpeak = book.content.substring(startTextIndex);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.voice = activeVoice;
    utterance.rate = playbackSpeed;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentPosition(startTextIndex + event.charIndex);
      }
    };

    utterance.onend = () => setIsPlaying(false);
    utteranceRef.current = utterance;
    synth.speak(utterance);
    setIsPlaying(true);
  };

  const setBookmark = async () => {
    if (!auth.currentUser) return;
    const path = 'bookmarks';
    try {
      await addDoc(collection(db, path), {
        bookId,
        userId: auth.currentUser.uid,
        position: currentPosition,
        label: `${new Date().toLocaleTimeString()}에 저장된 책갈피`,
        createdAt: serverTimestamp()
      });
      alert("책갈피가 저장되었습니다!");
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const handleSummarize = async () => {
    if (!book) return;
    setIsSummarizing(true);
    const s = await summarizeText(book.content);
    setSummary(s);
    setIsSummarizing(false);
  };

  const handleAsk = async () => {
    if (!question || !book) return;
    setIsAsking(true);
    const answer = await askQuestion(book.content, question);
    setAiResponse(answer);
    setIsAsking(false);

    // Save as interaction
    const path = 'interactions';
    try {
      await addDoc(collection(db, path), {
        bookId,
        userId: auth.currentUser?.uid,
        content: question,
        aiAnswer: answer,
        type: 'question',
        timestamp: currentPosition,
        createdAt: serverTimestamp()
      });
      setQuestion('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const handleTranslation = async () => {
    if (!book) return;
    setIsAsking(true);
    const result = await geminiModel.generateContent(`다음 텍스트를 한국어로 번역해줘: ${book.content.substring(currentPosition, currentPosition + 1000)}`);
    setAiResponse(result.response.text());
    setIsAsking(false);
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  if (!book) return <div>책을 찾을 수 없습니다.</div>;

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-120px)] flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-medium">
          <ChevronLeft className="w-5 h-5" />
          서재로 돌아가기
        </button>
        <div className="flex items-center gap-2">
          <button onClick={setBookmark} className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-600">
            <Bookmark className="w-5 h-5" />
          </button>
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-600">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Reader Display */}
        <div className="flex-[2] bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col overflow-hidden">
          <div className="p-10 flex-1 overflow-y-auto prose prose-slate prose-lg max-w-none scroll-smooth">
            <div className="mb-12">
              <h1 className="text-4xl font-black text-slate-900 mb-4">{book.title}</h1>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-wider">{book.category}</span>
                <span className="text-slate-400 text-sm font-medium">{book.author} 저</span>
              </div>
            </div>
            
            <div className="relative text-slate-700 leading-relaxed text-xl font-medium tracking-tight">
              {book.content.split('').map((char: string, index: number) => (
                <span 
                  key={index}
                  className={index < currentPosition ? 'bg-indigo-100/50 text-indigo-900 rounded-sm px-0.5' : ''}
                >
                  {char}
                </span>
              ))}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="h-24 bg-slate-50 border-t border-slate-200 px-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button className="text-slate-400 hover:text-slate-900"><SkipBack className="w-6 h-6" /></button>
              <button 
                onClick={togglePlayback}
                className="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 translate-x-0.5" />}
              </button>
              <button className="text-slate-400 hover:text-slate-900"><SkipForward className="w-6 h-6" /></button>
            </div>

            <div className="flex-1 mx-12 h-1 bg-slate-200 rounded-full relative overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-indigo-600 transition-all"
                style={{ width: `${(currentPosition / book.content.length) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 py-1 bg-white border border-slate-100 rounded-md">속도</span>
                <select 
                  value={playbackSpeed} 
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-transparent border-none text-sm font-bold text-indigo-600 focus:ring-0 cursor-pointer"
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1.0x</option>
                  <option value="1.25">1.2x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2.0x</option>
                </select>
              </div>
              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><Settings className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        {/* Sidebar Features */}
        <div className="flex-1 flex flex-col gap-6 overflow-hidden">
          {/* AI Tools */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              AI 어시스턴트
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={handleSummarize}
                disabled={isSummarizing}
                className="flex items-center justify-center gap-2 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
              >
                {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                요약하기
              </button>
              <button 
                onClick={handleTranslation}
                className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-2xl font-bold text-sm transition-all"
              >
                <Languages className="w-4 h-4" />
                번역하기
              </button>
            </div>

            <div className="relative">
              <input 
                type="text" 
                placeholder="내용에 대해 질문해보세요..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
              />
              <button 
                onClick={handleAsk}
                disabled={isAsking}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-indigo-100"
              >
                {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              </button>
            </div>

            <AnimatePresence>
              {(summary || aiResponse) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 overflow-y-auto max-h-[300px]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{summary ? 'AI 요약' : 'AI 답변'}</span>
                    <button onClick={() => { setSummary(null); setAiResponse(null); }} className="text-indigo-300 hover:text-indigo-600 transition-colors"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="text-sm text-indigo-900 leading-relaxed font-medium markdown-body">
                    <Markdown>{summary || aiResponse || ''}</Markdown>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Interactions / Notes */}
          <div className="flex-1 bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 flex flex-col gap-6 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                노트 및 상호작용
              </h3>
              <button className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                <Mic className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {notes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Info className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400 font-medium">듣는 도중에 질문을 하거나 음성 메모를 남겨보세요.</p>
                </div>
              ) : (
                notes.map((note, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-100 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{note.type}</span>
                       <span className="text-[10px] font-bold text-indigo-400">{Math.floor(note.timestamp / 60)}:{(note.timestamp % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <p className="text-sm text-slate-800 font-semibold mb-2">{note.content}</p>
                    {note.aiAnswer && <p className="text-xs text-slate-500 italic border-l-2 border-indigo-200 pl-3 py-1">{note.aiAnswer.substring(0, 100)}...</p>}
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
