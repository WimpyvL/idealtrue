import React, { useState, useRef } from 'react';
import { Button } from './button';
import { toast } from 'sonner';
import { Input } from './input';
import { X, Plus, Image as ImageIcon, Upload, Loader2, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { uploadListingMedia } from '@/lib/media-client';

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (value.length >= maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} images.`);
      return;
    }
    if (!listingId) {
      toast.error('Save the listing first so media can be attached to it.');
      return;
    }

    setIsUploading(true);
    try {
      const publicUrl = await uploadListingMedia({
        listingId,
        file,
      });
      onChange([...value, publicUrl]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter image URL..."
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
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isUploading || value.length >= maxFiles}
          />
          <Button 
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
            <p className="text-sm">No images added yet</p>
          </div>
        )}
      </div>
      <p className="text-xs text-on-surface-variant">
        {value.length} / {maxFiles} images added. The first image will be used as the primary photo.
      </p>
    </div>
  );
}
