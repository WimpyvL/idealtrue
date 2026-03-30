export function formatRand(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return `R${amount.toLocaleString()}`;
}
