import {createContext, ParentComponent, useContext} from 'solid-js';
import createContextMenu from '../../../helpers/dom/createContextMenu';
import {CanvasRenderer} from './CanvasRenderer';
import {MEHelpers} from './helpers';
import {ME_CONFIG} from '../config';
import {MediaEditorStore, MEStoreEvent} from './store';
import clamp from '../../../helpers/number/clamp';
import {METypes} from './types';

export class ContextData {
  private readonly _store = new MediaEditorStore();
  private _contextMenu: ReturnType<typeof createContextMenu>;
  private _renderer: CanvasRenderer;
  private _initialized = false;
  private _canvasResizeObserver: ResizeObserver;
  private _refs = {
    canvasElement: null as HTMLCanvasElement | null,
    previewElement: null as HTMLDivElement | null,
    brushPointer: null as HTMLDivElement | null,
    selectedItemContainer: null as HTMLDivElement | null
  };
  private _fontLoader = new MEHelpers.FontLoader();
  private _inputFieldCaret = new MEHelpers.InputFieldCaret();
  private _contextItemId: number;
  private _edittingText = false;

  constructor(readonly options: METypes.ContextDataOptions) {}

  private async _initialize() {
    if(!this._refs.canvasElement || !this._refs.previewElement) return;
    if(this._initialized) throw new Error();
    this._initialized = true;
    const self = this;
    this._contextMenu = createContextMenu({
      listenTo: this._refs.previewElement,
      async filterButtons(buttons) {
        const {tabsActions, pointerActions} = self.actions;
        if(tabsActions.isCropTab() || tabsActions.isEnhanceTab()) return [];

        const itemInfo = pointerActions.getHoveredItemInfo();

        if(self.store.pointer.hoveredItemId !== undefined) self._contextItemId = itemInfo.item.id;
        else self._contextItemId = undefined;
        return buttons.filter(x => {
          if(x.icon === 'add') return tabsActions.isTextTab() && itemInfo === undefined;
          if(x.icon === 'copy') return itemInfo !== undefined;
          if(x.icon === 'flip') return itemInfo && itemInfo.isSticker;
          if(x.icon === 'edit') return itemInfo && itemInfo.isText;
          return true;
        });
      },
      buttons: [
        {icon: 'add', text: 'MediaEditor.Context.AddText', onClick: (e) => {
          this._addNewText();
        }},
        {icon: 'flip', text: 'MediaEditor.Context.Flip', onClick: (e) => {
          const item = self.actions.itemsActions.getById(self._contextItemId);
          if(!item) return;
          self.actions.itemsActions.updateTransform(item.id, {flipped: !item.transform.flipped});
        }},
        {icon: 'edit', text: 'MediaEditor.Context.Edit', onClick: (e) => {
          // this.actions.commonActions.setIsCreatingText(!this.store.common.isCreatingText);
        }},
        {icon: 'copy', text: 'MediaEditor.Context.Duplicate', onClick: (e) => {
          const item = self.actions.itemsActions.getById(self._contextItemId);
          if(!item) return;
          let size: METypes.Geo.Dimensions = {width: 0, height: 0};
          if(item && self.actions.itemsActions.isSticker(item)) {
            size = this._renderer.getStickerDefaultSize(item.image.width, item.image.height);
          }
          const newItem = this._getNewItemTransform(size.width, size.height, false);
          self.actions.itemsActions.duplicate(self._contextItemId, newItem.transform);
        }},
        {icon: 'delete', text: 'MediaEditor.Context.Delete', danger: true, onClick: (e) => {
          self.actions.itemsActions.deleteById(self._contextItemId);
        }}
      ]
    });

    this._renderer = new CanvasRenderer(this,
      this._refs.previewElement,
      this._handleResize.bind(this),
      this._refs.canvasElement);

    document.addEventListener('mousedown', this._handleMouseDown.bind(this));
    document.addEventListener('mousemove', this._handleMouseMove.bind(this));
    document.addEventListener('mouseup', this._handleMouseUp.bind(this));
    document.addEventListener('mouseover', () => {});
    document.addEventListener('mouseout', () => {});
    window.addEventListener('resize', this._handleResize.bind(this));
    window.addEventListener('fullscreenchange', this._handleResize.bind(this));
    document.addEventListener('keydown', this._handleEditText.bind(this));

    this.actions.onAny(this._handleStoreEvents.bind(this));

    this._canvasResizeObserver = new ResizeObserver(this._handleResize.bind(this));
    this._canvasResizeObserver.observe(this._refs.previewElement);

    this._refs.brushPointer = document.getElementById('brush-pointer') as HTMLDivElement;

    await this._renderer.initialize(this.options.mediaSrc);
    this._handleResize();

    const fonts = ME_CONFIG.AVAILABLE_FONTS.map(x => ({name: x.family, url: x.url}));
    this._fontLoader.loadFonts(fonts).then(() => {
      // ? re-render Text Items with loaded fonts
      this._renderer.onItemsChanged();
    });

    this.actions.tabsActions.setActiveTab(METypes.PanelTab.Enhance);
    this.onConfirm();
    this.actions.commonActions.setStatus({isLoaded: true});
    MEHelpers.Development.initializeDev(this, this._renderer);
  }

