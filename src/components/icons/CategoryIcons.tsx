import { 
  Home, 
  Building2, 
  Bed, 
  Trees, 
  Wine, 
  Palmtree, 
  Mountain, 
  Backpack, 
  Sparkles,
  Hotel,
  Building,
  Waves,
  Coffee,
  MapPin,
  Tent,
  Castle,
  Palette,
  Snowflake,
  Sun,
  Droplets,
  Wind,
  Camera,
  Utensils
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, any> = {
  hotels_resorts: Building2,
  guesthouse_bnb: Home,
  safari_bush: Trees,
  winelands: Wine,
  coastal_beach: Palmtree,
  nature_country: Mountain,
  budget_backpackers: Backpack,
  unique_stays: Sparkles,
  
  // Subcategories
  hotels: Hotel,
  boutique_hotels: Building,
  resorts_self_catering: Waves,
  
  guesthouses: Home,
  bnbs: Coffee,
  farm_guesthouses: Home,
  
  bush_lodge: Trees,
  game_lodge: Trees,
  bush_camps: MapPin,
  luxury_safari_lodge: Trees,
  kruger_park_area: MapPin,
  
  wine_farm_stays: Wine,
  winelands_guesthouse: Home,
  luxury_wineland_lodges: Building2,
  
  beachfront_apartments: Building2,
  coastal_holiday_homes: Home,
  coastal_guesthouses: Home,
  
  lodges_nature_retreats: Mountain,
  farm_stays: Home,
  mountain_cabins_lodges: Mountain,
  
  budget_lodges: Home,
  backpackers: Backpack,
  
  glamping: Tent,
  tree_houses: Trees,
  tiny_homes: Home,
  historic_stays: Castle,
};
