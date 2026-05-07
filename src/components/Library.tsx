import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { FileText, Loader2, BookOpen, Clock, Tag } from 'lucide-react';
import { motion } from 'motion/react';

interface Book {
  id: string;
  title: string;
  author: string;
  content: string;
  category: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
}

export default function Library({ onSelectBook }: { onSelectBook: (id: string) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const path = 'books';
    const q = query(collection(db, path), where('ownerId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const b = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
      setBooks(b);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-full">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">내 서재</h2>
            <p className="text-slate-500">당신만의 생생한 AI 오디오북 컬렉션</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : books.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-[2.5rem] p-16 text-center transition-all bg-white">
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-slate-300 w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">서재가 비어있습니다</h3>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">
              '오디오북 만들기'를 통해 당신만의 첫 번째 지식 라이브러리를 구축해보세요.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
            {books.map((book) => (
              <motion.div 
                key={book.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelectBook(book.id)}
                className="group bg-white p-6 rounded-[2rem] shadow-sm hover:shadow-xl border border-slate-100 transition-all cursor-pointer"
              >
                <div className="w-12 h-16 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
                  <FileText className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{book.title}</h4>
                <p className="text-sm text-slate-500 mb-4">{book.author}</p>
                
                <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{book.createdAt ? new Date(book.createdAt.seconds * 1000).toLocaleDateString() : '방금 전'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    <Tag className="w-3 h-3" />
                    <span className="capitalize">{book.category}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