  setRef<K extends keyof typeof this._refs>(refType: K, element: typeof this._refs[K]) {
    if(refType !== 'brushPointer' && this._refs[refType])
      throw new Error(`${refType} is already set`);

    this._refs[refType] = element;

    if(refType === 'canvasElement' || refType === 'previewElement') {
      this._initialize();
    } else if(refType === 'brushPointer') {
      this._updateBrushPointer();
    } else if(refType === 'selectedItemContainer') {
      this._updateSelectedItemContainer();
    }
    else throw new Error(`Invalid Ref type, ${refType}`);
  }

  async handleCleanUp() {
    document.removeEventListener('mousedown', this._handleMouseDown.bind(this));
    document.removeEventListener('mousemove', this._handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this._handleMouseUp.bind(this));
    document.removeEventListener('mouseover', () => {});
    document.removeEventListener('mouseout', () => {});
    document.removeEventListener('keydown', this._handleResize.bind(this));
    window.removeEventListener('resize', this._handleResize.bind(this));
    window.removeEventListener('fullscreenchange', this._handleResize.bind(this));

    this._fontLoader.unloadFonts();
    this._renderer.destroy();
    if(this._canvasResizeObserver) this._canvasResizeObserver.disconnect();
    if(this._contextMenu) this._contextMenu.destroy();
  }

  addNewSticker(docId: string | number, image: ImageBitmap) {
    const {itemsActions} = this.actions;
    const size = this._renderer.getStickerDefaultSize(image.width, image.height);
    const newItem = this._getNewItemTransform(size.width, size.height);
    itemsActions.addItem(
      {
        id: newItem.id,
        transform: newItem.transform,
        image
      }
    );
  }

