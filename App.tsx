
import React, { useState, useEffect } from 'react';
import { Camera, Shirt, Package, Zap, RefreshCw, Download, Image as ImageIcon, Wand2, Edit3, Settings2, Info, MapPin, Eye, Key, AlertCircle, X, Layers } from 'lucide-react';
import ImageSelector from './components/ImageSelector';
import { AppStatus, GenerationSettings, CompositionResult } from './types';
import { generateFullComposition, cleanImageBackground, replaceBackground } from './services/geminiService';

const PRESET_ENVIRONMENTS = ["Studio tối giản", "Đường phố New York", "Sân vườn Resort", "Căn hộ Penthouse", "Quán Cafe vintage", "Văn phòng hiện đại"];
const PRESET_POSES = ["Đứng thẳng", "Đang đi bộ", "Ngồi bắt chéo chân", "Tạo dáng High-Fashion", "Nhìn nghiêng vai"];
const CLOTHING_TYPES = ["Áo phông/Sơ mi", "Váy/Đầm dạ hội", "Áo khoác Blazer", "Set đồ công sở", "Đồ thể thao"];
const CLOTHING_STYLES = ["Hiện đại", "Tối giản", "Cổ điển (Vintage)", "Sang trọng", "Họa tiết", "Streetwear"];
const SHOT_TYPES = ["Toàn thân (Full Body)", "Trung bình (Medium Shot)", "Cận cảnh (Close-up)", "Góc thấp (Low Angle)", "Góc cao (High Angle)"];

