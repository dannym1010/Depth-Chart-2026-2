import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Type, Smile, Sparkles, RotateCcw, Check, AlertCircle } from 'lucide-react';

export interface TeamLogoConfig {
  mode: 'letter' | 'image' | 'emoji';
  letterText: string;
  gradientClass: string;
  textColor: string;
  imageUrl?: string;
  emoji?: string;
}

export const DEFAULT_TEAM_LOGO: TeamLogoConfig = {
  mode: 'letter',
  letterText: 'M',
  gradientClass: 'from-indigo-700 via-indigo-800 to-slate-900',
  textColor: '#ffffff',
  emoji: '🏈',
};

export const GRADIENT_PRESETS = [
  { id: 'indigo', name: 'Indigo Classic', class: 'from-indigo-700 via-indigo-800 to-slate-900', border: 'border-indigo-400/40' },
  { id: 'navy-gold', name: 'Mahopac Navy & Gold', class: 'from-blue-900 via-slate-900 to-amber-600', border: 'border-amber-400/40' },
  { id: 'royal', name: 'Royal Blue', class: 'from-blue-600 via-blue-800 to-slate-950', border: 'border-blue-400/40' },
  { id: 'crimson', name: 'Crimson Red', class: 'from-red-600 via-red-800 to-slate-950', border: 'border-red-400/40' },
  { id: 'emerald', name: 'Defense Green', class: 'from-emerald-700 via-emerald-900 to-teal-950', border: 'border-emerald-400/40' },
  { id: 'stealth', name: 'Stealth Black', class: 'from-slate-800 via-zinc-900 to-black', border: 'border-slate-600/40' },
  { id: 'sunset', name: 'Sunset Blaze', class: 'from-orange-600 via-amber-700 to-slate-900', border: 'border-amber-500/40' },
  { id: 'purple', name: 'Purple Reign', class: 'from-purple-700 via-purple-900 to-slate-950', border: 'border-purple-400/40' },
];

export const EMOJI_PRESETS = [
  '🏈', '🦅', '🛡️', '⚡', '🐅', '🐺', '🦁', '🐻', '🏆', '⚔️', '🎯', '💥', '🥇', '🚩', '🚀', '🦍', '🐾', '🦾', '🔥', '⭐'
];

interface CustomLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: TeamLogoConfig;
  onSave: (config: TeamLogoConfig) => void;
  teamName?: string;
}

