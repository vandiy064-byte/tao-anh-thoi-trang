
import React, { useRef } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

interface ImageSelectorProps {
  label: string;
  image: string | null;
  onImageChange: (base64: string | null) => void;
  icon: React.ReactNode;
  isProcessing?: boolean;
  onProcess?: () => void;
  processLabel?: string;
}

const ImageSelector: React.FC<ImageSelectorProps> = ({ 
  label, 
  image, 
  onImageChange, 
  icon, 
  isProcessing = false,
  onProcess,
  processLabel
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</label>
      <div 
        className={`relative aspect-square w-full rounded-2xl overflow-hidden border-2 transition-all duration-300 flex flex-col items-center justify-center
          ${image ? 'border-indigo-500 bg-black' : 'border-gray-800 bg-white/5 hover:bg-white/10 hover:border-gray-600'}
          ${isProcessing ? 'animate-pulse opacity-70 cursor-wait' : ''}`}
      >
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="text-[10px] text-indigo-400 font-bold uppercase">Đang xử lý...</span>
          </div>
        ) : image ? (
          <img src={image} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center cursor-pointer"
          >
            <div className="text-gray-600 mb-2">{icon}</div>
            <span className="text-xs text-gray-600 font-medium">Tải ảnh lên</span>
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={handleFileChange} 
        />

        {image && !isProcessing && (
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
            <button 
              onClick={() => onImageChange(null)}
              className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-all shadow-lg"
              title="Xóa ảnh"
            >
              <X className="w-3 h-3" />
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] font-bold text-white px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 hover:bg-white hover:text-black transition-all"
            >
              THAY ĐỔI
            </button>
            {onProcess && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onProcess();
                }}
                className="text-[10px] font-bold text-white px-4 py-2 rounded-full bg-indigo-600 backdrop-blur-sm border border-indigo-400/50 hover:bg-indigo-500 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" /> {processLabel || 'XỬ LÝ'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageSelector;
