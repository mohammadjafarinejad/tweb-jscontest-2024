import {ColorHsla, hslaToString} from '../../../helpers/color';
import clamp from '../../../helpers/number/clamp';
import {MEHelpers} from './helpers';
import {ME_CONFIG} from '../config';
import {ImageProcessing, WebGLImageProcessing} from './imageProcessing';
import {METypes} from './types';

namespace RenderingUtils {
  type ContextType<T extends METypes.CanvasType> = T extends HTMLCanvasElement
  ? CanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext
  : T extends OffscreenCanvas
  ? OffscreenCanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext
  : never;

  export abstract class BaseCanvas<TCanvas extends METypes.CanvasType, TContext extends ContextType<TCanvas>> {
    protected _canvas: TCanvas;
    protected _ctx: TContext;
    private _rendering = false;
    private _eventHandlers: Array<() => void> = [];

    constructor(protected readonly _context: METypes.ContextType, canvas: TCanvas, contextId: '2d' | 'webgl' | 'webgl2') {
      this._canvas = canvas;
      const ctx = canvas.getContext(contextId);
      if(!ctx) {
        throw new Error('Context not available');
      }
      this._ctx = ctx as TContext;
    }

    protected _onResize?(w: number, h: number) : void;
    protected _onRender?() : Promise<void>;

    get canvas() {
      return this._canvas;
    }

    get ctx() {
      return this._ctx;
    }

    render(silentRender: boolean = false): Promise<void> {
      if(!this._onRender) return Promise.resolve();
      if(!this._rendering) {
        this._rendering = true;
        return new Promise(resolve => {
          requestAnimationFrame(() => this._handleRender(silentRender, resolve));
        });
      }
      return Promise.resolve();
    }

    private async _handleRender(silentRender: boolean, resolve: () => void) {
      await this._onRender();
      if(!silentRender) this._emitOnRendered();
      this._rendering = false;
      resolve();
    }

    onRendered(listener: () => void) {
      this._eventHandlers.push(listener);
    }

    removeEventListener(listener: () => void) {
      this._eventHandlers = this._eventHandlers.filter(l => l !== listener);
    }

    setSize(arg1: METypes.Geo.Dimensions | number | METypes.CanvasType, arg2?: number) {
      if(typeof arg1 === 'number' && typeof arg2 === 'number') {
        this._canvas.width = arg1;
        this._canvas.height = arg2;
      } else if(arg1 instanceof HTMLCanvasElement || arg1 instanceof OffscreenCanvas) {
        this._canvas.width = arg1.width;
        this._canvas.height = arg1.height;
      }
      else if(typeof arg1 === 'object' && 'width' in arg1 && 'height' in arg1) {
        this._canvas.width = arg1.width;
        this._canvas.height = arg1.height;
      }
      this._onResize?.(this._canvas.width, this._canvas.height);
    }

    _emitOnRendered() {
      this._eventHandlers.forEach(listener => listener());
    }
  }

  export function drawImage(ctx: METypes.CanvasContext2d, img: HTMLImageElement) {
    const canvas = ctx.canvas;
    const sub = {x: 0, y: 0, width: img.width, height: img.height};
    const dest = {x: 0, y: 0, width: canvas.width, height: canvas.height};

    // if(options.cropSettings) {
    //   sub.width = img.width * options.cropSettings.widthRatio;
    //   sub.height = img.height * options.cropSettings.heightRatio;
    //   sub.x = img.width * options.cropSettings.leftRatio;
    //   sub.y = img.height * options.cropSettings.topRatio;

    //   if(options.cropSettings.flipHorizontal) {
    //     ctx.translate(dest.width, 0);
    //     ctx.scale(-1, 1);
    //     // ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height); // Draw flipped image
    //   }
    // }

    ctx.drawImage(img, sub.x, sub.y, sub.width, sub.height, dest.x, dest.y, dest.width, dest.height);
  }

  export function clearFull(ctx: METypes.CanvasContext2d) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  export function cleanAndClear(ctx: METypes.CanvasContext2d) {
    ctx.resetTransform();
    clearFull(ctx);
    ctx.save();
  }

  export function drawRoundedRect(ctx: METypes.CanvasContext2d, rect: METypes.Geo.CoordinateRect, radii: METypes.Geo.Corners | number) {
    const {x, y, width, height} = rect;
    let topLeft, topRight, bottomRight, bottomLeft;

    if(typeof radii === 'number') {
      topLeft = topRight = bottomRight = bottomLeft = radii;
    } else {
      ({topLeft, topRight, bottomRight, bottomLeft} = radii);
    }

    ctx.save();
    ctx.beginPath();

    // Top-left corner
    ctx.moveTo(x + topLeft, y);
    ctx.lineTo(x + width - topRight, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + topRight);

    // Top-right corner
    ctx.lineTo(x + width, y + height - bottomRight);
    ctx.quadraticCurveTo(x + width, y + height, x + width - bottomRight, y + height);

    // Bottom-right corner
    ctx.lineTo(x + bottomLeft, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - bottomLeft);

    // Bottom-left corner
    ctx.lineTo(x, y + topLeft);
    ctx.quadraticCurveTo(x, y, x + topLeft, y);

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  export function getPositionInCanvas(sourceCanvas: HTMLCanvasElement, targetCanvas: METypes.CanvasType, absoluteX: number, absoluteY: number) {
    const sourceRect = sourceCanvas.getBoundingClientRect();

    // Calculate position relative to the target canvas
    const relativeX = (absoluteX - sourceRect.left) * (targetCanvas.width / sourceCanvas.width);
    const relativeY = (absoluteY - sourceRect.top) * (targetCanvas.height / sourceCanvas.height);

    return {x: relativeX, y: relativeY};
  }

  // TODO: calculateBasePixelRatio for all items

  export function calculateStickerSizeInPixels(
    canvas: METypes.CanvasType,
    stickerWidth: number,
    stickerHeight: number,
    sizeRatio: number
  ): METypes.Geo.Dimensions {
    const {width, height} = canvas;
    const minDimension = Math.min(width, height);

    const targetSize = sizeRatio * minDimension;

    // Calculate the scale factor to reach the target size
    const widthRatio = targetSize / stickerWidth;
    const heightRatio = targetSize / stickerHeight;
    const scaleFactor = Math.min(widthRatio, heightRatio);

    // Scale the sticker dimensions
    const scaledStickerWidth = stickerWidth * scaleFactor;
    const scaledStickerHeight = stickerHeight * scaleFactor;

    return {
      width: scaledStickerWidth,
      height: scaledStickerHeight
    };
  }

  export function calculateFontSizeInPixels(
    canvas: METypes.CanvasType,
    selectedFontSize: number,
    minSize: number,
    maxSize: number,
    sizeRatio: number
  ): number {
    const {width, height} = canvas;
    const minDimension = Math.min(width, height);

    // Calculate the actual Font size in pixels based on the selected size and the min/max brush sizes
    const relativeBrushSize = minDimension * sizeRatio;
    const fontSizeRatio = (selectedFontSize - minSize) / (maxSize - minSize);
    const fontSizeInPixels = relativeBrushSize * fontSizeRatio;

    return Math.floor(fontSizeInPixels);
  }

  export function calculateBrushSizeInPixels(
    canvas: METypes.CanvasType,
    selectedBrushSize: number,
    minBrushSize: number,
    maxBrushSize: number,
    sizeRatio: number
  ): number {
    const {width, height} = canvas;
    const minDimension = Math.min(width, height);

    // Calculate the actual brush size in pixels based on the selected size and the min/max brush sizes
    const relativeBrushSize = minDimension * sizeRatio;
    const brushSizeRatio = (selectedBrushSize - minBrushSize) / (maxBrushSize - minBrushSize);
    const brushSizeInPixels = relativeBrushSize * brushSizeRatio;

    return brushSizeInPixels;
  }
}

namespace RenderingUtils.MultiLayer {
  export class Layer<TContext extends METypes.CanvasContext> {
    private _canvas: OffscreenCanvas;
    private _context: TContext;
    private _order: number;
    private _opacity: number;

