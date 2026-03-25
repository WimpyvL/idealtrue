import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { UserProfile, OperationType } from '@/types';
import { handleFirestoreError } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import { Loader2, Camera, User as UserIcon, Mail, Shield, Calendar, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import KYCModal from '@/components/KYCModal';

export default function AccountPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isMakingAdmin, setIsMakingAdmin] = useState(false);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        email: profile.email || '',
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: formData.displayName,
      });
      toast({
        title: "Profile updated",
        description: "Your account details have been saved successfully.",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleSwitch = async (newRole: 'guest' | 'host') => {
    if (!user || !profile || profile.role === newRole) return;

    setIsSwitchingRole(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: newRole,
      });
      
      toast({
        title: `Switched to ${newRole} mode`,
        description: newRole === 'host' 
          ? "You are now in Host mode. Please complete your verification to start listing properties." 
          : "You are now in Guest mode. You can explore and book accommodations.",
      });

      if (newRole === 'host' && profile.kycStatus === 'none') {
        // Additional prompt for verification
        toast({
          variant: "default",
          title: "Verification Required",
          description: "As a host, you need to verify your identity to build trust with guests.",
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleMakeAdmin = async () => {
    if (!user || !profile || profile.role === 'admin') return;

    setIsMakingAdmin(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: 'admin',
      });
      
      toast({
        title: "Admin access granted",
        description: "You are now an administrator. You can access the Admin Dashboard from the navigation menu.",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsMakingAdmin(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload error:', error);
          toast({
            variant: "destructive",
            title: "Upload failed",
            description: "Failed to upload profile picture. Please try again.",
          });
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            photoURL: downloadURL,
          });
          toast({
            title: "Photo updated",
            description: "Your profile picture has been updated.",
          });
          setIsUploading(false);
        }
      );
    } catch (error) {
      console.error('Upload setup error:', error);
      setIsUploading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-on-surface-variant">Update your personal information and manage your profile.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="p-6 flex flex-col items-center text-center space-y-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-surface-container-high bg-surface-container relative">
                {profile.photoURL ? (
                  <img 
                    src={profile.photoURL} 
                    alt={profile.displayName} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <UserIcon className="w-12 h-12 text-primary" />
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <label className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                <Camera className="w-4 h-4" />
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
              </label>
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              <p className="text-sm text-on-surface-variant capitalize">{profile.role}</p>
            </div>
            <div className="w-full pt-4 border-t border-outline-variant space-y-3 text-left">
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <Mail className="w-4 h-4" />
                <span className="truncate">{profile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <Shield className="w-4 h-4" />
                <span>KYC Status: <span className={cn(
                  "font-bold uppercase text-[10px] px-2 py-0.5 rounded-full",
                  profile.kycStatus === 'verified' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                )}>{profile.kycStatus}</span></span>
              </div>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <Calendar className="w-4 h-4" />
                <span>Joined {format(new Date(profile.createdAt), 'MMMM yyyy')}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-bold">Referral Info</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Code</span>
                <span className="font-mono font-bold">{profile.referralCode}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Tier</span>
                <span className="capitalize font-bold">{profile.tier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-on-surface-variant">Balance</span>
                <span className="font-bold text-green-600">R{profile.balance.toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Edit Form */}
        <div className="md:col-span-2">
          <Card className="p-8">
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input 
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email"
                      value={formData.email}
                      disabled
                      className="bg-surface-container-low"
                    />
                    <p className="text-[10px] text-on-surface-variant italic">Email cannot be changed as it is linked to your Google account.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-outline-variant">
                    <div className="space-y-1">
                      <Label>Account Mode</Label>
                      <p className="text-xs text-on-surface-variant">Switch between Guest and Host modes to access different features.</p>
                    </div>
                    <div className="flex gap-4">
                      <Button 
                        type="button"
                        variant={profile.role === 'guest' ? 'default' : 'outline'}
                        className="flex-1 rounded-2xl h-12 font-bold"
                        onClick={() => handleRoleSwitch('guest')}
                        disabled={isSwitchingRole}
                      >
                        {isSwitchingRole && profile.role !== 'guest' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserIcon className="w-4 h-4 mr-2" />}
                        Guest Mode
                      </Button>
                      <Button 
                        type="button"
                        variant={profile.role === 'host' ? 'default' : 'outline'}
                        className="flex-1 rounded-2xl h-12 font-bold"
                        onClick={() => handleRoleSwitch('host')}
                        disabled={isSwitchingRole}
                      >
                        {isSwitchingRole && profile.role !== 'host' ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Shield className="w-4 h-4 mr-2" />
                        )}
                        Host Mode
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                {profile.role !== 'admin' ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={handleMakeAdmin}
                    disabled={isMakingAdmin}
                  >
                    {isMakingAdmin ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                    Make me Admin
                  </Button>
                ) : (
                  <Badge variant="success" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Administrator
                  </Badge>
                )}
                <Button type="submit" disabled={isSaving} className="min-w-[120px]">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          {profile.role === 'host' && (
            <Card className="mt-8 p-8 border-primary/20 bg-primary/5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl">
                  {profile.kycStatus === 'verified' ? (
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  ) : profile.kycStatus === 'pending' ? (
                    <Clock className="w-6 h-6 text-amber-600" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Host Verification</h3>
                  <p className="text-sm text-on-surface-variant">
                    Your account is currently <span className="font-bold text-on-surface capitalize">{profile.kycStatus}</span>. 
                    Verified hosts receive a badge on their listings and higher search visibility.
                  </p>
                  {profile.kycStatus !== 'verified' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setIsKYCModalOpen(true)}
                    >
                      {profile.kycStatus === 'pending' ? "Check Status" : "Complete Verification"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
      <KYCModal isOpen={isKYCModalOpen} onClose={() => setIsKYCModalOpen(false)} />
    </div>
  );
}
