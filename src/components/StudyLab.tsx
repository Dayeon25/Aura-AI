import React, { useState, useEffect } from 'react';
import { 
  Users, Plus, MessageSquare, Mic, 
  Sparkles, Video, BookOpen, Search,
  Send, Loader2, Play,
  Presentation, GraduationCap, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { 
  collection, query, onSnapshot, 
  addDoc, serverTimestamp, orderBy, getDocs, where
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { geminiModel, generateLecture } from '../services/gemini';
import Markdown from 'react-markdown';

interface Room {
  id: string;
  name: string;
  creatorId: string;
  bookId?: string;
  isAIEnabled: boolean;
  createdAt: { toDate: () => Date } | null;
}

interface Message {
  id?: string;
  text: string;
  userId: string;
  userName?: string;
  userPhoto?: string;
  type: 'chat' | 'ai' | 'voice';
  createdAt?: { toDate: () => Date } | null;
}

export default function StudyLab() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isGeneratingLecture, setIsGeneratingLecture] = useState(false);
  const [lectureContent, setLectureContent] = useState<string | null>(null);

  useEffect(() => {
    const path = 'studyRooms';
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    const path = `studyRooms/${activeRoom.id}/messages`;
    const q = query(collection(db, path), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, [activeRoom]);

  const createRoom = async () => {
    if (!newRoomName) return;
    const path = 'studyRooms';
    try {
      await addDoc(collection(db, path), {
        name: newRoomName,
        creatorId: auth.currentUser?.uid,
        isAIEnabled: true,
        createdAt: serverTimestamp()
      });
      setNewRoomName('');
      setIsCreating(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const sendMessage = async () => {
    if (!newMessage || !activeRoom) return;
    const text = newMessage;
    setNewMessage('');
    
    const path = `studyRooms/${activeRoom.id}/messages`;
    try {
      await addDoc(collection(db, path), {
        text,
        userId: auth.currentUser?.uid,
        userName: auth.currentUser?.displayName,
        userPhoto: auth.currentUser?.photoURL,
        type: 'chat',
        createdAt: serverTimestamp()
      });

      // AI Check
      if (activeRoom.isAIEnabled && (text.startsWith('/ai') || text.includes('AI'))) {
        const result = await geminiModel.generateContent(`스터디 그룹의 맥락에서 다음 질문에 한국어로 답변해줘: ${text}`);
        await addDoc(collection(db, path), {
          text: result.response.text(),
          userId: 'ai-assistant',
          userName: 'Aura AI 교수님',
          type: 'ai',
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const handleGenerateLecture = async () => {
    setIsGeneratingLecture(true);
    setLectureContent(null);
    const path = 'books';
    try {
      if (!auth.currentUser) throw new Error("User not authenticated");
      // Filter by ownerId to satisfy security rules
      const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid), orderBy('createdAt', 'desc'));
      const booksSnapshot = await getDocs(q);
      const content = booksSnapshot.docs[0]?.data()?.content || "내용을 찾을 수 없습니다.";
      const lecture = await generateLecture(content);
      setLectureContent(lecture);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    } finally {
      setIsGeneratingLecture(false);
    }
  };

  return (
    <div className="flex h-full gap-8">
      {/* Sidebar: Rooms List */}
      <div className="w-80 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">스터디룸</h2>
          <button 
            onClick={() => setIsCreating(true)}
            className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="룸 검색..."
            className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {rooms.map(room => (
            <button 
              key={room.id}
              onClick={() => setActiveRoom(room)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                activeRoom?.id === room.id 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' 
                  : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <div className="flex items-center gap-3 mb-1">
                <Users className={`w-4 h-4 ${activeRoom?.id === room.id ? 'text-indigo-200' : 'text-indigo-600'}`} />
                <span className="font-bold truncate">{room.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest opacity-70">
                <div className={`w-1.5 h-1.5 rounded-full ${activeRoom?.id === room.id ? 'bg-white' : 'bg-green-500'} animate-pulse`} />
                현재 활성화됨
              </div>
            </button>
          ))}
        </div>

        {/* AI Lecture Promo Card */}
        <div className="bg-indigo-900 rounded-3xl p-6 text-white overflow-hidden relative group">
          <div className="relative z-10">
            <Presentation className="w-10 h-10 text-indigo-400 mb-4" />
            <h3 className="font-bold text-lg mb-2">AI 마스터클래스</h3>
            <p className="text-xs text-indigo-300 mb-4 font-medium leading-relaxed">학습 자료를 AI가 설명하는 인터랙티브 영상 강의로 변환하세요.</p>
            <button 
               onClick={handleGenerateLecture}
               className="flex items-center gap-2 text-xs font-bold bg-white text-indigo-900 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-all"
            >
              강의 시작
              <Play className="w-3 h-3 fill-current" />
            </button>
          </div>
          <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-indigo-800 opacity-50 group-hover:scale-125 transition-transform" />
        </div>
      </div>

      {/* Main Study Area */}
      <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
        {activeRoom ? (
          <>
            {/* Room Header */}
            <header className="h-20 border-b border-slate-100 px-8 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Users className="text-indigo-600 w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{activeRoom.name}</h3>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">공동 학습 세션 • AI 지원</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Mic className="w-5 h-5" /></button>
                <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Video className="w-5 h-5" /></button>
              </div>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-10 space-y-6 flex flex-col-reverse">
              <div className="space-y-6">
                {messages.map((msg, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start gap-4 ${msg.userId === auth.currentUser?.uid ? 'flex-row-reverse' : ''}`}
                  >
                    {msg.type === 'ai' ? (
                       <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center border border-amber-200">
                         <Sparkles className="w-5 h-5 text-amber-500" />
                       </div>
                    ) : (
                      <img src={msg.userPhoto || `https://ui-avatars.com/api/?name=${msg.userName}`} className="w-10 h-10 rounded-full border border-slate-100" />
                    )}
                    <div className={`max-w-md ${msg.userId === auth.currentUser?.uid ? 'items-end' : 'items-start'} flex flex-col`}>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 px-1">
                        {msg.userName} • {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed ${
                        msg.userId === auth.currentUser?.uid 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100' 
                          : msg.type === 'ai' 
                            ? 'bg-amber-50 text-amber-900 border border-amber-100 rounded-tl-none' 
                            : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
                      }`}>
                        {msg.type === 'ai' ? (
                          <div className="prose prose-sm prose-amber max-w-none">
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        ) : (
                         msg.text
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Input Area */}
            <div className="p-8 bg-slate-50 border-t border-slate-100">
              <div className="flex gap-4 items-end max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <textarea 
                    placeholder="질문을 입력하거나 /ai를 입력하여 교수님을 호출하세요..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    rows={1}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-sm"
                  />
                  <div className="absolute right-4 bottom-4 flex items-center gap-2">
                    <button onClick={sendMessage} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center mb-8 rotate-3 group hover:rotate-0 transition-transform">
              <MessageSquare className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">스터디룸 선택</h3>
            <p className="text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
              스터디룸에 참여하여 책에 대해 토론하고, 문제를 함께 풀거나 AI 교수님으로부터 깊이 있는 학습 통찰을 얻어보세요.
            </p>
          </div>
        )}

        {/* Transition Overlay for Lecture */}
        <AnimatePresence>
          {(isGeneratingLecture || lectureContent) && (
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute inset-0 bg-white z-50 overflow-y-auto"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 h-20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GraduationCap className="text-indigo-600 w-6 h-6" />
                  <h3 className="font-bold text-xl">AI 마스터클래스 강의</h3>
                </div>
                <button onClick={() => { setLectureContent(null); setIsGeneratingLecture(false); }} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="max-w-4xl mx-auto py-16 px-8">
                {isGeneratingLecture ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-6">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                    <div className="text-center">
                      <p className="text-xl font-bold text-slate-900 mb-2">인터랙티브 강의 생성 중...</p>
                      <p className="text-slate-500 font-medium">교과서 내용을 마스터클래스 형식으로 합성하고 있습니다. 잠시만 기다려 주세요.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="aspect-video bg-slate-900 rounded-[2.5rem] flex items-center justify-center overflow-hidden shadow-2xl relative group">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                      <div className="z-10 text-center">
                         <div className="w-20 h-20 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6 cursor-pointer hover:scale-110 transition-transform">
                            <Play className="text-white w-8 h-8 fill-current" />
                         </div>
                         <p className="text-white font-bold tracking-wider uppercase text-xs">AI 시뮬레이션 강의 영상</p>
                      </div>
                      <img src="https://images.unsplash.com/photo-1544391682-178c6a5ff39c?q=80&w=2000&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="Lecture Cover" />
                    </div>

                    <div className="prose prose-indigo prose-lg max-w-none bg-slate-50 p-12 rounded-[2.5rem] border border-slate-100">
                      <Markdown>{lectureContent || ''}</Markdown>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                        <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                           <BookOpen className="w-5 h-5" />
                           스터디 질문
                        </h4>
                        <ul className="space-y-3 text-sm text-indigo-700 font-medium list-disc pl-5">
                          <li>섹션 1에서 제시된 핵심 논거는 무엇인가요?</li>
                          <li>작가는 발견한 내용을 현대 이론과 어떻게 연결시키나요?</li>
                          <li>이 텍스트에 대한 역사적 배경의 영향을 분석해보세요.</li>
                        </ul>
                      </div>
                      <div className="bg-amber-50 p-8 rounded-3xl border border-amber-100">
                        <h4 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                           <GraduationCap className="w-5 h-5" />
                           학습 목표
                        </h4>
                        <ul className="space-y-3 text-sm text-amber-700 font-medium">
                          <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> 핵심 용어 마스터하기</li>
                          <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> 실제 시나리오에 개념 적용하기</li>
                          <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> 소스 자료를 비판적으로 분석하기</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal for Creating Room */}
        <AnimatePresence>
          {isCreating && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[2rem] p-10 max-w-md w-full shadow-2xl"
              >
                <h3 className="text-2xl font-bold text-slate-900 mb-2">스터디룸 생성</h3>
                <p className="text-slate-500 text-sm mb-8 font-medium">다른 사람들을 초대하여 AI와 함께 토론하고 배워보세요.</p>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">룸 이름</label>
                    <input 
                      type="text" 
                      placeholder="예: 양자 역학 토론방"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl py-4 px-6 text-sm focus:border-indigo-500 focus:ring-0 transition-all font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-4 pt-4">
                    <button 
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-4 px-6 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                    >
                      취소
                    </button>
                    <button 
                      onClick={createRoom}
                      className="flex-1 py-4 px-6 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                    >
                      지금 생성하기
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