    constructor(canvas: OffscreenCanvas, context: TContext, order: number, opacity: number = 1) {
      this._canvas = canvas;
      this._context = context;
      this._order = order;
      this._opacity = opacity;
    }

    setRenderOpacity(opacity: number) {
      if(opacity < 0 || opacity > 1) {
        throw new Error('Opacity must be between 0 and 1.');
      }
      this._opacity = opacity;
    }

    getOpacity() {
      return this._opacity;
    }

    getCanvas() {
      return this._canvas;
    }

    getContext() {
      return this._context;
    }

    getOrder(): number {
      return this._order;
    }
  }

  export class Manager {
    private _layers: Layer<any>[] = [];
    private _width: number;
    private _height: number;
    private _bufferCanvas: OffscreenCanvas;
    private _bufferContext: OffscreenCanvasRenderingContext2D;

    constructor(width: number, height: number) {
      this._width = width;
      this._height = height;
      this._bufferCanvas = new OffscreenCanvas(width, height);
      this._bufferContext = this._bufferCanvas.getContext('2d', {alpha: true}) as OffscreenCanvasRenderingContext2D;
    }

    getSize() : METypes.Geo.Dimensions {
      return {width: this._width, height: this._height};
    }

    createLayer<T extends METypes.CanvasContext>(order: number, type: '2d' | 'webgl' | 'webgl2', alpha: boolean = true) {
      if(this._layers.some(layer => layer.getOrder() === order)) {
        throw new Error(`Layer with order ${order} already exists.`);
      }

      const canvas = new OffscreenCanvas(this._width, this._height);
      let context: METypes.CanvasContext;

      switch(type) {
        case '2d':
          context = canvas.getContext(type, {alpha}) as OffscreenCanvasRenderingContext2D;
          (context as OffscreenCanvasRenderingContext2D).imageSmoothingEnabled = false;
          break;
        case 'webgl':
          context = canvas.getContext(type, {alpha, antialias: false}) as WebGLRenderingContext;
          break;
        case 'webgl2':
          context = canvas.getContext(type, {alpha, antialias: false}) as WebGL2RenderingContext;
          break;
      }

      if(!context) {
        throw new Error(`Cannot create canvas context. type:${type}`);
      }

      const newCanvasLayer = new Layer<T>(canvas, context as T, order, 1);
      this._layers.push(newCanvasLayer);
      this._sortLayers();
      return newCanvasLayer;
    }

    removeLayer(layer: Layer<any>): void {
      this._layers = this._layers.filter(x => x !== layer);
    }

    removeAll() {
      this._layers = [];
    }

    mergeLayers(options: {angleDegree?: number, minLayerOrder?: number; maxLayerOrder?: number;} = {}) {
      const {angleDegree, minLayerOrder, maxLayerOrder} = options;

      this._bufferContext.resetTransform();
      this._bufferContext.clearRect(0, 0, this._width, this._height);

      if(angleDegree !== undefined && angleDegree !== 0) {
        const angleRadians = angleDegree * (Math.PI / 180);
        const centerX = this._width / 2;
        const centerY = this._height / 2;
        this._bufferContext.translate(centerX, centerY);
        this._bufferContext.rotate(angleRadians);
        this._bufferContext.translate(-centerX, -centerY);
      }

      for(const layer of this._layers) {
        const layerOrder = layer.getOrder();
        if((minLayerOrder === undefined || layerOrder >= minLayerOrder) &&
          (maxLayerOrder === undefined || layerOrder <= maxLayerOrder)) {
          this._bufferContext.globalAlpha = layer.getOpacity();
          this._bufferContext.drawImage(layer.getCanvas(), 0, 0);
        }
      }

      return this._bufferCanvas;
    }

    private _sortLayers(): void {
      this._layers.sort((a, b) => a.getOrder() - b.getOrder());
    }
  }
}

class BackgroundLayer {
  private _webgl: WebGLImageProcessing;

  constructor(private readonly _layer: RenderingUtils.MultiLayer.Layer<WebGLRenderingContext>, image: HTMLImageElement) {
    if(this._webgl) throw new Error();
    this._webgl = new WebGLImageProcessing(this._layer.getContext());
    this._webgl.create(image);
  }

  get canvas() {
    return this._layer.getCanvas();
  }

  render(enhanceSettings: METypes.EnhanceSettings) {
    this._webgl.draw(enhanceSettings);
  }
}

namespace DrawLayer {
  export class Layers {
    private readonly _brush = new Brush();
    private _stabilizer: Stabilizer;
    private _config = {
      color: {h: 0, l: 1, s: 0, a: 1} as ColorHsla,
      toolType: METypes.DrawTool.Pen,
      stabilizerLevel: 0.5,
      stabilizerWeight: 0.5,
      brushSizeInPixel: 0,
      opacity: 1,
      paintingKnockout: false
    }
    private _blurredImage: ImageBitmap;
    private _blurringImage = false;

    get brushSizeInPixel() {
      return this._config.brushSizeInPixel;
    }

    constructor(
      readonly mainLayer: RenderingUtils.MultiLayer.Layer<OffscreenCanvasRenderingContext2D>,
      readonly tempLayer: RenderingUtils.MultiLayer.Layer<OffscreenCanvasRenderingContext2D>,
      // ? Manually call _onRender after render due to delay from Stabilizer
      private readonly _onRender: () => void,
      private readonly _getLayersToBlurImage: () => OffscreenCanvas
    ) {}

    updateBrush(
      drawTab: METypes.ContextType['store']['tabs']['drawTab'],
      drawTabActions: METypes.ContextType['actions']['drawTabActions']) {
      const drawToolConfig = this._getDrawToolConfig(drawTab.selectedToolType);
      const selectedTool = drawTabActions.selectedTool();
      const brushSize = RenderingUtils.calculateBrushSizeInPixels(this.mainLayer.getCanvas(),
        selectedTool.size,
        ME_CONFIG.DRAW_TAB.MIN_BRUSH_SIZE,
        ME_CONFIG.DRAW_TAB.MAX_BRUSH_SIZE,
        ME_CONFIG.RENDER.BRUSH_SIZE_RATIO
      ) * (drawTabActions.isEraser() ? 2 : 1);

      const paintingKnockout = drawTabActions.isEraser();
      this._config = {
        toolType: drawTab.selectedToolType,
        color: selectedTool.color,
        opacity: drawToolConfig.opacity,
        brushSizeInPixel: brushSize,
        paintingKnockout,
        stabilizerLevel: drawToolConfig.level,
        stabilizerWeight: drawToolConfig.weight
      };
      const ctx = paintingKnockout ? this.mainLayer.getContext() : this.tempLayer.getContext();
      ctx.resetTransform();
      this._brush.setCtx(ctx);
      ctx.globalCompositeOperation = paintingKnockout ? 'destination-out' : 'source-over';
      if(!paintingKnockout) {
        // if tool is not eraser reset 'globalCompositeOperation' for other Draw Tools like Neon
        this.mainLayer.getContext().globalCompositeOperation = 'source-over';
      }
      this.tempLayer.setRenderOpacity(this._config.opacity);
      if(!drawTabActions.isBlur()) {
        this._blurredImage = null;
      }

      if(drawTabActions.isBlur() && !this._blurredImage && !this._blurringImage) {
        const image = this._getLayersToBlurImage();
        this._blurringImage = true;
        const avgSize = Math.max(image.width, image.height);
        const blurQuality = clamp(256 / avgSize, 0, 1);
        ImageProcessing.Filters.gaussianBlur(image, 5, blurQuality).then(x => {
          this._blurringImage = false;
          this._blurredImage = x;
        });
      }
      this._brush.setConfig({
        drawFunction: drawToolConfig.drawFunction,
        flow: drawToolConfig.flow,
        spacing: drawToolConfig.spacing,
        size: brushSize,
        color: hslaToString(selectedTool.color),
        angle: 0
      });
    }

