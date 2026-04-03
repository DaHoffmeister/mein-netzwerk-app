// lib/themes.ts
// Alle Theme-Definitionen — 1:1 aus dem Web-CSS übernommen

export type Theme = {
  key: string;
  label: string;
  emoji: string;
  logo: ReturnType<typeof require>;
  bg: string;
  panel: string;
  muted: string;
  text: string;
  textDim: string;
  brand: string;
  accent: string;
  danger: string;
  // Tab-Bar
  tabBar: string;
  tabActive: string;
  tabInactive: string;
};

export const THEMES: Theme[] = [
  {
    key: 'default',
    label: 'Standard',
    emoji: '🌐',
    logo: require('../assets/logos/assoz_net_logo.png'),
    bg: '#f5f5f5',
    panel: '#ffffff',
    muted: '#e0e0e0',
    text: '#1a1a1a',
    textDim: '#666666',
    brand: '#3498db',
    accent: '#2980b9',
    danger: '#e74c3c',
    tabBar: '#ffffff',
    tabActive: '#3498db',
    tabInactive: '#999999',
  },
  {
    key: 'vaporwave',
    label: 'Vaporwave',
    emoji: '🌸',
    logo: require('../assets/logos/assoz_vaporwave_logo.png'),
    bg: '#0a001c',
    panel: '#110230',
    muted: '#4d1277',
    text: '#f0e0ff',
    textDim: '#c084fc',
    brand: '#00ffff',
    accent: '#ff2d78',
    danger: '#ff0055',
    tabBar: '#110230',
    tabActive: '#00ffff',
    tabInactive: '#c084fc',
  },
  {
    key: 'pathfinder',
    label: 'Pathfinder',
    emoji: '⚔️',
    logo: require('../assets/logos/assoz_rpg_logo.png'),
    bg: '#0e0b07',
    panel: '#1b1509',
    muted: '#3b2e14',
    text: '#f0e6c8',
    textDim: '#b8965a',
    brand: '#c9a227',
    accent: '#8b1a1a',
    danger: '#dc2626',
    tabBar: '#1b1509',
    tabActive: '#c9a227',
    tabInactive: '#b8965a',
  },
  {
    key: 'matrix',
    label: 'Matrix',
    emoji: '💻',
    logo: require('../assets/logos/assoz_matrix_logo.png'),
    bg: '#000000',
    panel: '#0a0f0a',
    muted: '#0d2b0d',
    text: '#00ff41',
    textDim: '#00802b',
    brand: '#00ff41',
    accent: '#00cc33',
    danger: '#ff2222',
    tabBar: '#0a0f0a',
    tabActive: '#00ff41',
    tabInactive: '#00802b',
  },
  {
    key: 'knightrider',
    label: 'Knight Rider',
    emoji: '🚗',
    logo: require('../assets/logos/assoz_knightrider_logo.png'),
    bg: '#000000',
    panel: '#0d0505',
    muted: '#2a0a0a',
    text: '#e8e0e0',
    textDim: '#997070',
    brand: '#ff2200',
    accent: '#cc1a00',
    danger: '#ff4444',
    tabBar: '#0d0505',
    tabActive: '#ff2200',
    tabInactive: '#997070',
  },
  {
    key: 'hellokitty',
    label: 'Hello Kitty',
    emoji: '🎀',
    logo: require('../assets/logos/assoz_hk_logo.png'),
    bg: '#FFF0F7',
    panel: '#FFE0EF',
    muted: '#F5A8CC',
    text: '#5C0035',
    textDim: '#A04878',
    brand: '#FF1493',
    accent: '#FF69B4',
    danger: '#DC143C',
    tabBar: '#FFE0EF',
    tabActive: '#FF1493',
    tabInactive: '#A04878',
  },
  {
    key: 'cyberpunk',
    label: 'Cyberpunk',
    emoji: '⚡',
    logo: require('../assets/logos/assoz_cyberpunk_logo.png'),
    bg: '#000000',
    panel: '#06060e',
    muted: '#0e0e1c',
    text: '#ddd8c0',
    textDim: '#8a8770',
    brand: '#f9f002',
    accent: '#02d7f2',
    danger: '#ff003c',
    tabBar: '#06060e',
    tabActive: '#f9f002',
    tabInactive: '#8a8770',
  },
];

export const DEFAULT_THEME = THEMES[0];