export const CustomLogoModal: React.FC<CustomLogoModalProps> = ({
  isOpen,
  onClose,
  currentConfig,
  onSave,
  teamName = 'Mahopac Football',
}) => {
  const [mode, setMode] = useState<'letter' | 'image' | 'emoji'>(currentConfig.mode || 'letter');
  const [letterText, setLetterText] = useState(currentConfig.letterText || 'M');
  const [gradientClass, setGradientClass] = useState(currentConfig.gradientClass || GRADIENT_PRESETS[0].class);
  const [imageUrl, setImageUrl] = useState(currentConfig.imageUrl || '');
  const [emoji, setEmoji] = useState(currentConfig.emoji || '🏈');
  const [urlInput, setUrlInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Image size exceeds 4MB. Please upload a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setImageUrl(result);
        setMode('image');
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const newConfig: TeamLogoConfig = {
      mode,
      letterText: (letterText.trim() || 'M').slice(0, 4).toUpperCase(),
      gradientClass,
      textColor: '#ffffff',
      imageUrl: mode === 'image' ? imageUrl : undefined,
      emoji: mode === 'emoji' ? emoji : undefined,
    };
    onSave(newConfig);
    onClose();
  };

  const handleReset = () => {
    setMode('letter');
    setLetterText('M');
    setGradientClass(DEFAULT_TEAM_LOGO.gradientClass);
    setImageUrl('');
    setEmoji('🏈');
    setUploadError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="custom-logo-modal-dialog"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Customize Team Icon & Logo</h2>
              <p className="text-xs text-slate-400">Personalize the sidebar crest for {teamName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Live Preview Card */}
          <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Crest Preview */}
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientClass} border border-white/20 flex items-center justify-center shadow-xl ring-2 ring-indigo-500/30 overflow-hidden shrink-0`}
              >
                {mode === 'image' && imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Custom Logo Preview"
                    className="w-full h-full object-cover"
                    onError={() => setUploadError('Image failed to load. Check URL or upload again.')}
                  />
                ) : mode === 'emoji' ? (
                  <span className="text-2xl select-none">{emoji}</span>
                ) : (
                  <span className="text-white font-black text-2xl tracking-tighter select-none font-serif">
                    {letterText || 'M'}
                  </span>
                )}
              </div>

              <div>
                <span className="text-xs font-bold text-white block">{teamName}</span>
                <span className="text-[11px] text-slate-400">
                  {mode === 'image'
                    ? 'Custom Uploaded Crest'
                    : mode === 'emoji'
                    ? `Mascot Symbol (${emoji})`
                    : `Monogram Letter ("${letterText || 'M'}")`}
                </span>
                <span className="text-[10px] text-indigo-400 font-semibold block mt-0.5">
                  Appears in sidebar navigation & reports
                </span>
              </div>
            </div>

            {/* Collapsed Bar Miniature Preview */}
            <div className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-lg p-2 shrink-0">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-1">Collapsed</span>
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradientClass} border border-white/20 flex items-center justify-center shadow-md overflow-hidden`}
              >
                {mode === 'image' && imageUrl ? (
                  <img src={imageUrl} alt="Mini Preview" className="w-full h-full object-cover" />
                ) : mode === 'emoji' ? (
                  <span className="text-base">{emoji}</span>
                ) : (
                  <span className="text-white font-black text-base font-serif">{letterText || 'M'}</span>
                )}
              </div>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode('letter')}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'letter' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Monogram Letter</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('image')}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'image' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Upload Image</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('emoji')}
              className={`py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                mode === 'emoji' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Mascot Icon</span>
            </button>
          </div>

          {/* Mode 1: Monogram Letter */}
          {mode === 'letter' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Monogram Text (1 to 4 Characters)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={letterText}
                  onChange={(e) => setLetterText(e.target.value.toUpperCase())}
                  placeholder="M, MP, 10U..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-black text-lg tracking-wider focus:outline-hidden focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Background Gradient Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GRADIENT_PRESETS.map((p) => {
                    const isSelected = gradientClass === p.class;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGradientClass(p.class)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-950/40 ring-1 ring-indigo-400'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.class} border border-white/20 shadow-xs flex items-center justify-center`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 text-center leading-tight">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Upload Image */}
          {mode === 'image' && (
            <div className="space-y-4">
              {/* Drag and Drop Box */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/40 hover:bg-slate-950/70 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold text-white">Click or Drag Image File Here</span>
                <span className="text-[11px] text-slate-400 mt-1">Supports PNG, JPG, SVG, WebP (up to 4MB)</span>
              </div>

              {/* Paste Image URL */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Or Paste Direct Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/team-logo.png"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (urlInput.trim()) {
                        setImageUrl(urlInput.trim());
                        setUploadError(null);
                      }
                    }}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-xl text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {imageUrl && (
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-300 font-medium truncate max-w-[280px]">
                    Image Loaded Successfully
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl('');
                      setUrlInput('');
                    }}
                    className="text-xs text-red-400 hover:text-red-300 font-bold transition-colors"
                  >
                    Clear Image
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mode 3: Mascot / Football Emojis */}
          {mode === 'emoji' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Select Football Mascot or Icon</label>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                  {EMOJI_PRESETS.map((item) => {
                    const isSelected = emoji === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setEmoji(item)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-2 border-indigo-400 scale-110 shadow-md'
                            : 'bg-slate-950 border border-slate-800 hover:border-slate-700 hover:scale-105'
                        }`}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">Background Gradient Theme</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GRADIENT_PRESETS.map((p) => {
                    const isSelected = gradientClass === p.class;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGradientClass(p.class)}
                        className={`p-2 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-950/40 ring-1 ring-indigo-400'
                            : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${p.class} border border-white/20 shadow-xs flex items-center justify-center`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-[10px] font-semibold text-slate-300 text-center leading-tight">
                          {p.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Mahopac &quot;M&quot;</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white rounded-xl border border-slate-700/80 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Custom Logo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
