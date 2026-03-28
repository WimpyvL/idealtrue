type DestinationProfile = {
  match: RegExp;
  name: string;
  positioning: string;
  highlights: string[];
};

const DESTINATIONS: DestinationProfile[] = [
  {
    match: /cape town/i,
    name: "Cape Town",
    positioning: "Best for city energy, coastline, food, and short luxury breaks.",
    highlights: ["Table Mountain and city bowl", "Atlantic seaboard sunsets", "Winelands day-trip access"],
  },
  {
    match: /kruger/i,
    name: "Kruger National Park",
    positioning: "Best for safari planning, route discipline, and seasonal wildlife timing.",
    highlights: ["Early game drives", "Bush lodge stays", "Longer transit windows than people expect"],
  },
  {
    match: /johannesburg|joburg/i,
    name: "Johannesburg",
    positioning: "Best for city weekends, events, and a base before heading elsewhere.",
    highlights: ["Short-stay urban itineraries", "Food and culture circuits", "Easy add-on to nearby getaways"],
  },
  {
    match: /garden route/i,
    name: "Garden Route",
    positioning: "Best for scenic self-drive trips with multiple short stops.",
    highlights: ["Coastal road-trip pacing", "Nature reserves and beaches", "Mixed luxury and family-friendly stays"],
  },
];

function inferDestination(query: string) {
  return DESTINATIONS.find((item) => item.match.test(query)) ?? {
    name: "South Africa",
    positioning: "Best handled by narrowing the destination, dates, and trip intent first.",
    highlights: ["Match stay type to trip goal", "Avoid overpacking the itinerary", "Book high-demand dates early"],
  };
}

function inferTripLength(query: string) {
  const match = query.match(/(\d+)[-\s]?(day|night)/i);
  const days = match ? Number.parseInt(match[1], 10) : 3;
  return Number.isFinite(days) && days > 0 ? Math.min(days, 10) : 3;
}

export function buildTripPlannerResponse(query: string) {
  const destination = inferDestination(query);
  const days = inferTripLength(query);
  const itinerary = Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    if (day === 1) return `Day ${day}: Arrival, check-in, and a low-friction local plan so the trip starts clean.`;
    if (day === days) return `Day ${day}: Short final activity window, checkout discipline, and departure buffer.`;
    return `Day ${day}: Anchor the day around one main outing, one meal destination, and one recovery block.`;
  });

  return [
    `# Trip brief for ${destination.name}`,
    "",
    `**Your ask:** ${query}`,
    "",
    "## Positioning",
    destination.positioning,
    "",
    "## What to optimize for",
    ...destination.highlights.map((item) => `- ${item}`),
    "",
    "## Draft itinerary",
    ...itinerary.map((item) => `- ${item}`),
    "",
    "## Stay filters to use on Ideal Stay",
    "- Prioritize exact area before you obsess over amenities.",
    "- Match occupancy, self-catering, and budget to the actual trip shape.",
    "- Save 2-3 strong options and compare host responsiveness before booking.",
    "",
    "## Reality check",
    "Verify travel times, availability, and any seasonal constraints before committing. The planner gives direction, not guarantees.",
  ].join("\n");
}
