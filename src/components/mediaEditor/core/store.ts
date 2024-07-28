import {ColorHsla} from '../../../helpers/color';
import {createStore} from 'solid-js/store';
import {ME_CONFIG} from '../config';
import {METypes} from './types';

type EventHandler = () => void;
type AnyEventHandler = (event: MEStoreEvent) => void;
type EventMap = { [event in MEStoreEvent]?: EventHandler[] };
export type MEStoreEvent = 'enhanceChanged' | 'textTabChanged' | 'pointerChanged' |
'activeTabChanged' | 'cropTabChanged' | 'drawTabChanged' | 'cropChanged' |
'itemsChanged' | 'common-selectedItem' | 'onHistoryUpdate';

function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export class MediaEditorStore {
  private _events: EventMap = {};
  private _anyHandlers: AnyEventHandler[] = [];
  private _history = {
    undoStacks: [] as METypes.State[],
    redoStacks: [] as METypes.State[],
    currentStateDrawImage: null as ImageBitmap
  };
  private _dataStore = createStore({
    state: {
      texts: [] as METypes.Item.TextItem[],
      stickers: [] as METypes.Item.StickerItem[],
      cropSettings: {
        topRatio: 0,
        leftRatio: 0,
        widthRatio: 1,
        heightRatio: 1,
        flipHorizontal: false,
        angle: 0
      } as METypes.CropSettings,
      enhanceSettings: {
        enhance: 0,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        fade: 0,
        highlights: 0,
        shadows: 0,
        vignette: 0,
        grain: 0,
        sharpen: 0
      } as METypes.EnhanceSettings,
      _lastItemId: 0
    } as Omit<METypes.State, 'drawLayerImage'>,
    tabs: {
      tabType: METypes.PanelTab.Enhance,
      cropTab: {
        selectedAspectRatio: METypes.AspectRatio.Original,
        isMovingOrResizing: false,
        isRotating: false
      },
      textTab: {
        color: {h: 0, s: 0, l: 100, a: 1} as ColorHsla,
        isColorPickerOpen: false,
        align: METypes.TextAlign.Center,
        fontFrame: METypes.FontFrame.Black,
        font: {
          family: ME_CONFIG.AVAILABLE_FONTS[0].family,
          style: ME_CONFIG.AVAILABLE_FONTS[0].style,
          weight: ME_CONFIG.AVAILABLE_FONTS[0].weight
        } as METypes.Font,
        fontSize: 24
      },
      drawTab: {
        isColorPickerOpen: false,
        selectedToolType: METypes.DrawTool.Pen,
        tools: {
          [METypes.DrawTool.Pen]: {color: ME_CONFIG.COLORS[1], size: 10},
          [METypes.DrawTool.Arrow]: {color: ME_CONFIG.COLORS[3], size: 10},
          [METypes.DrawTool.Brush]: {color: ME_CONFIG.COLORS[2], size: 10},
          [METypes.DrawTool.Neon]: {color: ME_CONFIG.COLORS[5], size: 10},
          [METypes.DrawTool.Blur]: {color: ME_CONFIG.COLORS[0], size: 10},
          [METypes.DrawTool.Eraser]: {color: ME_CONFIG.COLORS[0], size: 20}
        }
      }
    },
    pointer: {
      cursorType: 'default' as METypes.Pointer.CursorType,
      target: undefined as METypes.Pointer.Target,
      isDown: false,
      start: undefined as METypes.Pointer.MousePos | undefined,
      last: undefined as METypes.Pointer.MousePos | undefined,
      hoveredItemId: undefined as METypes.Item.IdType | undefined
    },

    common: {
      status: {
        isLoaded: false,
        isExporting: false
      },
      history: {
        canUndo: false,
        canRedo: false
      },
      canvasState: {
        topPercentage: 0,
        width: 0,
        height: 0,
        baseAngle: 0,
        adjustmentAngle: 0,
        scale: 0
      },
      // Temporary item for adding text, removed if creation is canceled
      tempTextCreationItemId: undefined as METypes.Item.IdType | undefined,
      edittingText: undefined as METypes.EdittingText | undefined,
      selectedItemId: undefined as METypes.Item.IdType | undefined
    }
  });

  private _emit(event: MEStoreEvent) {
    this._anyHandlers.forEach(handler => handler(event));
    if(!this._events[event]) return;
    this._events[event].forEach(handler => handler());
  }

  private get _set() {
    const [_, set] = this._dataStore;
    return set;
  }

  private readonly _stateActions = {
    setEnhance: (params: Partial<METypes.EnhanceSettings>) => {
      this._set('state', 'enhanceSettings', {...this.store.state.enhanceSettings, ...params});
      this._emit('enhanceChanged');
    },
    setCrop: (params: Partial<METypes.CropSettings>) => {
      this._set('state', 'cropSettings', {...this.store.state.cropSettings, ...params});
      this._emit('cropChanged');
    }
  }

  // ? Because we are don't need SolidJS Signal or Store for History
  // ? we Store canUndo, canRedo inside _dataStore
  private readonly _historyActions = {
    checkUndoRedo: () => {
      this._commonActions.setCanUndoRedo({
        canUndo: this._history.undoStacks.length > 1,
        canRedo: this._history.redoStacks.length > 0
      });
    },
    currentStateDrawImage: () => {
      return this._history.currentStateDrawImage;
    },
    undo: () =>  {
      if(!this.store.common.history.canUndo) return;

      const stateToRedo = this._history.undoStacks.pop();
      this._history.redoStacks.push(stateToRedo);
      const {drawLayerImage, ...lastState} = this._history.undoStacks[this._history.undoStacks.length-1]
      this._dataStore[1]('state', {
        ...this.store.state,
        ...deepCopy(lastState)
      });
      this._history.currentStateDrawImage = drawLayerImage;

      this._historyActions.checkUndoRedo();
      this._emit('onHistoryUpdate');
    },
    redo: () => {
      if(!this.store.common.history.canRedo) return;
      const stateToUndo = this._history.redoStacks.pop();
      this._history.undoStacks.push(stateToUndo);
      const {drawLayerImage, ...state} = stateToUndo;
      this._dataStore[1]('state', {
        ...this.store.state,
        ...deepCopy(state)
      });
      this._history.currentStateDrawImage = drawLayerImage;
      this._historyActions.checkUndoRedo();
      this._emit('onHistoryUpdate');
    },
    saveState: (drawLayerImage: ImageBitmap) => {
      this._history.undoStacks.push({
        ...deepCopy(this.store.state),
        drawLayerImage
      });
      this._history.redoStacks = [];
      this._history.currentStateDrawImage = null;
      this._historyActions.checkUndoRedo();
    }
  }

  private readonly _itemsActions = {
    getById: (id: METypes.Item.IdType) : METypes.Item.ItemType | undefined => {
      const textItem = this.store.state.texts.find(x => x.id === id);
      const stickerItem = this.store.state.stickers.find(x => x.id === id);
      return textItem ?? stickerItem;
    },
    isText(item: METypes.Item.ItemType) : item is METypes.Item.TextItem {
      return (item as METypes.Item.TextItem).text !== undefined;
    },
    isSticker(item: METypes.Item.ItemType) : item is METypes.Item.StickerItem {
      return (item as METypes.Item.StickerItem).image !== undefined;
    },
    addItem: (item: METypes.Item.ItemType) => {
      if(!this._itemsActions.isIdUnique(item.id)) throw new Error(`Item id should be unique ${item.id}`);
      const newItem = {...item}; // copy item
      if(this._itemsActions.isText(newItem)) {
        this._set('state', 'texts', [...this.store.state.texts, newItem]);
      }
      else if(this._itemsActions.isSticker(newItem)) {
        this._set('state', 'stickers', [...this.store.state.stickers, newItem]);
      }
      this._emit('itemsChanged');
    },
    duplicate: (id: METypes.Item.IdType, newTransform: METypes.Item.Transform) => {
      const {_itemsActions} = this;
      const item = _itemsActions.getById(id);
      if(!item) return;
      const newItem = {...item, id: _itemsActions.generateId(), transform: newTransform};
      _itemsActions.addItem(newItem);
    },
    getItemInfo: (id: METypes.Item.IdType) => {
      if(id === undefined) return undefined;
      const item = this._itemsActions.getById(id);
      if(!item) return undefined;
      return {
        item,
        isText: this._itemsActions.isText(item),
        isSticker: this._itemsActions.isSticker(item)
      }
    },
    deleteById: (id: METypes.Item.IdType) => {
      this._set('state', 'stickers', this.store.state.stickers.filter(x => x.id !== id));
      this._set('state', 'texts', this.store.state.texts.filter(x => x.id !== id));
      this._emit('itemsChanged');
    },
    isIdUnique: (id: METypes.Item.IdType) => {
      return this._itemsActions.getById(id) === undefined;
    },
    generateId: (): METypes.Item.IdType => {
      const newId = this.store.state._lastItemId + 1;
      this._set('state', '_lastItemId', newId);
      return newId;
    },
    updateText: (id: METypes.Item.IdType, updatedItem: Partial<METypes.Item.TextItem>) => {
      const index = this.store.state.texts.findIndex(x => x.id === id);
      if(index !== -1) {
        this._set('state', 'texts',
          this.store.state.texts.map((item, i) => i === index ? {...item, ...updatedItem} : item));
        this._emit('itemsChanged');
      }
    },
    updateSticker: (id: METypes.Item.IdType, updatedItem: Partial<METypes.Item.StickerItem>) => {
      const index = this.store.state.stickers.findIndex(x => x.id === id);
      if(index !== -1) {
        this._set('state', 'stickers',
          this.store.state.stickers.map((item, i) => i === index ? {...item, ...updatedItem} : item));
        this._emit('itemsChanged');
      }
    },
    updateTransform: (id: METypes.Item.IdType, updatedTransform: Partial<METypes.Item.Transform>) => {
      const item = this._itemsActions.getById(id);
      if(!item) return;
      if(this._itemsActions.isText(item)) {
        this._itemsActions.updateText(item.id, {...item, transform: {
          ...item.transform,
          ...updatedTransform
        }});
        this._emit('itemsChanged');
      }
      else if(this._itemsActions.isSticker(item)) {
        this._itemsActions.updateSticker(item.id, {...item, transform: {
          ...item.transform,
          ...updatedTransform
        }});
        this._emit('itemsChanged');
      }
    },
    getAll: (): METypes.Item.ItemType[] => {
      return [...this.store.state.texts, ...this.store.state.stickers];
    },
    getNewOrderIndex: () => {
      const items =  this._itemsActions.getAll();
      const highestOrderIndex = items.reduce((max, item) => {
        return Math.max(max, item.transform.orderIndex);
      }, 0);
      return highestOrderIndex + 1;
    }
  };

  private readonly _pointerActions = {
    getHoveredItemInfo: () => {
      if(this.store.pointer.hoveredItemId === undefined) return undefined;
      const item = this._itemsActions.getById(this.store.pointer.hoveredItemId);
      if(!item) return undefined;
      return {
        item,
        isText: this._itemsActions.isText(item),
        isSticker: this._itemsActions.isSticker(item)
      }
    },
    getMouseInfo: (current: METypes.Pointer.MousePos): METypes.Pointer.MouseInfo => {
      const pointer = this.store.pointer;
      return {
        current,
        start: pointer.start ?? {x: 0, y: 0},
        last: pointer.last ?? {x: 0, y: 0},
        delta: pointer.last ? {x: current.x - pointer.last.x, y: current.y - pointer.last.y} : {x: 0, y: 0}
      }
    },
    onDown: (start: METypes.Pointer.MousePos, downTarget: METypes.Pointer.Target, cursorType: METypes.Pointer.CursorType) => {
      this._set('pointer', {
        ...this.store.pointer,
        cursorType,
        target: downTarget,
        isDown: true,
        start: {...start},
        last: {...start}
      });
      this._emit('pointerChanged');
    },
    onMove: (last: METypes.Pointer.MousePos, cursorType: METypes.Pointer.CursorType, hoveredItemId: METypes.Item.IdType | undefined) => {
      this._set('pointer', {
        ...this.store.pointer,
        cursorType,
        last,
        hoveredItemId
      });
      this._emit('pointerChanged');
    },
    onUp: (cursorType: METypes.Pointer.CursorType) => {
      this._set('pointer', {
        ...this.store.pointer,
        cursorType,
        isDown: false
      });
      this._emit('pointerChanged');
    }
  }

  private readonly _tabsActions = {
    setActiveTab: (v: METypes.PanelTab) => {
      this._set('tabs', 'tabType', v)
      this._emit('activeTabChanged');
    },
    isActive: (v: METypes.PanelTab) => this.store.tabs.tabType === v,
    isEnhanceTab: () => this.store.tabs.tabType === METypes.PanelTab.Enhance,
    isCropTab: () => this.store.tabs.tabType === METypes.PanelTab.Crop,
    isTextTab: () => this.store.tabs.tabType === METypes.PanelTab.Text,
    isDrawTab: () => this.store.tabs.tabType === METypes.PanelTab.Draw,
    isStickerTab: () => this.store.tabs.tabType === METypes.PanelTab.Sticker
  }

  private readonly _cropTabActions = {
    hasBaseAngle: () => {
      const baseAngleRatio = Math.abs(this.store.common.canvasState.baseAngle) % 360;
      return baseAngleRatio !== 0;
    },
    setTransformationState: ({isMovingOrResizing, isRotating}: {
      isMovingOrResizing?: boolean,
      isRotating?: boolean,
    }) => {
      if(isMovingOrResizing !== undefined) {
        this._set('tabs', 'cropTab', 'isMovingOrResizing', isMovingOrResizing);
      }
      if(isRotating !== undefined) {
        this._set('tabs', 'cropTab', 'isRotating', isRotating);
      }
      this._emit('cropTabChanged');
    },
    setSelectedAspectRatio: (v: METypes.AspectRatio) => {
      this._set('tabs', 'cropTab', {selectedAspectRatio: v});
      this._emit('cropTabChanged');
    }
  };

  private readonly _drawTabActions = {
    toggleColorPicker: (v: boolean) => {
      this._set('tabs', 'drawTab', 'isColorPickerOpen', v);
      this._emit('drawTabChanged');
    },
    setSelectedTool: (params: {color?: ColorHsla, size?:number}) => {
      this._set('tabs', 'drawTab', 'tools', this.store.tabs.drawTab.selectedToolType, (prev) => {
        return {...prev, ...params}
      });
      this._emit('drawTabChanged');
    },
    changeTool: (type: METypes.DrawTool) => {
      this._set('tabs', 'drawTab', 'selectedToolType', type);
      this._emit('drawTabChanged');
    },
    selectedTool: () => this.store.tabs.drawTab.tools[this.store.tabs.drawTab.selectedToolType],
    isActive: (v: METypes.DrawTool) => this.store.tabs.drawTab.selectedToolType === v,
    isPen: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Pen,
    isArrow: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Arrow,
    isBrush: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Brush,
    isNeon: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Neon,
    isBlur: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Blur,
    isEraser: () => this.store.tabs.drawTab.selectedToolType === METypes.DrawTool.Eraser
  };

  private readonly _textTabActions = {
    toggleColorPicker: (v: boolean) => {
      this._set('tabs', 'textTab', 'isColorPickerOpen', v);
      this._emit('textTabChanged');
    },
    set: (params: Partial<{
      color: ColorHsla,
      isColorPickerOpen: boolean,
      align: METypes.TextAlign,
      fontFrame: METypes.FontFrame,
      font: METypes.Font,
      fontSize: number}>) => {
      this._set('tabs', 'textTab', {...this.store.tabs.textTab, ...params});
      this._emit('textTabChanged');
    },
    setFromItem: (item: METypes.Item.TextItem) => {
      this._textTabActions.set({
        align: item.align,
        color: item.color,
        fontSize: item.fontSize,
        fontFrame: item.fontFrame,
        font: item.font
      });
    }
  };

  private readonly _commonActions = {
    setStatus: (params: Partial<typeof this.store.common.status>) => {
      this._set('common', 'status', {
        ... this.store.common.status,
        ...params
      });
    },
    setEdittingInfo: (v: METypes.EdittingText) => {
      this._set('common', 'edittingText', v);
    },
    updateCaretInfo: (params: Partial<METypes.CaretInfo>) => {
      this._set('common', 'edittingText', 'caretInfo', {
        ...this.store.common.edittingText.caretInfo, ...params
      });
    },
    setCanUndoRedo: (params: {canUndo: boolean, canRedo: boolean}) => {
      this._set('common', 'history', 'canUndo', params.canUndo);
      this._set('common', 'history', 'canRedo', params.canRedo);
    },
    isStoreChanged: () => {
      return true;
    },
    hasSelectedItem: () => {
      return this.store.common.selectedItemId !== undefined;
    },
    isEdittingItem: (id: METypes.Item.IdType) => {
      return this.store.common.selectedItemId !== id && this.store.common.edittingText !== undefined;
    },
    clearSelectedItem: () => {
      this._set('common', 'selectedItemId', undefined);
      this._set('common', 'edittingText', undefined);
      this._emit('common-selectedItem');
    },
    setSelectedItem: (id: METypes.Item.IdType) => {
      this._set('common', 'selectedItemId', id);
      this._emit('common-selectedItem');
    },
    isStickerItemSelected: () => {
      const itemInfo = this._itemsActions.getItemInfo(this.store.common.selectedItemId);
      return itemInfo?.isSticker;
    },
    isTextItemSelected: () => {
      const itemInfo = this._itemsActions.getItemInfo(this.store.common.selectedItemId);
      return itemInfo?.isText;
    },
    setCanvasState: (params: {
      topPercentage?: number,
      width?: number, height?: number,
      baseAngle?: number, adjustmentAngle?: number,
      scale?: number
    }) => {
      this._set('common', 'canvasState', {...this.store.common.canvasState, ...params});
    },
    getAngleDegrees: () => {
      return this.store.common.canvasState.baseAngle + this.store.common.canvasState.adjustmentAngle;
    },
    rotateBaseAngle:() => {
      const baseAngle = (this.store.common.canvasState.baseAngle - 90);
      this._commonActions.setCanvasState({baseAngle, adjustmentAngle: 0});
    }
  }

  get store() {
    const [get, _] = this._dataStore;
    return get;
  }

  on(event: MEStoreEvent, handler: EventHandler) {
    if(!this._events[event]) {
      this._events[event] = [];
    }
    this._events[event].push(handler);
  }

  off(event: MEStoreEvent, handler: EventHandler) {
    if(!this._events[event]) return;
    this._events[event] = this._events[event].filter(h => h !== handler);
  }

  onAny(handler: AnyEventHandler): void {
    this._anyHandlers.push(handler);
  }

  offAny(handler: AnyEventHandler): void {
    this._anyHandlers = this._anyHandlers.filter(h => h !== handler);
  }

  get historyActions() {
    return this._historyActions;
  }

  get cropTabActions() {
    return this._cropTabActions;
  }

  get textTabActions() {
    return this._textTabActions;
  }

  get itemsActions() {
    return this._itemsActions;
  }

  get pointerActions() {
    return this._pointerActions;
  }

  get tabsActions() {
    return this._tabsActions;
  }

  get drawTabActions() {
    return this._drawTabActions;
  }

  get stateActions() {
    return this._stateActions;
  }

  get commonActions() {
    return this._commonActions;
  }
}
