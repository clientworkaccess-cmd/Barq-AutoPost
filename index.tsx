import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  generateSocialPost, 
  enhanceText, 
  generateCaption,
  generateCaptionWithTone,
  dataURLtoBlob, 
  sendEditToWebhook 
} from './geminiService';

const LOGO_URL = "https://res.cloudinary.com/djmakoiji/image/upload/v1765978253/Barq_Digital_Logo-removebg-preview_glejpc.png";
const IMAGE_WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-linkedin";

type AppMode = 'image' | 'text';
type Tone = 'Humble Brag' | 'Technical Deep Dive' | 'Storytelling' | 'Collaborative' | 'Corporate Professional';

const TONES: Tone[] = ['Humble Brag', 'Technical Deep Dive', 'Storytelling', 'Collaborative', 'Corporate Professional'];

// Helper for debouncing
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const LinkedInPreview = ({ text }: { text: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const textLines = text.split('\n');
  const previewLimit = 4;
  const showSeeMore = textLines.length > previewLimit && !isExpanded;

  return (
    <div className="w-full max-w-full bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="p-4 flex gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center font-black text-black shrink-0">B</div>
        <div className="min-w-0">
          <h4 className="font-bold text-sm text-white flex items-center gap-1 truncate">Barq Digital Engineer <span className="text-gray-500 font-normal shrink-0">• 1st</span></h4>
          <p className="text-[11px] text-gray-400 truncate">Building the future of social assets</p>
          <p className="text-[11px] text-gray-500 flex items-center gap-1">Just now • <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/><path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg></p>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-4 pb-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
        {showSeeMore ? textLines.slice(0, previewLimit).join('\n') : text}
        {showSeeMore && (
          <button onClick={() => setIsExpanded(true)} className="text-gray-400 hover:text-white font-bold ml-1">...see more</button>
        )}
      </div>

      {/* Engagement Bar */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-white/5">
        <div className="flex -space-x-1">
          <div className="w-5 h-5 rounded-full bg-blue-600 border border-[#1a1a1a] flex items-center justify-center text-[10px]">👍</div>
          <div className="w-5 h-5 rounded-full bg-red-500 border border-[#1a1a1a] flex items-center justify-center text-[10px]">❤️</div>
          <div className="w-5 h-5 rounded-full bg-green-500 border border-[#1a1a1a] flex items-center justify-center text-[10px]">💡</div>
        </div>
        <div className="text-[11px] text-gray-500">12 comments • 4 reposts</div>
      </div>

      <div className="px-4 py-1 flex justify-around border-t border-white/5 text-gray-400 font-bold text-xs">
        <button className="flex items-center gap-1 py-2 hover:bg-white/5 px-2 rounded-md">Like</button>
        <button className="flex items-center gap-1 py-2 hover:bg-white/5 px-2 rounded-md">Comment</button>
        <button className="flex items-center gap-1 py-2 hover:bg-white/5 px-2 rounded-md">Repost</button>
        <button className="flex items-center gap-1 py-2 hover:bg-white/5 px-2 rounded-md">Send</button>
      </div>
    </div>
  );
};

const ImageEditor = ({ 
  image, 
  onClose, 
  onSend 
}: { 
  image: string; 
  onClose: () => void; 
  onSend: (data: { editedImage?: string, textInstructions?: string }) => Promise<void> 
}) => {
  const [textInstructions, setTextInstructions] = useState("");
  const [isSending, setIsSending] = useState(false);
  const INTERNAL_WIDTH = 1080;
  const INTERNAL_HEIGHT = 1350;

  const handleFinalSend = async () => {
    setIsSending(true);
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = INTERNAL_WIDTH;
      exportCanvas.height = INTERNAL_HEIGHT;
      const ctx = exportCanvas.getContext('2d')!;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      ctx.drawImage(img, 0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
      await onSend({ editedImage: exportCanvas.toDataURL('image/png'), textInstructions: textInstructions.trim() });
      onClose();
    } catch (e) { console.error(e); } finally { setIsSending(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/98 p-4 md:p-12 overflow-y-auto animate-in fade-in duration-300">
      <div className="max-w-2xl w-full bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col max-h-full overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black italic tracking-tighter text-orange-500 uppercase">Visual Editor_</h2>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest border border-white/5 rounded-lg">Close [Esc]</button>
        </div>
        
        <div className="flex-grow p-6 overflow-y-auto space-y-6">
          <div className="aspect-[4/5] bg-black border border-white/5 rounded-2xl overflow-hidden relative shadow-inner">
            <img src={image} className="w-full h-full object-contain" alt="Preview" />
          </div>
          
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">AI Generative Edit Prompt</label>
               <span className="text-[9px] text-orange-500/50 font-bold uppercase tracking-tighter">Powered by Gemini Vision</span>
             </div>
             <input 
               autoFocus
               value={textInstructions} 
               onChange={e => setTextInstructions(e.target.value)} 
               placeholder="Example: 'Change background to dark navy blue', 'Make it look like a tech magazine'..." 
               className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-orange-500 text-sm transition-all shadow-xl" 
               onKeyDown={e => e.key === 'Enter' && handleFinalSend()}
             />
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-[#0f0f0f] shrink-0">
          <button 
            onClick={handleFinalSend} 
            disabled={isSending || !textInstructions.trim()} 
            className="w-full py-4 bg-orange-600 text-black font-black rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:grayscale shadow-xl shadow-orange-900/20"
          >
            {isSending ? "SYNCING WITH AI..." : "APPLY GENERATIVE EDITS_"}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [appMode, setAppMode] = useState<AppMode>(() => (localStorage.getItem('barq_mode') as AppMode) || 'image');
  const [accomplishment, setAccomplishment] = useState("");
  const [caption, setCaption] = useState("");
  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [selectedTone, setSelectedTone] = useState<Tone>('Corporate Professional');

  const debouncedAccomplishment = useDebounce(accomplishment, 2000);

  useEffect(() => {
    localStorage.setItem('barq_mode', appMode);
  }, [appMode]);

  useEffect(() => {
    fetch(LOGO_URL).then(r => r.blob()).then(b => {
      const reader = new FileReader(); 
      reader.onloadend = () => setLogoBase64(reader.result as string); 
      reader.readAsDataURL(b);
    });
  }, []);

  // Auto-generate caption for Text Mode on change
  useEffect(() => {
    if (appMode === 'text' && debouncedAccomplishment.trim().length > 10) {
      handleAIRefineCaption();
    }
  }, [debouncedAccomplishment, appMode, selectedTone]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotification({ msg: "Please upload an image file", type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setStyleRef(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleStyleRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveStyleRef = () => {
    setStyleRef(null);
    setNotification({ msg: "Style Reference Cleared", type: 'success' });
  };

  const handleGenerate = async () => {
    if (!accomplishment || !logoBase64) return;
    setLoading(true); setGeneratedImage(null);
    try { 
      const res = await generateSocialPost(accomplishment, logoBase64, styleRef); 
      setGeneratedImage(res);
      setNotification({ msg: "Graphic Forged Successfully", type: 'success' });
      const aiCaption = await generateCaption(accomplishment);
      setCaption(aiCaption);
    } catch (e) { setNotification({ msg: "Engine Failure", type: 'error' }); } finally { setLoading(false); }
  };

  const handleAIRefineCaption = async () => {
    if (!accomplishment) return;
    setLoading(true);
    try {
      const newCaption = await generateCaptionWithTone(accomplishment, selectedTone);
      setCaption(newCaption);
      setNotification({ msg: `Narrative Refined: ${selectedTone}`, type: 'success' });
    } catch (e) { setNotification({ msg: "Caption refinement failed", type: 'error' }); } finally { setLoading(false); }
  };

  const handlePostToLinkedIn = async () => {
    if (appMode === 'image' && !generatedImage) return;
    setLoading(true);
    try {
      const formData = new FormData();
      if (appMode === 'image' && generatedImage) {
        formData.append('file', dataURLtoBlob(generatedImage), 'barq_post.png');
      }
      formData.append('caption', caption);
      formData.append('type', appMode === 'image' ? 'image' : 'text_only');
      const response = await fetch(IMAGE_WEBHOOK_URL, { method: 'POST', body: formData });
      if (response.ok) setNotification({ msg: "Broadcast Successful", type: 'success' });
      else throw new Error();
    } catch (e) { setNotification({ msg: "Network Error", type: 'error' }); } finally { setLoading(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotification({ msg: "Copied to Clipboard", type: 'success' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 font-['DM_Sans'] overflow-x-hidden transition-colors duration-700 pb-20">
      <div className={`fixed top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none transition-colors duration-700 ${appMode === 'image' ? 'bg-orange-600/10' : 'bg-yellow-600/10'}`} />
      <div className={`fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none transition-colors duration-700 ${appMode === 'image' ? 'bg-orange-600/5' : 'bg-yellow-600/5'}`} />

      <nav className="p-8 max-w-7xl mx-auto flex justify-between items-center relative z-10">
         <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-black text-xl italic transition-colors duration-700 ${appMode === 'image' ? 'bg-orange-600' : 'bg-yellow-600'}`}>B</div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">Barq<span className={appMode === 'image' ? 'text-orange-500' : 'text-yellow-500'}>.</span>Digital</span>
         </div>

         <div className="flex bg-black/50 p-1 rounded-xl border border-white/10 shrink-0">
           <button onClick={() => setAppMode('image')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${appMode === 'image' ? 'bg-orange-600 text-black' : 'text-gray-500 hover:text-white'}`}>Image Mode_</button>
           <button onClick={() => setAppMode('text')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${appMode === 'text' ? 'bg-yellow-600 text-black' : 'text-gray-500 hover:text-white'}`}>Text Mode_</button>
         </div>

         {notification && (
            <div className={`hidden lg:block px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-top duration-300 ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {notification.msg}
            </div>
         )}
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-4 relative z-10">
        {appMode === 'image' ? (
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div className="space-y-8 animate-in slide-in-from-left duration-500">
               <section className="space-y-4">
                  <h2 className="text-5xl font-black italic tracking-tighter leading-none uppercase">Forge Your<br/><span className="text-orange-600">Visuals_</span></h2>
                  <p className="text-gray-500 text-lg max-w-md">Professional engineering assets created instantly.</p>
               </section>

               <div className="space-y-6 bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Accomplishments</label>
                        <button onClick={() => enhanceText(accomplishment).then(setAccomplishment)} className="text-[10px] font-black text-orange-500 hover:text-orange-400 transition-colors">POLISH_</button>
                     </div>
                     <textarea 
                       value={accomplishment} 
                       onChange={e => setAccomplishment(e.target.value)} 
                       placeholder="What did you ship? e.g., 'Reduced Latency by 30%'" 
                       className="w-full h-32 bg-transparent text-xl font-medium outline-none placeholder:text-gray-800 border-b border-white/5 focus:border-orange-500/30 resize-none"
                     />
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Style Match (Drag & Drop Ref)</label>
                     <div className="flex gap-4 items-center h-28">
                       {styleRef ? (
                         <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-orange-500 group animate-in zoom-in-95">
                           <img src={styleRef} className="w-full h-full object-cover" alt="Style Ref" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button 
                               onClick={handleRemoveStyleRef}
                               className="bg-red-600 text-white rounded-full p-2 hover:scale-110 transition-transform shadow-xl"
                               title="Remove Style Reference"
                             >
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                           </div>
                         </div>
                       ) : (
                         <div 
                           onDragOver={handleDragOver}
                           onDragLeave={handleDragLeave}
                           onDrop={handleDrop}
                           className={`flex-grow flex items-center justify-center h-full border-2 border-dashed rounded-2xl cursor-pointer transition-all group relative ${isDragging ? 'border-orange-500 bg-orange-500/10 scale-[1.02]' : 'border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5'}`}
                         >
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleStyleRef} />
                            <div className="text-center">
                              <span className={`text-xs font-bold uppercase transition-colors ${isDragging ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500'}`}>
                                {isDragging ? "DROP IMAGE NOW_" : "DRAG & DROP STYLE REF_"}
                              </span>
                              <p className="text-[8px] text-gray-600 uppercase mt-1 tracking-widest">or click to browse</p>
                            </div>
                         </div>
                       )}
                       {styleRef && (
                         <div className="flex-grow flex flex-col justify-center">
                           <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Active Reference_</span>
                           <p className="text-[9px] text-gray-500 uppercase mt-1">AI will replicate this aesthetic exactly.</p>
                         </div>
                       )}
                     </div>
                  </div>
                  <button onClick={handleGenerate} disabled={loading} className="w-full py-6 bg-orange-600 text-black font-black uppercase tracking-widest rounded-3xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-orange-900/10">
                    {loading ? "INITIALIZING FORGE..." : "GENERATE VISUAL_"}
                  </button>
               </div>
            </div>

            <div className="bg-[#0a0a0a] rounded-[3rem] border border-white/5 p-8 min-h-[700px] flex flex-col items-center justify-center relative shadow-inner overflow-hidden animate-in slide-in-from-right duration-500">
              {loading ? (
                <div className="flex flex-col items-center gap-6">
                  <div className="w-16 h-16 border-4 border-orange-600/20 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-[10px] font-black tracking-[0.4em] text-orange-500 animate-pulse">CRAFTING PIXELS...</span>
                </div>
              ) : generatedImage ? (
                <div className="w-full space-y-6 flex flex-col h-full">
                  <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-white/5 aspect-[4/5] bg-black">
                    <img src={generatedImage} className="w-full h-full object-contain" alt="Generated" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">LinkedIn Caption</label>
                       <button onClick={handleAIRefineCaption} className="text-[10px] font-black text-orange-500 uppercase flex items-center gap-1 hover:text-orange-400">
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                         REGENERATE_
                       </button>
                    </div>
                    <textarea value={caption} onChange={e => setCaption(e.target.value)} className="w-full h-24 bg-black/40 border border-white/5 rounded-2xl p-4 text-sm resize-none focus:border-orange-500/50" placeholder="Caption..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0">
                    <button onClick={() => setIsEditorOpen(true)} className="py-4 bg-[#111] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-500/5 transition-all">EDIT GRAPHIC_</button>
                    <button onClick={handleGenerate} className="py-4 bg-[#111] border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">NEW VERSION_</button>
                  </div>
                  
                  <button onClick={handlePostToLinkedIn} className="w-full py-5 bg-[#0a66c2] hover:bg-[#004182] text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98] uppercase tracking-widest text-xs">POST TO LINKEDIN</button>
                </div>
              ) : (
                <div className="opacity-10 text-center space-y-4">
                  <div className="w-48 h-60 border-4 border-dashed border-white/20 rounded-3xl mx-auto flex items-center justify-center">
                    <span className="text-[40px] font-black">?</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.5em]">Forge Empty</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Text Mode Flow - Wide Layout */
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
             <section className="text-center space-y-4">
                <h2 className="text-5xl font-black italic tracking-tighter uppercase">Craft Your <span className="text-yellow-500">Narrative_</span></h2>
                <p className="text-gray-500 text-lg">AI-powered text optimized for maximum engagement.</p>
             </section>

             <div className="bg-[#0a0a0a] border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl space-y-10">
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Raw Source Material</label>
                      <div className="flex items-center gap-2">
                        {loading && <div className="w-3 h-3 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />}
                      </div>
                   </div>
                   <textarea 
                     value={accomplishment} 
                     onChange={e => setAccomplishment(e.target.value)} 
                     placeholder="Paste notes, logs, or raw thoughts here..." 
                     className="w-full h-32 bg-black/50 border border-white/5 rounded-2xl p-6 text-xl font-medium outline-none focus:border-yellow-500/30 resize-none transition-all"
                   />
                </div>

                <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Select Narrative Voice</label>
                      <button onClick={handleAIRefineCaption} disabled={loading || !accomplishment} className="text-[10px] font-black text-yellow-500 hover:text-yellow-400 transition-colors uppercase">Force Re-Forge_</button>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {TONES.map(t => (
                        <button 
                          key={t}
                          onClick={() => setSelectedTone(t)}
                          className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border ${selectedTone === t ? 'bg-yellow-600 text-black border-yellow-600' : 'bg-black/40 text-gray-400 border-white/5 hover:border-white/20'}`}
                        >
                          {t}
                        </button>
                      ))}
                   </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 items-start">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">AI-Crafted Post</label>
                      <textarea 
                        value={caption} 
                        onChange={e => setCaption(e.target.value)} 
                        className="w-full h-96 bg-black/30 border border-white/5 rounded-2xl p-6 text-base leading-relaxed outline-none focus:border-yellow-500/30 resize-none font-medium transition-all"
                      />
                      <button onClick={() => handleCopy(caption)} className="w-full py-4 bg-[#111] border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">Copy Post Text_</button>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">LinkedIn Feed Preview</label>
                      <div className="sticky top-8">
                        <LinkedInPreview text={caption || "Drafting in progress..."} />
                      </div>
                   </div>
                </div>

                <button 
                  onClick={handlePostToLinkedIn} 
                  disabled={loading || !caption}
                  className="w-full py-6 bg-[#0a66c2] hover:bg-[#004182] text-white font-black rounded-3xl transition-all shadow-xl shadow-blue-900/20 uppercase tracking-widest text-sm"
                >
                  {loading ? "COMMUNICATING WITH PIPELINE..." : "POST TEXT TO LINKEDIN_"}
                </button>
             </div>
          </div>
        )}
      </main>

      {isEditorOpen && generatedImage && (
        <ImageEditor 
          image={generatedImage} 
          onClose={() => setIsEditorOpen(false)} 
          onSend={async (data) => {
            setLoading(true);
            try {
              const res = await sendEditToWebhook({ originalImage: generatedImage, prompt: data.textInstructions || "Edit", type: 'visual' });
              if (res) {
                setGeneratedImage(res);
                setNotification({ msg: "AI Edit Complete", type: 'success' });
              }
            } catch (err) {
              setNotification({ msg: "AI Edit Failed", type: 'error' });
            } finally {
              setLoading(false);
            }
          }} 
        />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
