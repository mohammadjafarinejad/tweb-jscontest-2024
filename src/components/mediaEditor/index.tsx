import {createEffect, onCleanup, Show} from 'solid-js';
import ButtonIcon from '../buttonIcon';
import {CustomButton, DegreeSlider} from './CustomComponents';
import {MediaEditorContextProvider, useMediaEditor} from './core/MediaEditorContext';
import {MediaEditorTabs} from './tabsComponents';
import {attachClickEvent} from '../../helpers/dom/clickEvent';
import {MEIcons} from './icons';
import {METypes} from './core/types';

export const MediaEditorComponent = (props: METypes.ContextDataOptions) => {
  return <MediaEditorContextProvider {...props}>
    <Component/>
  </MediaEditorContextProvider>
}

const Component = () => {
  const [store, actions, mediaEditor] = useMediaEditor();
  const {} = actions;
  const {common} = store;

  const btnClose = ButtonIcon('close');
  btnClose.classList.add('popup-close');
  attachClickEvent(btnClose, () => mediaEditor.handleCancel());

  const btnConfirm = ButtonIcon('check');
  btnConfirm.classList.add('confirm-btn', 'btn-circle', 'btn-corner', 'animated-button-icon');
  attachClickEvent(btnConfirm, () => mediaEditor.handleConfirm());

  createEffect(() => {
    onCleanup(() => {
      mediaEditor.handleCleanUp();
    });
  });

  return <div class='popup-editor'>
    <div ref={(el) => mediaEditor.setRef('previewElement', el)} class='editor-preview'>
      <div class={`canvas-container ${common.status.isLoaded ? 'loaded' : ''}`.trim()}
        style={{
          '--canvas-top': `${common.canvasState.topPercentage}%`,
          '--canvas-width': `${common.canvasState.width}px`,
          '--canvas-height': `${common.canvasState.height}px`,
          '--canvas-angle': `${actions.tabsActions.isCropTab() ? actions.commonActions.getAngleDegrees() : 0}deg`,
          '--canvas-scale': `${common.canvasState.scale}`,
          '--overflow': `${actions.tabsActions.isCropTab() ? 'unset' : 'hidden'}`
        }}>
        <canvas
          ref={(el) => mediaEditor.setRef('canvasElement', el)}
          style={{'display': 'block'}}
        >Your browser does not support the Media Editor.</canvas>

        <div class='overflow-hidden'>
          <Show when={actions.tabsActions.isDrawTab()}>
            <div ref={(el) => mediaEditor.setRef('brushPointer', el)} class='brush-pointer'></div>
          </Show>
        </div>

        <div
          ref={(el) => {mediaEditor.setRef('selectedItemContainer', el);}}
          class={`
            selected-item-container ${actions.tabsActions.isCropTab() ? 'solid-border' : ''}`.trim()}
          data-no-transition={!actions.tabsActions.isCropTab() || store.tabs.cropTab.isMovingOrResizing}>
          <Show when={actions.tabsActions.isCropTab()}>
            <div class='cropper'>
              <div class='shadow'/>
              <div class={`grid grid-3x3 ${store.tabs.cropTab.isMovingOrResizing && 'show'}`}/>
              <div class={`grid grid-9x9 ${store.tabs.cropTab.isRotating && 'show'}`}/>
            </div>
          </Show>
          <div class='border'/>
          <div class="handles">
            <div class="handle top-left" data-corner-type={METypes.CornerType.TopLeft}></div>
            <div class="handle top-right" data-corner-type={METypes.CornerType.TopRight}></div>
            <div class="handle bottom-left" data-corner-type={METypes.CornerType.BottomLeft}></div>
            <div class="handle bottom-right" data-corner-type={METypes.CornerType.BottomRight}></div>
          </div>
          {/* <Show when={common.edittingText !== undefined}>
            <div class='caret' style={{
              'left': (common.edittingText ? common.edittingText.caretRect.left : 0) +'px',
              'top': (common.edittingText ? common.edittingText.caretRect.top : 0) +'px',
              'background-color': common.edittingText ? common.edittingText.caretInfo.color : 'white'
            }}/>
          </Show> */}
        </div>
      </div>

      <Show when={actions.tabsActions.isCropTab()}>
        <div class='crop-tab-bar'>
          <CustomButton
            icon={MEIcons.Rotate()}
            active={actions.cropTabActions.hasBaseAngle()}
            onClick={() => actions.commonActions.rotateBaseAngle()} isRounded/>
          <DegreeSlider
            currentIndex={() => common.canvasState.adjustmentAngle}
            onStartedDragging={() => actions.cropTabActions.setTransformationState({isRotating: true})}
            onFinishedDragging={() => actions.cropTabActions.setTransformationState({isRotating: false})}
            onChange={(v) => actions.commonActions.setCanvasState({adjustmentAngle: v})}
          />
          <CustomButton
            icon={MEIcons.Flip()}
            active={store.state.cropSettings.flipHorizontal}
            onClick={() => actions.stateActions.setCrop({
              flipHorizontal: !store.state.cropSettings.flipHorizontal
            })} isRounded/>
        </div>
      </Show>
    </div>

    <div class='editor-panel'>
      <div class='header'>
        <div class='header-bar'>
          {btnClose}
          <p>Edit</p>
          {btnConfirm}
          <div class='rightSide'>
            <CustomButton
              icon={MEIcons.Undo()}
              disabled={!common.history.canUndo}
              onClick={actions.historyActions.undo}
              isRounded/>
            <CustomButton
              icon={MEIcons.Redo()}
              disabled={!common.history.canRedo}
              onClick={actions.historyActions.redo}
              isRounded/>
          </div>
        </div>
        <div class='tabs'>
          {MediaEditorTabs.LIST.map(tab => {
            const active = store.tabs.tabType === tab.type;
            return <CustomButton
              icon={tab.icon}
              active={active}
              onClick={() => actions.tabsActions.setActiveTab(tab.type)}
            />
          })}
        </div>
      </div>

      <Show when={actions.tabsActions.isEnhanceTab()}><MediaEditorTabs.Enhance.Component/></Show>
      <Show when={actions.tabsActions.isCropTab()}><MediaEditorTabs.Crop.Component/></Show>
      <Show when={actions.tabsActions.isTextTab()}><MediaEditorTabs.Text.Component/></Show>
      <Show when={actions.tabsActions.isDrawTab()}><MediaEditorTabs.Draw.Component/></Show>
      <Show when={actions.tabsActions.isStickerTab()}><MediaEditorTabs.Sticker.Component/></Show>
    </div>
  </div>
};
