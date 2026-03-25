export const CATEGORIES = [
  {
    id: "hotels_resorts",
    label: "Hotels & Resorts",
    subcategories: [
      { id: "hotels", label: "Hotels" },
      { id: "boutique_hotels", label: "Boutique Hotels" },
      { id: "resorts_self_catering", label: "Resorts – Self-Catering" },
    ],
  },
  {
    id: "guesthouse_bnb",
    label: "Guesthouse & BnB",
    subcategories: [
      { id: "guesthouses", label: "Guesthouses" },
      { id: "bnbs", label: "BnB’s" },
      { id: "farm_guesthouses", label: "Farm Guesthouses" },
    ],
  },
  {
    id: "safari_bush",
    label: "Safari & Bush",
    subcategories: [
      { id: "bush_lodge", label: "Bush Lodge" },
      { id: "game_lodge", label: "Game Lodge" },
      { id: "bush_camps", label: "Bush Camps" },
      { id: "luxury_safari_lodge", label: "Luxury Safari Lodge" },
      { id: "kruger_park_area", label: "Kruger Park and Surrounding Area" },
    ],
  },
  {
    id: "winelands",
    label: "Winelands",
    subcategories: [
      { id: "wine_farm_stays", label: "Wine Farm Stays" },
      { id: "winelands_guesthouse", label: "Winelands Guesthouse" },
      { id: "luxury_wineland_lodges", label: "Luxury Wineland Lodges" },
    ],
  },
  {
    id: "coastal_beach",
    label: "Coastal & Beach",
    subcategories: [
      { id: "beachfront_apartments", label: "Beachfront Apartments" },
      { id: "coastal_holiday_homes", label: "Coastal Holiday Homes" },
      { id: "coastal_guesthouses", label: "Coastal Guesthouses" },
    ],
  },
  {
    id: "nature_country",
    label: "Nature & Country",
    subcategories: [
      { id: "lodges_nature_retreats", label: "Lodges and Nature Retreats" },
      { id: "farm_stays", label: "Farm Stays" },
      { id: "mountain_cabins_lodges", label: "Mountain Cabins or Lodges" },
    ],
  },
  {
    id: "budget_backpackers",
    label: "Budget & Backpackers",
    subcategories: [
      { id: "budget_lodges", label: "Budget Lodges and Accommodations" },
      { id: "backpackers", label: "Backpackers" },
    ],
  },
  {
    id: "unique_stays",
    label: "Unique Stays",
    subcategories: [
      { id: "glamping", label: "Glamping" },
      { id: "tree_houses", label: "Tree Houses" },
      { id: "tiny_homes", label: "Tiny Homes" },
      { id: "historic_stays", label: "Historic Stays" },
    ],
  },
];

export const AMENITIES = [
  "Wifi", "Kitchen", "Private Swimming Pool", "Hot tub", "Air conditioning",
  "Heating", "Washer", "Dryer", "Parking", "Gym",
  "Workspace", "TV", "Fireplace", "BBQ grill"
];

export const FACILITIES = [
  "Swimming Pool",
  "Heated Swimming Pool",
  "Jacuzzi",
  "Sauna",
  "Games Room",
  "Laundry",
  "Tennis Court",
  "Chess",
  "Trampoline",
  "Communal Braai area and Boma",
  "Hiking Trails",
  "Game View Points",
  "Game Drives",
  "Other"
];

export const PROVINCES = [
  'Western Cape', 'Eastern Cape', 'Northern Cape', 'Gauteng', 'KwaZulu-Natal', 'Free State', 'North West', 'Mpumalanga', 'Limpopo'
] as const;
