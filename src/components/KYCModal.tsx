import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, ShieldCheck, Camera, IdCard, CheckCircle2, AlertCircle, Clock, X, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { updateEncoreProfile } from '@/lib/identity-client';
import { submitKyc, uploadKycAsset, uploadKycDataUrl } from '@/lib/ops-client';

interface KYCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KYCModal({ isOpen, onClose }: KYCModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    idNumber: '',
    idType: 'id_card' as 'id_card' | 'passport' | 'drivers_license',
    idImage: null as string | null,
    selfieImage: null as string | null,
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Cleanup camera stream on unmount or when camera is deactivated
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please check permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, selfieImage: imageData }));
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, idImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
      (e.target as HTMLInputElement).dataset.objectUrl = URL.createObjectURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!formData.idNumber) {
      toast({ 
        title: "Error", 
        description: "Please enter your ID number.", 
        variant: "destructive" 
      });
      return;
    }
    if (!formData.idImage) {
      toast({ 
        title: "Error", 
        description: "Please upload your ID document.", 
        variant: "destructive" 
      });
      return;
    }
    if (!formData.selfieImage) {
      toast({ 
        title: "Error", 
        description: "Please take a selfie for verification.", 
        variant: "destructive" 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const idFile = fileInputRef.current?.files?.[0];
      if (!idFile) {
        throw new Error('Missing ID document file.');
      }
      const [idImageKey, selfieImageKey] = await Promise.all([
        uploadKycAsset(idFile),
        uploadKycDataUrl(`selfie-${Date.now()}.jpg`, formData.selfieImage),
      ]);

      await submitKyc({
        idType: formData.idType,
        idNumber: formData.idNumber,
        idImageKey,
        selfieImageKey,
      });
      await updateEncoreProfile({
        kycStatus: 'pending',
      });
      await refreshProfile();
      toast({ 
        title: "Success", 
        description: "Verification submitted! Admin will review it shortly." 
      });
      onClose();
    } catch (error) {
      console.error("KYC submission error:", error);
      toast({ 
        title: "Error", 
        description: "Failed to submit verification. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const simulateApproval = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await updateEncoreProfile({
        kycStatus: 'verified'
      });
      await refreshProfile();
      toast({ title: "Demo: Verified", description: "Your identity has been verified (Demo Mode)." });
    } catch (error) {
      console.error("Simulation error:", error);
      toast({ title: "Error", description: "Simulation failed. (Are you an admin in rules?)", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const renderStatus = () => {
    if (!profile) return null;

    switch (profile.kycStatus) {
      case 'pending':
        return (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-600 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Verification Pending</h3>
              <p className="text-on-surface-variant max-w-[280px]">
                We're currently reviewing your identity documents. This usually takes less than 24 hours.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full px-8">
              <Button onClick={handleClose} variant="outline" className="rounded-xl w-full">
                Close
              </Button>
              <Button 
                onClick={simulateApproval} 
                variant="ghost" 
                className="text-xs text-outline-variant hover:text-primary"
              >
                Demo: Simulate Admin Approval
              </Button>
            </div>
          </div>
        );
      case 'verified':
        return (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Identity Verified</h3>
              <p className="text-on-surface-variant">
                Your identity has been successfully verified. You can now list your properties!
              </p>
            </div>
            <Button onClick={handleClose} className="rounded-xl px-8">
              Continue
            </Button>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
            <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-rose-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Verification Rejected</h3>
              <p className="text-on-surface-variant">
                Unfortunately, your verification was not successful. Please try again with clearer documents.
              </p>
            </div>
            <Button onClick={() => {
              updateEncoreProfile({ kycStatus: 'none' }).then(() => refreshProfile());
            }} className="rounded-xl px-8">
              Try Again
            </Button>
          </div>
        );
      default:
        return (
          <>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="idType">Document Type</Label>
                <Select 
                  value={formData.idType} 
                  onValueChange={(v: any) => setFormData(prev => ({ ...prev, idType: v }))}
                >
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="id_card">National ID Card</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="idNumber">Document Number</Label>
                <Input
                  id="idNumber"
                  placeholder="Enter your ID or Passport number"
                  className="h-12 rounded-xl"
                  value={formData.idNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ID Document</Label>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "aspect-[4/3] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container transition-colors overflow-hidden relative group",
                      formData.idImage && "border-primary border-solid"
                    )}
                  >
                    {formData.idImage ? (
                      <>
                        <img src={formData.idImage} alt="ID" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <RefreshCw className="w-6 h-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <>
                        <IdCard className="w-6 h-6 text-outline-variant" />
                        <span className="text-[10px] text-on-surface-variant font-medium">Upload Photo</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Selfie</Label>
                  <div 
                    onClick={() => !formData.selfieImage && !isCameraActive && startCamera()}
                    className={cn(
                      "aspect-[4/3] bg-surface-container-low rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-surface-container transition-colors overflow-hidden relative group",
                      (formData.selfieImage || isCameraActive) && "border-primary border-solid"
                    )}
                  >
                    {isCameraActive ? (
                      <div className="relative w-full h-full">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="rounded-full h-8 w-8 bg-white/90 hover:bg-white"
                            onClick={(e) => { e.stopPropagation(); takePhoto(); }}
                          >
                            <Camera className="w-4 h-4 text-primary" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="destructive" 
                            className="rounded-full h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); stopCamera(); }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : formData.selfieImage ? (
                      <>
                        <img src={formData.selfieImage} alt="Selfie" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <RefreshCw className="w-6 h-6 text-white" onClick={(e) => { e.stopPropagation(); startCamera(); }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6 text-outline-variant" />
                        <span className="text-[10px] text-on-surface-variant font-medium">Take Selfie</span>
                      </>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full h-12 rounded-xl font-bold text-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Verification"}
              </Button>
            </DialogFooter>
          </>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          {(!profile || profile.kycStatus === 'none') && (
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
          )}
          <DialogTitle className="text-2xl font-bold">
            {profile?.kycStatus === 'none' ? "Host Verification" : "Verification Status"}
          </DialogTitle>
          {profile?.kycStatus === 'none' && (
            <DialogDescription>
              Complete a quick identity check to start hosting on our platform.
            </DialogDescription>
          )}
        </DialogHeader>

        {renderStatus()}
      </DialogContent>
    </Dialog>
  );
}