    onMouseDown(pos: {x: number, y: number}) {
      if(this._stabilizer) {
        this._stabilizer.dispose();
        this._stabilizer = undefined;
      }

      this._stabilizer = new Stabilizer({
        down: (x, y, scale) => {
          this._brush.down(x, y, scale);
          this._onRender();
        },
        move: (x, y, scale) => {
          this._brush.move(x, y, scale);
          this._onRender();
        },
        up: (x, y, scale) => {
          this._brush.up(x, y, scale);
          if(this._config.toolType === METypes.DrawTool.Arrow) {
            // Send params before stabilizer get removed
            this._drawArrowHead(this._stabilizer.getParamTable(), x, y);
          }

          if(this._config.toolType !== METypes.DrawTool.Eraser) {
            // reset 'globalCompositeOperation' to default, to avoid problem on undo-redo
            const ctx = this.mainLayer.getContext();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = this._config.opacity;
            ctx.resetTransform();
            ctx.drawImage(this.tempLayer.getCanvas(), 0, 0);
            ctx.globalAlpha = 1;
            RenderingUtils.cleanAndClear(this.tempLayer.getContext());
          }
          this._onRender();
          this._stabilizer = null;
        },
        interval: 5,
        pressure: 1,
        level: this._config.stabilizerLevel,
        weight: this._config.stabilizerWeight,
        x: pos.x,
        y: pos.y
      });
    }

    onMouseMove(pos: {x: number, y: number}) {
      if(!this._stabilizer) return;
      this._stabilizer.move(pos.x, pos.y, 1);
    }

    onMouseUp(pos: {x: number, y: number}) {
      if(!this._stabilizer) return;
      this._stabilizer.up(pos.x, pos.y, 1);
    }

    private _getDrawToolConfig(drawTool: METypes.DrawTool) {
      const defaultSetting = {
        flow: 1,
        opacity: 1,
        spacing: 0.01,
        level: 7,
        weight: 0.4
      };
      switch(drawTool) {
        case METypes.DrawTool.Brush:
          return {
            drawFunction: this._drawBrush.bind(this),
            flow: 1,
            opacity: 0.5,
            spacing: 0.01,
            level: 7,
            weight: 0.4
          };
        case METypes.DrawTool.Neon:
          return {
            ...defaultSetting,
            drawFunction: this._drawNeon.bind(this)
          };
        case METypes.DrawTool.Blur:
          return {
            ...defaultSetting,
            drawFunction: this._drawBlur.bind(this)
          };
        case METypes.DrawTool.Arrow:
          return {
            ...defaultSetting,
            drawFunction: null
          };
        case METypes.DrawTool.Eraser:
          return {
            drawFunction: null,
            flow: 1,
            opacity: 1,
            spacing: 0.01,
            level: 5,
            weight: 0.25
          };
        default:
          return {
            ...defaultSetting,
            drawFunction: null
          }
      }
    }

    private _drawArrowHead(params: Param[], x: number, y: number) {
      if(params.length < 2) {
        throw new Error('At least two points are required to draw an arrowhead');
      }

      // Add the last brush point to params for direction calculation
      params.push({...this._brush.last, pressure: 1});

      // Calculate the weighted average direction
      let sumWeights = 0;
      let weightedDx = 0;
      let weightedDy = 0;

      for(let i = 1; i < params.length; i++) {
        const {x: x1, y: y1} = params[i - 1];
        const {x: x0, y: y0} = params[i];

        const weight = i / params.length;
        sumWeights += weight;

        weightedDx += weight * (x0 - x1);
        weightedDy += weight * (y0 - y1);
      }

      const avgDx = weightedDx / sumWeights;
      const avgDy = weightedDy / sumWeights;

      const angle = Math.atan2(-avgDy, -avgDx);
      const arrowSize = 3 * this._brush.config.size;
      const arrowAngle = Math.PI / 6;
      const ctx = this._brush.ctx;

      ctx.strokeStyle = this._brush.config.color;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.lineWidth = this._brush.config.size;

      // Draw the arrow lines
      ctx.moveTo(x, y);
      ctx.lineTo(
        x - arrowSize * Math.cos(angle - arrowAngle),
        y - arrowSize * Math.sin(angle - arrowAngle)
      );

      ctx.moveTo(x, y);
      ctx.lineTo(
        x - arrowSize * Math.cos(angle + arrowAngle),
        y - arrowSize * Math.sin(angle + arrowAngle)
      );
      ctx.stroke();
    }

    private _drawNeon(size: number) {
      const ctx = this._brush.ctx;
      const ctxShadow = this.mainLayer.getContext();

      const halfSize = size * 0.5;
      ctx.fillStyle = 'white';
      ctx.globalAlpha = this._brush.config.flow;
      ctx.beginPath();
      ctx.arc(halfSize, halfSize, size * 0.3, 0, this._brush.ONE);
      ctx.closePath();
      ctx.fill();

      ctxShadow.save();
      ctxShadow.shadowBlur = 12;
      ctxShadow.shadowColor = this._brush.config.color;
      ctxShadow.resetTransform();
      ctxShadow.translate(this._brush.position.x, this._brush.position.y);
      ctxShadow.fillStyle = this._brush.config.color;
      ctxShadow.globalAlpha = this._brush.config.flow;
      ctxShadow.beginPath();
      ctxShadow.arc(halfSize, halfSize, size * 0.35, 0, this._brush.ONE);
      ctxShadow.closePath();
      ctxShadow.fill();
      ctxShadow.resetTransform();
      ctxShadow.restore();
    }

    private _drawBlur(size: number) {
      if(!this._blurredImage) return;
      const ctx = this._brush.ctx;
      const halfSize = size/2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(halfSize, halfSize, halfSize, 0, this._brush.ONE);
      ctx.closePath();
      ctx.clip();
      ctx.resetTransform();
      ctx.drawImage(this._blurredImage, 0, 0);
      ctx.restore();
    }

    private _drawBrush(size: number): void {
      const ctx = this._brush.ctx;
      if(!ctx) return;

      const halfSize = size * 0.5;
      ctx.fillStyle = this._brush.config.color;
      ctx.globalAlpha = this._brush.config.flow;

      ctx.beginPath();
      ctx.ellipse(halfSize, halfSize, halfSize * 0.5, halfSize, 0, 0, this._brush.ONE);
      ctx.closePath();
      ctx.fill();
    }
  }

  interface StabilizerOptions {
    down?: (x: number, y: number, pressure: number) => void;
    move: (x: number, y: number, pressure: number) => void;
    up?: (x: number, y: number, pressure: number) => void;
    level: number;
    weight: number;
    x: number;
    y: number;
    pressure: number;
    interval?: number;
  }

  interface Param {x: number; y: number; pressure: number}

  class Brush {
    private _ctx: METypes.CanvasContext2d;
    private _config = {
      color: '#000',
      flow: 1,
      size: 10,
      spacing: 0.2,
      angle: 0 // radian unit
    };