  setAspectRatio(aspectRatio: METypes.AspectRatio) {
    if(aspectRatio === METypes.AspectRatio.Free) {
      this.actions.cropTabActions.setSelectedAspectRatio(aspectRatio);
      return;
    }

    const canvasRect = this._refs.canvasElement.getBoundingClientRect();

    if(aspectRatio === METypes.AspectRatio.Original) {
      this.actions.stateActions.setCrop({
        topRatio: 0,
        leftRatio: 0,
        widthRatio: 1,
        heightRatio: 1
      });
      this.actions.cropTabActions.setSelectedAspectRatio(aspectRatio);
    }
    else if(aspectRatio === METypes.AspectRatio.Square) {
      const size = Math.min(canvasRect.width, canvasRect.height);
      this.actions.stateActions.setCrop({
        topRatio: 0,
        leftRatio: 0,
        widthRatio: size / canvasRect.width,
        heightRatio: size / canvasRect.height
      });
      this.actions.cropTabActions.setSelectedAspectRatio(aspectRatio);
    }
    else {
      const size = MEHelpers.calculateAspectRatio(aspectRatio);
      const cropSettings = this.store.state.cropSettings;
      const rect = {
        left: canvasRect.width * cropSettings.leftRatio,
        top: canvasRect.height * cropSettings.topRatio,
        width: 0,
        height: 0
      };
      const canvasAspectRatio = canvasRect.width / canvasRect.height;
      if(canvasAspectRatio >= size.widthRatio / size.heightRatio) {
        // If the canvas is wider than the target aspect ratio, use the canvas height to calculate width
        rect.width = canvasRect.height * (size.widthRatio / size.heightRatio);
        rect.height = canvasRect.height;
      } else {
        // If the canvas is taller than the target aspect ratio, use the canvas width to calculate height
        rect.width = canvasRect.width;
        rect.height = canvasRect.width * (size.heightRatio / size.widthRatio);
      }

      const rectResult = this._renderer.processRect(this._refs.canvasElement, 0, rect, 'clamp');
      this.actions.stateActions.setCrop({
        topRatio: rectResult.ratio.top,
        leftRatio: rectResult.ratio.left,
        widthRatio: rectResult.ratio.width,
        heightRatio: rectResult.ratio.height
      });

      const aspectRatio2 = MEHelpers.detectAspectRatio(rectResult.ratio.width * canvasRect.width,
        rectResult.ratio.height * canvasRect.height);
      this.actions.cropTabActions.setSelectedAspectRatio(aspectRatio2);
    }
  }

  async onConfirm() {
    const image = await this._renderer.getDrawLayerSnapshot()
    this.actions.historyActions.saveState(image);
  }

  get store() {
    return this._store.store;
  }

  get actions() {
    return this._store;
  }

  private _updateBrushPointer(pos?: {x: number, y: number}) {
    const brushPointer = this._refs.brushPointer;
    if(!brushPointer) return;
    if(!this.store.pointer.last || !pos) {
      brushPointer.style.display = 'none';
      return;
    }
    brushPointer.style.display = 'block';
    const size = this._renderer.brushSizeInPixel() * this._renderer.renderingScaleFactor;
    brushPointer.style.width = `${size}px`;
    brushPointer.style.height = `${size}px`;
    brushPointer.style.left = `${pos.x - (size / 2)}px`;
    brushPointer.style.top = `${pos.y - (size / 2)}px`;
  }

  private _updateSelectedItemContainer() {
    const {selectedItemContainer} = this._refs;
    if(!selectedItemContainer) return;
    const {tabsActions, itemsActions, commonActions} = this.actions;

    const show = commonActions.hasSelectedItem() || tabsActions.isCropTab();
    selectedItemContainer.setAttribute('data-show', show.toString());
    if(!show) return;

    const self = this;
    const item = itemsActions.getById(self.store.common.selectedItemId);
    const t = item ? item.transform : undefined;
    function getRect() {
      if(tabsActions.isCropTab()) {
        const cs = self.store.state.cropSettings;
        return {
          left: cs.leftRatio * 100 + '%',
          top: cs.topRatio * 100 + '%',
          width: cs.widthRatio * 100 + '%',
          height: cs.heightRatio * 100 + '%',
          angleDegree: '0deg'
        }
      }

      const scaleFactor = self._renderer.renderingScaleFactor
      const rect = t ? MEHelpers.Geo.addPaddingToRect(t, 10) : t;
      return {
        left: (t ? rect.left * scaleFactor : 0) + 'px',
        top: (t ? rect.top * scaleFactor : 0) + 'px',
        width:(t ? rect.width * scaleFactor * t.scale : 0) + 'px',
        height: (t ? rect.height * scaleFactor * t.scale : 0) + 'px',
        angleDegree: (t ? t.angleDegree : 0) + 'deg'
      }
    }

    const rect = getRect();
    selectedItemContainer.style.top = rect.top;
    selectedItemContainer.style.left = rect.left;
    selectedItemContainer.style.width = rect.width;
    selectedItemContainer.style.height = rect.height;
    selectedItemContainer.style.transform = `rotate(${rect.angleDegree})`;
    selectedItemContainer.style.scale = `${tabsActions.isCropTab() ? 1 : 1.1}`;
  }

