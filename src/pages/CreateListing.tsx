import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ImageUpload from "@/components/ui/image-upload";
import VideoUpload from "@/components/ui/video-upload";
import {
  Home,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Loader2,
  Lock,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  X,
  ShieldAlert,
  ShieldCheck,
  Clock,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getClient } from "@/lib/client";
import { listHostListings } from "@/lib/platform-client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { geocodeAddress } from "@/lib/geocoding";
import { getErrorMessage } from "@/lib/errors";
import { Listing } from "@/types";
import KYCModal from "@/components/KYCModal";

import { CATEGORIES, AMENITIES, FACILITIES, PROVINCES } from "@/constants/categories";
import { CATEGORY_ICONS } from "@/components/icons/CategoryIcons";

import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon using CDN
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

function LocationPicker({ value, onChange }: { value: { lat: number; lng: number } | null, onChange: (coords: { lat: number; lng: number }) => void }) {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng);
    },
  });

  return value ? <Marker position={[value.lat, value.lng]} /> : null;
}

export default function CreateListing() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { id } = useParams();
  const isEditMode = !!id;
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  const [isKYCModalOpen, setIsKYCModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    category: "",
    location: "",
    area: "",
    province: "",
    title: "", // This is the Property/Lodge Name
    adults: 2,
    children: 0,
    bedrooms: 1,
    bathrooms: 1,
    is_self_catering: false,
    has_restaurant: false,
    restaurant_offers: [] as string[],
    amenities: [] as string[],
    facilities: [] as string[],
    other_facility: "",
    description: "",
    pricePerNight: "",
    discount: "0",
    images: [] as string[],
    video_url: null as string | null,
    is_occupied: false,
    coordinates: { lat: -29.8587, lng: 31.0218 } as { lat: number; lng: number } | null
  });

  const [plan, setPlan] = useState<'free' | 'standard' | 'professional' | 'premium'>('free');
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [canCreate, setCanCreate] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected' | null>(null);

  const checkLimits = useCallback(async () => {
    if (!profile || !user) return;
    setPlan(profile.host_plan || 'free');
    setVerificationStatus(profile.kycStatus);
    if (isEditMode) {
      setCanCreate(true);
      setCheckingLimit(false);
      return;
    }

    const existingListings = await listHostListings(user.uid);
    const nonArchivedListings = existingListings.filter((listing) => listing.status !== 'archived');
    setCanCreate((profile.host_plan || 'free') !== 'free' || nonArchivedListings.length < 1);
    setCheckingLimit(false);
  }, [isEditMode, profile, user]);

  useEffect(() => {
    checkLimits();
  }, [checkLimits]);

  const fetchListingData = useCallback(async () => {
    if (!id || !user) return;

    try {
      const { listing: data } = await getClient.hospitality.getListing(id) as { listing: Listing | null };

      if (data) {
        setFormData({
          category: data.type || "",
          location: data.location || "",
          area: data.area || "",
          province: data.province || "",
          title: data.title || "",
          adults: data.adults || 2,
          children: data.children || 0,
          bedrooms: data.bedrooms || 1,
          bathrooms: data.bathrooms || 1,
          is_self_catering: data.is_self_catering || false,
          has_restaurant: data.has_restaurant || false,
          restaurant_offers: data.restaurant_offers || [],
          amenities: data.amenities || [],
          facilities: data.facilities || [],
          other_facility: data.other_facility || "",
          description: data.description || "",
          pricePerNight: data.pricePerNight?.toString() || "",
          discount: data.discount?.toString() || "0",
          images: data.images || [],
          video_url: data.video_url || null,
          is_occupied: data.is_occupied || false,
          coordinates: data.coordinates || null
        });

        // Set parent category based on subcategory
        const parent = CATEGORIES.find(c =>
          c.subcategories.some(s => s.id === data.type)
        );
        if (parent) setParentCategory(parent.id);
      }
    } catch (error: unknown) {
      console.error("Error fetching listing:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not load listing data.",
      });
      navigate("/host/listings");
    }
  }, [id, user, navigate, toast]);

  useEffect(() => {
    if (isEditMode) {
      fetchListingData();
    }
  }, [isEditMode, fetchListingData]);

  const handleNext = useCallback(() => setStep(step + 1), [step]);
  const handleBack = useCallback(() => setStep(step - 1), [step]);

  const updateData = useCallback((key: string, value: string | number | boolean | string[] | null | { lat: number; lng: number }) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleAmenity = useCallback((amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  }, []);

  const toggleFacility = useCallback((facility: string) => {
    setFormData(prev => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter(f => f !== facility)
        : [...prev.facilities, facility]
    }));
  }, []);

  const toggleRestaurantOffer = useCallback((offer: string) => {
    setFormData(prev => ({
      ...prev,
      restaurant_offers: prev.restaurant_offers.includes(offer)
        ? prev.restaurant_offers.filter(o => o !== offer)
        : [...prev.restaurant_offers, offer]
    }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to create a listing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let latitude = formData.coordinates?.lat || -33.9249;
      let longitude = formData.coordinates?.lng || 18.4241;

      // Only geocode if user hasn't manually picked a location or if we want to refine it
      // For now, let's prefer the manually picked coordinates if they differ from the default
      if (!formData.coordinates || (formData.coordinates.lat === -29.8587 && formData.coordinates.lng === 31.0218)) {
        if (formData.location) {
          const addressToGeocode = formData.location + (formData.province ? `, ${formData.province}` : "");
          const coords = await geocodeAddress(addressToGeocode);
          if (coords) {
            latitude = coords.lat;
            longitude = coords.lng;
          }
        }
      }

      const propertyPayload = {
        title: formData.title,
        description: formData.description,
        location: formData.location,
        area: formData.area,
        province: formData.province || "",
        pricePerNight: Number(formData.pricePerNight),
        discount: Number(formData.discount),
        type: formData.category,
        amenities: formData.amenities,
        facilities: formData.facilities,
        other_facility: formData.other_facility,
        adults: formData.adults,
        children: formData.children,
        bedrooms: formData.bedrooms,
        bathrooms: formData.bathrooms,
        is_self_catering: formData.is_self_catering,
        has_restaurant: formData.has_restaurant,
        restaurant_offers: formData.restaurant_offers,
        images: formData.images,
        video_url: formData.video_url,
        is_occupied: formData.is_occupied,
        hostUid: user.uid,
        status: 'active' as const,
        category: parentCategory || "",
        rating: 0,
        reviews: 0,
        coordinates: { lat: latitude, lng: longitude }
      };

      await getClient.hospitality.saveListing({
        id: isEditMode ? id : undefined,
        ...propertyPayload
      });

      toast({
        title: isEditMode ? "Listing Updated!" : "Listing Submitted!",
        description: isEditMode
          ? "Your changes have been saved successfully."
          : "Your listing is pending admin approval and will be live once reviewed.",
      });

      navigate("/host/listings");
    } catch (error: unknown) {
      console.error("Error creating listing:", getErrorMessage(error));
      toast({
        title: "Error",
        description: "Failed to create listing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, formData, isEditMode, id, navigate, toast]);

  if (checkingLimit) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  if (profile?.kycStatus !== 'verified') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-on-surface">Verification Required</h1>
        <p className="text-on-surface-variant text-lg max-w-md mx-auto">
          {profile?.kycStatus === 'pending'
            ? "Your identity verification is currently under review. You'll be able to list properties once approved."
            : "To ensure the safety of our community, all hosts must verify their identity before listing properties."}
        </p>
        <div className="pt-6">
          <Button 
            onClick={() => setIsKYCModalOpen(true)} 
            className="h-12 px-8 text-base font-bold rounded-xl"
          >
            {profile?.kycStatus === 'pending' ? "Check Status" : "Verify Identity Now"}
          </Button>
          <div className="mt-4">
            <Link to="/host" className="text-sm text-on-surface-variant hover:text-on-surface font-medium">
              Return to Dashboard
            </Link>
          </div>
        </div>
        <KYCModal isOpen={isKYCModalOpen} onClose={() => setIsKYCModalOpen(false)} />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-surface-container-low rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-outline-variant" />
        </div>
        <h1 className="text-3xl font-bold text-on-surface">Listing Limit Reached</h1>
        <p className="text-on-surface-variant text-lg max-w-md mx-auto">
          You are currently on the <strong>Free Plan</strong>, which allows only 1 property listing.
          To publish more listings and unlock video features, please upgrade.
        </p>
        <div className="pt-6">
                      <Button onClick={() => navigate('/pricing?audience=host')} className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
            Upgrade My Plan
          </Button>
          <div className="mt-4">
            <Link to="/host" className="text-sm text-on-surface-variant hover:text-on-surface font-medium">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <div className="flex justify-between text-sm font-medium text-on-surface-variant mb-2">
          <span>Step {step} of {totalSteps}</span>
          <span>{Math.round((step / totalSteps) * 100)}% Completed</span>
        </div>
        <div className="h-2 bg-surface-container-low rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-slate-900 to-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant shadow-sm p-8 min-h-[600px] flex flex-col">
        <div className="flex-1">
          {/* Step 1: Category */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center max-w-lg mx-auto mb-10">
                <h2 className="text-2xl font-bold mb-2">
                  {!parentCategory
                    ? "Which of these best describes your place?"
                    : `Now, let's be more specific about your ${CATEGORIES.find(c => c.id === parentCategory)?.label}`}
                </h2>
                <p className="text-on-surface-variant">
                  Select a category that matches your property type.
                </p>
              </div>

              {!parentCategory ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {CATEGORIES.map((cat) => {
                    const IconComponent = CATEGORY_ICONS[cat.id];
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (cat.subcategories.length > 0) {
                            setParentCategory(cat.id);
                          } else {
                            updateData("category", cat.id);
                            // If it's a flat category, we might want to proceed to next step or just mark it selected
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all hover:border-primary/50 hover:bg-surface-container-lowest group",
                          (parentCategory === cat.id || formData.category === cat.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-outline-variant text-on-surface-variant"
                        )}
                      >
                        {IconComponent ? (
                          <IconComponent className="w-10 h-10 mb-3 transition-transform group-hover:scale-110" />
                        ) : (
                          <Home className="w-10 h-10 mb-3" />
                        )}
                        <span className="font-semibold text-center">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {CATEGORIES.find(c => c.id === parentCategory)?.subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => updateData("category", sub.id)}
                        className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all hover:border-primary/50 hover:bg-surface-container-lowest",
                          formData.category === sub.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-outline-variant text-on-surface-variant"
                        )}
                      >
                        <span className="font-semibold text-center">{sub.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="ghost"
                      onClick={() => { setParentCategory(null); updateData("category", ""); }}
                      className="text-outline-variant hover:text-on-surface-variant"
                    >
                      Change main category
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Location Details */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">Location Information</h2>
                <p className="text-on-surface-variant mb-6">Where is your property situated?</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Province</Label>
                    <Select onValueChange={(v) => updateData('province', v)} value={formData.province}>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCES.map(p => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Area</Label>
                    <Input
                      placeholder="e.g., Mossel Bay, Ballito"
                      className="h-12"
                      value={formData.area}
                      onChange={(e) => updateData("area", e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Property / Lodge / Guesthouse Name</Label>
                    <Input
                      placeholder="Enter the name of your place"
                      className="h-12"
                      value={formData.title}
                      onChange={(e) => updateData("title", e.target.value)}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Full Address</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-5 h-5 text-outline-variant" />
                      <Input
                        placeholder="Enter full street address"
                        className="pl-10 h-12"
                        value={formData.location}
                        onChange={(e) => updateData("location", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label>Pin Location on Map</Label>
                    <p className="text-sm text-on-surface-variant mb-2">Click on the map to set the exact location of your property.</p>
                    <div className="h-[300px] w-full rounded-xl overflow-hidden border border-outline-variant z-0 relative">
                      <MapContainer
                        {...({
                          center: formData.coordinates || [-29.8587, 31.0218],
                          zoom: 13,
                          style: { width: "100%", height: "100%" }
                        } as any)}
                      >
                        <TileLayer
                          {...({
                            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          } as any)}
                        />
                        <LocationPicker 
                          value={formData.coordinates} 
                          onChange={(coords) => updateData("coordinates", coords)} 
                        />
                      </MapContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Property Info & Catering */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">Property Details</h2>
                <p className="text-on-surface-variant mb-6">Tell us about the capacity and catering.</p>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Guests Split */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b border-outline-variant">
                        <span className="text-on-surface font-medium">Adults</span>
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("adults", Math.max(1, formData.adults - 1))}>-</Button>
                          <span className="w-4 text-center">{formData.adults}</span>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("adults", formData.adults + 1)}>+</Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-outline-variant">
                        <span className="text-on-surface font-medium">Children</span>
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("children", Math.max(0, formData.children - 1))}>-</Button>
                          <span className="w-4 text-center">{formData.children}</span>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("children", formData.children + 1)}>+</Button>
                        </div>
                      </div>
                    </div>

                    {/* Rooms */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between py-2 border-b border-outline-variant">
                        <span className="text-on-surface font-medium">Bedrooms</span>
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("bedrooms", Math.max(1, formData.bedrooms - 1))}>-</Button>
                          <span className="w-4 text-center">{formData.bedrooms}</span>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("bedrooms", formData.bedrooms + 1)}>+</Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-outline-variant">
                        <span className="text-on-surface font-medium">Bathrooms</span>
                        <div className="flex items-center gap-4">
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("bathrooms", Math.max(1, formData.bathrooms - 0.5))}>-</Button>
                          <span className="w-4 text-center">{formData.bathrooms}</span>
                          <Button variant="outline" size="icon" className="rounded-full w-8 h-8" onClick={() => updateData("bathrooms", formData.bathrooms + 0.5)}>+</Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Catering */}
                  <div className="pt-6 space-y-4">
                    <h3 className="font-semibold text-lg">Catering Options</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => updateData("is_self_catering", !formData.is_self_catering)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                          formData.is_self_catering ? "border-primary bg-primary/10" : "border-outline-variant"
                        )}
                      >
                        <span className="font-medium">Self-Catering</span>
                        {formData.is_self_catering && <Check className="w-5 h-5 text-primary" />}
                      </button>
                      <button
                        onClick={() => updateData("has_restaurant", !formData.has_restaurant)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border-2 transition-all",
                          formData.has_restaurant ? "border-primary bg-primary/10" : "border-outline-variant"
                        )}
                      >
                        <span className="font-medium">Onsite Restaurant</span>
                        {formData.has_restaurant && <Check className="w-5 h-5 text-primary" />}
                      </button>
                    </div>

                    {formData.has_restaurant && (
                      <div className="p-4 bg-surface-container-lowest rounded-xl space-y-3">
                        <p className="text-sm font-medium text-on-surface-variant">Restaurant offers:</p>
                        <div className="flex flex-wrap gap-3">
                          {["Breakfast", "Lunch", "Dinner"].map(meal => (
                            <button
                              key={meal}
                              onClick={() => toggleRestaurantOffer(meal)}
                              className={cn(
                                "px-4 py-2 rounded-full border transition-all text-sm font-medium",
                                formData.restaurant_offers.includes(meal)
                                  ? "bg-gradient-to-r from-slate-900 to-blue-600 text-white border-transparent"
                                  : "bg-surface text-on-surface-variant border-outline-variant"
                              )}
                            >
                              {meal}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Availability Toggle */}
                <div className="pt-6 border-t border-outline-variant">
                  <h3 className="font-semibold text-lg mb-4">Availability Status</h3>
                  <div className="flex items-center justify-between p-4 rounded-xl border-2 transition-all bg-surface-container-lowest uppercase leading-tight">
                    <div className="space-y-1">
                      <span className="font-medium block text-on-surface">Occupancy Status</span>
                      <p className="text-xs text-outline-variant normal-case font-normal leading-normal">
                        {formData.is_occupied
                          ? "This property is currently marked as occupied and will NOT appear in the featured carousel."
                          : "This property is currently available and will appear in the listings."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateData("is_occupied", !formData.is_occupied)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        formData.is_occupied ? "bg-red-500" : "bg-green-500"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-surface transition-transform",
                          formData.is_occupied ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Offerings & Facilities */}
          {step === 4 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">What does your place offer?</h2>
                <p className="text-on-surface-variant mb-6">Select amenities and onsite facilities.</p>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">General Amenities</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {AMENITIES.map((amenity) => (
                        <button
                          key={amenity}
                          onClick={() => toggleAmenity(amenity)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border text-sm transition-all",
                            formData.amenities.includes(amenity) ? "border-primary bg-primary/10/50" : "border-outline-variant"
                          )}
                        >
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center", formData.amenities.includes(amenity) ? "bg-gradient-to-r from-slate-900 to-blue-600 border-transparent text-white" : "border-outline-variant")}>
                            {formData.amenities.includes(amenity) && <Check className="w-3 h-3" />}
                          </div>
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Onsite Facilities</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {FACILITIES.map((facility) => (
                        <button
                          key={facility}
                          onClick={() => toggleFacility(facility)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border text-sm transition-all",
                            formData.facilities.includes(facility) ? "border-primary bg-primary/10/50" : "border-outline-variant"
                          )}
                        >
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center", formData.facilities.includes(facility) ? "bg-gradient-to-r from-slate-900 to-blue-600 border-transparent text-white" : "border-outline-variant")}>
                            {formData.facilities.includes(facility) && <Check className="w-3 h-3" />}
                          </div>
                          {facility}
                        </button>
                      ))}
                    </div>
                    {formData.facilities.includes("Other") && (
                      <Input
                        placeholder="Please specify other facilities..."
                        value={formData.other_facility}
                        onChange={(e) => updateData("other_facility", e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Photos & Description */}
          {step === 5 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold mb-2">Let's describe your place</h2>
                <p className="text-on-surface-variant mb-6">Attract guests with photos and a great description.</p>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Short Description / Catchy Title</Label>
                    <Input
                      placeholder="e.g., Luxury Bush Lodge with Private Pool"
                      value={formData.description.split('\n')[0]} // Just a helper placeholder
                      onChange={(e) => updateData("description", e.target.value)}
                      className="text-lg"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Long Description</Label>
                    <Textarea
                      placeholder="Describe the decor, layout, nearby attractions, etc..."
                      className="h-32 resize-none"
                      value={formData.description}
                      onChange={(e) => updateData("description", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="mb-2">
                      <Label>Property Photos</Label>
                      <p className="text-sm text-on-surface-variant">Upload up to 5 high-quality photos. Lead with a strong exterior or hero room shot.</p>
                    </div>
                    <ImageUpload
                      value={formData.images}
                      onChange={(urls) => updateData("images", urls)}
                      onRemove={(url) => updateData("images", formData.images.filter(i => i !== url))}
                      listingId={id}
                      maxFiles={5}
                    />
                  </div>

                  {plan !== 'free' && (
                    <div className="space-y-3 pt-6 border-t border-outline-variant">
                      <Label className="text-base">Showcase Video</Label>
                      <VideoUpload
                        value={formData.video_url}
                        onChange={(url) => updateData("video_url", url)}
                        listingId={id}
                        maxSizeMB={100}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Pricing */}
          {step === 6 && (
            <div className="space-y-6">
              <div className="text-center max-w-lg mx-auto">
                <h2 className="text-2xl font-bold mb-2">Set your price and discounts</h2>
                <p className="text-on-surface-variant mb-8">You can offer seasonal discounts here.</p>

                <div className="bg-surface p-8 rounded-2xl border border-outline-variant shadow-lg space-y-8">
                  <div className="space-y-4">
                    <Label className="text-lg">Price per Night</Label>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-4xl font-bold text-outline-variant">R</span>
                      <Input
                        type="number"
                        placeholder="0"
                        className="text-4xl font-bold border-none text-center w-48 h-16 p-0 focus-visible:ring-0 placeholder:text-outline-variant"
                        value={formData.pricePerNight}
                        onChange={(e) => updateData("pricePerNight", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t">
                    <Label className="text-lg">Discount Percentage (%)</Label>
                    <p className="text-sm text-on-surface-variant">Optional: offer a discount to attract more guests.</p>
                    <div className="flex items-center justify-center gap-4">
                      <Input
                        type="number"
                        placeholder="0"
                        className="text-2xl font-bold text-center w-24 h-12"
                        value={formData.discount}
                        onChange={(e) => updateData("discount", e.target.value)}
                      />
                      <span className="text-2xl font-bold text-outline-variant">%</span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-outline-variant space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface-variant">Service Fee (3%)</span>
                      <span className="font-medium">R{Math.round(Number(formData.pricePerNight) * 0.03)}</span>
                    </div>
                    {Number(formData.discount) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">Discount Applied</span>
                        <span className="font-medium text-red-500">-R{Math.round(Number(formData.pricePerNight) * (Number(formData.discount) / 100))}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-on-surface font-bold">You earn approx.</span>
                      <span className="font-bold text-green-600 text-lg">
                        R{Math.round(Number(formData.pricePerNight) * (1 - (Number(formData.discount) / 100)) * 0.97)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-8 mt-8 border-t border-outline-variant flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || isSubmitting}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={step === totalSteps ? handleSubmit : handleNext}
            className="bg-gradient-to-r from-slate-900 to-blue-600 hover:opacity-90 text-white px-8 rounded-xl h-12 text-base shadow-lg shadow-blue-900/20"
            disabled={(step === 1 && !formData.category) || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                {step === totalSteps ? "Publish Listing" : "Next"}
                {step !== totalSteps && <ChevronRight className="w-4 h-4 ml-2" />}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