    private rotateToDirection: boolean = false;
    private normalSpread: number = 0;
    private tangentSpread: number = 0;
    private image: HTMLImageElement | null = null;
    private transformedImage: HTMLCanvasElement | null = null;
    private transformedImageIsDirty: boolean = true;
    private imageRatio: number = 1;
    private delta: number = 0;
    private prevX: number = 0;
    private prevY: number = 0;
    private lastX: number = 0;
    private lastY: number = 0;
    private dir: number = 0;
    private prevScale: number = 0;
    private _drawFunction: (size: number) => void = this._drawCircle;
    private reserved: { x: number; y: number; scale: number } | null = null;
    private _dirtyRect: { x: number; y: number; width: number; height: number } = {x: 0, y: 0, width: 0, height: 0};
    private _drawTransform = {x: 0, y: 0};

    private _lastTimestamp = 0;
    private _extraSize = 0;
    private _maxSize = 0.2;
    private _sizeChangeRate = 0.5;
    private _moveThreshold = 0.07;

    private random: () => number = Math.random;

    readonly ONE: number = Math.PI * 2;
    private readonly QUARTER: number = Math.PI * 0.5;
    private readonly toRad: number = Math.PI / 180;
    private readonly toDeg: number = 1 / this.toRad;

    constructor() {}

    get config() {
      return this._config;
    }

    get position() {
      return this._drawTransform;
    }

    get last() {
      return {x: this.lastX, y: this.lastY};
    }

    get ctx() {
      return this._ctx;
    }

    setCtx(ctx: METypes.CanvasContext2d) {
      this._ctx = ctx;
    }

    setConfig(params: {
      drawFunction?: (size: number) => void,
      spacing: number;
      size: number;
      angle: number;
      color: string;
      flow: number;
    }) {
      const {drawFunction, ...rest} = params;
      this._drawFunction = params.drawFunction ?? this._drawCircle;
      this._config = {
        ...this._config,
        ...rest
      }
      if(params.size !== undefined) {
        this._config.size = params.size < 1 ? 1 : params.size;
      }
      if(params.angle !== undefined) {
        this._config.angle = params.angle * this.toRad;
      }
      if(params.spacing !== undefined) {
        this._config.spacing = params.spacing < 0.01 ? 0.01 : params.spacing;
      }
    }

    setRotateToDirection(value: boolean): void {
      this.rotateToDirection = value;
    }

    setNormalSpread(value: number): void {
      this.normalSpread = value;
    }

    setTangentSpread(value: number): void {
      this.tangentSpread = value;
    }

    private _drawCircle(size: number): void {
      if(!this._ctx) return;
      const halfSize = size * 0.5;
      this._ctx.fillStyle = this._config.color;
      this._ctx.globalAlpha = this._config.flow;
      this._ctx.beginPath();
      this._ctx.arc(halfSize, halfSize, halfSize, 0, this.ONE);
      this._ctx.closePath();
      this._ctx.fill();
    }

    setImage(value: HTMLImageElement | null): void {
      if(value == null) {
        this.transformedImage = this.image = null;
        this.imageRatio = 1;
        this._drawFunction = this._drawCircle;
      } else if(value != this.image) {
        this.image = value;
        this.imageRatio = this.image.height / this.image.width;
        this.transformedImage = document.createElement('canvas');
        this._drawFunction = this._drawImage;
        this.transformedImageIsDirty = true;
      }
    }

    private spreadRandom(): number {
      return this.random() - 0.5;
    }

    private drawReserved(): void {
      if(this.reserved != null) {
        this._drawTo(this.reserved.x, this.reserved.y, this.reserved.scale);
        this.reserved = null;
      }
    }

    private appendDirtyRect(x: number, y: number, width: number, height: number): void {
      if(!(width && height)) return;
      const dxw = this._dirtyRect.x + this._dirtyRect.width;
      const dyh = this._dirtyRect.y + this._dirtyRect.height;
      const xw = x + width;
      const yh = y + height;
      const minX = this._dirtyRect.width ? Math.min(this._dirtyRect.x, x) : x;
      const minY = this._dirtyRect.height ? Math.min(this._dirtyRect.y, y) : y;
      this._dirtyRect.x = minX;
      this._dirtyRect.y = minY;
      this._dirtyRect.width = Math.max(dxw, xw) - minX;
      this._dirtyRect.height = Math.max(dyh, yh) - minY;
    }

    private transformImage(): void {
      if(!this.transformedImage || !this.image || !this._ctx) return;

      this.transformedImage.width = this._config.size;
      this.transformedImage.height = this._config.size * this.imageRatio;
      const brushContext = this.transformedImage.getContext('2d');
      if(!brushContext) return;

      brushContext.clearRect(0, 0, this.transformedImage.width, this.transformedImage.height);
      brushContext.drawImage(this.image, 0, 0, this.transformedImage.width, this.transformedImage.height);
      brushContext.globalCompositeOperation = 'source-in';
      brushContext.fillStyle = this._config.color;
      brushContext.globalAlpha = this._config.flow;
      brushContext.fillRect(0, 0, this.transformedImage.width, this.transformedImage.height);
    }

    private _drawImage(size: number): void {
      if(!this._ctx || !this.transformedImage) return;

      if(this.transformedImageIsDirty) this.transformImage();
      try {
        this._ctx.drawImage(this.transformedImage, 0, 0, size, size * this.imageRatio);
      } catch(e) {
        this._drawCircle(size);
      }
    }

    private _getSize(scale: number = 1) {
      return (this._config.size * scale) + this._extraSize;
    }

    private _drawTo(x: number, y: number, scale: number): void {
      if(!this._ctx) return;

      const scaledSize = this._getSize(scale)
      const nrm = this.dir + this.QUARTER;
      const nr = this.normalSpread * scaledSize * this.spreadRandom();
      const tr = this.tangentSpread * scaledSize * this.spreadRandom();
      const ra = this.rotateToDirection ? this._config.angle + this.dir : this._config.angle;
      const width = scaledSize;
      const height = width * this.imageRatio;
      const boundWidth = Math.abs(height * Math.sin(ra)) + Math.abs(width * Math.cos(ra));
      const boundHeight = Math.abs(width * Math.sin(ra)) + Math.abs(height * Math.cos(ra));
      x += Math.cos(nrm) * nr + Math.cos(this.dir) * tr;
      y += Math.sin(nrm) * nr + Math.sin(this.dir) * tr;
      this._ctx.save();
      this._ctx.translate(x, y);
      this._ctx.rotate(ra);
      this._ctx.translate(-(width * 0.5), -(height * 0.5));
      this._drawTransform = {
        x: x + -(width * 0.5),
        y: y + -(height * 0.5)
      };
      this._drawFunction(width);
      this._ctx.restore();
      this.appendDirtyRect(x - (boundWidth * 0.5), y - (boundHeight * 0.5), boundWidth, boundHeight);
    }

    down(x: number, y: number, scale: number, noDraw: boolean = false): void {
      if(this._ctx == null) throw new Error('brush needs the context');
      this.dir = 0;
      this._extraSize = 0;
      this._ctx.resetTransform();
      this._dirtyRect = {x: 0, y: 0, width: 0, height: 0};
      if(scale > 0) {
        if(this.rotateToDirection || this.normalSpread != 0 || this.tangentSpread != 0)
          this.reserved = {x, y, scale};
        else if(!noDraw)
          this._drawTo(x, y, scale);
      }
      this.delta = 0;
      this.lastX = this.prevX = x;
      this.lastY = this.prevY = y;
      this.prevScale = scale;

      this._lastTimestamp = Date.now();
    }