  private _handleResize() {
    this.actions.commonActions.setCanvasState({
      width: this._renderer.renderingCanvas.canvas.width,
      height: this._renderer.renderingCanvas.canvas.height
    });
  }

  handleCancel() {
    this.options.onClose();
  }

  async handleConfirm() {
    const {commonActions} = this.actions;
    try {
      if(this.store.common.status.isExporting) return;
      await this._renderer.setCropSettings(this.store.state.cropSettings);
      commonActions.setStatus({isExporting: true});
      if(!commonActions.isStoreChanged()) {
        this.handleCancel();
        return;
      }
      const blob = await this._renderer.getCanvasBlob();
      const newFile = new File([blob], this.options.file.name, {type: 'image/png'});
      this.options.onConfirm(newFile);
    } catch(error) {
      console.error(error);
    } finally {
      commonActions.setStatus({isExporting: false});
    }
  }

  private _handleStoreEvents(event: MEStoreEvent) {
    const store = this.store;
    const {tabsActions, itemsActions, stateActions, commonActions, historyActions} = this.actions;

    if(event === 'drawTabChanged') this._renderer.onDrawTabChanged();
    if(event === 'enhanceChanged') this._renderer.onEnhanceSettingsChanged();
    if(event === 'itemsChanged') {
      // checking if item deleted
      if(itemsActions.getById(store.common.selectedItemId) === undefined) {
        this._removeSelectedItem();
      }
      this._renderer.onItemsChanged();
      this._updateSelectedItemContainer();
    }

    if(event === 'onHistoryUpdate') {
      this._renderer.onHistoryUpdate(historyActions.currentStateDrawImage());
    }

    if(event === 'cropChanged' || event === 'cropTabChanged') {
      this._updateSelectedItemContainer();
    }

    if(event === 'cropChanged') {
      const canvasRect = this._refs.canvasElement.getBoundingClientRect();
      const cropSettings = this.store.state.cropSettings;

      if(cropSettings.heightRatio >= 1 && cropSettings.widthRatio >= 1) {
        this.actions.cropTabActions.setSelectedAspectRatio(METypes.AspectRatio.Original);
      }
      else {
        const aspectRatio = MEHelpers.detectAspectRatio(cropSettings.widthRatio * canvasRect.width
          , cropSettings.heightRatio * canvasRect.height);
        this.actions.cropTabActions.setSelectedAspectRatio(aspectRatio);
      }
    }

    if(event === 'textTabChanged') {
      const textTab = this.store.tabs.textTab;
      if(commonActions.isTextItemSelected()) {
        itemsActions.updateText(store.common.selectedItemId, {
          align: textTab.align,
          color: textTab.color,
          font: textTab.font,
          fontFrame: textTab.fontFrame,
          fontSize: textTab.fontSize
        });
      }
      // ? or editting text
      // if(store.common.isCreatingText && this._refs.inputField) {
      //   // const container = this._refs.inputField.container;
      //   // container.setAttribute('--input-color', hslaToString(textTab.color));
      // }
    }

    if(event === 'common-selectedItem') {
      this._updateSelectedItemContainer();
      if(commonActions.isTextItemSelected()) {
        tabsActions.setActiveTab(METypes.PanelTab.Text);
      }
    }

    if(event === 'activeTabChanged') {
      this._updateSelectedItemContainer();
      if(!(tabsActions.isTextTab() || tabsActions.isStickerTab())) {
        this._removeSelectedItem();
      }

      if(tabsActions.isCropTab()) {
        this._renderer.setCropSettings(undefined);
        commonActions.setCanvasState({topPercentage: 45, scale: 0.78});
        this._handleResize();
      }
      else {
        this._renderer.setCropSettings(store.state.cropSettings);
        commonActions.setCanvasState({topPercentage: 50, scale: 1});
      }
    }

    if(event === 'pointerChanged') {
      const downTarget = store.pointer.target;
      if(downTarget && (downTarget.type === 'item' || downTarget.type === 'item-corner')) {
        const item = itemsActions.getById(downTarget.itemId);
        if(item && itemsActions.isText(item)) {
          tabsActions.setActiveTab(METypes.PanelTab.Text);
          this.actions.textTabActions.set(item);
        }
      }
      this._renderer.renderingCanvas.canvas.style.cursor = store.pointer.cursorType;
    }
  }

