import {hexaToHsla} from '../../../helpers/color';
import {ME_CONFIG} from '../config';
import {CanvasRenderer} from './CanvasRenderer';
import {METypes} from './types';

export namespace MEHelpers {
  export class AsyncFrameThrottle {
    private _isPending: boolean = false;

    constructor(private readonly _execute: () => void) {}

    call(): Promise<void> {
      if(!this._isPending) {
        this._isPending = true;
        return new Promise(resolve => {
          requestAnimationFrame(() => this._handleExecute(resolve));
        });
      }
      return Promise.resolve();
    }

    private _handleExecute(resolve: () => void) {
      this._execute();
      this._isPending = false;
      resolve();
    }
  }

  export class InputFieldCaret {
    private _textArray: string[] = [];
    private _caretPos: number = 0;
    private _caretLine: number = 0;

    public handleKeydown(event: KeyboardEvent, edittingText: METypes.EdittingText) {
      this._textArray = edittingText.linesArray;
      this._caretLine = edittingText.caretInfo.line;
      this._caretPos = edittingText.caretInfo.position;

      let newText = edittingText.mainText;
      if(event.key === 'Backspace') {
        newText = newText.slice(0, -1);
      }
      else if(event.key === 'Enter') {
        newText += '\n';
      }
      else {
        if(event.key.length === 1) { // Only process printable characters
          newText += event.key;
        }
      }

      return {
        newText
      }

      return;

      switch(event.key) {
        case 'Backspace':
          this.handleBackspace();
          break;
        case 'Enter':
          this.handleEnter();
          break;
        case 'ArrowLeft':
          this.moveCaretLeft();
          break;
        case 'ArrowRight':
          this.moveCaretRight();
          break;
        case 'ArrowUp':
          this.moveCaretUp();
          break;
        case 'ArrowDown':
          this.moveCaretDown();
          break;
        default:
          if(event.key.length === 1) { // Only process printable characters
            this.insertCharacter(event.key);
          }
          break;
      }

      // edittingText.linesArray = this._textArray;
      // edittingText.caretInfo.line = this._caretLine;
      // edittingText.caretInfo.position = this._caretPos;

      console.log(this._textArray, this._caretLine, this._caretPos);

      return {
        newText: this._textArray.join(''), // this._textArray.join(''),
        caretLine: this._caretLine,
        caretPos: this._caretPos
      };
    }

    private handleBackspace() {
      if(this._caretPos > 0) {
        // Remove character before the caret
        this._textArray[this._caretLine] = this._textArray[this._caretLine].slice(0, this._caretPos - 1) + this._textArray[this._caretLine].slice(this._caretPos);
        this._caretPos -= 1;
      } else if(this._caretLine > 0) {
        // Merge current line with the previous line
        const prevLineLength = this._textArray[this._caretLine - 1].length;
        this._textArray[this._caretLine - 1] += this._textArray[this._caretLine];
        this._textArray.splice(this._caretLine, 1);
        this._caretLine--;
        this._caretPos = prevLineLength;
      }
    }

    private handleEnter() {
      // Split current line at the caret position
      const newLine = this._textArray[this._caretLine].slice(this._caretPos);
      this._textArray[this._caretLine] = this._textArray[this._caretLine].slice(0, this._caretPos);
      this._textArray.splice(this._caretLine + 1, 0, newLine);
      this._caretLine++;
      this._caretPos = 0;
    }

    private insertCharacter(char: string) {
      // Insert character at the caret position
      this._textArray[this._caretLine] = this._textArray[this._caretLine].slice(0, this._caretPos) + char + this._textArray[this._caretLine].slice(this._caretPos);
      this._caretPos++;
    }

    private moveCaretLeft() {
      if(this._caretPos > 0) {
        this._caretPos--;
      } else if(this._caretLine > 0) {
        this._caretLine--;
        this._caretPos = this._textArray[this._caretLine].length;
      }
    }

    private moveCaretRight() {
      if(this._caretPos < this._textArray[this._caretLine].length) {
        this._caretPos++;
      } else if(this._caretLine < this._textArray.length - 1) {
        this._caretLine++;
        this._caretPos = 0;
      }
    }

