import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { requestEmailVerification, requestProfilePhotoUpload, updateEncoreProfile } from '@/lib/identity-client';
import { useEffectiveKycStatus } from '@/hooks/use-effective-kyc-status';

export default function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { effectiveKycStatus } = useEffectiveKycStatus(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    paymentMethod: '',
    paymentInstructions: '',
    paymentReferencePrefix: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        email: profile.email || '',
        paymentMethod: profile.paymentMethod || '',
        paymentInstructions: profile.paymentInstructions || '',
        paymentReferencePrefix: profile.paymentReferencePrefix || '',
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    try {
      await updateEncoreProfile({
        displayName: formData.displayName,
        paymentMethod: formData.paymentMethod || null,
        paymentInstructions: formData.paymentInstructions || null,
        paymentReferencePrefix: formData.paymentReferencePrefix || null,
      });
      await refreshProfile();
      toast({
        title: "Profile updated",
        description: "Your account details have been saved successfully.",
      });
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleSwitch = async (newRole: 'guest' | 'host') => {
    if (!user || !profile || profile.role === newRole) return;

    setIsSwitchingRole(true);
    try {
      await updateEncoreProfile({
        role: newRole,
      });
      await refreshProfile();
      
      toast({
        title: `Switched to ${newRole} mode`,
        description: newRole === 'host' 
          ? "You are now in Host mode. Please complete your verification to start listing properties." 
          : "You are now in Guest mode. You can explore and book accommodations.",
      });

      if (newRole === 'host' && effectiveKycStatus === 'none') {
        // Additional prompt for verification
        toast({
          variant: "default",
          title: "Verification Required",
          description: "As a host, you need to verify your identity to build trust with guests.",
        });
      }
    } catch (error) {
      console.error('Failed to switch role:', error);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const signed = await requestProfilePhotoUpload(file.name);
      const uploadResponse = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      await updateEncoreProfile({
        photoUrl: signed.publicUrl,
      });
      await refreshProfile();
      toast({
        title: "Photo updated",
        description: "Your profile picture has been updated.",
      });
    } catch (error) {
      console.error('Upload setup error:', error);
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: "Failed to upload profile picture. Please try again.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendVerification = async () => {
    setIsSendingVerification(true);
    try {
      await requestEmailVerification();
      toast({
        title: "Verification email sent",
        description: "Check your inbox for the verification link.",
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      toast({
        variant: "destructive",
        title: "Email failed",
        description: "Could not send a verification email right now.",
      });
    } finally {
      setIsSendingVerification(false);
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
                <div className="min-w-0">
                  <div className="truncate">{profile.email}</div>
                  <div className={cn("text-[11px] font-semibold", profile.emailVerified ? "text-green-600" : "text-amber-600")}>
                    {profile.emailVerified ? 'Email verified' : 'Email not verified'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-on-surface-variant">
                <Shield className="w-4 h-4" />
                <span>KYC Status: <span className={cn(
                  "font-bold uppercase text-[10px] px-2 py-0.5 rounded-full",
                  effectiveKycStatus === 'verified'
                    ? "bg-green-100 text-green-700"
                    : effectiveKycStatus === 'rejected'
                      ? "bg-rose-100 text-rose-700"
                      : "bg-amber-100 text-amber-700"
                )}>{effectiveKycStatus}</span></span>
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
                    {!profile.emailVerified && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-2 rounded-xl"
                        onClick={handleSendVerification}
                        disabled={isSendingVerification}
                      >
                        {isSendingVerification ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                        Send verification email
                      </Button>
                    )}
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

                  {profile.role === 'host' && (
                    <div className="space-y-4 pt-4 border-t border-outline-variant">
                      <div className="space-y-1">
                        <Label>Payment Coordination</Label>
                        <p className="text-xs text-on-surface-variant">These instructions are what guests should use when you request direct payment for a booking.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentMethod">Preferred Payment Method</Label>
                        <Input
                          id="paymentMethod"
                          value={formData.paymentMethod}
                          onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                          placeholder="e.g. EFT / Bank Transfer"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentReferencePrefix">Reference Prefix</Label>
                        <Input
                          id="paymentReferencePrefix"
                          value={formData.paymentReferencePrefix}
                          onChange={(e) => setFormData({ ...formData, paymentReferencePrefix: e.target.value })}
                          placeholder="e.g. IDEALSTAY"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                        <textarea
                          id="paymentInstructions"
                          value={formData.paymentInstructions}
                          onChange={(e) => setFormData({ ...formData, paymentInstructions: e.target.value })}
                          placeholder="Bank details, payment timing, proof-of-payment rules, and anything guests must know."
                          className="w-full min-h-[120px] rounded-xl border border-outline-variant bg-background px-3 py-2 text-sm outline-none transition-all focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                {profile.role === 'admin' ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Administrator
                  </Badge>
                ) : <span />}
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
                  {effectiveKycStatus === 'verified' ? (
                    <ShieldCheck className="w-6 h-6 text-primary" />
                  ) : effectiveKycStatus === 'pending' ? (
                    <Clock className="w-6 h-6 text-amber-600" />
                  ) : (
                    <ShieldAlert className="w-6 h-6 text-rose-600" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold">Host Verification</h3>
                  <p className="text-sm text-on-surface-variant">
                    Your account is currently <span className="font-bold text-on-surface capitalize">{effectiveKycStatus}</span>. 
                    Verified hosts receive a badge on their listings and higher search visibility.
                  </p>
                  {effectiveKycStatus !== 'verified' && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => setIsKYCModalOpen(true)}
                    >
                      {effectiveKycStatus === 'pending' ? "Check Status" : "Complete Verification"}
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