  private _removeSelectedItem() {
    const {itemsActions, commonActions} = this.actions;
    const item = itemsActions.getById(this.store.common.selectedItemId);
    if(item && itemsActions.isText(item) && item.text.trim() === '') {
      itemsActions.deleteById(item.id);
    }
    commonActions.clearSelectedItem();
    this._renderer.onItemsChanged(); // to remove caret from text item
    this._edittingText = false;
  }

  private _handleEditText(event: KeyboardEvent) {
    const {itemsActions} = this.actions;
    const {edittingText} = this.store.common;
    if(this.store.common.selectedItemId === undefined || !edittingText) return;
    const item = itemsActions.getById(this.store.common.selectedItemId);
    if(!item || !itemsActions.isText(item)) return;

    const updatedInfo = this._inputFieldCaret.handleKeydown(event, {
      ...edittingText,
      // deep copy array to remove solidjs proxy
      linesArray: edittingText.linesArray.map(x => x)
    });

    itemsActions.updateText(item.id, {
      text: updatedInfo.newText
    });
    this.actions.commonActions.updateCaretInfo({
      line: updatedInfo.caretLine,
      position: updatedInfo.caretPos
    });
  }

  private _handleEditTextFinished() {

  }

  private _handleMouseDown(event: MouseEvent) {
    if(event.button !== 0) return; // Exit if not the left mouse button
    if(this.actions.tabsActions.isEnhanceTab()) return;

    const {actions, store, _renderer, _refs} = this;
    const {tabsActions, pointerActions, cropTabActions, commonActions, itemsActions} = actions;

    const self = this;
    const target = event.target;
    const isCanvas = target === _renderer.renderingCanvas.canvas;
    const isPreviewElement = target === _refs.previewElement;
    const isHandle = target instanceof HTMLElement && target.className.startsWith('handle');
    const isCropper = target instanceof HTMLElement && target.className.startsWith('cropper');
    const cornerType = isHandle ? target.dataset.cornerType as METypes.CornerType : undefined;
    let clickedItemId: METypes.Item.IdType | undefined;
    const downTarget: METypes.Pointer.Target | undefined = determineDownTargetType()
    let cursorType: METypes.Pointer.CursorType = 'default';

    function determineDownTargetType(): typeof downTarget  {
      const downTarget = store.pointer.target;
      if(tabsActions.isCropTab()) {
        if(cornerType) return {type: 'cropper-corner', cornerType};
        else if(isCropper) return {type: 'cropper'};
      }
      else if(tabsActions.isDrawTab() && isCanvas) {
        return {type: 'drawing'};
      }
      else if(cornerType && downTarget && (downTarget.type === 'item' || downTarget.type === 'item-corner')) {
        return {type: 'item-corner', itemId: downTarget.itemId, cornerType};
      }
      else if(isCanvas) {
        clickedItemId = self._renderer.findItemId(event, itemsActions.getAll());
        if(clickedItemId !== undefined) {
          return {type: 'item', itemId: clickedItemId};
        }
      }
      return undefined;
    }

    // const downTarget = determineDownTargetType();
    // if(this._edittingText && clickedItemId === undefined) {
    //   // this._edittingText = false;
    //   // this.actions.commonActions.setIsEdittingText(this._edittingText);
    // }

    if(downTarget !== undefined) {
      if(downTarget.type === 'drawing') {
        cursorType = 'none';
        this._renderer.onMouseDown(event);
      }
      else if(downTarget.type === 'cropper') {
        cropTabActions.setTransformationState({isMovingOrResizing: true});
      }
    }
    else if(tabsActions.isTextTab() && clickedItemId === undefined) {
      this._addNewText();
    }

    if(clickedItemId !== undefined) {
      if(store.common.selectedItemId === clickedItemId) {
        // this._edittingText = true;
        // ! selected item text, set caret pos to end
        // self._caretPos =
        // commonActions.setIsEdittingText(this._edittingText);
      }
      commonActions.setSelectedItem(clickedItemId);
      // move item to top order
      itemsActions.updateTransform(clickedItemId, {
        orderIndex: itemsActions.getNewOrderIndex()
      });
    }
    else if(isCanvas) this._removeSelectedItem();


    pointerActions.onDown({x: event.clientX, y: event.clientY}, downTarget, cursorType);
  }