    private moveCaretUp() {
      if(this._caretLine > 0) {
        this._caretLine--;
        this._caretPos = Math.min(this._caretPos, this._textArray[this._caretLine].length);
      }
    }

    private moveCaretDown() {
      if(this._caretLine < this._textArray.length - 1) {
        this._caretLine++;
        this._caretPos = Math.min(this._caretPos, this._textArray[this._caretLine].length);
      }
    }
  }

  export class FontLoader {
    private _loadedFonts: FontFace[] = [];

    async loadFonts(fonts: { name: string; url: string }[]): Promise<void> {
      const fontPromises = fonts.map(async(font) => {
        try {
          const fontFace = new FontFace(font.name, `url(${font.url})`);
          const loadedFontFace = await fontFace.load();
          document.fonts.add(loadedFontFace);
          this._loadedFonts.push(loadedFontFace);
        } catch(error) {
          console.error(`Failed to load font ${font.name} from ${font.url}:`, error);
        }
      });

      await Promise.all(fontPromises);
    }

    unloadFonts() {
      this._loadedFonts.forEach(font => {
        document.fonts.delete(font);
      });
      this._loadedFonts = [];
    }
  }

  export function canEditMedia(file: File) {
    return /^image\//.test(file.type);
  }

  export function roundNumber(v: number, digitCount: number) {
    return Math.round(v * Math.pow(10, digitCount)) / Math.pow(10, digitCount);
  }

  export function findMax(array: number[], defaultValue?: number): number {
    if(array.length === 0) {
      if(defaultValue !== undefined) return defaultValue;
      throw new Error('Array cannot be empty and no default value provided');
    }

    return array.reduce((max, current) => current > max ? current : max, array[0]);
  }

  export function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (error) => {
        reject(error);
      };
    });
  }

  export function calculateAspectRatio(aspectRatio: METypes.AspectRatio): { widthRatio: number, heightRatio: number } {
    switch(aspectRatio) {
      case METypes.AspectRatio.Original:
        return {widthRatio: 1, heightRatio: 1};
      case METypes.AspectRatio.Square:
        return {widthRatio: 1, heightRatio: 1};
      case METypes.AspectRatio._3_2:
        return {widthRatio: 1, heightRatio: 0.6667};
      case METypes.AspectRatio._4_3:
        return {widthRatio: 1, heightRatio: 0.75};
      case METypes.AspectRatio._5_4:
        return {widthRatio: 1, heightRatio: 0.8};
      case METypes.AspectRatio._7_5:
        return {widthRatio: 1, heightRatio: 0.7143};
      case METypes.AspectRatio._16_9:
        return {widthRatio: 1, heightRatio: 0.5625};
      case METypes.AspectRatio._2_3:
        return {widthRatio: 0.6667, heightRatio: 1};
      case METypes.AspectRatio._3_4:
        return {widthRatio: 0.75, heightRatio: 1};
      case METypes.AspectRatio._4_5:
        return {widthRatio: 0.8, heightRatio: 1};
      case METypes.AspectRatio._5_7:
        return {widthRatio: 0.7143, heightRatio: 1};
      case METypes.AspectRatio._9_16:
        return {widthRatio: 0.5625, heightRatio: 1};
      default:
        throw new Error('Unknown aspect ratio');
    }
  }

  export function detectAspectRatio(width: number, height: number): METypes.AspectRatio {
    const aspectRatios: Record<string, METypes.AspectRatio> = {
      '1:1': METypes.AspectRatio.Square,
      '3:2': METypes.AspectRatio._3_2,
      '4:3': METypes.AspectRatio._4_3,
      '5:4': METypes.AspectRatio._5_4,
      '7:5': METypes.AspectRatio._7_5,
      '16:9': METypes.AspectRatio._16_9,
      '2:3': METypes.AspectRatio._2_3,
      '3:4': METypes.AspectRatio._3_4,
      '4:5': METypes.AspectRatio._4_5,
      '5:7': METypes.AspectRatio._5_7,
      '9:16': METypes.AspectRatio._9_16
    };

    // Using tolerance to handle floating-point precision issues in aspect ratio comparison.
    const tolerance = 0.02;
    const isCloseTo = (a: number, b: number) => Math.abs(a - b) < tolerance;

    for(const [key, value] of Object.entries(aspectRatios)) {
      const [w, h] = key.split(':').map(Number);
      if(isCloseTo(width / height, w / h)) {
        return value;
      }
    }

    return METypes.AspectRatio.Free;
  }


  export function dataUrlToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        createImageBitmap(img)
        .then(resolve)
        .catch(reject);
      };
      img.onerror = (error) => reject(error);
      img.src = dataUrl;
    });
  }
}

