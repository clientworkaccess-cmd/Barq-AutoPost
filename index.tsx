import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  generateSocialPost, 
  enhanceText, 
  generateCaption,
  dataURLtoBlob, 
  generateImageEdit, 
  sendEditToWebhook 
} from './geminiService';

const LOGO_URL = "https://res.cloudinary.com/djmakoiji/image/upload/v1765978253/Barq_Digital_Logo-removebg-preview_glejpc.png";
const IMAGE_WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-linkedin";

type Tool = 'text';

interface Annotation {
  id: string;
  type: Tool;
  x: number;
  y: number;
  text?: string;
  color: string;
}

const ImageEditor = ({ 
  image, 
  onClose, 
  onSend 
}: { 
  image: string; 
  onClose: () => void; 
  onSend: (data: { editedImage?: string, textInstructions?: string, metadata?: Annotation[] }) => Promise<void> 
}) => {
  const [color, setColor] = useState('#FF8C00');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [textInstructions, setTextInstructions] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [tempText, setTempText] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // High-res internal dimensions for 4:5
  const INTERNAL_WIDTH = 1080;
  const INTERNAL_HEIGHT = 1350;

  useEffect(() => {
    const resize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      
      // Calculate best fit for 4:5 in the available space
      let displayWidth = rect.width;
      let displayHeight = rect.width * (5/4);
      
      if (displayHeight > rect.height) {
        displayHeight = rect.height;
        displayWidth = displayHeight * (4/5);
      }

      canvasRef.current.width = INTERNAL_WIDTH;
      canvasRef.current.height = INTERNAL_HEIGHT;
      canvasRef.current.style.width = `${displayWidth}px`;
      canvasRef.current.style.height = `${displayHeight}px`;
      
      draw();
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [image]);

  useEffect(() => { draw(); }, [annotations, editingTextId, tempText, color]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawItem = (item: Partial<Annotation>) => {
      ctx.strokeStyle = item.color || color;
      ctx.fillStyle = item.color || color;
      ctx.font = 'bold 48px DM Sans';
      ctx.textBaseline = 'middle';

      if (item.id === editingTextId) {
        ctx.globalAlpha = 0.5;
        ctx.fillText(tempText + '|', item.x!, item.y!);
        ctx.globalAlpha = 1.0;
      } else if (item.text) {
        ctx.fillText(item.text, item.x!, item.y!);
      }
    };

    annotations.forEach(drawItem);
  };

  const getCanvasCoords = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = INTERNAL_WIDTH / rect.width;
    const scaleY = INTERNAL_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editingTextId) return; // Prevent multiple simultaneous edits
    const { x, y } = getCanvasCoords(e);
    const id = Date.now().toString();
    setAnnotations([...annotations, { id, type: 'text', x, y, text: "", color }]);
    setEditingTextId(id);
    setTempText("");
  };

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
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      // Draw base image scaled to 4:5
      ctx.drawImage(img, 0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT);
      
      // Overlay the manual text annotations
      const annotationLayer = canvasRef.current!;
      ctx.drawImage(annotationLayer, 0, 0);

      await onSend({ 
        editedImage: exportCanvas.toDataURL('image/png'),
        textInstructions: textInstructions.trim() || undefined,
        metadata: annotations
      });
      onClose();
    } catch (e) {
      console.error("Export failure:", e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/98 p-4 md:p-8 overflow-hidden animate-in fade-in duration-300">
      <div className="w-full h-full max-w-7xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex justify-between items-center shrink-0">
           <div className="flex items-center gap-4">
             <h2 className="text-2xl font-black text-orange-500 italic tracking-tighter">BARQ EDITOR_</h2>
             <div className="h-4 w-px bg-white/10 hidden md:block" />
             <div className="flex items-center gap-3">
               <span className="bg-orange-600/10 text-orange-500 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border border-orange-500/20">TEXT MODE_</span>
               <input 
                 type="color" 
                 value={color} 
                 onChange={e => setColor(e.target.value)} 
                 className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10 hover:border-orange-500 transition-colors" 
                 title="Text Color" 
               />
             </div>
           </div>
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-sm font-black tracking-widest">CLOSE [X]</button>
        </div>
        
        {/* Workspace - Fixed 4:5 Preview */}
        <div className="flex-grow flex items-center justify-center relative bg-[#0a0a0a] rounded-[2.5rem] border border-white/5 overflow-hidden group">
          <div ref={containerRef} className="w-full h-full flex items-center justify-center relative">
            <div className="relative shadow-[0_0_80px_rgba(255,140,0,0.05)] border border-white/5 overflow-hidden">
               {/* Base Image Layer */}
               <img 
                 src={image} 
                 className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
                 style={{ aspectRatio: '4/5' }}
               />
               
               {/* Drawing Canvas Layer */}
               <canvas 
                 ref={canvasRef} 
                 onMouseDown={handleMouseDown} 
                 className="relative z-20 cursor-text touch-none"
                 title="Click anywhere to add text"
               />

               {/* Active Text Input Overlay */}
               {editingTextId && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                  <div className="bg-[#111] p-6 rounded-3xl border border-orange-500/30 shadow-2xl w-80 translate-y-[-20%]">
                    <p className="text-[10px] text-orange-500 font-black uppercase tracking-widest mb-3">Add Overlay Content_</p>
                    <input 
                      autoFocus
                      className="w-full bg-black/50 border-b-2 border-orange-600 p-3 outline-none text-white text-xl font-bold rounded-t-lg"
                      placeholder="Type text..."
                      value={tempText}
                      onChange={e => setTempText(e.target.value)}
                      onBlur={() => {
                        if (tempText.trim() === "") {
                          setAnnotations(prev => prev.filter(a => a.id !== editingTextId));
                        } else {
                          setAnnotations(prev => prev.map(a => a.id === editingTextId ? { ...a, text: tempText } : a));
                        }
                        setEditingTextId(null);
                      }}
                      onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                    <p className="mt-3 text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Press ENTER to save or click away</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-[#111] p-6 rounded-[2rem] border border-white/5 flex flex-col md:flex-row gap-6 shrink-0">
          <div className="flex-grow">
             <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest block mb-2">Generative AI Edits (AI will transform the style)</label>
             <input 
               value={textInstructions} 
               onChange={e => setTextInstructions(e.target.value)} 
               placeholder="Example: 'Make it look like a cyberpunk poster' or 'Change background to dark navy'..."
               className="w-full bg-black border border-white/5 rounded-2xl p-4 outline-none focus:border-orange-500/50 transition-all text-sm font-medium"
             />
          </div>
          <button 
            onClick={handleFinalSend} 
            disabled={isSending}
            className="px-12 py-4 bg-orange-600 text-black font-black rounded-2xl hover:scale-105 transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-orange-900/20 whitespace-nowrap"
          >
            {isSending ? "SYNCING CHANGES..." : "APPLY & REFRESH_"}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [accomplishment, setAccomplishment] = useState("");
  const [caption, setCaption] = useState("");
  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetch(LOGO_URL).then(r => r.blob()).then(b => {
      const reader = new FileReader(); 
      reader.onloadend = () => setLogoBase64(reader.result as string); 
      reader.readAsDataURL(b);
    });
  }, []);

  const handleStyleRef = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setStyleRef(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!accomplishment || !logoBase64) return;
    setLoading(true); setGeneratedImage(null); setNotification(null);
    try { 
      const res = await generateSocialPost(accomplishment, logoBase64, styleRef); 
      setGeneratedImage(res);
      setNotification({ msg: "Graphic Forged Successfully", type: 'success' });
      
      // Auto-generate caption if it's empty
      if (!caption) {
        const aiCaption = await generateCaption(accomplishment);
        setCaption(aiCaption);
      }
    } catch (e) { 
      setNotification({ msg: "Engine Failure: Unable to generate", type: 'error' });
    } finally { setLoading(false); }
  };

  const handleSendEdit = async (data: { editedImage?: string, textInstructions?: string, metadata?: Annotation[] }) => {
    if (!generatedImage) return;
    setLoading(true);
    try {
      const webhookResult = await sendEditToWebhook({
        originalImage: generatedImage,
        editedImage: data.editedImage,
        prompt: data.textInstructions || "Creative Overlay Applied",
        type: data.textInstructions ? 'text' : 'visual'
      });
      if (webhookResult) {
        setGeneratedImage(webhookResult);
        setNotification({ msg: "Preview Updated via Webhook", type: 'success' });
      }
    } catch (e) {
      setNotification({ msg: "Edit Transmission Failed", type: 'error' });
    } finally { setLoading(false); }
  };

  const handlePostToLinkedIn = async () => {
    if (!generatedImage) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', dataURLtoBlob(generatedImage), 'barq_post.png');
      formData.append('caption', caption);
      const response = await fetch(IMAGE_WEBHOOK_URL, { method: 'POST', body: formData });
      if (response.ok) {
        setNotification({ msg: "Transmitted to LinkedIn Pipeline", type: 'success' });
      } else {
        throw new Error("Pipeline rejected transmission");
      }
    } catch (e) {
      setNotification({ msg: "Network Error: Broadcast failed", type: 'error' });
    } finally { setLoading(false); }
  };

  const handleAIRefineCaption = async () => {
    if (!accomplishment) return;
    setLoading(true);
    try {
      const newCaption = await generateCaption(accomplishment);
      setCaption(newCaption);
      setNotification({ msg: "Caption Refined via AI", type: 'success' });
    } catch (e) {
      setNotification({ msg: "Caption refinement failed", type: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-orange-500/30 font-['DM_Sans'] overflow-x-hidden">
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-yellow-600/5 blur-[120px] rounded-full pointer-events-none" />

      <nav className="p-8 max-w-7xl mx-auto flex justify-between items-center relative z-10">
         <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center font-black text-black text-xl italic">B</div>
            <span className="text-2xl font-black tracking-tighter uppercase italic">Barq<span className="text-orange-500">.</span>Digital</span>
         </div>
         {notification && (
            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border animate-in slide-in-from-top duration-300 ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
              {notification.msg}
            </div>
         )}
      </nav>

      <main className="max-w-7xl mx-auto px-8 py-12 grid lg:grid-cols-2 gap-16 items-start relative z-10">
        <div className="space-y-12">
           <section className="space-y-4">
              <h2 className="text-5xl font-black italic tracking-tighter leading-none">CRAFT YOUR<br/><span className="text-orange-600">VICTORY_</span></h2>
              <p className="text-gray-500 text-lg max-w-md">Transform your weekly engineering feats into high-impact social media assets.</p>
           </section>

           <div className="space-y-8 bg-[#0a0a0a] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl italic tracking-tighter pointer-events-none">INPUT</div>
              
              <div className="space-y-4">
                 <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Accomplishments</label>
                    <button onClick={() => enhanceText(accomplishment).then(setAccomplishment)} className="text-[10px] font-black text-orange-500 hover:text-orange-400 transition-colors">POLISH TEXT_</button>
                 </div>
                 <textarea 
                   value={accomplishment} 
                   onChange={e => setAccomplishment(e.target.value)} 
                   placeholder="Example: Resolved 42 high-priority bugs, boosted app performance by 30%..." 
                   className="w-full h-48 bg-transparent text-xl font-medium outline-none placeholder:text-gray-800 resize-none"
                 />
              </div>

              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Style Reference (Optional)</label>
                 <div className="flex gap-4 items-center">
                    <label className="flex-grow flex items-center justify-center h-20 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-orange-500/50 hover:bg-orange-500/5 transition-all">
                       <span className="text-xs text-gray-500 font-bold">{styleRef ? "IMAGE LOADED_" : "UPLOAD REFERENCE_"}</span>
                       <input type="file" className="hidden" accept="image/*" onChange={handleStyleRef} />
                    </label>
                    {styleRef && <img src={styleRef} className="w-20 h-20 object-cover rounded-2xl border border-white/10" />}
                 </div>
              </div>

              <button 
                onClick={handleGenerate} 
                disabled={loading} 
                className="w-full py-6 bg-orange-600 text-black font-black uppercase italic tracking-widest rounded-3xl shadow-xl shadow-orange-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? "PROCESSING..." : "GENERATE ASSET_"}
              </button>
           </div>
        </div>

        <div className="relative group">
           <div className="absolute inset-0 bg-orange-600/5 blur-[100px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
           
           <div className="bg-[#0a0a0a] rounded-[3rem] border border-white/5 p-10 min-h-[600px] flex flex-col items-center justify-center shadow-[0_0_100px_rgba(0,0,0,0.5)] relative overflow-hidden">
              {loading ? (
                 <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-orange-600/20 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-[10px] font-black tracking-[0.4em] text-orange-500 animate-pulse">RENDER IN PROGRESS</span>
                 </div>
              ) : generatedImage ? (
                 <div className="w-full space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="relative shadow-2xl rounded-2xl overflow-hidden border border-white/10">
                       <img src={generatedImage} className="w-full object-contain mx-auto" style={{ aspectRatio: '4/5' }} />
                       <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-[10px] font-black uppercase tracking-widest text-orange-500">Preview_4:5</div>
                    </div>

                    <div className="space-y-3">
                       <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">LinkedIn Caption</label>
                          <button onClick={handleAIRefineCaption} className="text-[10px] font-black text-orange-500 hover:text-orange-400 transition-colors uppercase">AI Refine_</button>
                       </div>
                       <textarea 
                         value={caption} 
                         onChange={e => setCaption(e.target.value)} 
                         placeholder="Enter your LinkedIn caption here..."
                         className="w-full h-32 bg-black/40 border border-white/5 rounded-2xl p-4 text-sm font-medium outline-none focus:border-orange-500/50 resize-none"
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => setIsEditorOpen(true)} className="py-4 bg-[#111] hover:bg-white/5 rounded-2xl font-black text-orange-500 border border-white/5 transition-all text-xs uppercase tracking-widest">EDIT ASSET_</button>
                       <button onClick={handleGenerate} className="py-4 bg-[#111] hover:bg-white/5 rounded-2xl font-black border border-white/5 transition-all text-xs uppercase tracking-widest">REGENERATE_</button>
                    </div>

                    <button 
                      onClick={handlePostToLinkedIn} 
                      className="w-full py-5 bg-[#0a66c2] hover:bg-[#004182] text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                      POST TO LINKEDIN
                    </button>
                 </div>
              ) : (
                 <div className="flex flex-col items-center gap-8 opacity-20">
                    <div className="w-48 h-60 border-4 border-dashed border-white/20 rounded-[2rem]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.6em]">Await Signal</span>
                 </div>
              )}
           </div>
        </div>
      </main>

      {isEditorOpen && generatedImage && (
        <ImageEditor image={generatedImage} onClose={() => setIsEditorOpen(false)} onSend={handleSendEdit} />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
