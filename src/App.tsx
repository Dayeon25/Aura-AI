import React, { useState, useEffect } from 'react';
import { 
  Book as BookIcon, 
  Camera, 
  Settings, 
  Users, 
  Volume2,
  Search,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Component Imports
import Library from './components/Library';
import CreationCenter from './components/CreationCenter';
import Reader from './components/Reader';
import StudyLab from './components/StudyLab';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'library' | 'create' | 'reader' | 'study'>('library');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Ensure user profile exists
        try {
          await setDoc(doc(db, 'users', u.uid), {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            updatedAt: new Date()
          }, { merge: true });
        } catch (e) {
          console.error("Error updating user profile:", e);
        }
      }
    });
    return unsubscribe;
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-indigo-200 shadow-xl">
            <Volume2 className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Aura AI</h1>
          <p className="text-slate-500 mb-8">AI 기반 오디오북 & 스터디 랩</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all transform hover:scale-[1.02] flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-sm p-0.5" alt="Google" />
            Google 계정으로 계속하기
          </button>
          <p className="mt-6 text-xs text-slate-400">
            OCR 스캐닝 • 역할별 음성 연기 • 실시간 스터디
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="w-72 bg-white border-r border-slate-200 flex flex-col z-50 absolute md:relative h-full"
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Volume2 className="text-white w-6 h-6" />
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900">Aura AI</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-2 py-4">
              <NavItem 
                icon={<BookIcon />} 
                label="내 서재" 
                active={activeTab === 'library'} 
                onClick={() => { setActiveTab('library'); setSelectedBookId(null); }} 
              />
              <NavItem 
                icon={<Camera />} 
                label="오디오북 만들기" 
                active={activeTab === 'create'} 
                onClick={() => setActiveTab('create')} 
              />
              <NavItem 
                icon={<Users />} 
                label="스터디 랩" 
                active={activeTab === 'study'} 
                onClick={() => setActiveTab('study')} 
              />
            </nav>

            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="User" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                <button onClick={() => auth.signOut()} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`${isSidebarOpen ? 'hidden' : 'block'} p-2 hover:bg-slate-100 rounded-lg transition-colors`}
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          
          <div className="flex-1 max-w-2xl relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="오디오북, 노트, 스터디룸 검색..."
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" aria-label="설정">
              <Settings className="w-6 h-6" />
            </button>
            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" aria-label="음성 안내">
              <Volume2 className="w-6 h-6" />
            </button>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 relative p-6">
          {activeTab === 'library' && (
            <Library onSelectBook={(id) => { setSelectedBookId(id); setActiveTab('reader'); }} />
          )}
          {activeTab === 'create' && <CreationCenter onComplete={() => setActiveTab('library')} />}
          {activeTab === 'study' && <StudyLab />}
          {activeTab === 'reader' && selectedBookId && (
            <Reader bookId={selectedBookId} onBack={() => setActiveTab('library')} />
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
        active 
          ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span className={`${active ? 'text-indigo-600' : 'text-slate-400'}`}>{icon}</span>
      {label}
    </button>
  );
}
