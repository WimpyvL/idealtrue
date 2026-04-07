const DEFAULT_APP_URL = "https://ideal-stay.vercel.app";

function sanitizeText(value) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return sanitizeText(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRand(amount) {
  return `R${Math.max(0, Number(amount) || 0).toLocaleString("en-ZA")}`;
}

function getAppUrl(env = process.env) {
  return `${env.IDEAL_STAY_APP_URL || env.APP_URL || DEFAULT_APP_URL}`.trim().replace(/\/+$/, "");
}

function buildBookingUrl(listingId, env = process.env) {
  return `${getAppUrl(env)}/?listingId=${encodeURIComponent(listingId)}`;
}

function buildLocationLabel(listing) {
  return [listing.area, listing.location, listing.province]
    .map((value) => sanitizeText(value))
    .filter(Boolean)
    .join(", ");
}

function buildFeatureList(listing) {
  const candidates = [
    ...(Array.isArray(listing.amenities) ? listing.amenities : []),
    ...(Array.isArray(listing.facilities) ? listing.facilities : []),
    listing.bedrooms ? `${listing.bedrooms} bedrooms` : "",
    listing.bathrooms ? `${listing.bathrooms} bathrooms` : "",
    listing.adults || listing.children ? `Sleeps ${(listing.adults || 0) + (listing.children || 0)}` : "",
    listing.hasRestaurant ? "Restaurant on site" : "",
    listing.isSelfCatering ? "Self catering" : "",
  ]
    .map((value) => titleCase(value))
    .filter(Boolean);

  return [...new Set(candidates)].slice(0, 6);
}

function buildPromoPrice(listing) {
  const discount = Number(listing.discount ?? listing.discountPercent ?? 0);
  if (discount < 1) {
    return Number(listing.pricePerNight) || 0;
  }
  return Math.max(1, Math.round(Number(listing.pricePerNight) * (1 - discount / 100)));
}

function escapeXml(value) {
  return `${value || ""}`
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderWrappedText({ x, y, width, lineHeight, fontSize, weight = 700, fill = "#ffffff", lines, align = "start" }) {
  const safeLines = lines.filter(Boolean).slice(0, 6);
  return `
    <text x="${x}" y="${y}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}" text-anchor="${align}">
      ${safeLines
        .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
        .join("")}
    </text>
  `;
}

function readTonePalette(tone) {
  switch (tone) {
    case "friendly":
      return { accent: "#F97316", accentSoft: "#FED7AA", panel: "#0F172A", panelSoft: "#1E293B" };
    case "adventurous":
      return { accent: "#0F766E", accentSoft: "#99F6E4", panel: "#082F49", panelSoft: "#0F172A" };
    case "luxurious":
      return { accent: "#C9972B", accentSoft: "#FDE68A", panel: "#111827", panelSoft: "#1F2937" };
    case "urgent":
      return { accent: "#DC2626", accentSoft: "#FECACA", panel: "#111827", panelSoft: "#1F2937" };
    default:
      return { accent: "#2563EB", accentSoft: "#BFDBFE", panel: "#0F172A", panelSoft: "#1E293B" };
  }
}

function getPlatformSpec(platform, templateId) {
  if (templateId === "story_pack") {
    return { width: 1080, height: 1920, radius: 44 };
  }

  switch (platform) {
    case "instagram_story":
    case "whatsapp":
      return { width: 1080, height: 1920, radius: 44 };
    case "twitter":
      return { width: 1600, height: 900, radius: 34 };
    case "linkedin":
      return { width: 1200, height: 1200, radius: 34 };
    case "facebook":
      return { width: 1200, height: 1500, radius: 34 };
    default:
      return { width: 1080, height: 1350, radius: 34 };
  }
}

async function fetchImageAsDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load the listing image for template generation.");
  }

  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const dataBase64 = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${mimeType};base64,${dataBase64}`;
}

function getTemplateName(templateId) {
  switch (templateId) {
    case "featured_stay":
      return "Featured Stay";
    case "special_offer":
      return "Special Offer";
    case "lifestyle_escape":
      return "Luxury Escape";
    case "stay_carousel":
      return "Stay Carousel";
    case "story_pack":
      return "Story Pack";
    case "quick_facts":
      return "Quick Facts";
    case "weekend_escape":
      return "Weekend Escape";
    default:
      return "Featured Stay";
  }
}

function buildCaptionAndHeadline({ listing, templateId, includePrice, includeSpecialOffer, customHeadline, env }) {
  const propertyName = sanitizeText(listing.title);
  const location = buildLocationLabel(listing);
  const features = buildFeatureList(listing);
  const guests = Math.max(1, Number(listing.adults || 0) + Number(listing.children || 0));
  const nightlyRate = formatRand(listing.pricePerNight);
  const promoPrice = formatRand(buildPromoPrice(listing));
  const discount = Number(listing.discount ?? listing.discountPercent ?? 0);
  const bookingUrl = buildBookingUrl(listing.id, env);
  const headline = sanitizeText(customHeadline);

  switch (templateId) {
    case "special_offer":
      return {
        headline: headline || (includeSpecialOffer && discount > 0 ? `${discount}% off your stay` : `Now from ${promoPrice} per night`),
        caption: `Special offer at ${propertyName} in ${location}. Book now for ${includeSpecialOffer && discount > 0 ? `${discount}% off` : `from ${promoPrice} per night`}. Perfect for guests looking for ${features[0] || "comfort"} and ${features[1] || "a memorable stay"}. Limited dates available: ${bookingUrl}`,
        bookingUrl,
      };
    case "lifestyle_escape":
      return {
        headline: headline || "Where weekends feel longer",
        caption: `Slow down at ${propertyName} in ${location}. Think ${features[0] || "beautiful spaces"}, ${features[1] || "quiet comfort"}, and ${features[2] || "a stay worth sharing"} all wrapped into one stay. See more or book now: ${bookingUrl}`,
        bookingUrl,
      };
    case "stay_carousel":
      return {
        headline: headline || propertyName,
        caption: `Take a look inside ${propertyName} in ${location}. Swipe through the stay, explore the spaces, and book your next escape${includePrice ? ` from ${nightlyRate} per night` : ""}. ${bookingUrl}`,
        bookingUrl,
      };
    case "story_pack":
      return {
        headline: headline || propertyName,
        caption: `${propertyName} in ${location}. ${includePrice ? `From ${nightlyRate} per night. ` : ""}See the highlights and book your stay: ${bookingUrl}`,
        bookingUrl,
      };
    case "quick_facts":
      return {
        headline: propertyName,
        caption: `Looking for a stay in ${location}? ${propertyName} sleeps ${guests} and includes ${features[0] || "great amenities"}, ${features[1] || "comfortable spaces"}, and ${features[2] || "a strong location"}.${includePrice ? ` From ${nightlyRate} per night.` : ""} Book here: ${bookingUrl}`,
        bookingUrl,
      };
    case "weekend_escape":
      return {
        headline: headline || `Weekend escape in ${location}`,
        caption: `Planning a quick break? ${propertyName} in ${location} is perfect for a weekend away. Enjoy ${features[0] || "comfortable spaces"}, ${features[1] || "a strong location"}, and ${features[2] || "a polished stay"}${includePrice ? ` from ${nightlyRate} per night` : ""}. Book now: ${bookingUrl}`,
        bookingUrl,
      };
    default:
      return {
        headline: headline || `Stay at ${propertyName}`,
        caption: `Escape to ${location} at ${propertyName}. Enjoy ${features[0] || "beautiful spaces"}, ${features[1] || "great amenities"}, and ${features[2] || "a memorable stay"}${includePrice ? ` from ${nightlyRate} per night` : ""}. Book here: ${bookingUrl}`,
        bookingUrl,
      };
  }
}

function buildAssetTextPack({ listing, templateId, includePrice, includeSpecialOffer, customHeadline, env }) {
  const features = buildFeatureList(listing);
  const location = buildLocationLabel(listing);
  const guests = Math.max(1, Number(listing.adults || 0) + Number(listing.children || 0));
  const price = formatRand(listing.pricePerNight);
  const promoPrice = formatRand(buildPromoPrice(listing));
  const discount = Number(listing.discount ?? listing.discountPercent ?? 0);
  const captionData = buildCaptionAndHeadline({ listing, templateId, includePrice, includeSpecialOffer, customHeadline, env });

  if (templateId === "story_pack") {
    return {
      ...captionData,
      slides: [
        { label: "Story 1", kicker: "Ideal Stay", headline: captionData.headline, body: location, cta: "Book now" },
        { label: "Story 2", kicker: "Top features", headline: features.slice(0, 3).join(" · "), body: includePrice ? `From ${price} per night` : `Sleeps ${guests}`, cta: "See details" },
        { label: "Story 3", kicker: includeSpecialOffer && discount > 0 ? "Limited Offer" : "Ready to book?", headline: includeSpecialOffer && discount > 0 ? `${discount}% off selected dates` : `Stay at ${listing.title}`, body: includeSpecialOffer && discount > 0 ? `Now from ${promoPrice} per night` : captionData.bookingUrl, cta: "Reserve today" },
      ],
    };
  }

  if (templateId === "stay_carousel") {
    const featureRow = features.slice(0, 3).join(" · ");
    return {
      ...captionData,
      slides: [
        { label: "Slide 1", kicker: "Featured stay", headline: listing.title, body: location, cta: "Swipe" },
        { label: "Slide 2", kicker: "Comfort", headline: "Comfortable spaces to unwind", body: `${listing.bedrooms || 1} bedrooms · ${listing.bathrooms || 1} bathrooms`, cta: null },
        { label: "Slide 3", kicker: "Highlights", headline: featureRow || "Real stay highlights", body: sanitizeText(listing.description).slice(0, 120), cta: null },
        { label: "Slide 4", kicker: "Value", headline: includePrice ? `From ${price} per night` : `Sleeps ${guests}`, body: includeSpecialOffer && discount > 0 ? `${discount}% off selected dates` : "Book on Ideal Stay", cta: null },
        { label: "Slide 5", kicker: "Book now", headline: listing.title, body: "Reserve this stay on Ideal Stay", cta: "Book now" },
      ],
    };
  }

  if (templateId === "quick_facts") {
    return {
      ...captionData,
      facts: [
        `Sleeps ${guests}`,
        `${listing.bedrooms || 1} bedrooms`,
        `${listing.bathrooms || 1} bathrooms`,
        features[0] || "Great location",
        features[1] || "Comfortable interiors",
        features[2] || "Ideal Stay listing",
        includePrice ? `From ${price}` : "Book on Ideal Stay",
        location,
      ],
    };
  }

  return {
    ...captionData,
    features,
    location,
    price,
    promoPrice,
    discount,
  };
}

function buildSvgShell({ width, height, imageDataUrl, overlay, radius }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <clipPath id="frame">
          <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" />
        </clipPath>
        <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0F172A" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#0F172A" stop-opacity="0.74" />
        </linearGradient>
      </defs>
      <g clip-path="url(#frame)">
        <image href="${imageDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" />
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#topFade)" />
        ${overlay}
      </g>
    </svg>
  `.trim();
}