  private _handleMouseMove(event: MouseEvent) {
    const {tabsActions, pointerActions} = this.actions;
    if(tabsActions.isEnhanceTab()) return;

    const target = event.target;
    const isCanvas = target === this._refs.canvasElement;
    const pointer = this.store.pointer;
    const canvasRect = this._renderer.renderingCanvas.canvas.getBoundingClientRect();
    let hoveredItemId: METypes.Item.IdType | undefined;
    let cursorType: METypes.Pointer.CursorType = 'default';

    const mouseInfo = pointerActions.getMouseInfo({x: event.clientX, y: event.clientY});
    const canvasMouseCoords = MEHelpers.Pointer.transformToRectCoords(mouseInfo, canvasRect);

    if(tabsActions.isDrawTab()) {
      // Update brush pointer even if moues is not on the canvas
      this._updateBrushPointer(canvasMouseCoords.current);
      cursorType = 'crosshair';
      // if(isCanvas) cursorType = pointer.isDown ? 'none' : 'crosshair';
    }

    if(isCanvas && (tabsActions.isTextTab() || tabsActions.isStickerTab())) {
      const itemId = this._renderer.findItemId(event,  this.actions.itemsActions.getAll());
      if(itemId !== undefined) cursorType = 'pointer';
      hoveredItemId = itemId;
    }

    if(pointer.isDown && pointer.target) {
      const downTarget = pointer.target;
      if(downTarget.type === 'drawing') {
        cursorType = 'none';
        this._renderer.onMouseMove(event);
      }
      else if(downTarget.type === 'cropper' || downTarget.type === 'cropper-corner') {
        cursorType = 'grabbing';
        this._handleCropperEvent(downTarget, canvasMouseCoords, canvasRect);
      }
      else if(downTarget.type === 'item' || downTarget.type === 'item-corner') {
        cursorType = 'grabbing';
        this._handleItemEvent(downTarget, canvasMouseCoords);
      }
    }

    pointerActions.onMove(mouseInfo.current, cursorType, hoveredItemId);
  }

  private _handleMouseUp(event: MouseEvent) {
    const {pointerActions, cropTabActions} = this.actions;
    const target = event.target;
    const isCanvas = target === this._refs.canvasElement;
    const pointer = this.store.pointer;

    if(pointer.target) {
      if(pointer.target.type === 'drawing') {
        this._renderer.onMouseUp(event);
        this.onConfirm();
      }

      if(pointer.target.type === 'cropper' ||
        pointer.target.type === 'cropper-corner' ||
        pointer.target.type === 'item' ||
        pointer.target.type === 'item-corner') {
        this.onConfirm();
      }
    }

    pointerActions.onUp('default');
    cropTabActions.setTransformationState({isMovingOrResizing: false});
  }

