import { studioTheme } from 'ag-studio';

const LINE = '#2a2d31';
const MUTED = '#8f9499';
const PLEX = 'var(--font-plex-sans)';

export const guardrailsTheme = studioTheme.withParams({
  backgroundColor: '#17191c',
  foregroundColor: '#e8e9ea',
  accentColor: '#4f8ff7',
  browserColorScheme: 'dark',
  fontFamily: PLEX,
  chartFontFamily: PLEX,
  gridFontFamily: PLEX,

  studioWrapperBackgroundColor: '#111315',
  studioWrapperSpacing: 0,
  studioWidgetBackgroundColor: '#17191c',
  studioWidgetBorder: { width: 1, color: LINE },
  studioWidgetBorderRadius: 8,
  studioWidgetPadding: 12,
  studioWidgetTitleFontFamily: PLEX,
  studioWidgetTitleFontSize: 13,
  studioWidgetTitleFontWeight: 500,
  studioWidgetTitleTextColor: MUTED,
  studioValueWidgetFontSize: 34,

  gridHeaderBackgroundColor: '#1c1f23',
  gridOddRowBackgroundColor: '#1a1c1f',
  gridRowBorder: { width: 1, color: '#22252a' },
  gridRowHeight: 30,

  chartGridLineColor: LINE,
  chartSubtleTextColor: MUTED,
  chartPaletteFills1Color: '#4f8ff7',
  chartPaletteFills2Color: '#3fb68b',
  chartPaletteFills3Color: '#e0a030',
  chartPaletteFills4Color: '#c2549d',
  chartPaletteFills5Color: '#8b7cf6',
  chartPaletteFills6Color: '#e5634d',
});
