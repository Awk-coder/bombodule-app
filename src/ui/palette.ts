const PALETTE = [
  { bg: "#421A00", fg: "#FFA65C" },
  { bg: "#3A0763", fg: "#D9A8FF" },
  { bg: "#192E03", fg: "#C6F25A" },
  { bg: "#1D1B4A", fg: "#A9B1FF" },
  { bg: "#083343", fg: "#67E0F5" },
  { bg: "#3D2600", fg: "#FFD84D" },
  { bg: "#3F0A1E", fg: "#FF8FB5" },
  { bg: "#1A2733", fg: "#9CC3E6" },
];

export const courseColor = (i: number) => PALETTE[i % PALETTE.length];