function renderSingleOverlay({ width, height, radius, listing, templateId, tone, context, slideIndex = 0, slideCount = 1 }) {
  const palette = readTonePalette(tone);
  const badgeText = templateId === "special_offer"
    ? context.discount > 0 && context.discount ? `SAVE ${context.discount}%` : "Limited Offer"
    : templateId === "weekend_escape"
      ? "Weekend Escape"
      : templateId === "quick_facts"
        ? "Quick Facts"
        : "Ideal Stay";

  const headline = context.slides?.[slideIndex]?.headline || context.headline;
  const kicker = context.slides?.[slideIndex]?.kicker || context.location || listing.location;
  const body = context.slides?.[slideIndex]?.body || context.features?.slice(0, 3).join(" · ") || sanitizeText(listing.description).slice(0, 96);
  const cta = context.slides?.[slideIndex]?.cta ?? "Book now";
  const progress = slideCount > 1 ? `${slideIndex + 1}/${slideCount}` : null;
  const footerPrice = templateId === "special_offer"
    ? context.promoPrice
    : context.price;

  const panelHeight = height < 1000 ? 245 : 360;
  const panelY = height - panelHeight - 40;

  return `
    <rect x="40" y="${panelY}" width="${width - 80}" height="${panelHeight}" rx="${Math.max(26, radius - 8)}" fill="rgba(15,23,42,0.72)" />
    <rect x="64" y="${panelY + 30}" width="220" height="48" rx="24" fill="${palette.accent}" />
    <text x="174" y="${panelY + 61}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800" text-anchor="middle">${escapeXml(badgeText)}</text>
    ${progress ? `<text x="${width - 80}" y="${panelY + 60}" fill="#E2E8F0" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" text-anchor="end">${escapeXml(progress)}</text>` : ""}
    ${renderWrappedText({
      x: 68,
      y: panelY + 122,
      width: width - 136,
      lineHeight: 56,
      fontSize: height < 1000 ? 42 : 54,
      lines: [headline],
    })}
    ${renderWrappedText({
      x: 68,
      y: panelY + (height < 1000 ? 170 : 190),
      width: width - 136,
      lineHeight: 34,
      fontSize: 24,
      weight: 600,
      fill: "#D6E3F5",
      lines: [kicker, body].filter(Boolean),
    })}
    ${footerPrice ? `<rect x="68" y="${panelY + panelHeight - 82}" width="250" height="54" rx="27" fill="rgba(255,255,255,0.12)" />
      <text x="193" y="${panelY + panelHeight - 47}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" text-anchor="middle">${escapeXml(`From ${footerPrice}`)}</text>` : ""}
    ${cta ? `<rect x="${width - 290}" y="${panelY + panelHeight - 82}" width="182" height="54" rx="27" fill="#ffffff" />
      <text x="${width - 199}" y="${panelY + panelHeight - 47}" fill="${palette.panel}" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800" text-anchor="middle">${escapeXml(cta)}</text>` : ""}
  `;
}

function renderQuickFactsOverlay({ width, height, radius, listing, tone, context }) {
  const palette = readTonePalette(tone);
  const facts = context.facts || [];
  const gridItems = facts
    .slice(0, 8)
    .map((fact, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = 68 + col * ((width - 180) / 2);
      const y = 360 + row * 88;
      return `
        <rect x="${x}" y="${y}" width="${(width - 220) / 2}" height="68" rx="22" fill="rgba(255,255,255,0.13)" />
        <text x="${x + 24}" y="${y + 42}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="700">${escapeXml(fact)}</text>
      `;
    })
    .join("");

  return `
    <rect x="40" y="40" width="${width - 80}" height="${height - 80}" rx="${Math.max(26, radius - 8)}" fill="rgba(15,23,42,0.68)" />
    <rect x="68" y="72" width="230" height="50" rx="25" fill="${palette.accent}" />
    <text x="183" y="106" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="800" text-anchor="middle">Quick Facts</text>
    ${renderWrappedText({ x: 68, y: 172, width: width - 136, lineHeight: 58, fontSize: 58, lines: [listing.title] })}
    ${renderWrappedText({ x: 68, y: 246, width: width - 136, lineHeight: 34, fontSize: 26, weight: 600, fill: "#D6E3F5", lines: [buildLocationLabel(listing)] })}
    ${gridItems}
    <rect x="68" y="${height - 134}" width="${width - 136}" height="66" rx="33" fill="#ffffff" />
    <text x="${width / 2}" y="${height - 91}" fill="${palette.panel}" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" text-anchor="middle">${escapeXml(context.bookingUrl)}</text>
  `;
}

function renderStoryOverlay({ width, height, radius, tone, context, slideIndex, slideCount }) {
  const palette = readTonePalette(tone);
  const slide = context.slides[slideIndex];
  return `
    <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="${Math.max(34, radius - 8)}" fill="rgba(15,23,42,0.56)" />
    <rect x="78" y="86" width="260" height="56" rx="28" fill="${palette.accent}" />
    <text x="208" y="123" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" text-anchor="middle">${escapeXml(slide.kicker)}</text>
    <text x="${width - 92}" y="122" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700" text-anchor="end">${escapeXml(`${slideIndex + 1}/${slideCount}`)}</text>
    ${renderWrappedText({ x: 86, y: 260, width: width - 172, lineHeight: 84, fontSize: 78, lines: [slide.headline] })}
    ${renderWrappedText({ x: 86, y: 560, width: width - 172, lineHeight: 46, fontSize: 34, weight: 600, fill: "#DBEAFE", lines: [slide.body] })}
    <rect x="86" y="${height - 220}" width="${width - 172}" height="92" rx="46" fill="#ffffff" />
    <text x="${width / 2}" y="${height - 162}" fill="${palette.panel}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" text-anchor="middle">${escapeXml(slide.cta || "Book now")}</text>
  `;
}

function svgToAsset({ svg, templateId, label, width, height, fileName }) {
  const mimeType = "image/svg+xml";
  const dataBase64 = Buffer.from(svg).toString("base64");
  return {
    id: `${templateId}-${label.toLowerCase().replace(/\s+/g, "-")}`,
    label,
    width,
    height,
    mimeType,
    fileName,
    dataBase64,
  };
}

function chooseImageUrls(listing, templateId, sourceImageUrl) {
  const images = [...new Set([sourceImageUrl, ...(Array.isArray(listing.images) ? listing.images : [])].filter(Boolean))];
  if (templateId === "story_pack") {
    return images.slice(0, 3);
  }
  if (templateId === "stay_carousel") {
    return images.slice(0, 5);
  }
  return images.slice(0, 1);
}

export async function generateSocialTemplatePack({
  listing,
  sourceImageUrl,
  platform,
  tone,
  templateId,
  includePrice,
  includeSpecialOffer,
  customHeadline,
  env = process.env,
}) {
  const templateName = getTemplateName(templateId);
  const context = buildAssetTextPack({
    listing,
    templateId,
    includePrice,
    includeSpecialOffer,
    customHeadline,
    env,
  });

  const imageUrls = chooseImageUrls(listing, templateId, sourceImageUrl);
  const imageDataUrls = await Promise.all(imageUrls.map((url) => fetchImageAsDataUrl(url)));
  const spec = getPlatformSpec(platform, templateId);

  let assets;
  if (templateId === "story_pack") {
    const slideCount = 3;
    assets = new Array(slideCount).fill(null).map((_, index) => {
      const imageDataUrl = imageDataUrls[index] || imageDataUrls[imageDataUrls.length - 1];
      const overlay = renderStoryOverlay({
        width: spec.width,
        height: spec.height,
        radius: spec.radius,
        tone,
        context,
        slideIndex: index,
        slideCount,
      });
      const svg = buildSvgShell({ width: spec.width, height: spec.height, imageDataUrl, overlay, radius: spec.radius });
      return svgToAsset({
        svg,
        templateId,
        label: context.slides[index].label,
        width: spec.width,
        height: spec.height,
        fileName: `ideal-stay-${templateId}-${index + 1}.svg`,
      });
    });
  } else if (templateId === "stay_carousel") {
    const slideCount = 5;
    assets = new Array(slideCount).fill(null).map((_, index) => {
      const imageDataUrl = imageDataUrls[index] || imageDataUrls[imageDataUrls.length - 1];
      const overlay = renderSingleOverlay({
        width: spec.width,
        height: spec.height,
        radius: spec.radius,
        listing,
        templateId,
        tone,
        context,
        slideIndex: index,
        slideCount,
      });
      const svg = buildSvgShell({ width: spec.width, height: spec.height, imageDataUrl, overlay, radius: spec.radius });
      return svgToAsset({
        svg,
        templateId,
        label: context.slides[index]?.label || `Slide ${index + 1}`,
        width: spec.width,
        height: spec.height,
        fileName: `ideal-stay-${templateId}-${index + 1}.svg`,
      });
    });
  } else {
    const imageDataUrl = imageDataUrls[0];
    const overlay =
      templateId === "quick_facts"
        ? renderQuickFactsOverlay({ width: spec.width, height: spec.height, radius: spec.radius, listing, tone, context })
        : renderSingleOverlay({ width: spec.width, height: spec.height, radius: spec.radius, listing, templateId, tone, context });
    const svg = buildSvgShell({ width: spec.width, height: spec.height, imageDataUrl, overlay, radius: spec.radius });
    assets = [
      svgToAsset({
        svg,
        templateId,
        label: templateName,
        width: spec.width,
        height: spec.height,
        fileName: `ideal-stay-${templateId}.svg`,
      }),
    ];
  }

  return {
    templateId,
    templateName,
    headline: context.headline,
    caption: context.caption,
    bookingUrl: context.bookingUrl,
    mimeType: assets[0].mimeType,
    dataBase64: assets[0].dataBase64,
    assets,
  };
}
