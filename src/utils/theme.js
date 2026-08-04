export const colors = {
  green:       '#14432A',   // deeper, richer fairway green
  greenMid:    '#1A4A2E',   // original primary — mid tone
  greenLight:  '#2D6B44',
  greenPale:   '#E8F1EA',   // subtle green tint for fills/rows
  gold:        '#B8860B',
  goldLight:   '#DAA520',
  goldPale:    '#FBF6E9',   // warm tint for press/pro surfaces
  red:         '#C0392B',
  redPale:     '#FBECEA',
  white:       '#FFFFFF',
  offWhite:    '#F5F5F0',
  border:      '#E4E7E2',
  textDark:    '#16211B',   // near-black with a green undertone
  textMid:     '#54605A',
  textLight:   '#96A09A',
  cardBg:      '#FFFFFF',
  background:  '#EEF3EE',
};

// Gradient stops (for LinearGradient where available; otherwise decorative)
export const gradients = {
  green: ['#1E5638', '#12381F'],
  gold:  ['#DAA520', '#B8860B'],
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius  = { sm: 12, md: 16, lg: 24, xl: 30, pill: 50 };

export const shadow = {
  sm:    { shadowColor: '#1A2B20', shadowOpacity: 0.08, shadowRadius: 6,  shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md:    { shadowColor: '#132018', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  lg:    { shadowColor: '#0D1811', shadowOpacity: 0.16, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  green: { shadowColor: '#14432A', shadowOpacity: 0.34, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  gold:  { shadowColor: '#B8860B', shadowOpacity: 0.32, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
};
