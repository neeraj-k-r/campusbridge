import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCw, Check, Scissors } from 'lucide-react';
import { getCroppedImgFile } from '../lib/imageUtils';

export default function ImageCropper({ image, onCropComplete, onCancel, aspectRatio = 16 / 9 }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [currentAspect, setCurrentAspect] = useState(aspectRatio);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [loading, setLoading] = useState(false);

  const aspectRatios = [
    { label: 'Free', value: null },
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
    { label: '9:16', value: 9 / 16 },
    { label: '2:3', value: 2 / 3 },
  ];

  const onCropChange = (crop) => {
    setCrop(crop);
  };

  const onRotationChange = (rotation) => {
    setRotation(rotation);
  };

  const onZoomChange = (zoom) => {
    setZoom(zoom);
  };

  const onCropAreaComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    setLoading(true);
    try {
      const { file, url } = await getCroppedImgFile(image, croppedAreaPixels, rotation);
      onCropComplete(file, url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 md:p-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-4xl bg-zinc-900 rounded-[2.5rem] overflow-hidden flex flex-col h-[80vh]"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Scissors size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">Crop & Rotate Image</h3>
              <p className="text-zinc-500 text-xs">Adjust your image for the perfect fit</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full text-zinc-400 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative flex-1 bg-black">
          <Cropper
            image={image}
            crop={crop}
            rotation={rotation}
            zoom={zoom}
            aspect={currentAspect}
            onCropChange={onCropChange}
            onRotationChange={onRotationChange}
            onCropComplete={onCropAreaComplete}
            onZoomChange={onZoomChange}
          />
        </div>

        <div className="p-6 bg-zinc-900 border-t border-white/10 space-y-6">
          <div className="space-y-4">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Aspect Ratio</label>
            <div className="flex flex-wrap gap-2">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio.label}
                  onClick={() => setCurrentAspect(ratio.value)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                    currentAspect === ratio.value
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Zoom</label>
                <span className="text-xs font-mono text-emerald-500">{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Rotation</label>
                <span className="text-xs font-mono text-emerald-500">{rotation}°</span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  aria-labelledby="Rotation"
                  onChange={(e) => onRotationChange(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <button 
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all"
                  title="Rotate 90°"
                >
                  <RotateCw size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCrop}
              disabled={loading}
              className="flex-[2] bg-emerald-500 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={20} />
                  <span>Apply Crop</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
