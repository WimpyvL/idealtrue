import React, { useState, useRef } from 'react';
import { Button } from './button';
import { toast } from 'sonner';
import { Input } from './input';
import { X, Video, Plus, Upload, Loader2 } from 'lucide-react';
import { uploadListingMedia } from '@/lib/media-client';

interface VideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  listingId?: string;
  maxSizeMB?: number;
}

export default function VideoUpload({ value, onChange, listingId, maxSizeMB = 50 }: VideoUploadProps) {
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addVideo = () => {
    if (url) {
      onChange(url);
      setUrl('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Check file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Video size must be less than ${maxSizeMB}MB.`);
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
      onChange(publicUrl);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Enter video URL (e.g., YouTube, Vimeo, or direct link)..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addVideo()}
          disabled={isUploading}
        />
        <Button onClick={addVideo} disabled={!url || isUploading}>
          <Plus className="w-4 h-4 mr-2" /> Add URL
        </Button>
        <div className="relative">
          <input
            type="file"
            accept="video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Upload
          </Button>
        </div>
      </div>

      {value ? (
        <div className="relative aspect-video rounded-xl overflow-hidden border border-outline-variant group">
          <div className="w-full h-full bg-surface-container-low flex items-center justify-center">
            <Video className="w-12 h-12 text-outline-variant" />
            <p className="absolute bottom-4 left-4 text-xs font-mono text-on-surface-variant truncate max-w-[80%]">{value}</p>
          </div>
          <button
            onClick={() => onChange(null)}
            className="absolute top-2 right-2 p-2 bg-surface/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="aspect-video border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-outline-variant">
          <Video className="w-12 h-12 mb-2" />
          <p className="text-sm">No video added yet</p>
        </div>
      )}
    </div>
  );
}