export namespace MEHelpers.Geo {
  export function isPointInsideRect(point: METypes.Geo.Point, rect: METypes.Geo.Rect, angle: number) {
    const rad = angle * (Math.PI / 180);

    // Find the center of the rectangle
    const rectCenterX = rect.left + rect.width / 2;
    const rectCenterY = rect.top + rect.height / 2;

    // Translate point to origin
    const translatedX = point.x - rectCenterX;
    const translatedY = point.y - rectCenterY;

    // Rotate the point back
    const rotatedX = translatedX * Math.cos(-rad) - translatedY * Math.sin(-rad);
    const rotatedY = translatedX * Math.sin(-rad) + translatedY * Math.cos(-rad);

    // Translate point back to the original position
    const finalX = rotatedX + rectCenterX;
    const finalY = rotatedY + rectCenterY;

    // Check if the point is within the bounds of the rectangle
    const isInside = (
      finalX >= rect.left &&
      finalX <= rect.left + rect.width &&
      finalY >= rect.top &&
      finalY <= rect.top + rect.height
    );

    return isInside;
  }

  export function addPaddingToRect(
    rect: METypes.Geo.Rect,
    padding: number
  ): METypes.Geo.Rect {
    return {
      left: rect.left - padding,
      top: rect.top - padding,
      width: rect.width + 2 * padding,
      height: rect.height + 2 * padding
    };
  }

  export function radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  export function scaleRect(rect: METypes.Geo.Rect, scaleFactor: number): METypes.Geo.Rect {
    return {
      left: rect.left * scaleFactor,
      top: rect.top * scaleFactor,
      width: rect.width * scaleFactor,
      height: rect.height * scaleFactor
    };
  }