const App: React.FC = () => {
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [clothingImage, setClothingImage] = useState<string | null>(null);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [environmentImage, setEnvironmentImage] = useState<string | null>(null);
  
  const [cleaningStates, setCleaningStates] = useState({ clothing: false, product: false });
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [settings, setSettings] = useState<GenerationSettings>({
    aspectRatio: "3:4",
    pose: PRESET_POSES[0],
    environment: PRESET_ENVIRONMENTS[0],
    environmentDetail: "",
    clothingStyle: CLOTHING_STYLES[0],
    clothingType: CLOTHING_TYPES[0],
    clothingDetail: "",
    shotType: SHOT_TYPES[0]
  });
  
  const [currentResults, setCurrentResults] = useState<CompositionResult[]>([]);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);
  const [history, setHistory] = useState<CompositionResult[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [hasSelectedKey, setHasSelectedKey] = useState(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasSelectedKey(hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [selectedResultIndex, currentResults]);

  const handleDownload = (result: CompositionResult) => {
    if (!result || !result.imageUrl) return;
    const link = document.createElement('a');
    link.href = result.imageUrl;
    link.download = `anh-quan-mkt-${result.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClean = async (type: 'clothing' | 'product') => {
    const targetImg = type === 'clothing' ? clothingImage : productImage;
    if (!targetImg) return;
    
    setCleaningStates(prev => ({ ...prev, [type]: true }));
    try {
      const cleaned = await cleanImageBackground(targetImg, type === 'clothing' ? 'CLOTHING' : 'PRODUCT');
      if (cleaned) {
        if (type === 'clothing') setClothingImage(cleaned);
        else setProductImage(cleaned);
      }
    } catch (e: any) {
      console.error("Clean error:", e);
      if (e.message === "API_KEY_MISSING") {
        setErrorMsg("Lỗi hệ thống: Không tìm thấy API Key.");
      } else if (e.message === "QUOTA_EXHAUSTED") {
        setErrorMsg("Hết lượt truy cập miễn phí! Vui lòng thử lại sau.");
      } else if (e.message === "SAFETY_FILTER") {
        setErrorMsg("Ảnh bị từ chối do vi phạm chính sách an toàn. Vui lòng thử ảnh khác.");
      } else {
        alert("Xử lý thất bại. Vui lòng thử lại.");
      }
    } finally {
      setCleaningStates(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleGenerate = async () => {
    if (!modelImage) {
      alert("Vui lòng tải ảnh Người mẫu làm chủ thể!");
      return;
    }
    
    setStatus(AppStatus.GENERATING);
    setErrorMsg(null);
    setCurrentResults([]);
    setSelectedResultIndex(0);

    try {
      const results: string[] = [];
      // Generate 2 variations sequentially to avoid 429 errors on free tier
      for (let i = 0; i < 2; i++) {
        try {
          const url = await generateFullComposition(modelImage, clothingImage, productImage, environmentImage, settings, i);
          if (url) results.push(url);
          // Small delay between requests
          if (i === 0) await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e: any) {
          console.error(`Variation ${i} failed:`, e);
          if (e.message === "QUOTA_EXHAUSTED" || e.message === "AUTH_ERROR" || e.message === "API_KEY_MISSING") {
            throw e; // Re-throw to handle outside
          }
        }
      }

      const valid = results.map((url, i) => ({
        id: `res-${Date.now()}-${i}`,
        imageUrl: url,
        prompt: `Ghép ${settings.clothingType} ${settings.clothingStyle}`,
        timestamp: Date.now()
      }));

      if (valid.length > 0) {
        setCurrentResults(valid);
        setHistory(prev => [...valid, ...prev].slice(0, 12));
        setStatus(AppStatus.IDLE);
      } else {
        setStatus(AppStatus.ERROR);
        setErrorMsg("Không thể tạo ảnh. Vui lòng thử lại.");
      }
    } catch (e: any) {
      console.error("Generation Error:", e);
      setStatus(AppStatus.ERROR);
      if (e.message === "API_KEY_MISSING") {
        setErrorMsg("Lỗi hệ thống: Không tìm thấy API Key.");
      } else if (e.message === "QUOTA_EXHAUSTED") {
        setErrorMsg("Hết lượt truy cập miễn phí! Hãy nhấn vào biểu tượng chìa khóa 🔑 để dùng API Key riêng.");
      } else if (e.message === "AUTH_ERROR") {
        setErrorMsg("Lỗi xác thực hoặc quyền truy cập! Hãy nhấn vào biểu tượng chìa khóa 🔑 để dùng API Key cá nhân của bạn.");
      } else if (e.message === "SAFETY_FILTER") {
        setErrorMsg("Yêu cầu bị từ chối do vi phạm chính sách an toàn. Hãy thử thay đổi mô tả hoặc ảnh đầu vào.");
      } else {
        setErrorMsg("Có lỗi xảy ra. Hãy kiểm tra kết nối và thử lại.");
      }
    }
  };

  const handleReplaceBackground = async () => {
    const currentImg = currentResults[selectedResultIndex]?.imageUrl;
    if (!currentImg) return;

    setStatus(AppStatus.CHANGING_BACKGROUND);
    setErrorMsg(null);

    try {
      const url = await replaceBackground(currentImg, environmentImage, {
        aspectRatio: settings.aspectRatio,
        environment: settings.environment,
        environmentDetail: settings.environmentDetail
      });

      if (url) {
        const newRes = {
          id: `res-bg-${Date.now()}`,
          imageUrl: url,
          prompt: `Đổi nền: ${settings.environment}`,
          timestamp: Date.now()
        };
        setCurrentResults(prev => [newRes, ...prev]);
        setSelectedResultIndex(0);
        setHistory(prev => [newRes, ...prev].slice(0, 12));
        setStatus(AppStatus.IDLE);
      } else {
        setStatus(AppStatus.ERROR);
        setErrorMsg("Không thể đổi nền. Vui lòng thử lại.");
      }
    } catch (e: any) {
      console.error("BG Change Error:", e);
      setStatus(AppStatus.ERROR);
      if (e.message === "API_KEY_MISSING") {
        setErrorMsg("Lỗi hệ thống: Không tìm thấy API Key.");
      } else if (e.message === "QUOTA_EXHAUSTED") {
        setErrorMsg("Hết lượt truy cập miễn phí! Hãy nhấn vào biểu tượng chìa khóa 🔑 để dùng API Key riêng.");
      } else if (e.message === "SAFETY_FILTER") {
        setErrorMsg("Yêu cầu bị từ chối do vi phạm chính sách an toàn.");
      } else {
        setErrorMsg("Có lỗi xảy ra khi đổi nền.");
      }
    }
  };

  const isGenerateDisabled = status === AppStatus.GENERATING || status === AppStatus.CHANGING_BACKGROUND || !modelImage;

  const handleResetAll = () => {
    if (confirm("Bạn có chắc chắn muốn xóa tất cả dữ liệu và bắt đầu lại?")) {
      setModelImage(null);
      setClothingImage(null);
      setProductImage(null);
      setEnvironmentImage(null);
      setCurrentResults([]);
      setHistory([]);
      setErrorMsg(null);
      setStatus(AppStatus.IDLE);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasSelectedKey(true);
      setErrorMsg(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#050505] text-white selection:bg-indigo-500/30 overflow-hidden">
      {/* Sidebar */}
      <div className="w-full lg:w-[450px] glass-morphism border-b lg:border-r border-white/5 p-5 lg:p-6 flex flex-col gap-6 lg:h-screen lg:overflow-y-auto lg:sticky lg:top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-500/30 shadow-lg relative">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter text-indigo-400 leading-none uppercase">ANH QUÂN MKT</h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase">Free Studio v2.5</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSelectKey}
              className={`p-2 rounded-lg transition-all ${hasSelectedKey ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:text-indigo-400 hover:bg-indigo-400/10'}`}
              title={hasSelectedKey ? "Đã kết nối API Key riêng" : "Kết nối API Key riêng"}
            >
              <Key className="w-5 h-5" />
            </button>
            <button 
              onClick={handleResetAll}
              className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
              title="Làm mới tất cả"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>


        {/* Error Message */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex flex-col gap-3 animate-in slide-in-from-top duration-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-red-400 uppercase tracking-tight">Thông báo</p>
                <p className="text-[11px] text-red-300/80 mt-0.5">{errorMsg}</p>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-500/50 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {errorMsg.includes("Hết lượt") && (
              <button 
                onClick={handleSelectKey}
                className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold py-2 rounded-lg border border-red-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Key className="w-3 h-3" />
                SỬ DỤNG API KEY RIÊNG (KHÔNG GIỚI HẠN)
              </button>
            )}
          </div>
        )}

        {/* Input Sections */}
        <div className="grid grid-cols-2 gap-3">
          <ImageSelector 
            label="1. Người Mẫu" 
            image={modelImage} 
            onImageChange={setModelImage} 
            icon={<Camera className="w-4 h-4" />} 
          />
          <ImageSelector 
            label="2. Trang Phục" 
            image={clothingImage} 
            onImageChange={setClothingImage} 
            icon={<Shirt className="w-4 h-4" />} 
            isProcessing={cleaningStates.clothing}
            onProcess={() => handleClean('clothing')}
            processLabel="TÁCH"
          />
          <ImageSelector 
            label="3. Sản Phẩm" 
            image={productImage} 
            onImageChange={setProductImage} 
            icon={<Package className="w-4 h-4" />} 
            isProcessing={cleaningStates.product}
            onProcess={() => handleClean('product')}
            processLabel="TÁCH"
          />
          <ImageSelector 
            label="4. Nền Riêng" 
            image={environmentImage} 
            onImageChange={setEnvironmentImage} 
            icon={<MapPin className="w-4 h-4" />} 
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><Eye className="w-3 h-3"/> Góc Chụp AI</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500/50 appearance-none transition-colors" value={settings.shotType} onChange={e => setSettings({...settings, shotType: e.target.value})}>
                {SHOT_TYPES.map(s => <option key={s} value={s} className="bg-gray-900">{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase">Tư Thế</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs outline-none focus:border-indigo-500/50 appearance-none transition-colors" value={settings.pose} onChange={e => setSettings({...settings, pose: e.target.value})}>
                {PRESET_POSES.map(p => <option key={p} value={p} className="bg-gray-900">{p}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Bối Cảnh</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ENVIRONMENTS.map(env => (
                <button 
                  key={env}
                  onClick={() => setSettings({...settings, environment: env})}
                  className={`text-[10px] px-3 py-1.5 rounded-lg border transition-all ${settings.environment === env ? 'bg-indigo-600 border-indigo-400' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                  {env}
                </button>
              ))}
            </div>
            <textarea 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs min-h-[50px] outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-700 mt-2" 
              placeholder="Mô tả bối cảnh chi tiết: Bãi biển lúc hoàng hôn, rừng thông sương mù..."
              value={settings.environmentDetail}
              onChange={e => setSettings({...settings, environmentDetail: e.target.value})}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><Edit3 className="w-3 h-3"/> Ghi Chú Đặc Biệt</label>
            <textarea 
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs min-h-[60px] outline-none focus:border-indigo-500/50 transition-all placeholder:text-gray-700" 
              placeholder="Yêu cầu riêng: Mẫu nhìn thẳng, biểu cảm vui vẻ, da thật..."
              value={settings.clothingDetail}
              onChange={e => setSettings({...settings, clothingDetail: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Khung Hình</label>
            <div className="grid grid-cols-5 gap-1.5">
              {["1:1", "3:4", "4:3", "9:16", "16:9"].map(ratio => (
                <button
                  key={ratio}
                  onClick={() => setSettings({...settings, aspectRatio: ratio as any})}
                  className={`text-[10px] font-bold py-2 rounded-lg border transition-all ${settings.aspectRatio === ratio ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-gray-500'}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerateDisabled}
          className={`w-full font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 disabled:bg-gray-800 disabled:text-gray-600 mt-auto ${status === AppStatus.GENERATING ? 'bg-gray-800 text-gray-400' : 'bg-white text-black shadow-xl shadow-white/5'}`}
        >
          {status === AppStatus.GENERATING ? <RefreshCw className="animate-spin w-5 h-5" /> : <Wand2 className="w-5 h-5" />}
          XUẤT BẢN KẾT QUẢ
        </button>
      </div>

      {/* Main Preview */}
      <main className="flex-1 p-4 lg:p-12 bg-[#020202] flex flex-col items-center justify-center relative overflow-y-auto">
        {!currentResults.length && status !== AppStatus.GENERATING ? (
          <div className="flex flex-col items-center text-center max-w-sm animate-in fade-in zoom-in duration-700">
            <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20">
              <ImageIcon className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black mb-2 uppercase tracking-tight">Pro Photo Studio</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Tạo ảnh lookbook chân thật với AI thế hệ mới. Không chỉ là ghép ảnh, đó là nghệ thuật ánh sáng chuyên nghiệp.
            </p>
          </div>
        ) : (
          <div className={`w-full max-w-4xl flex flex-col items-center gap-8 ${status === AppStatus.GENERATING ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-700`}>
            {/* Image Stage */}
            <div className="relative group w-full max-w-[500px]">
              <div 
                className={`relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl bg-black transition-all duration-500 ${isTransitioning ? 'scale-95 opacity-50 blur-sm' : 'scale-100 opacity-100 blur-0'}`}
                style={{ aspectRatio: settings.aspectRatio.replace(':', '/') }}
              >
                {currentResults[selectedResultIndex] && (
                  <img 
                    src={currentResults[selectedResultIndex].imageUrl} 
                    className="w-full h-full object-contain animate-in fade-in duration-500" 
                    alt="Result" 
                    decoding="async"
                  />
                )}
                
                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                   <button 
                    onClick={() => handleDownload(currentResults[selectedResultIndex])}
                    className="p-4 bg-white/90 backdrop-blur text-black rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl active:scale-90"
                    title="Tải ảnh về"
                   >
                    <Download className="w-5 h-5" />
                   </button>
                   <button 
                    onClick={handleReplaceBackground}
                    disabled={status === AppStatus.CHANGING_BACKGROUND}
                    className="p-4 bg-white/90 backdrop-blur text-black rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-xl active:scale-90 disabled:opacity-50"
                    title="Đổi nền cho ảnh này"
                   >
                    <Layers className="w-5 h-5" />
                   </button>
                </div>
              </div>
            </div>

            {/* Varients / Current Session */}
            <div className="flex gap-3 px-4 pb-4">
              {currentResults.map((res, i) => (
                <div 
                  key={res.id}
                  onClick={() => setSelectedResultIndex(i)}
                  className={`w-16 h-20 lg:w-20 lg:h-24 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${selectedResultIndex === i ? 'border-indigo-500 scale-110' : 'border-white/5 opacity-40 hover:opacity-100'}`}
                >
                  <img src={res.imageUrl} className="w-full h-full object-cover" alt="Thumb" loading="lazy" decoding="async" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {(status === AppStatus.GENERATING || status === AppStatus.CHANGING_BACKGROUND) && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
            <div className="relative mb-8">
              <div className="w-20 h-20 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-indigo-400 font-bold tracking-widest text-[10px] uppercase animate-pulse">
              {status === AppStatus.CHANGING_BACKGROUND ? "Đang thay đổi bối cảnh..." : "Đang kiến tạo thực tế ảo..."}
            </p>
            <p className="text-gray-500 text-[9px] mt-2 uppercase tracking-widest">
              {hasSelectedKey ? "Sử dụng API Key cá nhân (Tốc độ cao)" : "Sử dụng mô hình Gemini 2.5 Flash miễn phí"}
            </p>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="w-full max-w-5xl mt-12 pt-8 border-t border-white/5">
            <div className="flex items-center justify-between mb-4 px-4">
              <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Bộ sưu tập Studio</h3>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-4">
              {history.map(h => (
                <div 
                  key={h.id}
                  onClick={() => { setCurrentResults([h]); setSelectedResultIndex(0); }}
                  className="group relative flex-shrink-0 w-20 lg:w-24 transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden border border-white/10 opacity-60 group-hover:opacity-100 transition-all cursor-pointer shadow-lg bg-gray-900/50">
                    <img 
                      src={h.imageUrl} 
                      className="w-full h-full object-cover animate-image-reveal" 
                      alt="History" 
                      loading="lazy" 
                      decoding="async"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes image-reveal {
          from { opacity: 0; filter: blur(4px); }
          to { opacity: 1; filter: blur(0); }
        }
        
        .animate-result {
          animation: fade-in-scale 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-image-reveal {
          animation: image-reveal 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default App;
