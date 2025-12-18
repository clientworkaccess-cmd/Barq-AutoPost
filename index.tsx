import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { generateSocialPost, enhanceText, generateCaption } from './geminiService';

const LOGO_URL = "https://res.cloudinary.com/djmakoiji/image/upload/v1765978253/Barq_Digital_Logo-removebg-preview_glejpc.png";
const IMAGE_WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-linkedin";
const TEXT_WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/3c345faf-7a5c-42ad-aa0a-4985b1e6f1dc";

const LOADING_MESSAGES = [
  "We are cooking...",
  "Making your post...",
  "Mixing the colors...",
  "Adding some sparkle...",
  "Almost ready...",
  "Styling the pixels..."
];

type PostType = 'image' | 'text';

const App = () => {
  const [activeTab, setActiveTab] = useState<PostType>('image');
  const [accomplishment, setAccomplishment] = useState("");
  const [textContent, setTextContent] = useState("");
  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [enhancing, setEnhancing] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [enhancingCaption, setEnhancingCaption] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycle loading messages
  useEffect(() => {
    let interval: any;
    if (loading) {
      let i = 0;
      setLoadingMessage(LOADING_MESSAGES[0]);
      interval = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[i]);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Fetch logo on mount
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch(LOGO_URL, { mode: 'cors' });
        if (!response.ok) throw new Error('Failed to fetch logo');
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to fetch logo:", err);
        setError("Warning: Could not load company logo. Please refresh or check connection.");
      }
    };
    fetchLogo();
  }, []);

  const handleStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setStyleRef(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnhance = async (type: PostType) => {
    const targetText = type === 'image' ? accomplishment : textContent;
    if (!targetText) return;
    
    setEnhancing(true);
    setError(null);
    try {
      const improvedText = await enhanceText(targetText, type);
      if (type === 'image') {
        setAccomplishment(improvedText);
      } else {
        setTextContent(improvedText);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to enhance text. Please try again.");
    } finally {
      setEnhancing(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!accomplishment) return;
    setGeneratingCaption(true);
    try {
      const cap = await generateCaption(accomplishment);
      setCaption(cap);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate caption.");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleEnhanceCaption = async () => {
    if (!caption) return;
    setEnhancingCaption(true);
    try {
      const improved = await enhanceText(caption, 'text');
      setCaption(improved);
    } catch (err: any) {
      console.error(err);
      setError("Failed to enhance caption.");
    } finally {
      setEnhancingCaption(false);
    }
  };

  const handleGenerate = async () => {
    if (!accomplishment) {
      setError("Please enter your weekly accomplishments.");
      return;
    }
    if (!logoBase64) {
      setError("Logo is still loading, please wait a moment...");
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setNotification(null);
    setCaption("");

    try {
      const imageResult = await generateSocialPost(accomplishment, logoBase64, styleRef);
      setGeneratedImage(imageResult);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate image.");
    } finally {
      setLoading(false);
    }
  };

  const handlePostToLinkedIn = async () => {
    setNotification(null);
    setError(null);
    
    if (activeTab === 'image') {
      if (!generatedImage) {
        setError("Please generate an image first.");
        return;
      }
      setPosting(true);
      try {
        const res = await fetch(generatedImage);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append('file', blob, 'post.png');
        if (caption) {
          formData.append('caption', caption);
        }
        const webhookRes = await fetch(IMAGE_WEBHOOK_URL, {
          method: 'POST',
          body: formData,
        });
        if (webhookRes.ok) {
          setNotification({ message: "Successfully posted image to LinkedIn!", type: 'success' });
        } else {
          throw new Error(`Webhook failed with status ${webhookRes.status}`);
        }
      } catch (err: any) {
        console.error(err);
        setNotification({ message: "Failed to post image: " + err.message, type: 'error' });
      } finally {
        setPosting(false);
      }
    } else {
      // Text post logic
      if (!textContent) {
        setError("Please enter some text content to post.");
        return;
      }
      setPosting(true);
      try {
        // Explicitly sending the text content in a JSON structure
        const payload = { 
          text: textContent,
          timestamp: new Date().toISOString(),
          type: 'text_post'
        };
        
        const webhookRes = await fetch(TEXT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
        });
        
        if (webhookRes.ok) {
          setNotification({ message: "Successfully posted text to LinkedIn!", type: 'success' });
        } else {
          const errorText = await webhookRes.text();
          throw new Error(`Webhook failed with status ${webhookRes.status}: ${errorText}`);
        }
      } catch (err: any) {
        console.error("Text post error details:", err);
        setNotification({ message: "Failed to post text: " + err.message, type: 'error' });
      } finally {
        setPosting(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-black text-white selection:bg-orange-500 selection:text-white font-['DM_Sans']">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* LEFT COLUMN - INPUTS */}
        <div className="flex flex-col space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent">
              Barq Creator
            </h1>
            <p className="text-gray-400">Premium social tools for digital excellence.</p>
          </div>

          {/* TAB TOGGLE */}
          <div className="flex p-1 bg-[#1a1a1c] rounded-xl border border-gray-800">
            <button 
              onClick={() => { setActiveTab('image'); setNotification(null); setError(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'image' ? 'bg-orange-600 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Image Generator
            </button>
            <button 
              onClick={() => { setActiveTab('text'); setNotification(null); setError(null); }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'text' ? 'bg-orange-600 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Text Post
            </button>
          </div>

          {activeTab === 'image' ? (
            <div className="space-y-6 animate-in slide-in-from-left duration-500">
              <div className="bg-[#1a1a1c] p-6 rounded-2xl border border-gray-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-gray-300">Weekly Accomplishments</label>
                  <button
                    onClick={() => handleEnhance('image')}
                    disabled={enhancing || !accomplishment}
                    className="text-xs bg-[#2a2a2c] hover:bg-[#333] text-orange-400 border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 group"
                  >
                    {enhancing ? <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></span> : '✨ Enhance'}
                  </button>
                </div>
                <textarea 
                  value={accomplishment}
                  onChange={(e) => setAccomplishment(e.target.value)}
                  placeholder="Describe your wins..."
                  className="w-full h-40 bg-[#0f0f10] border border-gray-700 rounded-xl p-4 text-gray-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="bg-[#1a1a1c] p-6 rounded-2xl border border-gray-800 shadow-2xl">
                <label className="block text-sm font-semibold text-gray-300 mb-2">Style Reference (Optional)</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group cursor-pointer w-full h-24 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-orange-500 hover:bg-[#252528] transition-all relative overflow-hidden"
                >
                  <input type="file" ref={fileInputRef} onChange={handleStyleUpload} className="hidden" accept="image/*" />
                  {styleRef ? (
                     <div className="flex items-center space-x-3">
                       <img src={styleRef} alt="Ref" className="h-16 w-16 object-cover rounded-lg border border-gray-600" />
                       <span className="text-green-400 text-sm font-medium">Reference loaded</span>
                     </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500 group-hover:text-orange-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs uppercase font-bold">Upload Image</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg transition-all transform hover:-translate-y-1 ${loading ? 'bg-gray-700 text-gray-400' : 'bg-gradient-to-r from-orange-600 to-yellow-500 text-black'}`}
              >
                {loading ? <span className="flex items-center justify-center gap-3"><span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>{loadingMessage}</span> : "Generate Post Image"}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-right duration-500">
              <div className="bg-[#1a1a1c] p-6 rounded-2xl border border-gray-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-semibold text-gray-300">Post Content</label>
                  <button
                    onClick={() => handleEnhance('text')}
                    disabled={enhancing || !textContent}
                    className="text-xs bg-[#2a2a2c] hover:bg-[#333] text-orange-400 border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 group"
                  >
                    {enhancing ? <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></span> : '🪄 AI Polish'}
                  </button>
                </div>
                <textarea 
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Share your thoughts or news with the network..."
                  className="w-full h-64 bg-[#0f0f10] border border-gray-700 rounded-xl p-4 text-gray-100 focus:ring-2 focus:ring-orange-500 outline-none transition-all resize-none"
                />
              </div>

              <button
                onClick={handlePostToLinkedIn}
                disabled={posting || !textContent}
                className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg transition-all transform hover:-translate-y-1 ${posting ? 'bg-gray-700 text-gray-400' : 'bg-blue-700 hover:bg-blue-600 text-white shadow-blue-900/40'}`}
              >
                {posting ? <span className="flex items-center justify-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Posting...</span> : "Post Text to LinkedIn"}
              </button>
            </div>
          )}

          {error && <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm">{error}</div>}
          {notification && <div className={`p-4 rounded-lg text-sm border flex items-center shadow-xl animate-in fade-in slide-in-from-bottom-2 ${notification.type === 'success' ? 'bg-green-900/30 border-green-800 text-green-200' : 'bg-red-900/30 border-red-800 text-red-200'}`}>{notification.message}</div>}
        </div>

        {/* RIGHT COLUMN - PREVIEW */}
        <div className="flex flex-col bg-[#151516] rounded-3xl border border-gray-800 p-8 min-h-[500px] relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-[#000] to-black pointer-events-none"></div>

            <div className="flex-grow flex items-center justify-center w-full z-10">
              {activeTab === 'image' ? (
                generatedImage ? (
                  <div className="relative w-full flex flex-col items-center animate-in fade-in duration-700 space-y-8">
                    <div className="relative shadow-2xl rounded-sm overflow-hidden border-4 border-gray-900" style={{ aspectRatio: '4/5', maxHeight: '480px' }}>
                        <img src={generatedImage} alt="Generated Post" className="w-full h-full object-cover" />
                    </div>

                    <div className="w-full bg-[#1a1a1c] border border-gray-800 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                         <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">LinkedIn Caption</label>
                         <div className="flex gap-2">
                            <button onClick={handleGenerateCaption} disabled={generatingCaption} className="text-xs bg-gray-800 hover:bg-gray-700 text-orange-400 border border-gray-600 px-2 py-1 rounded transition-colors">
                               {generatingCaption ? '⏳' : '✨'} AI Generate
                            </button>
                            <button onClick={handleEnhanceCaption} disabled={enhancingCaption || !caption} className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-600 px-2 py-1 rounded transition-colors">
                               {enhancingCaption ? '⏳' : '🪄'} Enhance
                            </button>
                         </div>
                      </div>
                      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption..." className="w-full h-20 bg-[#0f0f10] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500 outline-none resize-none" />
                    </div>

                    <div className="flex gap-4 w-full">
                       <button onClick={handleGenerate} className="flex-1 py-3 px-6 rounded-lg font-semibold bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 transition-colors flex items-center justify-center gap-2">Regenerate</button>
                       <button onClick={handlePostToLinkedIn} disabled={posting} className="flex-1 py-3 px-6 rounded-lg font-semibold bg-blue-700 hover:bg-blue-600 text-white shadow-lg shadow-blue-900/30 transition-colors flex items-center justify-center gap-2">
                          {posting ? "Posting..." : "Post to LinkedIn"}
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 max-w-md">
                     <div className="w-24 h-32 border-2 border-gray-700 border-dashed rounded-lg mx-auto mb-6 flex items-center justify-center">
                        <span className="text-gray-600 font-bold text-4xl opacity-50">?</span>
                     </div>
                     <h3 className="text-xl font-bold text-gray-200 mb-2">Visual Preview</h3>
                     <p className="text-gray-500 text-sm">Design your accomplishment graphic. The preview will update here once generated.</p>
                  </div>
                )
              ) : (
                <div className="w-full max-w-lg bg-[#1a1a1c] border border-gray-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-500 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700">
                      <img src={LOGO_URL} className="w-6 h-6 object-contain" alt="Barq" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Barq Digital Team</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">LinkedIn Update</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap min-h-[200px] flex-grow">
                    {textContent || <span className="text-gray-600 italic">No text content yet...</span>}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-800 flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                    <span>Text-only post preview</span>
                    <span className="text-orange-500">Ready to transmit</span>
                  </div>
                  
                  <button 
                    onClick={handlePostToLinkedIn} 
                    disabled={posting || !textContent}
                    className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition-all flex items-center justify-center gap-2 ${posting ? 'bg-gray-700 text-gray-500' : 'bg-blue-700 hover:bg-blue-600 text-white shadow-lg shadow-blue-900/30'}`}
                  >
                    {posting ? <span className="flex items-center justify-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Transmitting...</span> : "Transmit to LinkedIn"}
                  </button>
                </div>
              )}
            </div>
        </div>

      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
