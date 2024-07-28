import {ColorHsla} from '../../../helpers/color';
import {ContextData} from './MediaEditorContext';

export namespace METypes {
  export type CanvasType = HTMLCanvasElement | OffscreenCanvas;
  export type CanvasContext = OffscreenCanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext;
  export type CanvasContext2d = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

  export type ContextType = typeof ContextData.prototype;

  export interface Font {
    url: string;
    label?: string;
    family: string;
    lineHeight?: number;
    style: string;
    weight: number;
  }

  export interface ContextDataOptions {
    file: File,
    mediaSrc: string,
    onConfirm: (newFile: File) => void,
    onClose: () => void,
  }

  export enum CornerType {
    TopLeft = 'top-left',
    TopRight = 'top-right',
    BottomLeft = 'bottom-left',
    BottomRight = 'bottom-right',
  }

  export enum AspectRatio {
    Free = 'free',
    Original = 'original',
    Square = 'square',
    _3_2 = '3:2',
    _4_3 = '4:3',
    _5_4 = '5:4',
    _7_5 = '7:5',
    _16_9 = '16:9',
    // * REVERSED-VERTICAL
    _2_3 = '2:3',
    _3_4 = '3:4',
    _4_5 = '4:5',
    _5_7 = '5:7',
    _9_16 = '9:16'
  }

  export enum PanelTab {
    Enhance = 'Enhance',
    Crop = 'Crop',
    Text = 'Text',
    Draw = 'Draw',
    Sticker = 'Sticker',
  }

  export enum DrawTool {
    Pen = 'pen',
    Arrow = 'arrow',
    Brush = 'brush',
    Neon = 'neon',
    Blur = 'blur',
    Eraser = 'eraser',
  }

  export enum TextAlign {
    Left = 'left',
    Center = 'center',
    Right = 'right',
  }

  export enum FontFrame {
    No = 'no',
    White = 'white',
    Black = 'black',
  }

  export interface EnhanceSettings {
    enhance: number;
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    fade: number;
    highlights: number;
    shadows: number;
    vignette: number;
    grain: number;
    sharpen: number;
  }

  export interface CropSettings {
    topRatio: number;
    leftRatio: number;
    widthRatio: number;
    heightRatio: number;
    flipHorizontal: boolean;
    angle: number;
  }

  export interface EdittingText {
    mainText: string;
    caretInfo: CaretInfo;
    linesArray: string[];
    caretRect: METypes.Geo.Rect;
  }

  export interface CaretInfo {
    color: string;
    line: number;
    position: number;
  }

  export interface State {
    enhanceSettings: METypes.EnhanceSettings;
    cropSettings: METypes.CropSettings;
    texts: METypes.Item.TextItem[];
    stickers: METypes.Item.StickerItem[];
    drawLayerImage: ImageBitmap;
    _lastItemId: number;
  }
}

export namespace METypes.Item {
  export type IdType = number;
  export type ItemType = TextItem | StickerItem;
  export type TransformEntry = { id: METypes.Item.IdType, transform: Transform };

  export interface Transform extends Geo.Rect {
    orderIndex: number,
    angleDegree: number;
    scale: number;
    flipped: boolean;
    hide: boolean;
  }

  interface BaseItem {
    id: IdType;
    transform: Transform;
  }

  export interface TextItem extends BaseItem {
    text: string;
    fontSize: number;
    font: Font;
    color: ColorHsla;
    align: TextAlign;
    fontFrame: FontFrame;
  }

  export interface StickerItem extends BaseItem  {
    image: ImageBitmap;
  }
}

export namespace METypes.Pointer {
  export type CursorType = 'auto' | 'default' | 'none' | 'context-menu' | 'help' | 'pointer' | 'progress' | 'wait' | 'cell' | 'crosshair' | 'text' | 'vertical-text' | 'alias' | 'copy' | 'move' | 'no-drop' | 'not-allowed' | 'grab' | 'grabbing' | 'all-scroll' | 'col-resize' | 'row-resize' | 'n-resize' | 'e-resize' | 's-resize' | 'w-resize' | 'ne-resize' | 'nw-resize' | 'se-resize' | 'sw-resize' | 'ew-resize' | 'ns-resize' | 'nesw-resize' | 'nwse-resize' | 'zoom-in' | 'zoom-out';
  export type Target =  {type: 'drawing'} |
  {type: 'item', itemId: Item.IdType} | {type: 'item-corner', itemId: Item.IdType, cornerType: CornerType} |
  {type: 'cropper'} | {type: 'cropper-corner', cornerType: CornerType};

  export interface MousePos extends METypes.Geo.Point {}
  export interface MouseInfo {
    current: MousePos,
    start: MousePos,
    last: MousePos,
    delta: METypes.Geo.Point,
  }
}


// Geometry
export namespace METypes.Geo {
  export interface Rect { left: number, top: number, width: number, height: number };
  export interface CoordinateRect { x: number, y: number, width: number, height: number };
  export interface RelativeRect { leftRatio: number, topRatio: number, widthRatio: number, heightRatio: number };
  export interface Dimensions { width: number; height: number };
  export interface Point { x: number; y: number; }
  export interface Corners { topLeft: number, topRight: number, bottomRight: number, bottomLeft: number };
}