    move(x: number, y: number, scale: number): void {
      if(this._ctx == null) throw new Error('brush needs the context');
      if(scale <= 0) {
        this.delta = 0;
        this.prevX = x;
        this.prevY = y;
        this.prevScale = scale;
        return;
      }

      const dx = x - this.prevX;
      const dy = y - this.prevY;
      const ds = scale - this.prevScale;
      const d = Math.sqrt(dx * dx + dy * dy);
      this.prevX = x;
      this.prevY = y;
      this.delta += d;
      const midScale = (this.prevScale + scale) * 0.5;
      const drawSpacing = this._getSize() * this._config.spacing * midScale;
      let ldx = x - this.lastX;
      let ldy = y - this.lastY;

      const now = Date.now();
      const speed = Math.hypot(ldx, ldy) / (now - this._lastTimestamp);
      this._lastTimestamp = now;
      const sizeDelta = speed * (speed > this._moveThreshold ? this._sizeChangeRate : -1);
      this._extraSize = clamp(this._extraSize + sizeDelta, 0, this._config.size * this._maxSize);

      const ld = Math.sqrt(ldx * ldx + ldy * ldy);
      this.dir = Math.atan2(ldy, ldx);
      if(ldx || ldy) this.drawReserved();

      if(drawSpacing < 0.5) {
        this.prevScale = scale;
      }
      if(this.delta < drawSpacing) {
        this.prevScale = scale;
        return;
      }
      const scaleSpacing = ds * (drawSpacing / this.delta);

      if(ld < drawSpacing) {
        this.lastX = x;
        this.lastY = y;
        this._drawTo(this.lastX, this.lastY, scale);
        this.delta -= drawSpacing;
      } else {
        while(this.delta >= drawSpacing) {
          ldx = x - this.lastX;
          ldy = y - this.lastY;
          const tx = Math.cos(this.dir);
          const ty = Math.sin(this.dir);
          this.lastX += tx * drawSpacing;
          this.lastY += ty * drawSpacing;
          this.prevScale += scaleSpacing;
          this._drawTo(this.lastX, this.lastY, this.prevScale);
          this.delta -= drawSpacing;
        }
      }
      this.prevScale = scale;
    }

    up(x: number, y: number, scale: number) {
      this.dir = Math.atan2(y - this.lastY, x - this.lastX);
      this.drawReserved();
      return this._dirtyRect;
    }
  }

  class Stabilizer {
    private _follow: number;
    private _paramTable: Param[];
    private _current: Param;
    private _first: Param;
    private _last: Param;
    private _upCalled: boolean;
    private _interval: number;
    private _callbacks: {
      down?: (x: number, y: number, pressure: number) => void;
      move: (x: number, y: number, pressure: number) => void;
      up?: (x: number, y: number, pressure: number) => void;
    };

    constructor(options: StabilizerOptions) {
      const {down, move, up, level, weight, x, y, pressure, interval} = options;
      this._follow = 1 - Math.min(0.95, Math.max(0, weight));
      this._paramTable = [];
      this._current = {x, y, pressure};
      this._interval = interval || 5;

      for(let i = 0; i < level; ++i) {
        this._paramTable.push({x, y, pressure});
      }

      this._first = this._paramTable[0];
      this._last = this._paramTable[this._paramTable.length - 1];
      this._upCalled = false;

      this._callbacks = {
        down,
        move,
        up
      };

      if(down != null) {
        down(x, y, pressure);
      }

      window.setTimeout(this._moveTimeout.bind(this), this._interval);
    }

    public getParamTable() {
      return this._paramTable;
    }

    public move(x: number, y: number, pressure: number) {
      this._current.x = x;
      this._current.y = y;
      this._current.pressure = pressure;
    }

    public up(x: number, y: number, pressure: number) {
      this._current.x = x;
      this._current.y = y;
      this._current.pressure = pressure;
      this._upCalled = true;
    }

    dispose() {
      if(this._interval) window.clearTimeout(this._interval);
    }

    private _dlerp(a: number, d: number, t: number): number {
      return a + d * t;
    }

    private _moveTimeout(justCalc?: boolean): number {
      let curr: { x: number; y: number; pressure: number };
      let prev: { x: number; y: number; pressure: number };
      let dx: number;
      let dy: number;
      let dp: number;
      let delta: number = 0;

      this._first.x = this._current.x;
      this._first.y = this._current.y;
      this._first.pressure = this._current.pressure;

      for(let i = 1; i < this._paramTable.length; ++i) {
        curr = this._paramTable[i];
        prev = this._paramTable[i - 1];

        dx = prev.x - curr.x;
        dy = prev.y - curr.y;
        dp = prev.pressure - curr.pressure;

        delta += Math.abs(dx);
        delta += Math.abs(dy);

        curr.x = this._dlerp(curr.x, dx, this._follow);
        curr.y = this._dlerp(curr.y, dy, this._follow);
        curr.pressure = this._dlerp(curr.pressure, dp, this._follow);
      }

      if(justCalc) {
        return delta;
      }

      if(this._upCalled) {
        while(delta > 1) {
          this._callbacks.move(this._last.x, this._last.y, this._last.pressure);
          delta = this._moveTimeout(true);
        }
        this._callbacks.up(this._last.x, this._last.y, this._last.pressure);
      } else {
        this._callbacks.move(this._last.x, this._last.y, this._last.pressure);
        window.setTimeout(this._moveTimeout.bind(this), this._interval);
      }
    }
  }
}

namespace ItemsLayer {
  export class Layer extends RenderingUtils.BaseCanvas<OffscreenCanvas, OffscreenCanvasRenderingContext2D> {
    constructor(context: METypes.ContextType, canvas: OffscreenCanvas) {
      super(context, canvas, '2d');
    }

    protected async _onRender() {
      RenderingUtils.cleanAndClear(this._ctx);
      const {store} = this._context;
      const {itemsActions, commonActions} = this._context.actions;
      const sortedItems = itemsActions.getAll().sort((a, b) => a.transform.orderIndex - b.transform.orderIndex);
      for(const item of sortedItems) {
        if(item.transform.hide) continue;
        this._ctx.resetTransform();
        if(itemsActions.isText(item)) {
          const isSelectedItem = store.common.selectedItemId === item.id;
          const textInfo = MultiLineText.drawText(this._ctx, item,
            isSelectedItem, store.common.edittingText?.caretInfo);
          itemsActions.updateTransform(item.id, {
            width: textInfo.width,
            height: textInfo.height
          });

          if(isSelectedItem) {
            // Solidjs remove empty strings from array
            textInfo.edittingInfo.linesArray = textInfo.edittingInfo.linesArray.map(x => x === '' ? '\n' : x);
            commonActions.setEdittingInfo(textInfo.edittingInfo);
          }
        }
        else if(itemsActions.isSticker(item)) {
          await this._drawSticker(item);
        }
      }
    }

    private async _drawSticker(item: METypes.Item.StickerItem) {
      const ctx = this._ctx;
      const {transform} = item;
      const width = transform.width * transform.scale;
      const height = transform.height * transform.scale;

      ctx.resetTransform();
      ctx.save();

      // Translate to the item's center
      ctx.translate(transform.left + width / 2, transform.top + height / 2);

      // Rotate the context
      ctx.rotate(transform.angleDegree * Math.PI / 180);

      const scaleX = transform.flipped ? -1 : 1;
      ctx.scale(scaleX, 1);

      // Draw the image centered around the origin
      ctx.drawImage(item.image, -width / 2, -height / 2, width, height);

      // Restore the context to its original state
      ctx.restore();
    }
  }
}

namespace ItemsLayer.MultiLineText {
  /**
   * This function will insert spaces between words in a line in order
   * to raise the line width to the box width.
   * The spaces are evenly spread in the line, and extra spaces (if any) are inserted
   * between the first words.
   *
   * It returns the justified text.
   */
  function justifyLine(params: {
  ctx: METypes.CanvasContext2d
  line: string
  spaceWidth: number
  spaceChar: string
  width: number
}) {
    const {ctx, line, spaceWidth, spaceChar, width} = params;
    const text = line.trim()
    const words = text.split(/\s+/)
    const numOfWords = words.length - 1

    if(numOfWords === 0) return text;

    // Width without spaces
    const lineWidth = ctx.measureText(words.join('')).width

    const noOfSpacesToInsert = (width - lineWidth) / spaceWidth
    const spacesPerWord = Math.floor(noOfSpacesToInsert / numOfWords)

    if(noOfSpacesToInsert < 1) return text

    const spaces = spaceChar.repeat(spacesPerWord)

    // Return justified text
    return words.join(spaces)
  }

