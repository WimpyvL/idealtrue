export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  console.warn('Geocoding is not configured for this environment. Skipping address lookup for:', address);
  return null;
}
