import {hexaToHsla} from '../../helpers/color'
import {METypes} from './core/types';

const fontPath = (p: string) => `/assets/fonts/mediaEditor/${p}`;

const AVAILABLE_FONTS: METypes.Font[] = [
  {url: '/assets/fonts/Roboto-Medium.woff2', family: 'Roboto', weight: 500, style: 'normal'},
  {url: fontPath('AmericanTypewLH-MedCond.woff2'), label: 'Typewriter', family: 'American Typewriter', weight: 600, style: 'normal'},
  {url: fontPath('AvenirNextCyr-Italic.woff2'), family: 'Avenir Next', weight: 700, style: 'italic'},
  {url: fontPath('CourierNewPS-BoldMT.woff2'), family: 'Courier New', weight: 700, style: 'normal'},
  {url: fontPath('Noteworthy-Bold.woff2'), family: 'Noteworthy', weight: 700, style: 'normal'},
  {url: fontPath('Georgia-Bold.woff2'), family: 'Georgia', weight: 700, style: 'normal'},
  {url: fontPath('Papyrus.ttf'), family: 'Papyrus', weight: 400, style: 'normal'},
  {url: fontPath('SnellRoundhandLTStd-BdScr.woff2'), family: 'Snell Roundhand', weight: 700, style: 'italic'}
]

export const ME_CONFIG = {
  // Start Media Editor with sample texts and stickers
  IS_DEV: false,
  // Maximum width for images to prevent performance issues in the MediaEditor
  MAX_WIDTH: 1280,
  // Maximum resize factor to fit the image to the screen without quality loss
  MAX_INCREASE_FACTOR: 3,
  AVAILABLE_FONTS,
  // CustomColorPicker preset colors and default Draw tool colors
  COLORS: [
    '#ffffff', // white
    '#FE4438', // red
    '#FF8901', // orange
    '#FFD60A', // yellow
    '#33C759', // green
    '#62E5E0', // cyan
    '#0A84FF', // blue
    '#BD5CF3' // purple
  ].map(x => hexaToHsla(x)),
  TEXT_LIMIT: 100,
  TEXT_TAB: {
    MIN_FONT_SIZE: 5,
    MAX_FONT_SIZE: 40
  },
  DRAW_TAB: {
    MIN_BRUSH_SIZE: 3,
    MAX_BRUSH_SIZE: 30
  },
  RENDER: {
    DEBUG_TEXT: false,
    // This ratio is used to adjust the Brush size relative to the image size.
    // It ensures that the brush size remains proportional to the image dimensions, maintaining consistent user experience across different image sizes.
    BRUSH_SIZE_RATIO: 0.2,
    STICKER_DEFAULT_SIZE_RATIO: 0.2,
    TEXT_SIZE_RATIO: 0.1,
    TEXT_FRAME_PADDING: 10,
    TEXT_JUSTIFY: false,
    TEXT_FRAME_BORDER_RADIUS: 15
  }
}