  private _handleCropperEvent(downTarget: METypes.Pointer.Target,
    mouseInfo: METypes.Pointer.MouseInfo,
    canvasRect: METypes.Geo.Rect) {
    const cropSettings = this.store.state.cropSettings;
    const cropperRect = {
      left: canvasRect.width * cropSettings.leftRatio,
      top: canvasRect.height * cropSettings.topRatio,
      width: canvasRect.width * cropSettings.widthRatio,
      height: canvasRect.height * cropSettings.heightRatio
    };

    if(downTarget.type === 'cropper') {
      cropperRect.left += mouseInfo.delta.x;
      cropperRect.top += mouseInfo.delta.y;
    } else if(downTarget.type === 'cropper-corner')  {
      switch(downTarget.cornerType) {
        case METypes.CornerType.TopLeft:
          cropperRect.left += mouseInfo.delta.x;
          cropperRect.top += mouseInfo.delta.y;
          cropperRect.width -= mouseInfo.delta.x;
          cropperRect.height -= mouseInfo.delta.y;
          break;
        case METypes.CornerType.BottomLeft:
          cropperRect.left += mouseInfo.delta.x;
          cropperRect.width -= mouseInfo.delta.x;
          cropperRect.height += mouseInfo.delta.y;
          break;
        case METypes.CornerType.TopRight:
          cropperRect.top += mouseInfo.delta.y;
          cropperRect.width += mouseInfo.delta.x;
          cropperRect.height -= mouseInfo.delta.y;
          break;
        case METypes.CornerType.BottomRight:
          cropperRect.width += mouseInfo.delta.x;
          cropperRect.height += mouseInfo.delta.y;
          break;
      }
    }

    const rectResult = this._renderer.processRect(this._renderer.renderingCanvas.canvas,
      this.actions.commonActions.getAngleDegrees(),
      cropperRect,
      downTarget.type === 'cropper' ? 'clamp' : 'cutoff');

    this.actions.stateActions.setCrop({
      leftRatio: rectResult.ratio.left,
      topRatio: rectResult.ratio.top,
      widthRatio: rectResult.ratio.width,
      heightRatio: rectResult.ratio.height
    });
    this.actions.cropTabActions.setTransformationState({isMovingOrResizing: true});
    this._updateSelectedItemContainer();
  }

