import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { generateSocialPost, enhanceText, generateCaption } from './geminiService';

const LOGO_URL = "https://res.cloudinary.com/djmakoiji/image/upload/v1765978253/Barq_Digital_Logo-removebg-preview_glejpc.png";
const WEBHOOK_URL = "https://n8n.srv927950.hstgr.cloud/webhook/image-linkedin";

const LOADING_MESSAGES = [
  "We are cooking...",
  "Making your post...",
  "Mixing the colors...",
  "Adding some sparkle...",
  "Almost ready...",
  "Styling the pixels..."
];

const App = () => {
  const [accomplishment, setAccomplishment] = useState("");
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
    let interval: NodeJS.Timeout;
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

  const handleEnhanceText = async () => {
    if (!accomplishment) return;
    setEnhancing(true);
    setError(null);
    try {
      const improvedText = await enhanceText(accomplishment);
      setAccomplishment(improvedText);
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
      const improved = await enhanceText(caption);
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
    setCaption(""); // Reset caption on new generation

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
    if (!generatedImage) return;

    setPosting(true);
    try {
      // Convert base64 to blob
      const res = await fetch(generatedImage);
      const blob = await res.blob();

      const formData = new FormData();
      formData.append('file', blob, 'post.png');
      if (caption) {
        formData.append('caption', caption);
      }

      // Post binary/multipart to webhook
      const webhookRes = await fetch(WEBHOOK_URL, {
        method: 'POST',
        body: formData,
      });

      if (webhookRes.ok) {
        setNotification({ message: "Successfully posted to LinkedIn!", type: 'success' });
      } else {
        throw new Error(`Webhook failed with status ${webhookRes.status}`);
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ message: "Failed to post: " + err.message, type: 'error' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-black text-white selection:bg-orange-500 selection:text-white">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        
        {/* LEFT COLUMN - INPUTS */}
        <div className="flex flex-col space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent">
              Barq Post Gen
            </h1>
            <p className="text-gray-400">Turn your weekly wins into social media gold.</p>
          </div>

          <div className="bg-[#1a1a1c] p-6 rounded-2xl border border-gray-800 shadow-2xl relative">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-semibold text-gray-300">
                Weekly Accomplishments
              </label>
              <button
                onClick={handleEnhanceText}
                disabled={enhancing || !accomplishment}
                className="text-xs bg-[#2a2a2c] hover:bg-[#333] text-orange-400 border border-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {enhancing ? (
                   <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                )}
                Enhance with AI
              </button>
            </div>
            <textarea 
              value={accomplishment}
              onChange={(e) => setAccomplishment(e.target.value)}
              placeholder="e.g. Resolved 5 critical bugs in the payment gateway and improved loading speed by 20%..."
              className="w-full h-40 bg-[#0f0f10] border border-gray-700 rounded-xl p-4 text-gray-100 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all resize-none"
            />
          </div>

          <div className="bg-[#1a1a1c] p-6 rounded-2xl border border-gray-800 shadow-2xl">
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Style Reference (Optional)
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group cursor-pointer w-full h-24 border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center hover:border-orange-500 hover:bg-[#252528] transition-all relative overflow-hidden"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleStyleUpload} 
                className="hidden" 
                accept="image/*"
              />
              {styleRef ? (
                 <div className="flex items-center space-x-3">
                   <img src={styleRef} alt="Ref" className="h-16 w-16 object-cover rounded-lg border border-gray-600" />
                   <span className="text-green-400 text-sm font-medium">Reference loaded</span>
                 </div>
              ) : (
                <div className="flex flex-col items-center text-gray-500 group-hover:text-orange-400 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs uppercase font-bold tracking-wider">Upload Image</span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !logoBase64}
            className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide uppercase shadow-lg transition-all transform hover:-translate-y-1 ${
              loading 
                ? 'bg-gray-700 cursor-wait text-gray-400' 
                : 'bg-gradient-to-r from-orange-600 to-yellow-500 hover:from-orange-500 hover:to-yellow-400 text-black shadow-orange-900/50'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {loadingMessage}
              </span>
            ) : "Generate Post"}
          </button>

          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800 text-red-200 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          {notification && (
             <div className={`p-4 rounded-lg text-sm border flex items-center ${notification.type === 'success' ? 'bg-green-900/30 border-green-800 text-green-200' : 'bg-red-900/30 border-red-800 text-red-200'}`}>
                {notification.message}
             </div>
          )}
        </div>

        {/* RIGHT COLUMN - PREVIEW */}
        <div className="flex flex-col bg-[#151516] rounded-3xl border border-gray-800 p-8 min-h-[500px] relative overflow-hidden transition-all">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-700 via-[#000] to-black pointer-events-none"></div>

            <div className="flex-grow flex items-center justify-center w-full z-10">
              {generatedImage ? (
                <div className="relative w-full flex flex-col items-center animate-in fade-in duration-700 space-y-8">
                  <div className="relative shadow-2xl rounded-sm overflow-hidden border-4 border-gray-900" style={{ aspectRatio: '4/5', maxHeight: '500px' }}>
                      <img src={generatedImage} alt="Generated Post" className="w-full h-full object-cover" />
                  </div>

                  {/* CAPTION SECTION */}
                  <div className="w-full bg-[#1a1a1c] border border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                       <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">LinkedIn Caption (Optional)</label>
                       <div className="flex gap-2">
                          <button 
                             onClick={handleGenerateCaption}
                             disabled={generatingCaption}
                             className="text-xs bg-gray-800 hover:bg-gray-700 text-orange-400 border border-gray-600 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                          >
                             {generatingCaption ? <span className="animate-spin">⏳</span> : '✨'} AI Generate
                          </button>
                          <button 
                             onClick={handleEnhanceCaption}
                             disabled={enhancingCaption || !caption}
                             className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-600 px-2 py-1 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                             {enhancingCaption ? <span className="animate-spin">⏳</span> : '🪄'} Enhance
                          </button>
                       </div>
                    </div>
                    <textarea 
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Write a caption or use AI to generate one..."
                      className="w-full h-24 bg-[#0f0f10] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500 outline-none resize-none mb-1"
                    />
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex flex-col sm:flex-row gap-4 w-full">
                     <button 
                       onClick={handleGenerate}
                       className="flex-1 py-3 px-6 rounded-lg font-semibold bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 transition-colors flex items-center justify-center gap-2"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Regenerate Image
                     </button>
                     <button 
                       onClick={handlePostToLinkedIn}
                       disabled={posting}
                       className="flex-1 py-3 px-6 rounded-lg font-semibold bg-blue-700 hover:bg-blue-600 text-white shadow-lg shadow-blue-900/30 transition-colors flex items-center justify-center gap-2"
                     >
                        {posting ? (
                           <span className="animate-pulse">Posting...</span>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854V1.146zm4.943 12.248V6.169H2.542v7.225h2.401zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248-.822 0-1.359.54-1.359 1.248 0 .694.521 1.248 1.327 1.248h.016zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.25c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016a5.54 5.54 0 0 1 .016-.025V6.169h-2.4c.03.678 0 7.225 0 7.225h2.4z"/>
                            </svg>
                            Post to LinkedIn
                          </>
                        )}
                     </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 max-w-md">
                   <div className="w-24 h-32 border-2 border-gray-700 border-dashed rounded-lg mx-auto mb-6 flex items-center justify-center">
                      <span className="text-gray-600 font-bold text-4xl opacity-50">?</span>
                   </div>
                   <h3 className="text-xl font-bold text-gray-200 mb-2">Ready to Create?</h3>
                   <p className="text-gray-500">
                      Your generated image will appear here. The AI will combine your text, the company logo, and a fresh design into a LinkedIn-ready image.
                   </p>
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