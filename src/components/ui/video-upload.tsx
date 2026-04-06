import React, { useState, useRef } from 'react';
import { Button } from './button';
import { toast } from 'sonner';
import { Input } from './input';
import { X, Video, Plus, Upload, Loader2, Film } from 'lucide-react';
import { uploadListingMedia } from '@/lib/media-client';

const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
export const DEFAULT_VIDEO_UPLOAD_MAX_MB = 250;

interface VideoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  listingId?: string;
  ensureListingId?: () => Promise<string | undefined>;
  maxSizeMB?: number;
}

export default function VideoUpload({
  value,
  onChange,
  listingId,
  ensureListingId,
  maxSizeMB = DEFAULT_VIDEO_UPLOAD_MAX_MB,
}: VideoUploadProps) {
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addVideo = () => {
    if (url) {
      onChange(url);
      setUrl('');
    }
  };

  const uploadVideoFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Video size must be less than ${maxSizeMB}MB.`);
      return;
    }
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      toast.error('Please choose an MP4, WEBM, or MOV file.');
      return;
    }

    setIsUploading(true);
    try {
      let resolvedListingId = listingId;
      if (!resolvedListingId && ensureListingId) {
        resolvedListingId = await ensureListingId();
      }
      setUploadLabel(`Uploading ${file.name}...`);
      const publicUrl = await uploadListingMedia({
        listingId: resolvedListingId,
        file,
      });
      onChange(publicUrl);
      toast.success('Video uploaded.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload video. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadLabel(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadVideoFile(files[0]);
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
            accept="video/mp4,video/webm,video/quicktime"
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

      <div
        className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-outline-variant bg-surface-container-low'
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragActive(false);
        }}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) {
            await uploadVideoFile(file);
          }
        }}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <Film className="mb-3 h-10 w-10 text-outline-variant" />
          <p className="text-sm font-medium text-on-surface">
            Drop a showcase video here or use Upload
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            MP4, WEBM, or MOV up to {maxSizeMB}MB. You can add this before the listing is saved.
          </p>
          {uploadLabel && <p className="mt-2 text-xs text-on-surface-variant">{uploadLabel}</p>}
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
        <div className="aspect-video border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center text-outline-variant bg-surface-container-low">
          <Video className="w-12 h-12 mb-2" />
          <p className="text-sm">No showcase video added yet</p>
        </div>
      )}
    </div>
  );
}