  private _handleItemEvent(downTarget: METypes.Pointer.Target, mouseInfo: METypes.Pointer.MouseInfo) {
    const {itemsActions} = this.actions;

    if(downTarget.type !== 'item' && downTarget.type !== 'item-corner') return;
    const item = itemsActions.getById(downTarget.itemId);
    if(!item) return;

    if(downTarget.type === 'item-corner') {
      const t = {...item.transform};

      const itemRect = MEHelpers.Geo.scaleRect(t, this._renderer.renderingScaleFactor);
      const itemCenter = MEHelpers.Geo.getRectCenter(itemRect);

      const angle = Math.atan2(mouseInfo.current.y - itemCenter.y, mouseInfo.current.x - itemCenter.x) -
      Math.atan2(mouseInfo.last.y - itemCenter.y, mouseInfo.last.x - itemCenter.x);

      const rotation = angle * (180 / Math.PI);
      const newAngleDegree = t.angleDegree + rotation;

      function rotateCornerType(cornerType: METypes.CornerType, angleDegrees: number) {
        // Convert angle from degrees to radians
        const angleRadians = angleDegrees * (Math.PI / 180);

        // Define the original corner positions
        const corners = {
          [METypes.CornerType.TopLeft]: {x: -1, y: -1},
          [METypes.CornerType.TopRight]: {x: 1, y: -1},
          [METypes.CornerType.BottomLeft]: {x: -1, y: 1},
          [METypes.CornerType.BottomRight]: {x: 1, y: 1}
        };

        // Rotate function to apply rotation matrix
        function rotatePoint(x: number, y: number, angle: number) {
          const cosA = Math.cos(angle);
          const sinA = Math.sin(angle);
          return {
            x: x * cosA - y * sinA,
            y: x * sinA + y * cosA
          };
        }

        // Get the original corner position
        const {x: originalX, y: originalY} = corners[cornerType];

        // Rotate the corner position
        const {x: rotatedX, y: rotatedY} = rotatePoint(originalX, originalY, angleRadians);

        // Determine the new corner type based on rotated coordinates
        if(rotatedX <= 0 && rotatedY <= 0) return METypes.CornerType.TopLeft;
        if(rotatedX >= 0 && rotatedY <= 0) return METypes.CornerType.TopRight;
        if(rotatedX <= 0 && rotatedY >= 0) return METypes.CornerType.BottomLeft;
        if(rotatedX >= 0 && rotatedY >= 0) return METypes.CornerType.BottomRight;

        // Fallback in case something went wrong
        return cornerType;
      }

      const isRotating = Math.abs(newAngleDegree - t.angleDegree) > 1;

      if(!isRotating) {
        switch(rotateCornerType(downTarget.cornerType, newAngleDegree)) {
          case METypes.CornerType.TopLeft:
            t.left += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.top += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.width -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            t.height -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            break;
          case METypes.CornerType.BottomLeft:
            t.left += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.top += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.width -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            t.height -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            break;
          case METypes.CornerType.TopRight:
            t.left -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.top -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.width += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            t.height += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            break;
          case METypes.CornerType.BottomRight:
            t.left -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.top -= (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 1;
            t.width += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            t.height += (mouseInfo.delta.x / this._renderer.renderingScaleFactor) * 2;
            break;
        }
      }

      // text width-height is auto generated from render, so we should scale font
      if(itemsActions.isText(item)) {
        const originalWidth = item.transform.width;
        const scaleFactor = t.width / originalWidth;
        let fontSize = item.fontSize * scaleFactor;
        fontSize = clamp(fontSize, ME_CONFIG.TEXT_TAB.MIN_FONT_SIZE, ME_CONFIG.TEXT_TAB.MAX_FONT_SIZE)
        itemsActions.updateText(item.id, {fontSize});
        itemsActions.updateTransform(downTarget.itemId, {
          angleDegree: newAngleDegree
        });
      }
      else {
        itemsActions.updateTransform(downTarget.itemId, {
          ...t,
          angleDegree: newAngleDegree
        });
      }
    } else if(downTarget.type === 'item') {
      itemsActions.updateTransform(downTarget.itemId, {
        left: item.transform.left + (mouseInfo.delta.x / this._renderer.renderingScaleFactor),
        top: item.transform.top + (mouseInfo.delta.y / this._renderer.renderingScaleFactor)
      });
    }
  }

  private _addNewText() {
    if(this.store.common.edittingText !== undefined || this._edittingText) return;
    const newItem = this._getNewItemTransform(0, 0);
    const textTab = this.store.tabs.textTab;
    this.actions.itemsActions.addItem({
      id: newItem.id,
      text: '',
      color: textTab.color,
      align: textTab.align,
      fontFrame: textTab.fontFrame,
      font: textTab.font,
      fontSize: textTab.fontSize,
      transform: newItem.transform
    });
    this.actions.commonActions.setSelectedItem(newItem.id);
  }

  private _getNewItemTransform(width: number, height: number, withId: boolean = true) {
    const {itemsActions} = this.actions;
    const pos = this._renderer.getCenterOfCanvas();
    return {
      id: withId ? itemsActions.generateId() : -1,
      transform: {
        width,
        height,
        angleDegree: 0,
        scale: 1,
        orderIndex: itemsActions.getNewOrderIndex(),
        left: pos.x - width/2,
        top: pos.y - height/2,
        hide: false,
        flipped: false
      }
    }
  }
}

const MediaEditorContext = createContext<ContextData>();
export const MediaEditorContextProvider: ParentComponent<METypes.ContextDataOptions> = (props) => {
  return (
    <MediaEditorContext.Provider value={new ContextData(props)}>
      {props.children}
    </MediaEditorContext.Provider>
  );
};
export const useMediaEditor = () :
[store: typeof ContextData.prototype.store,
  actions: typeof ContextData.prototype.actions,
  mediaEditor: typeof ContextData.prototype] => {
  const context = useContext(MediaEditorContext);
  return [context.store, context.actions, context]
};