  export function toCoordinateRect(rect: METypes.Geo.Rect): METypes.Geo.CoordinateRect {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      width: rect.width,
      height: rect.height
    };
  }

  export function relativeToRect(ref: METypes.Geo.Dimensions, relative: METypes.Geo.RelativeRect): METypes.Geo.Rect {
    return {
      left: relative.leftRatio * ref.width,
      top: relative.topRatio * ref.height,
      width: relative.widthRatio * ref.width,
      height: relative.heightRatio * ref.height
    };
  }

  export function rectToRelative(ref: METypes.Geo.Dimensions, rect: METypes.Geo.Rect): METypes.Geo.RelativeRect {
    return {
      leftRatio: rect.left / ref.width,
      topRatio: rect.top / ref.height,
      widthRatio: rect.width / ref.width,
      heightRatio: rect.height / ref.height
    };
  }

  export function getRotatedBoundingBox(rect: METypes.Geo.Rect, angle: number): METypes.Geo.Rect {
    const radians = angle * (Math.PI / 180);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const corners = [
      {x: rect.left, y: rect.top},
      {x: rect.left + rect.width, y: rect.top},
      {x: rect.left, y: rect.top + rect.height},
      {x: rect.left + rect.width, y: rect.top + rect.height}
    ];

    const transformedCorners = corners.map(corner => ({
      x: cos * (corner.x - rect.left) - sin * (corner.y - rect.top) + rect.left,
      y: sin * (corner.x - rect.left) + cos * (corner.y - rect.top) + rect.top
    }));

    const xs = transformedCorners.map(c => c.x);
    const ys = transformedCorners.map(c => c.y);

    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  }

  export function getScaleFactor(a: METypes.Geo.Dimensions, b: METypes.Geo.Dimensions) {
    return Math.min(a.width / b.width, a.height / b.height);
  }

  export function fitToContainer(org: METypes.Geo.Dimensions, cont: METypes.Geo.Dimensions,
    increaseFactor: number = 1): METypes.Geo.Dimensions {
    const originalAspectRatio = org.width / org.height;
    const containerAspectRatio = cont.width / cont.height;

    let newWidth: number;
    let newHeight: number;

    if(originalAspectRatio > containerAspectRatio) {
      // Image is wider than the container
      newWidth = Math.min(org.width * increaseFactor, cont.width);
      newHeight = newWidth / originalAspectRatio;
    } else {
      // Image is taller than the container
      newHeight = Math.min(org.height * increaseFactor, cont.height);
      newWidth = newHeight * originalAspectRatio;
    }

    return {width: Math.floor(newWidth), height: Math.floor(newHeight)};
  }

  export function resizeToMaxWidth(dimension: METypes.Geo.Dimensions, maxWidth: number): METypes.Geo.Dimensions {
    if(dimension.width > maxWidth) {
      const aspectRatio = dimension.height / dimension.width;
      const newHeight = maxWidth * aspectRatio;
      return {width: maxWidth, height: newHeight};
    }
    return dimension;
  }

  export function sumPoints(a: METypes.Geo.Point, b: METypes.Geo.Point): METypes.Geo.Point {
    return {x: a.x + b.x, y: a.y + b.y};
  }

  export function getRectCenter(r: METypes.Geo.Rect): METypes.Geo.Point {
    return {x:r.left + r.width / 2, y: r.top + r.height / 2};
  }

  export function getDistance(a: METypes.Geo.Point, b: METypes.Geo.Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

export namespace MEHelpers.Animation {
  export type EasingFunction = (t: number) => number;

  export class NumberAnimator {
    private _startValue: number;
    private _endValue: number;
    private _duration: number;
    private _easingFunction: EasingFunction;
    private _startTime: number | null;
    private _updateCallback: (value: number) => void;
    private _animationFrameId: number | null;

    constructor() {
      this._startValue = 0;
      this._endValue = 0;
      this._duration = 0;
      this._easingFunction = (t: number) => t;
      this._updateCallback = () => {};
      this._startTime = null;
      this._animationFrameId = null;
    }

    get isPlaying(): boolean {
      return this._startTime !== null;
    }

    start(
      startValue: number,
      endValue: number,
      duration: number,
      updateCallback: (value: number) => void,
      easingFunction: EasingFunction = (t: number) => t
    ) {
      this._startValue = startValue;
      this._endValue = endValue;
      this._duration = duration;
      this._easingFunction = easingFunction;
      this._updateCallback = updateCallback;

      if(this._animationFrameId !== null) {
        cancelAnimationFrame(this._animationFrameId);
      }

      this._startTime = null;
      this._animationFrameId = requestAnimationFrame(this._tick.bind(this));
    }

    private _tick(currentTime: number): void {
      if(this._startTime === null) {
        this._startTime = currentTime;
      }

      const elapsedTime = currentTime - this._startTime;
      const t = Math.min(elapsedTime / this._duration, 1); // Normalize time to [0, 1]
      const easedT = this._easingFunction(t);
      const currentValue = this._startValue + (this._endValue - this._startValue) * easedT;

      this._updateCallback(currentValue);

      if(t < 1) {
        this._animationFrameId = requestAnimationFrame(this._tick.bind(this));
      } else {
        this._startTime = null; // Reset for potential reuse
        this._animationFrameId = null;
      }
    }
  }

  export const linear: EasingFunction = (t) => t;
  export const easeInOutQuad: EasingFunction = (t) =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export namespace MEHelpers.Pointer {
  export function transformToRectCoords(mouseInfo: METypes.Pointer.MouseInfo, rect: METypes.Geo.Rect): METypes.Pointer.MouseInfo {
    const convertPoint = (point: METypes.Geo.Point): METypes.Geo.Point => ({
      x: point.x - rect.left,
      y: point.y - rect.top
    });

    const current = convertPoint(mouseInfo.current);
    const last = convertPoint(mouseInfo.last);

    return {
      current,
      start: convertPoint(mouseInfo.start),
      last,
      delta: {x: current.x - last.x, y: current.y - last.y}
    };
  }
}

export namespace MEHelpers.LottieToGif {
  // if there is animated gif in Sticker Items render frames using LottiePlayer and create gif using frames
}

export namespace MEHelpers.Development {
  let canOpenPopup = true;
  // ? During development, this function can automatically open the MediaEditor popup
  export function showForTest(callback: () => void) {
    if(!canOpenPopup || !ME_CONFIG.IS_DEV) return;
    canOpenPopup = false;
    callback();
  }

  export function log(message?: any, ...optionalParams: any[]) {
    console.log('[MMDJN]', message, ...optionalParams);
  }

  class Animations {
    private context: METypes.ContextType;
    private renderer: CanvasRenderer;
    private intervalIds: { [key: string]: NodeJS.Timeout[] } = {};

    constructor(context: METypes.ContextType, renderer: CanvasRenderer) {
      this.context = context;
      this.renderer = renderer;
    }

    private getRandomColor(): string {
      return `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`;
    }

    private getRandomPosition(): { left: number, top: number } {
      const canvas = this.renderer.renderingCanvas.canvas;
      const left = Math.random() * (canvas.width / this.renderer.renderingScaleFactor);
      const top = Math.random() * (canvas.height / this.renderer.renderingScaleFactor);
      return {left, top};
    }

    private changeColor(id: METypes.Item.IdType) {
      const newColor = this.getRandomColor();
      this.context.actions.itemsActions.updateText(id, {color: hexaToHsla(newColor)});
    }

    private moveItem(id: METypes.Item.IdType) {
      const newPosition = this.getRandomPosition();
      this.context.actions.itemsActions.updateTransform(id, {left: newPosition.left, top: newPosition.top});
    }

    animateItem(id: METypes.Item.IdType) {
      const changeInterval = () => Math.random() * 5000 + 10000;
      const moveInterval = 3000;

      this.intervalIds[id] = [
        setInterval(() => {
          this.changeColor(id);
        }, changeInterval()),

        setInterval(() => {
          this.moveItem(id);
        }, moveInterval)
      ];
    }

    public start() {
      const items = this.context.actions.itemsActions.getAll();
      const ids = Object.keys(items);

      ids.forEach(id => {
        // this.animateItem(id);
      });
    }

    public stop() {
      Object.values(this.intervalIds).forEach(intervalArray => {
        intervalArray.forEach(clearInterval);
      });
    }
  }


  // ? Initializes the development with preset configurations and sample items for quick setup during development.
  export async function initializeDev(context: METypes.ContextType, renderer: CanvasRenderer) {
    if(!ME_CONFIG.IS_DEV) return;
    log('Initializing Media Editor for Test..');

    const {itemsActions} = context.actions;

    await new Promise((resolve) => setTimeout(() => resolve(true), 1000));

    function getTopMostOrder() {
      return context.actions.itemsActions.getNewOrderIndex();
    }

    function getRandomElement<T>(array: T[]): T | undefined {
      if(array.length === 0) return undefined;
      const randomIndex = Math.floor(Math.random() * array.length);
      return array[randomIndex];
    }

    function getRandomPosition(params: {leftRatio?: number, topRatio?: number} = {}) {
      const canvas = renderer.renderingCanvas.canvas;
      if(params.leftRatio === undefined) params.leftRatio = Math.random();
      if(params.topRatio === undefined) params.topRatio = Math.random();
      return {
        left: params.leftRatio * (canvas.width / renderer.renderingScaleFactor),
        top: params.topRatio * (canvas.height / renderer.renderingScaleFactor),
        orderIndex: getTopMostOrder(),
        scale: 1,
        flipped: false
      };
    }

    function getRandomEnumValue<T>(enumType: T): T[keyof T] | undefined {
      const enumValues = Object.values(enumType) as T[keyof T][];
      if(enumValues.length === 0) return undefined;
      const randomIndex = Math.floor(Math.random() * enumValues.length);
      return enumValues[randomIndex];
    }

    context.actions.tabsActions.setActiveTab(METypes.PanelTab.Text);

    context.actions.stateActions.setEnhance({
      contrast: 25,
      vignette: 40
    });

    // multi line test
    function textFullTest(runTest = false) {
      const id = itemsActions.generateId();
      itemsActions.addItem({
        id,
        text: 'Test Text',
        // 'Be sure to wear flowers\nin your hair\n\nSan Francisco',
        color: hexaToHsla('#0A84FF'),
        fontSize: ME_CONFIG.TEXT_TAB.MAX_FONT_SIZE,
        font: ME_CONFIG.AVAILABLE_FONTS[0],
        align: METypes.TextAlign.Center,
        fontFrame: METypes.FontFrame.White,
        transform: {...getRandomPosition({leftRatio: 0.1, topRatio: 0.5}), width: 0, height: 0, angleDegree: 0, hide: false}
      });

      if(runTest) {
        const clonedIds = [id];

        // Setup animations for original and cloned items
        const animations = new Animations(context, renderer);
        clonedIds.forEach(clonedId => animations.animateItem(clonedId));
      }
    }

    textFullTest(false);

    return;

    for(const availableFont of ME_CONFIG.AVAILABLE_FONTS) {
      itemsActions.addItem({
        id: itemsActions.generateId(),
        text: availableFont.family,
        color: getRandomElement(ME_CONFIG.COLORS),
        fontSize: 16,
        font: availableFont,
        align: getRandomEnumValue(METypes.TextAlign),
        fontFrame: getRandomEnumValue(METypes.FontFrame),
        transform: {...getRandomPosition(), width: 0.1, height: 0.1, angleDegree: 0, hide: false}
      });
    }

    itemsActions.addItem({
      id: itemsActions.generateId(),
      text: 'San Francisco',
      color: hexaToHsla('#33C759'),
      fontSize: 15,
      font: ME_CONFIG.AVAILABLE_FONTS[6],
      align: METypes.TextAlign.Center,
      fontFrame: METypes.FontFrame.White,
      transform: {left: 0, top: 0, width: 75, height: 20, angleDegree: 0, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
    });

    setTimeout(() => {
      itemsActions.addItem({
        id: itemsActions.generateId(),
        text: 'Test Test',
        color: hexaToHsla('#FE4438'),
        fontSize: 15,
        font: ME_CONFIG.AVAILABLE_FONTS[6],
        align: METypes.TextAlign.Center,
        fontFrame: METypes.FontFrame.No,
        transform: {left: 250, top: 300, width: 75, height: 20, angleDegree: 0, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
      });
    }, 3500);

    itemsActions.addItem({
      id: itemsActions.generateId(),
      text: 'لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ',
      color: hexaToHsla('#FE4438'),
      fontSize: 24,
      font: ME_CONFIG.AVAILABLE_FONTS[0],
      align: METypes.TextAlign.Left,
      fontFrame: METypes.FontFrame.Black,
      transform: {left: 150, top: 450, width: 75, height: 20, angleDegree: 10, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
    });

    itemsActions.addItem({
      id: itemsActions.generateId(),
      text: 'Telegram is great',
      color: hexaToHsla('#FE4438'),
      fontSize: 24,
      font: ME_CONFIG.AVAILABLE_FONTS[7],
      align: METypes.TextAlign.Left,
      fontFrame: METypes.FontFrame.Black,
      transform: {left: 250, top: 50, width: 75, height: 20, angleDegree: 0, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
    });

    itemsActions.addItem({
      id: itemsActions.generateId(),
      image: await MEHelpers.dataUrlToImageBitmap('/assets/img/emoji/1f432.png'),
      transform: {left: 500, top: 450, width: 60, height: 60, angleDegree: 0, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
    });

    itemsActions.addItem({
      id: itemsActions.generateId(),
      image: await MEHelpers.dataUrlToImageBitmap('/assets/img/emoji/1f436.png'),
      transform: {left: 300, top: 300, width: 40, height: 40, angleDegree: 0, orderIndex: getTopMostOrder(), scale: 1, flipped: false, hide: false}
    });
  }
}
