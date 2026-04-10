import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Download, Share2, Palette, Type as TypeIcon, Layout, Settings, Trash2, BarChart3, Image as ImageIcon, ChevronRight, Minus, Plus, AlignLeft, AlignCenter, AlignRight, X, Info, LogIn, LogOut, User as UserIcon, History, Save, Upload } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateImageFromPoem } from './lib/gemini';
import { Modal } from './components/Modal';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';

// Types
type AppView = 'home' | 'editor' | 'admin' | 'gallery' | 'auth';
type ImageStyle = 'watercolor' | 'oil' | 'minimal' | 'ink' | 'photo';
type TextSettings = {
  fontSize: number;
  fontFamily: string;
  textColor: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number;
};

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({ username: '', nickname: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [poem, setPoem] = useState('');
  const [author, setAuthor] = useState('');
  const [showAuthor, setShowAuthor] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('시의 감성을 분석하고 있습니다...');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<ImageStyle>('watercolor');
  const [imageOpacity, setImageOpacity] = useState(100);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Editor state
  const [activeTab, setActiveTab] = useState<'title' | 'poem' | 'author'>('title');
  const [activeMobileTool, setActiveMobileTool] = useState<'text' | 'style' | 'image' | 'actions'>('text');
  const [titleSettings, setTitleSettings] = useState<TextSettings>({
    fontSize: 36,
    fontFamily: 'font-myeongjo',
    textColor: '#ffffff',
    textAlign: 'center',
  });
  const [poemSettings, setPoemSettings] = useState<TextSettings>({
    fontSize: 24,
    fontFamily: 'font-myeongjo',
    textColor: '#ffffff',
    textAlign: 'center',
    lineHeight: 1.6,
  });
  const [authorSettings, setAuthorSettings] = useState<TextSettings>({
    fontSize: 18,
    fontFamily: 'font-myeongjo',
    textColor: '#ffffff',
    textAlign: 'center',
  });

  const fonts = [
    { name: '명조', value: 'font-myeongjo' },
    { name: '고딕', value: 'font-sans' },
    { name: '나눔펜', value: 'font-pen' },
    { name: '감자꽃', value: 'font-flower' },
    { name: '하이멜로디', value: 'font-melody' },
  ];

  // Admin state (mock)
  const [stats] = useState({ totalCreated: 1248, activeUsers: 85, topStyle: '수채화' });

  // SEO Update
  useEffect(() => {
    document.title = "시화 (Sihwa) - 시를 이미지로 승화시키는 예술 플랫폼";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", "당신의 시를 AI 기반 이미지로 변환하여 예술적 감성을 더해주는 프리미엄 서비스 시화(Sihwa)입니다.");
    }
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data());
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Gallery Listener
  useEffect(() => {
    if (!user) {
      setGalleryItems([]);
      return;
    }
    const q = query(
      collection(db, 'sihwas'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGalleryItems(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sihwas');
    });
    return () => unsubscribe();
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const { username, nickname, password } = authForm;

    if (authMode === 'signup') {
      if (!/^[a-zA-Z0-9]+$/.test(username)) {
        setAuthError('아이디는 영문과 숫자만 가능합니다.');
        return;
      }
      if (!/^\d{6}$/.test(password)) {
        setAuthError('비밀번호는 숫자 6자리여야 합니다.');
        return;
      }
      if (!nickname.trim()) {
        setAuthError('닉네임을 입력해 주세요.');
        return;
      }

      try {
        // Simple email-like username for Firebase Auth
        const email = `${username}@sihwa.app`;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;

        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          username,
          nickname,
          createdAt: serverTimestamp(),
        });
        setView('home');
      } catch (error: any) {
        setAuthError(error.message.includes('email-already-in-use') ? '이미 존재하는 아이디입니다.' : '회원가입 중 오류가 발생했습니다.');
      }
    } else {
      try {
        const email = `${username}@sihwa.app`;
        await signInWithEmailAndPassword(auth, email, password);
        setView('home');
      } catch (error: any) {
        setAuthError('아이디 또는 비밀번호가 일치하지 않습니다.');
      }
    }
  };

  const handleSaveToGallery = async () => {
    if (!user || !generatedImage) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'sihwas'), {
        uid: user.uid,
        title,
        poem,
        author,
        imageUrl: generatedImage,
        style: selectedStyle,
        createdAt: serverTimestamp(),
      });
      alert('갤러리에 저장되었습니다.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sihwas');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('home');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 크기는 5MB 이하여야 합니다.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setGeneratedImage(result);
        setUploadedImage(result);
        setView('editor');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!poem.trim()) return;
    setIsGenerating(true);
    
    const messages = [
      '시의 감성을 분석하고 있습니다...',
      '아름다운 색채를 고르는 중입니다...',
      '캔버스에 그림을 피워내고 있습니다...',
      '예술적인 터치를 더하는 중입니다...',
      '거의 다 되었습니다. 잠시만 기다려 주세요.'
    ];
    
    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % messages.length;
      setLoadingMessage(messages[messageIndex]);
    }, 3000);

    try {
      const fullPrompt = `${title ? `Title: ${title}\n` : ''}Poem: ${poem}${author ? `\nAuthor: ${author}` : ''}`;
      const imageUrl = await generateImageFromPoem(fullPrompt, selectedStyle);
      setGeneratedImage(imageUrl);
      setView('editor');
    } catch (error) {
      console.error(error);
      alert('이미지 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setLoadingMessage('시의 감성을 분석하고 있습니다...');
    }
  };

  const updateSettings = (key: keyof TextSettings, value: any) => {
    if (activeTab === 'title') {
      setTitleSettings(prev => ({ ...prev, [key]: value }));
    } else if (activeTab === 'poem') {
      setPoemSettings(prev => ({ ...prev, [key]: value }));
    } else {
      setAuthorSettings(prev => ({ ...prev, [key]: value }));
    }
  };

  const currentSettings = activeTab === 'title' ? titleSettings : activeTab === 'poem' ? poemSettings : authorSettings;

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 2, // Higher quality
      });
      
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `sihwa-${Date.now()}.png`;
      link.click();
    } catch (error) {
      console.error('Download failed:', error);
      alert('다운로드 중 오류가 발생했습니다.');
    }
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    
    try {
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 2,
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      setShareImage(dataUrl);

      // Try Web Share API first
      if (navigator.share) {
        try {
          // Convert dataUrl to File object
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], `sihwa-${Date.now()}.png`, { type: 'image/png' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: '시화 (Sihwa)',
              text: '나만의 시화를 감상해보세요.',
            });
            return; // Success!
          } else {
            // If can't share files, try sharing just the text/url
            await navigator.share({
              title: '시화 (Sihwa)',
              text: '나만의 시화를 감상해보세요.',
              url: window.location.href,
            });
            return;
          }
        } catch (err) {
          console.log('Web Share failed, falling back to modal:', err);
        }
      }

      // Fallback: Open Modal
      setIsShareModalOpen(true);
    } catch (error) {
      console.error('Share failed:', error);
      alert('공유 준비 중 오류가 발생했습니다.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('링크가 클립보드에 복사되었습니다.');
  };

  return (
    <div className="min-h-screen flex flex-col custom-cursor">
      <Modal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        title="작품 공유하기"
      >
        <div className="flex flex-col items-center gap-6">
          {shareImage && (
            <div className="w-full max-w-[200px] aspect-[9/16] shadow-xl rounded-lg overflow-hidden border border-oriental-red/10">
              <img src={shareImage} alt="Share Preview" className="w-full h-full object-cover" />
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 w-full">
            <button 
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')}
              className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Facebook
            </button>
            <button 
              onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('시화(Sihwa)에서 나만의 시화를 만들었습니다.')}`, '_blank')}
              className="flex items-center justify-center gap-2 py-3 bg-[#1DA1F2] text-white rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Twitter
            </button>
            <button 
              onClick={copyToClipboard}
              className="flex items-center justify-center gap-2 py-3 bg-ink-black text-white rounded-xl font-bold hover:opacity-90 transition-all"
            >
              링크 복사
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-3 border border-oriental-red text-oriental-red rounded-xl font-bold hover:bg-oriental-red/5 transition-all"
            >
              이미지 저장
            </button>
          </div>
          
          <p className="text-xs text-ink-black/40 text-center">
            이미지를 저장한 후 인스타그램이나 카카오톡에 직접 업로드하여 공유해보세요.
          </p>
        </div>
      </Modal>

      {/* Navigation */}
      <nav className="sticky top-0 z-40 bg-beige-bg/80 backdrop-blur-md border-b border-oriental-red/10 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center">
        <div 
          className="text-2xl md:text-3xl font-myeongjo font-bold text-oriental-red cursor-pointer tracking-widest"
          onClick={() => setView('home')}
        >
          시화 <span className="hidden sm:inline text-sm font-sans font-normal text-ink-black/60 ml-2">Sihwa</span>
        </div>
        <div className="flex gap-4 md:gap-8 items-center font-medium text-sm md:text-base">
          <button onClick={() => setView('home')} className={`hover:text-oriental-red transition-colors ${view === 'home' ? 'text-oriental-red' : ''}`}>홈</button>
          <button 
            onClick={() => user ? setView('gallery') : setView('auth')} 
            className={`hover:text-oriental-red transition-colors ${view === 'gallery' ? 'text-oriental-red' : ''}`}
          >
            갤러리
          </button>
          <button onClick={() => setView('admin')} className={`hover:text-oriental-red transition-colors ${view === 'admin' ? 'text-oriental-red' : ''}`}>관리자</button>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-ink-black/60">{userProfile?.nickname || '회원'}님</span>
              <button 
                onClick={handleLogout}
                className="bg-ink-black/5 text-ink-black px-4 md:px-6 py-1.5 md:py-2 rounded-full hover:bg-ink-black/10 transition-all text-xs md:text-sm flex items-center gap-2"
              >
                <LogOut size={14} /> 로그아웃
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setView('auth')}
              className="bg-oriental-red text-white px-4 md:px-6 py-1.5 md:py-2 rounded-full hover:bg-oriental-red/90 transition-all shadow-lg text-xs md:text-sm flex items-center gap-2"
            >
              <LogIn size={14} /> 로그인
            </button>
          )}
        </div>
      </nav>

      <AnimatePresence>
        {isGenerating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-beige-bg/90 backdrop-blur-md"
          >
            <div className="relative w-32 h-32 mb-8">
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                  borderRadius: ["20%", "50%", "20%"]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-0 border-4 border-oriental-red/30"
              />
              <motion.div 
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  rotate: [360, 180, 0],
                  borderRadius: ["50%", "20%", "50%"]
                }}
                transition={{ 
                  duration: 4, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute inset-4 border-4 border-oriental-red/60"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles size={48} className="text-oriental-red" />
                </motion.div>
              </div>
            </div>
            
            <motion.p 
              key={loadingMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-xl md:text-2xl font-myeongjo text-ink-black/80 text-center px-6"
            >
              {loadingMessage}
            </motion.p>
            
            <div className="mt-12 flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    duration: 1, 
                    repeat: Infinity, 
                    delay: i * 0.2 
                  }}
                  className="w-2 h-2 bg-oriental-red rounded-full"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {view === 'auth' && (
            <motion.section
              key="auth"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md mx-auto px-4 py-20"
            >
              <div className="bg-white/50 p-8 rounded-3xl border border-oriental-red/10 backdrop-blur-md shadow-xl">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-oriental-red/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-oriental-red">
                    <UserIcon size={32} />
                  </div>
                  <h2 className="text-3xl font-myeongjo mb-2">
                    {authMode === 'login' ? '다시 오셨군요' : '시화의 회원이 되어보세요'}
                  </h2>
                  <p className="text-ink-black/60">
                    {authMode === 'login' ? '로그인하여 당신의 작품을 보관하세요' : '간단한 정보 입력으로 가입할 수 있습니다'}
                  </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-ink-black/40 mb-1 ml-1 uppercase tracking-wider">아이디 (영문+숫자)</label>
                    <input
                      type="text"
                      required
                      value={authForm.username}
                      onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                      className="w-full p-4 bg-white/50 border border-oriental-red/10 rounded-2xl focus:ring-2 focus:ring-oriental-red/20 focus:border-oriental-red outline-none transition-all"
                      placeholder="sihwa123"
                    />
                  </div>

                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs font-bold text-ink-black/40 mb-1 ml-1 uppercase tracking-wider">닉네임</label>
                      <input
                        type="text"
                        required
                        value={authForm.nickname}
                        onChange={(e) => setAuthForm({ ...authForm, nickname: e.target.value })}
                        className="w-full p-4 bg-white/50 border border-oriental-red/10 rounded-2xl focus:ring-2 focus:ring-oriental-red/20 focus:border-oriental-red outline-none transition-all"
                        placeholder="시인 김철수"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-ink-black/40 mb-1 ml-1 uppercase tracking-wider">간편 비밀번호 (숫자 6자리)</label>
                    <input
                      type="password"
                      required
                      maxLength={6}
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      className="w-full p-4 bg-white/50 border border-oriental-red/10 rounded-2xl focus:ring-2 focus:ring-oriental-red/20 focus:border-oriental-red outline-none transition-all tracking-[0.5em]"
                      placeholder="••••••"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-red-50 text-red-500 text-sm rounded-xl flex items-center gap-2">
                      <Info size={14} /> {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-4 bg-oriental-red text-white rounded-2xl font-bold shadow-lg hover:bg-oriental-red/90 transition-all flex items-center justify-center gap-2"
                  >
                    {authMode === 'login' ? <LogIn size={20} /> : <UserIcon size={20} />}
                    {authMode === 'login' ? '로그인' : '회원가입 완료'}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-sm text-ink-black/60 hover:text-oriental-red transition-colors underline underline-offset-4"
                  >
                    {authMode === 'login' ? '아직 회원이 아니신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {view === 'gallery' && (
            <motion.section
              key="gallery"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto px-4 py-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
                <div>
                  <h2 className="text-4xl font-myeongjo mb-2">나의 시화 갤러리</h2>
                  <p className="text-ink-black/60">지금까지 피워낸 당신의 예술 작품들입니다.</p>
                </div>
                <button 
                  onClick={() => setView('home')}
                  className="flex items-center gap-2 px-6 py-3 bg-oriental-red text-white rounded-full font-bold shadow-lg hover:bg-oriental-red/90 transition-all"
                >
                  <Plus size={20} /> 새로운 시화 만들기
                </button>
              </div>

              {galleryItems.length === 0 ? (
                <div className="text-center py-20 bg-white/30 rounded-3xl border border-dashed border-oriental-red/20">
                  <div className="w-20 h-20 bg-oriental-red/5 rounded-full flex items-center justify-center mx-auto mb-6 text-oriental-red/40">
                    <ImageIcon size={40} />
                  </div>
                  <h3 className="text-2xl font-myeongjo mb-2">아직 보관된 시화가 없습니다</h3>
                  <p className="text-ink-black/60 mb-8">첫 번째 시화를 만들어 갤러리를 채워보세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {galleryItems.map((item) => (
                    <motion.div
                      key={item.id}
                      layoutId={item.id}
                      className="group bg-white rounded-3xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-oriental-red/5"
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                          <div className="flex gap-2">
                            <button className="flex-grow py-2 bg-white/20 backdrop-blur-md text-white rounded-lg text-sm font-bold hover:bg-white/30 transition-all">
                              상세보기
                            </button>
                            <button className="p-2 bg-white/20 backdrop-blur-md text-white rounded-lg hover:bg-red-500/50 transition-all">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-5">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-myeongjo text-lg truncate flex-grow">{item.title || '무제'}</h3>
                          <span className="text-[10px] bg-oriental-red/10 text-oriental-red px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter">
                            {item.style}
                          </span>
                        </div>
                        <p className="text-sm text-ink-black/60 line-clamp-2 font-myeongjo italic mb-4">
                          "{item.poem}"
                        </p>
                        <div className="flex justify-between items-center text-[10px] text-ink-black/40">
                          <span>{item.author || '익명'}</span>
                          <span>{item.createdAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
          {view === 'home' && (
            <motion.section 
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-20 text-center"
            >
              <h1 className="text-4xl md:text-7xl font-myeongjo mb-6 md:mb-8 leading-tight">
                당신의 시가 <br />
                <span className="text-oriental-red">한 폭의 그림</span>이 됩니다
              </h1>
              <p className="text-base md:text-xl text-ink-black/70 mb-8 md:mb-12 max-w-2xl mx-auto leading-relaxed">
                마음속에 품은 시 구절을 입력해 보세요. <br className="hidden md:block" />
                AI가 시의 감성을 분석하여 세상에 단 하나뿐인 예술 작품을 피워냅니다.
              </p>

              <div className="bg-beige-bg/30 p-5 md:p-8 rounded-2xl border border-ink-black/5 backdrop-blur-sm space-y-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="시의 제목을 입력하세요 (선택 사항)"
                  className="w-full p-3 md:p-4 bg-transparent border-b border-ink-black/5 focus:border-oriental-red focus:ring-0 text-xl md:text-2xl font-myeongjo placeholder:text-ink-black/20 outline-none"
                />
                <textarea
                  value={poem}
                  onChange={(e) => setPoem(e.target.value)}
                  placeholder="여기에 시 내용을 입력하세요...&#10;예: 나 보기가 역겨워 가실 때에는 말없이 고이 보내 드리오리다."
                  className="w-full h-48 md:h-64 p-3 md:p-4 bg-transparent border-none focus:ring-0 text-lg md:text-xl font-myeongjo resize-none placeholder:text-ink-black/20 outline-none"
                />

                <div className="flex items-start gap-2 px-4 py-3 bg-oriental-red/5 rounded-xl text-left">
                  <Info size={16} className="text-oriental-red shrink-0 mt-0.5" />
                  <div className="text-xs text-ink-black/60 leading-relaxed">
                    <span className="font-bold text-oriental-red">작성 팁:</span> 선명한 묘사(예: 붉은 노을, 시린 새벽)나 구체적인 감정 표현을 담으면 더욱 아름다운 이미지가 생성됩니다. <br />
                    <span className="font-bold text-oriental-red">안내:</span> 이미지 생성 후 에디터에서 텍스트 수정이 가능합니다.
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 items-center border-t border-ink-black/5 pt-4">
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="작성자 이름"
                    className="w-full md:flex-grow p-2 md:p-3 bg-transparent border-b border-ink-black/5 focus:border-oriental-red focus:ring-0 text-base md:text-lg font-myeongjo placeholder:text-ink-black/20 outline-none"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none self-start md:self-center">
                    <input 
                      type="checkbox" 
                      checked={showAuthor} 
                      onChange={(e) => setShowAuthor(e.target.checked)}
                      className="w-5 h-5 accent-oriental-red rounded"
                    />
                    <span className="text-sm font-medium text-ink-black/60">작성자 표시</span>
                  </label>
                </div>
                
                <div className="mt-6 md:mt-8 flex flex-wrap gap-2 md:gap-4 justify-center">
                  {(['watercolor', 'oil', 'minimal', 'ink', 'photo'] as ImageStyle[]).map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className={`px-4 md:px-6 py-1.5 md:py-2 rounded-full border text-sm md:text-base transition-all ${
                        selectedStyle === style 
                        ? 'bg-oriental-red text-white border-oriental-red' 
                        : 'border-oriental-red/20 text-ink-black/60 hover:border-oriental-red/50'
                      }`}
                    >
                      {style === 'watercolor' && '수채화'}
                      {style === 'oil' && '유화'}
                      {style === 'minimal' && '미니멀'}
                      {style === 'ink' && '수묵화'}
                      {style === 'photo' && '실사'}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col md:flex-row gap-4 justify-center mt-8 md:mt-10">
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !poem.trim()}
                    className="flex-grow md:flex-grow-0 group relative inline-flex items-center justify-center px-10 md:px-12 py-3 md:py-4 font-myeongjo text-lg md:text-xl font-bold text-white transition-all duration-200 bg-oriental-red rounded-full hover:bg-oriental-red/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-oriental-red disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden shadow-lg"
                  >
                    <span className="relative flex items-center gap-2">
                      {isGenerating ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Sparkles size={24} />
                        </motion.div>
                      ) : <Sparkles size={24} />}
                      {isGenerating ? '피어나는 중...' : 'AI 이미지로 피어내기'}
                    </span>
                  </button>

                  <label className="flex-grow md:flex-grow-0 cursor-pointer group relative inline-flex items-center justify-center px-10 md:px-12 py-3 md:py-4 font-myeongjo text-lg md:text-xl font-bold text-oriental-red transition-all duration-200 bg-white border-2 border-oriental-red rounded-full hover:bg-oriental-red/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-oriental-red overflow-hidden shadow-lg">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload}
                    />
                    <span className="relative flex items-center gap-2">
                      <Upload size={24} />
                      내 이미지 업로드
                    </span>
                  </label>
                </div>
              </div>

              {/* Information Sections */}
              <div className="mt-24 md:mt-32 space-y-20 md:space-y-32 text-left">
                {/* Service Introduction */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="grid md:grid-cols-2 gap-12 items-center"
                >
                  <div>
                    <h2 className="text-3xl md:text-4xl font-myeongjo mb-6 border-l-4 border-oriental-red pl-4">시화 서비스 소개</h2>
                    <p className="text-ink-black/70 leading-relaxed text-lg">
                      '시화'는 당신의 문학적 감수성을 시각적 예술로 승화시키는 AI 기반 창작 플랫폼입니다. 
                      단순한 텍스트를 넘어, 시가 가진 고유의 분위기와 은유를 AI가 깊이 있게 해석하여 
                      세상에 단 하나뿐인 배경 이미지를 생성해 드립니다. 
                      전통적인 수묵화부터 현대적인 실사 스타일까지, 당신의 시에 가장 어울리는 옷을 입혀보세요.
                    </p>
                  </div>
                  <div className="bg-oriental-red/5 rounded-3xl p-8 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="w-full aspect-[3/4] bg-white rounded-xl shadow-md rotate-[-5deg] flex items-center justify-center p-4">
                        <div className="w-full h-full border border-ink-black/5 bg-oriental-red/5 rounded-lg"></div>
                      </div>
                      <div className="w-full aspect-[3/4] bg-white rounded-xl shadow-md rotate-[5deg] flex items-center justify-center p-4">
                        <div className="w-full h-full border border-ink-black/5 bg-oriental-red/5 rounded-lg"></div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* How to Use */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  <h2 className="text-3xl md:text-4xl font-myeongjo mb-12 text-center">이용 방법</h2>
                  <div className="grid md:grid-cols-4 gap-8">
                    {[
                      { step: '01', title: '시 입력', desc: '제목과 시 내용, 작성자 이름을 입력합니다.' },
                      { step: '02', title: '스타일 선택', desc: '수채화, 수묵화 등 원하는 화풍을 선택합니다.' },
                      { step: '03', title: '이미지 생성', desc: 'AI가 시의 내용을 분석해 이미지를 그려냅니다.' },
                      { step: '04', title: '편집 및 저장', desc: '텍스트 위치와 크기를 조절한 뒤 저장하세요.' },
                    ].map((item, idx) => (
                      <div key={idx} className="relative p-6 bg-white rounded-2xl shadow-sm border border-ink-black/5 hover:shadow-md transition-shadow">
                        <span className="absolute -top-4 left-6 text-4xl font-bold text-oriental-red/20">{item.step}</span>
                        <h3 className="text-xl font-bold mb-3 mt-2">{item.title}</h3>
                        <p className="text-sm text-ink-black/60 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* AI Principles */}
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="bg-ink-black text-white rounded-[3rem] p-8 md:p-16 overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-oriental-red/20 blur-[100px] rounded-full"></div>
                  <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-myeongjo mb-8">AI 이미지 생성 원리</h2>
                    <div className="space-y-6 text-white/70 text-lg leading-relaxed max-w-3xl">
                      <p>
                        우리의 AI는 구글의 최신 생성형 모델인 <span className="text-oriental-red font-bold">Gemini 2.5 Flash Image</span>를 기반으로 작동합니다. 
                        사용자가 입력한 시의 텍스트에서 주요 키워드와 감정적 맥락을 추출하고, 이를 시각적 프롬프트로 변환합니다.
                      </p>
                      <p>
                        단순히 단어를 나열하는 것이 아니라, 시의 '여백의 미'와 '은유'를 이해하려 노력합니다. 
                        예를 들어 "시린 새벽"이라는 표현에서 차가운 푸른 빛의 조명과 정적인 구도를 설계하여 
                        시의 분위기를 가장 잘 대변할 수 있는 예술적 배경을 실시간으로 렌더링합니다.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          )}

          {view === 'editor' && generatedImage && (
            <motion.section 
              key="editor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden relative bg-ink-black/5"
            >
              {/* Canvas Area */}
              <div className="flex-grow flex items-center justify-center p-4 md:p-8 overflow-hidden relative z-10">
                <div 
                  ref={canvasRef}
                  className="relative shadow-2xl bg-white aspect-[9/16] h-full max-h-[65vh] lg:max-h-full max-w-full group overflow-hidden"
                >
                  <img 
                    src={generatedImage} 
                    alt="Generated Art" 
                    crossOrigin="anonymous"
                    className="w-full h-full object-cover transition-opacity duration-300"
                    style={{ opacity: imageOpacity / 100 }}
                  />
                  
                  {/* Separate Draggable Text Boxes */}
                  <motion.div 
                    drag
                    dragMomentum={false}
                    onClick={() => setActiveTab('title')}
                    whileDrag={{ outline: '2px solid #D68F7B', backgroundColor: 'rgba(214, 143, 123, 0.1)' }}
                    className="absolute cursor-move p-4 select-none whitespace-nowrap rounded-lg transition-colors z-10"
                    style={{ 
                      top: '15%', 
                      left: '50%', 
                      x: '-50%',
                      textAlign: titleSettings.textAlign 
                    }}
                  >
                    <div 
                      style={{ 
                        fontSize: `${titleSettings.fontSize}px`,
                        color: titleSettings.textColor,
                      }}
                      className={`${titleSettings.fontFamily} font-bold drop-shadow-lg`}
                    >
                      {title}
                    </div>
                  </motion.div>

                  {showAuthor && author && (
                    <motion.div 
                      drag
                      dragMomentum={false}
                      onClick={() => setActiveTab('author')}
                      whileDrag={{ outline: '2px solid #D68F7B', backgroundColor: 'rgba(214, 143, 123, 0.1)' }}
                      className="absolute cursor-move p-4 select-none whitespace-nowrap rounded-lg transition-colors z-10"
                      style={{ 
                        top: '25%', 
                        left: '50%', 
                        x: '-50%',
                        textAlign: authorSettings.textAlign
                      }}
                    >
                      <div 
                        style={{ 
                          fontSize: `${authorSettings.fontSize}px`,
                          color: authorSettings.textColor,
                        }}
                        className={`${authorSettings.fontFamily} drop-shadow-md`}
                      >
                        {author}
                      </div>
                    </motion.div>
                  )}

                  <motion.div 
                    drag
                    dragMomentum={false}
                    onClick={() => setActiveTab('poem')}
                    whileDrag={{ outline: '2px solid #D68F7B', backgroundColor: 'rgba(214, 143, 123, 0.1)' }}
                    className="absolute cursor-move p-4 select-none whitespace-pre rounded-lg transition-colors z-10"
                    style={{ 
                      top: '40%', 
                      left: '50%', 
                      x: '-50%',
                      textAlign: poemSettings.textAlign
                    }}
                  >
                    <div 
                      style={{ 
                        fontSize: `${poemSettings.fontSize}px`,
                        color: poemSettings.textColor,
                        lineHeight: poemSettings.lineHeight,
                      }}
                      className={`${poemSettings.fontFamily} drop-shadow-md`}
                    >
                      {poem}
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* MiriCanvas Style Bottom Menu (Mobile) / Sidebar (Desktop) */}
              <div className="w-full lg:w-96 bg-beige-bg border-t lg:border-t-0 lg:border-l border-oriental-red/10 flex flex-col h-auto lg:h-full z-30 relative">
                {/* Desktop Title */}
                <h2 className="hidden lg:flex text-2xl font-myeongjo p-8 pb-0 items-center gap-2 text-oriental-red">
                  <Palette size={24} /> 작품 편집
                </h2>

                {/* Floating Panel (Mobile) / Content Area (Desktop) */}
                <div className={`
                  flex-grow overflow-y-auto no-scrollbar transition-all duration-500 ease-in-out
                  fixed lg:relative bottom-[72px] lg:bottom-0 left-0 right-0 lg:left-auto lg:right-auto
                  bg-beige-bg lg:bg-transparent rounded-t-3xl lg:rounded-none
                  shadow-[0_-8px_30px_rgba(0,0,0,0.1)] lg:shadow-none
                  ${activeMobileTool ? 'max-h-[50vh] lg:max-h-none opacity-100 translate-y-0 p-6 md:p-8' : 'max-h-0 lg:max-h-none opacity-0 translate-y-full lg:translate-y-0 p-0 lg:p-8'}
                `}>
                  {/* Mobile Panel Header */}
                  <div className="lg:hidden flex items-center justify-between mb-6 relative">
                    <div className="w-10" /> {/* Spacer for centering handle */}
                    <div className="w-12 h-1.5 bg-oriental-red/10 rounded-full" />
                    <button 
                      onClick={() => setActiveMobileTool(null as any)}
                      className="p-2 text-ink-black/40 hover:text-oriental-red transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-8">
                    {/* Tabs - Visible in Text and Style tools on mobile, always on desktop */}
                    <div className={`${(activeMobileTool === 'text' || activeMobileTool === 'style') ? 'block' : 'hidden lg:block'} border-b border-oriental-red/10`}>
                      <div className="flex">
                        <button 
                          onClick={() => setActiveTab('title')}
                          className={`flex-grow py-3 text-xs font-bold transition-all ${activeTab === 'title' ? 'text-oriental-red border-b-2 border-oriental-red' : 'text-ink-black/40'}`}
                        >
                          제목
                        </button>
                        <button 
                          onClick={() => setActiveTab('poem')}
                          className={`flex-grow py-3 text-xs font-bold transition-all ${activeTab === 'poem' ? 'text-oriental-red border-b-2 border-oriental-red' : 'text-ink-black/40'}`}
                        >
                          내용
                        </button>
                        <button 
                          onClick={() => setActiveTab('author')}
                          className={`flex-grow py-3 text-xs font-bold transition-all ${activeTab === 'author' ? 'text-oriental-red border-b-2 border-oriental-red' : 'text-ink-black/40'}`}
                        >
                          작성자
                        </button>
                      </div>
                    </div>

                    {/* Text Content Input - Mobile: Text tool only */}
                    <div className={`${activeMobileTool === 'text' ? 'block' : 'hidden lg:block'}`}>
                      <label className="block text-sm font-bold mb-4 flex items-center gap-2">
                        <TypeIcon size={16} /> {activeTab === 'title' ? '제목' : activeTab === 'poem' ? '내용' : '작성자'} 편집
                      </label>
                      <div className="space-y-4">
                        {/* Text Content Input */}
                        <div>
                          <span className="text-xs text-ink-black/60">내용 수정</span>
                          {activeTab === 'author' && (
                            <div className="mb-2 mt-2">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                  type="checkbox" 
                                  checked={showAuthor} 
                                  onChange={(e) => setShowAuthor(e.target.checked)}
                                  className="w-4 h-4 accent-oriental-red rounded"
                                />
                                <span className="text-xs font-medium text-ink-black/60">작성자 표시</span>
                              </label>
                            </div>
                          )}
                          {activeTab === 'poem' ? (
                            <textarea 
                              value={poem}
                              onChange={(e) => setPoem(e.target.value)}
                              className="w-full mt-2 p-3 bg-white border border-oriental-red/10 rounded-xl text-sm font-myeongjo resize-none h-32 outline-none focus:border-oriental-red transition-all"
                            />
                          ) : (
                            <input 
                              type="text"
                              value={activeTab === 'title' ? title : author}
                              onChange={(e) => activeTab === 'title' ? setTitle(e.target.value) : setAuthor(e.target.value)}
                              className="w-full mt-2 p-3 bg-white border border-oriental-red/10 rounded-xl text-sm font-myeongjo outline-none focus:border-oriental-red transition-all"
                            />
                          )}

                          {activeTab === 'poem' && (
                            <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-oriental-red/5 rounded-lg">
                              <Info size={14} className="text-oriental-red shrink-0 mt-0.5" />
                              <p className="text-[11px] text-ink-black/60 leading-tight">
                                <span className="font-bold text-oriental-red">팁:</span> 시각적인 묘사나 감정적인 단어를 사용하면 AI가 더 풍부한 이미지를 그려냅니다.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Style Settings - Mobile: Style tool only */}
                    <div className={`${activeMobileTool === 'style' ? 'block' : 'hidden lg:block'} space-y-6`}>
                      <label className="block text-sm font-bold mb-4 flex items-center gap-2">
                        <Palette size={16} /> {activeTab === 'title' ? '제목' : activeTab === 'poem' ? '내용' : '작성자'} 스타일
                      </label>
                      
                      <div>
                        <span className="text-xs text-ink-black/60">글꼴 크기</span>
                        <div className="flex items-center gap-3 mt-2">
                          <button 
                            onClick={() => updateSettings('fontSize', Math.max(12, currentSettings.fontSize - 1))}
                            className="p-3 md:p-2 border border-oriental-red/20 rounded-lg hover:bg-oriental-red/5 text-oriental-red transition-all"
                          >
                            <Minus size={16} />
                          </button>
                          <input 
                            type="number" 
                            min="12" 
                            max="120" 
                            value={currentSettings.fontSize} 
                            onChange={(e) => updateSettings('fontSize', parseInt(e.target.value) || 12)}
                            className="w-16 text-center bg-white border border-oriental-red/10 rounded-lg py-2 md:py-1 font-bold text-oriental-red outline-none focus:border-oriental-red"
                          />
                          <button 
                            onClick={() => updateSettings('fontSize', Math.min(120, currentSettings.fontSize + 1))}
                            className="p-3 md:p-2 border border-oriental-red/20 rounded-lg hover:bg-oriental-red/5 text-oriental-red transition-all"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-ink-black/60">정렬</span>
                        <div className="flex gap-1 mt-2 p-1 bg-oriental-red/5 rounded-xl relative">
                          {[
                            { id: 'left', icon: <AlignLeft size={18} /> },
                            { id: 'center', icon: <AlignCenter size={18} /> },
                            { id: 'right', icon: <AlignRight size={18} /> }
                          ].map((align) => (
                            <button 
                              key={align.id}
                              onClick={() => updateSettings('textAlign', align.id as any)}
                              className={`relative flex-grow flex justify-center py-2.5 md:py-2 rounded-lg transition-colors z-10 ${
                                currentSettings.textAlign === align.id 
                                ? 'text-white' 
                                : 'text-ink-black/40 hover:text-ink-black/60'
                              }`}
                            >
                              {align.icon}
                              {currentSettings.textAlign === align.id && (
                                <motion.div
                                  layoutId="activeAlignment"
                                  className="absolute inset-0 bg-oriental-red rounded-lg -z-10 shadow-sm"
                                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {activeTab === 'poem' && (
                        <div>
                          <span className="text-xs text-ink-black/60">행간 조절</span>
                          <div className="flex items-center gap-3 mt-2">
                            <button 
                              onClick={() => updateSettings('lineHeight', Math.max(1, (poemSettings.lineHeight || 1.6) - 0.1))}
                              className="p-3 md:p-2 border border-oriental-red/20 rounded-lg hover:bg-oriental-red/5 text-oriental-red transition-all"
                            >
                              <Minus size={16} />
                            </button>
                            <div className="w-16 text-center font-bold text-oriental-red">
                              {(poemSettings.lineHeight || 1.6).toFixed(1)}
                            </div>
                            <button 
                              onClick={() => updateSettings('lineHeight', Math.min(3, (poemSettings.lineHeight || 1.6) + 0.1))}
                              className="p-3 md:p-2 border border-oriental-red/20 rounded-lg hover:bg-oriental-red/5 text-oriental-red transition-all"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {fonts.map((font) => (
                          <button 
                            key={font.value}
                            onClick={() => updateSettings('fontFamily', font.value)}
                            className={`py-2 border rounded text-sm ${currentSettings.fontFamily === font.value ? 'bg-oriental-red text-white border-oriental-red' : 'border-oriental-red/20'} ${font.value}`}
                          >
                            {font.name}
                          </button>
                        ))}
                      </div>

                      <div>
                        <span className="text-xs text-ink-black/60">색상</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {['#ffffff', '#000000', '#D68F7B', '#FDFDF9', '#4A433A', '#FFD700'].map(color => (
                            <button 
                              key={color}
                              onClick={() => updateSettings('textColor', color)}
                              className={`w-8 h-8 rounded-full border border-black/10 ${currentSettings.textColor === color ? 'ring-2 ring-oriental-red ring-offset-2' : ''}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Image Settings - Mobile: Image tool only */}
                    <div className={`${activeMobileTool === 'image' ? 'block' : 'hidden lg:block'} pt-6 border-t border-oriental-red/10`}>
                      <label className="block text-sm font-bold mb-4 flex items-center gap-2">
                        <ImageIcon size={16} /> 배경 이미지 설정
                      </label>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-ink-black/60">
                            <span>불투명도</span>
                            <span>{imageOpacity}%</span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={imageOpacity} 
                            onChange={(e) => setImageOpacity(parseInt(e.target.value))}
                            className="w-full accent-oriental-red"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                          <label className="cursor-pointer flex items-center justify-center gap-2 py-3 border border-oriental-red/20 rounded-xl text-sm font-medium hover:bg-oriental-red/5 transition-all">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleImageUpload}
                            />
                            <Upload size={16} /> 이미지 교체
                          </label>
                          <button 
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center justify-center gap-2 py-3 border border-oriental-red/20 rounded-xl text-sm font-medium hover:bg-oriental-red/5 transition-all disabled:opacity-50"
                          >
                            {isGenerating ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <Sparkles size={16} />
                              </motion.div>
                            ) : <Sparkles size={16} />}
                            AI로 다시 생성
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions - Mobile: Actions tool only */}
                    <div className={`${activeMobileTool === 'actions' ? 'block' : 'hidden lg:block'} pt-8 border-t border-oriental-red/10 flex flex-col gap-4`}>
                      <button 
                        onClick={handleSaveToGallery}
                        disabled={isSaving || !user}
                        className="w-full py-4 bg-ink-black text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                      >
                        {isSaving ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <Save size={20} />
                          </motion.div>
                        ) : <Save size={20} />}
                        {user ? '갤러리에 저장' : '로그인 후 저장 가능'}
                      </button>
                      <button 
                        onClick={handleDownload}
                        className="w-full py-4 bg-oriental-red text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-oriental-red/90 transition-all shadow-lg"
                      >
                        <Download size={20} /> 고화질 다운로드
                      </button>
                      <button 
                        onClick={handleShare}
                        className="w-full py-4 border border-oriental-red text-oriental-red rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-oriental-red/5 transition-all"
                      >
                        <Share2 size={20} /> SNS 공유하기
                      </button>
                      <button 
                        onClick={() => setView('home')}
                        className="w-full py-2 text-ink-black/40 hover:text-ink-black/80 transition-all text-sm"
                      >
                        새로운 시 작성하기
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile Bottom Navigation Bar */}
                <div className="lg:hidden flex border-t border-oriental-red/10 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] h-[72px] relative z-40">
                  {[
                    { id: 'text', label: '텍스트', icon: <TypeIcon size={22} /> },
                    { id: 'style', label: '스타일', icon: <Palette size={22} /> },
                    { id: 'image', label: '배경', icon: <ImageIcon size={22} /> },
                    { id: 'actions', label: '저장', icon: <Download size={22} /> },
                  ].map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => setActiveMobileTool(activeMobileTool === tool.id ? null as any : tool.id as any)}
                      className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
                        activeMobileTool === tool.id 
                        ? 'text-oriental-red' 
                        : 'text-ink-black/40'
                      }`}
                    >
                      <div className={`p-1 rounded-lg transition-colors ${activeMobileTool === tool.id ? 'bg-oriental-red/5' : ''}`}>
                        {tool.icon}
                      </div>
                      <span className="text-[10px] font-bold">{tool.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {view === 'admin' && (
            <motion.section 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-6xl mx-auto px-6 py-12"
            >
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h1 className="text-4xl font-myeongjo text-oriental-red mb-2">관리자 대시보드</h1>
                  <p className="text-ink-black/60">시화 플랫폼의 현황을 한눈에 확인하세요.</p>
                </div>
                <div className="flex gap-4">
                  <button className="px-4 py-2 bg-white border border-oriental-red/20 rounded-lg flex items-center gap-2 hover:bg-oriental-red/5 transition-all">
                    <Settings size={18} /> 설정
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-oriental-red/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-oriental-red/10 rounded-xl text-oriental-red">
                      <ImageIcon size={24} />
                    </div>
                    <span className="text-green-500 text-sm font-bold">+12%</span>
                  </div>
                  <h3 className="text-ink-black/60 text-sm mb-1">총 생성 이미지</h3>
                  <p className="text-3xl font-bold">{stats.totalCreated.toLocaleString()}</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-oriental-red/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                      <BarChart3 size={24} />
                    </div>
                    <span className="text-green-500 text-sm font-bold">+5%</span>
                  </div>
                  <h3 className="text-ink-black/60 text-sm mb-1">활성 사용자</h3>
                  <p className="text-3xl font-bold">{stats.activeUsers}</p>
                </div>
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-oriental-red/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                      <Palette size={24} />
                    </div>
                  </div>
                  <h3 className="text-ink-black/60 text-sm mb-1">인기 스타일</h3>
                  <p className="text-3xl font-bold">{stats.topStyle}</p>
                </div>
              </div>

              {/* Recent Content */}
              <div className="bg-white rounded-2xl shadow-sm border border-oriental-red/5 overflow-hidden">
                <div className="p-6 border-b border-oriental-red/5 flex justify-between items-center">
                  <h2 className="font-bold text-lg">최근 생성된 작품</h2>
                  <button className="text-oriental-red text-sm hover:underline">전체 보기</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-beige-bg/30 text-ink-black/60 text-sm">
                      <tr>
                        <th className="px-6 py-4 font-medium">작품</th>
                        <th className="px-6 py-4 font-medium">시 구절</th>
                        <th className="px-6 py-4 font-medium">사용자</th>
                        <th className="px-6 py-4 font-medium">상태</th>
                        <th className="px-6 py-4 font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-oriental-red/5">
                      {[1, 2, 3, 4].map((i) => (
                        <tr key={i} className="hover:bg-beige-bg/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="w-12 h-12 rounded bg-gray-200 overflow-hidden">
                              <img src={`https://picsum.photos/seed/${i}/100/100`} alt="Art" className="w-full h-full object-cover" />
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-xs truncate font-myeongjo">
                            {i === 1 ? '나 보기가 역겨워 가실 때에는...' : '별 헤는 밤, 하늘에는 별이 가득합니다.'}
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-black/70">user_{i}42@email.com</td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">완료</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="p-2 text-ink-black/40 hover:text-oriental-red transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-ink-black text-beige-bg py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="text-2xl font-myeongjo font-bold mb-2">시화 (Sihwa)</div>
            <p className="text-beige-bg/60 text-sm">© 2026 Sihwa Art Platform. All rights reserved.</p>
          </div>
          <div className="flex gap-8 text-sm text-beige-bg/80">
            <a href="#" className="hover:text-white transition-colors">이용약관</a>
            <a href="#" className="hover:text-white transition-colors">개인정보처리방침</a>
            <a href="#" className="hover:text-white transition-colors">문의하기</a>
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer">
              <Share2 size={18} />
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer">
              <Layout size={18} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