  // Hair space character for precise justification
  const SPACE = '\u{200a}'

  function splitText(params: {
    ctx: METypes.CanvasContext2d,
    text: string
    justify: boolean
    width: number
  }): string[] {
    const {ctx, text, justify, width} = params;
    const textMap = new Map<string, number>()

    const measureText = (text: string): number => {
      let width = textMap.get(text)
      if(width !== undefined) {
        return width
      }

      width = ctx.measureText(text).width
      textMap.set(text, width)
      return width
    }

    const textArray: string[] = []
    const initialTextArray = text.split('\n')

    const spaceWidth = justify ? measureText(SPACE) : 0

    let index = 0
    let averageSplitPoint = 0
    for(const singleLine of initialTextArray) {
      let textWidth = measureText(singleLine)
      const singleLineLength = singleLine.length

      if(textWidth <= width) {
        textArray.push(singleLine)
        continue
      }

      let tempLine = singleLine

      let splitPoint
      let splitPointWidth
      let textToPrint = ''

      while(textWidth > width) {
        index++
        splitPoint = averageSplitPoint
        splitPointWidth =
          splitPoint === 0 ? 0 : measureText(singleLine.substring(0, splitPoint))

        // if(splitPointWidth === width) Nailed
        if(splitPointWidth < width) {
          while(splitPointWidth < width && splitPoint < singleLineLength) {
            splitPoint++
            splitPointWidth = measureText(tempLine.substring(0, splitPoint))
            if(splitPoint === singleLineLength) break
          }
        } else if(splitPointWidth > width) {
          while(splitPointWidth > width) {
            splitPoint = Math.max(1, splitPoint - 1)
            splitPointWidth = measureText(tempLine.substring(0, splitPoint))
            if(splitPoint === 1) break
          }
        }

        averageSplitPoint = Math.round(
          averageSplitPoint + (splitPoint - averageSplitPoint) / index
        )

        // Remove last character that was out of the box
        splitPoint--

        // Ensures a new line only happens at a space, and not amidst a word
        if(splitPoint > 0) {
          let tempSplitPoint = splitPoint
          if(tempLine.substring(tempSplitPoint, tempSplitPoint + 1) != ' ') {
            while(tempSplitPoint >= 0 && tempLine.substring(tempSplitPoint, tempSplitPoint + 1) != ' ') {
              tempSplitPoint--
            }
            if(tempSplitPoint > 0) {
              splitPoint = tempSplitPoint
            }
          }
        }

        if(splitPoint === 0) {
          splitPoint = 1
        }

        // Finally sets text to print
        textToPrint = tempLine.substring(0, splitPoint)

        textToPrint = justify ? justifyLine({ctx, line: textToPrint, spaceWidth, spaceChar: SPACE, width}) : textToPrint
        textArray.push(textToPrint)
        tempLine = tempLine.substring(splitPoint)
        textWidth = measureText(tempLine)
      }

      if(textWidth > 0) {
        textToPrint = justify ? justifyLine({ctx, line: tempLine, spaceWidth, spaceChar: SPACE, width}) : tempLine
        textArray.push(textToPrint)
      }
    }
    return textArray;
  }

  function getTextHeight(params: {
    ctx: METypes.CanvasContext2d
    text: string
    style: string
  }) {
    const {ctx, text, style} = params;
    const previousTextBaseline = ctx.textBaseline
    const previousFont = ctx.font

    ctx.textBaseline = 'bottom'
    ctx.font = style
    const {actualBoundingBoxAscent: height} = ctx.measureText(text)

    // Reset baseline
    ctx.textBaseline = previousTextBaseline
    ctx.font = previousFont

    return height
  }

  export function drawText(ctx: METypes.CanvasContext2d,
    item: METypes.Item.TextItem,
    createCaret: boolean,
    caretInfo?: METypes.CaretInfo
  ) {
    const fontSize = RenderingUtils.calculateFontSizeInPixels(ctx.canvas,
      item.fontSize,
      ME_CONFIG.TEXT_TAB.MIN_FONT_SIZE,
      ME_CONFIG.TEXT_TAB.MAX_FONT_SIZE,
      ME_CONFIG.RENDER.TEXT_SIZE_RATIO
    );
    const pixelRatio = fontSize / item.fontSize;
    const padding = item.fontFrame === METypes.FontFrame.White ? ME_CONFIG.RENDER.TEXT_FRAME_PADDING * pixelRatio : 0;
    const radius = ME_CONFIG.RENDER.TEXT_FRAME_BORDER_RADIUS * pixelRatio;
    const isEmpty = item.text.trim() === '';
    const VARIENT = 'normal';
    const text = isEmpty ? 'Add text' : item.text;

    const t = item.transform;
    const style = `${item.font.style} ${VARIENT} ${item.font.weight} ${fontSize}px ${item.font.family}`;
    ctx.font = style;

    const textCord = {
      txtY: -1,
      textAnchor: 0,
      maxWidth: -1,
      totalHeight: -1
    };

    ctx.textAlign = item.align;

    const textArray = splitText({
      ctx,
      text: text,
      justify: ME_CONFIG.RENDER.TEXT_JUSTIFY,
      width: ctx.canvas.width
    });

    const charHeight = item.font.lineHeight ? item.font.lineHeight : getTextHeight({ctx, text: 'M', style}) * 1.1;
    const vHeight = charHeight * (textArray.length - 1);

    const lineMetrics = textArray.map((txtline, index) => {
      txtline = txtline.trim();
      const measure = ctx.measureText(txtline);
      return {
        text: txtline,
        width: measure.width,
        height: charHeight
      };
    });

    textCord.maxWidth = Math.max(...lineMetrics.map(metric => metric.width)) + padding * 2;
    textCord.totalHeight = lineMetrics.reduce((sum, metric) => sum + metric.height, 0) + padding * 2;

    if(item.align === METypes.TextAlign.Right) {
      textCord.textAnchor = textCord.maxWidth - padding * 2;
      ctx.textAlign = 'right'
    } else if(item.align === METypes.TextAlign.Left) {
      textCord.textAnchor = 0;
      ctx.textAlign = 'left';
    } else {
      textCord.textAnchor = (textCord.maxWidth / 2) - padding;
      ctx.textAlign = 'center'
    }

    textCord.txtY = (textCord.totalHeight / 2 + fontSize / 2) - (vHeight / 2) - padding;
    ctx.textBaseline = 'bottom';

    ctx.resetTransform();

    ctx.translate(t.left + padding, t.top + padding);

    // move to center of text to rotate
    const centerX = textCord.maxWidth / 2 - padding;
    const centerY = textCord.totalHeight / 2 - padding;
    ctx.translate(centerX, centerY);
    ctx.rotate(t.angleDegree * Math.PI / 180);
    ctx.translate(-centerX, -centerY);

    const scaleX = t.flipped ? -1 : 1;
    ctx.scale(scaleX, 1);

    if(ME_CONFIG.RENDER.DEBUG_TEXT) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(-padding, -padding, textCord.maxWidth,  textCord.totalHeight);

      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(0, 0, textCord.maxWidth-padding*2,  textCord.totalHeight-padding*2);
    }

    if(isEmpty) {
      // textCord.textAnchor -= textCord.maxWidth / 2;
    }

