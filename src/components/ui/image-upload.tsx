import React, { useState, useRef } from 'react';
import { Button } from './button';
import { toast } from 'sonner';
import { Input } from './input';
import { X, Plus, Image as ImageIcon, Upload, Loader2, ChevronLeft, ChevronRight, Star, ImageUp } from 'lucide-react';
import { uploadListingImage } from '@/lib/media-client';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  onRemove: (url: string) => void;
  listingId?: string;
  maxFiles?: number;
}

export default function ImageUpload({ value, onChange, onRemove, listingId, maxFiles = 5 }: ImageUploadProps) {
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImage = () => {
    if (url && value.length < maxFiles) {
      onChange([...value, url]);
      setUrl('');
    }
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newImages = [...value];
    if (direction === 'left' && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    } else if (direction === 'right' && index < newImages.length - 1) {
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
    }
    onChange(newImages);
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxFiles - value.length;
    if (remainingSlots <= 0) {
      toast.error(`You can only upload up to ${maxFiles} images.`);
      return;
    }

    setIsUploading(true);
    try {
      const uploadQueue = Array.from(files).slice(0, remainingSlots);
      if (uploadQueue.length < files.length) {
        toast.message(`Only the first ${uploadQueue.length} image${uploadQueue.length === 1 ? '' : 's'} were added to stay within your limit.`);
      }

      const uploadedUrls: string[] = [];
      for (let index = 0; index < uploadQueue.length; index += 1) {
        const file = uploadQueue[index];
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
          toast.error(`"${file.name}" is not supported. Use JPG, PNG, or WEBP.`);
          continue;
        }

        setUploadLabel(`Uploading ${index + 1} of ${uploadQueue.length}: ${file.name}`);
        const publicUrl = await uploadListingImage({
          listingId,
          file,
        });
        uploadedUrls.push(publicUrl);
      }

      if (uploadedUrls.length > 0) {
        onChange([...value, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} photo${uploadedUrls.length === 1 ? '' : 's'} uploaded.`);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadLabel(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFilesSelected(e.target.files ?? []);
  };

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest'}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setDragActive(false);
          await handleFilesSelected(event.dataTransfer.files);
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
            <ImageUp className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-on-surface">Drop photos here or browse</p>
            <p className="text-sm text-on-surface-variant">
              JPG, PNG, and WEBP work best. We compress photos automatically to make uploads less painful.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || value.length >= maxFiles}
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Choose Photos
          </Button>
          {uploadLabel && <p className="text-xs text-on-surface-variant">{uploadLabel}</p>}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Or paste an image URL if you already host it somewhere..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addImage()}
          disabled={isUploading}
        />
        <Button onClick={addImage} disabled={!url || value.length >= maxFiles || isUploading}>
          <Plus className="w-4 h-4 mr-2" /> Add URL
        </Button>
        <div className="relative">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isUploading || value.length >= maxFiles}
          />
          <Button
            type="button"
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || value.length >= maxFiles}
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {value.map((imageUrl, index) => (
          <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-outline-variant group">
            <img 
              src={imageUrl} 
              alt={`Upload ${index + 1}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => onRemove(imageUrl)}
              className="absolute top-1 right-1 p-1.5 bg-surface/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-50"
            >
              <X className="w-4 h-4 text-red-500" />
            </button>
            
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => moveImage(index, 'left')}
                disabled={index === 0}
                className="p-1.5 bg-surface/90 rounded-full disabled:opacity-0 shadow-sm hover:bg-surface-container-low"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {index === 0 && (
                <div className="bg-primary/90 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center font-semibold shadow-sm">
                  <Star className="w-3 h-3 mr-1 fill-current" /> Primary
                </div>
              )}
              
              <button
                onClick={() => moveImage(index, 'right')}
                disabled={index === value.length - 1}
                className="p-1.5 bg-surface/90 rounded-full disabled:opacity-0 shadow-sm hover:bg-surface-container-low"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {value.length === 0 && (
          <div className="col-span-full py-10 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-outline-variant">
            <ImageIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No photos added yet</p>
          </div>
        )}
      </div>
      <p className="text-xs text-on-surface-variant">
        {value.length} / {maxFiles} photos added. The first photo is the primary image, and you can drag and drop or upload multiple files at once.
      </p>
    </div>
  );
}
