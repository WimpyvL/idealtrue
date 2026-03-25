export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  console.log('Geocoding address:', address);
  // Mocking geocoding - returning random coordinates near Cape Town
  return {
    lat: -33.9249 + (Math.random() - 0.5) * 0.1,
    lng: 18.4241 + (Math.random() - 0.5) * 0.1
  };
}