    const selectedColor = hslaToString(item.color);
    ctx.fillStyle = isEmpty ? 'rgba(255, 255, 255, 0.5)' : selectedColor;
    if(!isEmpty && item.fontFrame === METypes.FontFrame.White) {
      RenderingUtils.drawRoundedRect(ctx, {
        x: -padding,
        y: -padding,
        width: textCord.maxWidth,
        height: textCord.totalHeight
      }, {
        topLeft: radius,
        topRight: radius,
        bottomLeft: radius,
        bottomRight: radius
      });
      ctx.fillStyle = 'white';
    }

    let edittingInfo: METypes.EdittingText;
    if(createCaret) {
      const defaultLine = textArray.length - 1;
      const defaultPosition = textArray[defaultLine]?.length - 1;

      const line = clamp(caretInfo?.line ?? defaultLine, 0, textArray.length-1);
      const position = caretInfo?.position ?? defaultPosition;

      edittingInfo = {
        mainText: item.text,
        linesArray: textArray,
        caretRect: {left: 0, top: 0, height: 0, width: 0},
        caretInfo: {
          color: ctx.fillStyle,
          line: defaultLine,
          position: defaultPosition // clamp(position, 0, textArray[line]?.length-1 || 0)
        }
      };
    }

    lineMetrics.forEach((metric, index) => {
      const textY = textCord.txtY + index * charHeight;
      if(!isEmpty && item.fontFrame === METypes.FontFrame.Black) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 6 * pixelRatio;
        ctx.strokeText(metric.text, textCord.textAnchor, textY);
      }
      if(edittingInfo && index === edittingInfo.caretInfo.line) {
        const line = edittingInfo.caretInfo.line;
        const position = edittingInfo.caretInfo.position;
        const textWidth = ctx.measureText(textArray[line].substring(0, position)).width;
        // const space = ctx.measureText('M').width;
        // console.log(textArray[line].substring(0, position));

        const caretWidth = 2 * pixelRatio;
        let left = textCord.textAnchor;
        if(item.align === METypes.TextAlign.Left) left += textWidth + padding * 2;
        else if(item.align === METypes.TextAlign.Right) left += 0;
        else left += textWidth / 2 + padding;

        edittingInfo.caretRect = {
          left,
          top: textY - charHeight,
          height: charHeight,
          width: caretWidth
        };
        ctx.fillRect( edittingInfo.caretRect.left,  edittingInfo.caretRect.top,  edittingInfo.caretRect.width,  edittingInfo.caretRect.height);
      }
      ctx.fillText(metric.text, textCord.textAnchor, textY);
    });

    return {
      width: textCord.maxWidth,
      height: textCord.totalHeight,
      edittingInfo
    };
  }
}

class RenderingCanvas extends RenderingUtils.BaseCanvas<HTMLCanvasElement, CanvasRenderingContext2D> {
  constructor(context: METypes.ContextType, canvas: HTMLCanvasElement) {
    super(context, canvas, '2d');
  }
}

export class CanvasRenderer {
  private _layerManager: RenderingUtils.MultiLayer.Manager;
  private _backgroundLayer: BackgroundLayer;
  private _drawLayers: DrawLayer.Layers;
  private _itemsLayer: ItemsLayer.Layer;
  readonly renderingCanvas: RenderingCanvas;
  private readonly _renderFrameThrottle = new MEHelpers.AsyncFrameThrottle( this._renderFull.bind(this));
  private _renderingCropSettings?: METypes.CropSettings;
  private _renderingScaleFactor = 0;

  get renderingScaleFactor() {
    return this._renderingScaleFactor;
  }

  constructor(
    private readonly _context: METypes.ContextType,
    private _previewElement: HTMLDivElement,
    private _onResizeRender: () => void,
    canvas: HTMLCanvasElement) {
    this.renderingCanvas = new RenderingCanvas(this._context, canvas);
  }

  async initialize(imageSrc: string) {
    const image = await MEHelpers.loadImage(imageSrc);
    const size = MEHelpers.Geo.resizeToMaxWidth(image, ME_CONFIG.MAX_WIDTH);
    image.width = size.width;
    image.height = size.height;

    this._layerManager = new RenderingUtils.MultiLayer.Manager(size.width, size.height);

    const backgroundLayer = this._layerManager.createLayer<WebGLRenderingContext>(0, 'webgl', false);
    this._backgroundLayer = new BackgroundLayer(backgroundLayer, image);

    const mainDrawLayer = this._layerManager.createLayer<OffscreenCanvasRenderingContext2D>(1, '2d');
    const tempDrawLayer = this._layerManager.createLayer<OffscreenCanvasRenderingContext2D>(2, '2d');
    this._drawLayers = new DrawLayer.Layers(mainDrawLayer, tempDrawLayer,
      () => {
        this._renderFrameThrottle.call();
      }, () => {
        return this._layerManager.mergeLayers({maxLayerOrder: 1});
      });

    const itemsLayer = this._layerManager.createLayer<OffscreenCanvasRenderingContext2D>(3, '2d');
    this._itemsLayer = new ItemsLayer.Layer(this._context, itemsLayer.getCanvas());

    this.onEnhanceSettingsChanged(true);
    await this.onItemsChanged(true);
    this.onDrawTabChanged(true);
    await this.onRenderingCanvasResized();
  }

  destroy() {
    this._layerManager.removeAll();
  }

  getCenterOfCanvas(): METypes.Geo.Point {
    return {
      x: this._backgroundLayer.canvas.width/2,
      y: this._backgroundLayer.canvas.height/2
    }
  }

  getStickerDefaultSize(width: number, height: number) {
    return RenderingUtils.calculateStickerSizeInPixels(this._backgroundLayer.canvas,
      width, height, ME_CONFIG.RENDER.STICKER_DEFAULT_SIZE_RATIO)
  }

  async getDrawLayerSnapshot() {
    const canvas = this._drawLayers.mainLayer.getCanvas() as any;
    return createImageBitmap(await canvas.convertToBlob());
    // const image = this._drawLayers.mainLayer.getCanvas().transferToImageBitmap();
    // this._drawLayers.mainLayer.getContext().drawImage(image, 0, 0);
    // return image;
  }

  async onHistoryUpdate(image?: ImageBitmap) {
    if(image) {
      const ctx = this._drawLayers.mainLayer.getContext();
      RenderingUtils.cleanAndClear(ctx);
      ctx.drawImage(image, 0, 0);
    }
    this.onEnhanceSettingsChanged(true);
    this.onDrawTabChanged(true);
    await this.onItemsChanged(true);
    this._renderFrameThrottle.call();
  }

  brushSizeInPixel() {
    return this._drawLayers.brushSizeInPixel;
  }

  onEnhanceSettingsChanged(silentRender: boolean = false) {
    this._backgroundLayer.render(this._context.store.state.enhanceSettings);
    if(!silentRender) this._renderFrameThrottle.call();
  }

  onDrawTabChanged(silentRender: boolean = false) {
    this._drawLayers.updateBrush(this._context.store.tabs.drawTab, this._context.actions.drawTabActions);
    if(!silentRender) this._renderFrameThrottle.call();
  }

  async onItemsChanged(silentRender: boolean = false) {
    await this._itemsLayer.render();
    if(!silentRender) this._renderFrameThrottle.call();
  }

  async onRenderingCanvasResized() {
    if(!this._layerManager) return false;
    const originalSize = this._layerManager.getSize();
    const widthRatio = this._renderingCropSettings ? this._renderingCropSettings.widthRatio : 1;
    const heightRatio = this._renderingCropSettings ? this._renderingCropSettings.heightRatio : 1;
    const rect = this._previewElement.getBoundingClientRect();
    const bestSize = MEHelpers.Geo.fitToContainer({
      width: originalSize.width * widthRatio,
      height: originalSize.height * heightRatio
    }, rect, ME_CONFIG.MAX_INCREASE_FACTOR)

    this._renderingScaleFactor = MEHelpers.Geo.getScaleFactor(bestSize, originalSize);
    this.renderingCanvas.setSize(bestSize);
    this._onResizeRender();
    await this._renderFrameThrottle.call();
    return true;
  }

  getCanvasBlob() {
    return new Promise<Blob>((resolve, reject) => {
      this.renderingCanvas.canvas.toBlob((blob) => {
        if(blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas is empty or toBlob failed.'));
        }
      });
    });
  }

  processRect(element: Element, angle: number, rect: METypes.Geo.Rect, type: 'clamp' | 'cutoff') {
    const elementRect = element.getBoundingClientRect();
    let newLeft = rect.left;
    let newTop = rect.top;
    let newWidth = rect.width;
    let newHeight = rect.height;

    if(type === 'clamp') {
      newWidth = clamp(rect.width, 0, elementRect.width);
      newHeight = clamp(rect.height, 0, elementRect.height);
      newLeft = clamp(rect.left, 0, elementRect.width - newWidth);
      newTop = clamp(rect.top, 0, elementRect.height - newHeight);
    } else if(type === 'cutoff') {
      const leftOverflow = Math.max(0, -rect.left);
      const topOverflow = Math.max(0, -rect.top);
      const rightOverflow = Math.max(0, rect.left + rect.width - elementRect.width);
      const bottomOverflow = Math.max(0, rect.top + rect.height - elementRect.height);

      newWidth = Math.max(0, rect.width - leftOverflow - rightOverflow);
      newHeight = Math.max(0, rect.height - topOverflow - bottomOverflow);
      newLeft = clamp(rect.left, 0, elementRect.width - newWidth);
      newTop = clamp(rect.top, 0, elementRect.height - newHeight);
    } else {
      throw new Error('Invalid type provided. Use \'clamp\' or \'cutoff\'.');
    }

    return {
      rect: {
        left: newLeft,
        top: newTop,
        width: newWidth,
        height: newHeight
      },
      ratio: {
        width: newWidth / elementRect.width,
        height: newHeight / elementRect.height,
        left: newLeft / elementRect.width,
        top: newTop / elementRect.height
      }
    };
  }

  private _renderFull() {
    // console.trace('_renderFull');

    const cropSettings =  this._renderingCropSettings;
    const originalSize = this._layerManager.getSize();
    const widthRatio = cropSettings ? cropSettings.widthRatio : 1;
    const heightRatio = cropSettings ? cropSettings.heightRatio : 1;
    const newWidth = originalSize.width * this._renderingScaleFactor; // * widthRatio;
    const newHeight = originalSize.height * this._renderingScaleFactor; // * heightRatio;
    // console.trace('_renderFull');

    // console.log(originalSize, this._renderingCanvasRatio, newWidth, newHeight);


    const bufferCanvas = this._layerManager.mergeLayers({angleDegree: cropSettings?.angle});

    // this.renderingCanvas.setSize(newWidth, newHeight);
    //
    const sub = {x: 0, y: 0, width: bufferCanvas.width, height: bufferCanvas.height};
    const dest = {x: 0, y: 0, width: this.renderingCanvas.canvas.width, height: this.renderingCanvas.canvas.height};

    if(cropSettings) {
      sub.width = bufferCanvas.width * cropSettings.widthRatio;
      sub.height = bufferCanvas.height * cropSettings.heightRatio;
      sub.x = bufferCanvas.width * cropSettings.leftRatio;
      sub.y = bufferCanvas.height * cropSettings.topRatio;

      const ctx = this.renderingCanvas.ctx;
      ctx.resetTransform();
      ctx.restore();

      const degrees = this._context.actions.commonActions.getAngleDegrees(); // Get the rotation angle
      const radians = degrees * (Math.PI / 180);
      const centerX = dest.width / 2;
      const centerY = dest.height / 2;

      // ctx.translate(centerX, centerY); // Move the origin to the center of the destination
      // ctx.rotate(radians); // Rotate the canvas around its new origin
      // ctx.translate(-centerX, -centerY); // Move the origin back
      // ctx.save();

      // console.log(degrees, radians, sub, dest);

      if(this._renderingCropSettings.flipHorizontal) {
        ctx.translate(dest.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(bufferCanvas,
        sub.x, sub.y, sub.width, sub.height,
        dest.x, dest.y, dest.width, dest.height);
      ctx.save();
      return;

      // this.renderingCanvas.ctx.resetTransform();
      // // this.renderingCanvas.ctx.rotate(-this._context.store.getAngle());
      // if(this._cropSettings.flipHorizontal) {
      //   this.renderingCanvas.ctx.translate(dest.width, 0);
      //   this.renderingCanvas.ctx.scale(-1, 1);
      //   // ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width, img.height); // Draw flipped image
      // }
      // // console.log(sub, dest, this._renderingCanvasRatio,  this._cropSettings);

      // this.renderingCanvas.ctx.drawImage(bufferCanvas,
      //   sub.x, sub.y, sub.width, sub.height,
      //   dest.x, dest.y, dest.width, dest.height);
      // return;
    }
    this.renderingCanvas.ctx.drawImage(bufferCanvas, 0, 0, newWidth, newHeight);
  }

  requestRender() {
    this._renderFrameThrottle.call();
  }

  onMouseDown(event: MouseEvent) {
    const pos = RenderingUtils.getPositionInCanvas(this.renderingCanvas.canvas,
      this._drawLayers.mainLayer.getCanvas(), event.clientX, event.clientY);
    this._drawLayers.onMouseDown(pos);
    this._renderFrameThrottle.call();
  }

  onMouseMove(event: MouseEvent) {
    const pos = RenderingUtils.getPositionInCanvas(this.renderingCanvas.canvas,
      this._drawLayers.mainLayer.getCanvas(), event.clientX, event.clientY);
    this._drawLayers.onMouseMove(pos);
    this._renderFrameThrottle.call();
  }

  onMouseUp(event: MouseEvent) {
    const pos = RenderingUtils.getPositionInCanvas(this.renderingCanvas.canvas,
      this._drawLayers.mainLayer.getCanvas(), event.clientX, event.clientY);
    this._drawLayers.onMouseUp(pos);
    this._renderFrameThrottle.call();
  }

  findItemId(event: MouseEvent, transforms: METypes.Item.TransformEntry[]) : METypes.Item.IdType | undefined {
    // ? add crop settings
    const ctx = this.renderingCanvas.ctx;
    const rect = ctx.canvas.getBoundingClientRect();
    const originalCanvas = this._backgroundLayer.canvas;
    // const mouseY = event.clientY - rect.top;
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const originalPoint = {x: point.x / this._renderingScaleFactor, y: point.y / this._renderingScaleFactor};
    originalPoint.x += this._renderingCropSettings ? this._renderingCropSettings.leftRatio * originalCanvas.width : 0;
    originalPoint.y += this._renderingCropSettings ? this._renderingCropSettings.topRatio * originalCanvas.height : 0;

    const clickedItems = transforms.filter(x =>
      MEHelpers.Geo.isPointInsideRect(originalPoint, x.transform, x.transform.angleDegree));
    const topMostItem = clickedItems.length > 0 ? clickedItems.reduce((maxItem, item) =>
        item.transform.orderIndex > maxItem.transform.orderIndex ? item : maxItem
    , clickedItems[0]) : undefined;
    return topMostItem ? topMostItem.id : undefined;
  }

  async setCropSettings(cropSettings?: METypes.CropSettings) {
    this._renderingCropSettings = cropSettings;
    await this.onRenderingCanvasResized();
    // setTimeout(() => {
    //   this.onRenderingCanvasResized();
    // }, 50);
    // this.resize();
    // this._renderFull();
    // this.renderingCanvas.resize();
  }
}
