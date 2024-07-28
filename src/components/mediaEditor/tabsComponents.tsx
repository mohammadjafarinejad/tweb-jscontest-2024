import {onCleanup} from 'solid-js';
import {hslaToString} from '../../helpers/color';
import {CustomButton, CustomColorPicker, HeaderWithContent, renderSlider} from './CustomComponents';
import {useMediaEditor} from './core/MediaEditorContext';
import {simulateClickEvent} from '../../helpers/dom/clickEvent';
import {MEIcons} from './icons';
import {ME_CONFIG} from './config';
import {METypes} from './core/types';
import {EmoticonsDropdown} from '../emoticonsDropdown';
import {MEHelpers} from './core/helpers';
import rootScope from '../../lib/rootScope';
import wrapSticker from '../wrappers/sticker';

const capitalizeFirstChar = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export namespace MediaEditorTabs {
  export const LIST = [
    {type: METypes.PanelTab.Enhance, icon: MEIcons.Tab.Enhance()},
    {type: METypes.PanelTab.Crop, icon: MEIcons.Tab.Crop()},
    {type: METypes.PanelTab.Text, icon: MEIcons.Tab.Text()},
    {type: METypes.PanelTab.Draw, icon: MEIcons.Tab.Draw()},
    {type: METypes.PanelTab.Sticker, icon: MEIcons.Tab.Sticker()}
  ];
}

export namespace MediaEditorTabs.Enhance {
  export const Component = () => {
    const [store, actions, mediaEditor] = useMediaEditor();
    const {stateActions} = actions;

    type EnhanceSettingKey = keyof typeof store.state.enhanceSettings;
    const sliders: { label: string, key: EnhanceSettingKey, min: number, max: number, center?: true }[] = [
      {label: 'Enhance', key: 'enhance', min: 0, max: 100},
      {label: 'Brightness', key: 'brightness', min: -100, max: 100, center: true},
      {label: 'Contrast', key: 'contrast', min: -100, max: 100, center: true},
      {label: 'Saturation', key: 'saturation', min: -100, max: 100, center: true},
      {label: 'Warmth', key: 'warmth', min: -100, max: 100, center: true},
      {label: 'Fade', key: 'fade', min: 0, max: 100},
      {label: 'Highlights', key: 'highlights', min: -100, max: 100, center: true},
      {label: 'Shadows', key: 'shadows', min: -100, max: 100, center: true},
      {label: 'Vignette', key: 'vignette', min: 0, max: 100},
      {label: 'Grain', key: 'grain', min: 0, max: 100},
      {label: 'Sharpen', key: 'sharpen', min: 0, max: 100}
    ];

    return (
      <div class="tab enhance-tab">
        {sliders.map(({label, key, min, max, center}) =>
          renderSlider(label, min, max,
            () => store.state.enhanceSettings[key],
            (v) => stateActions.setEnhance({[key]: v}),
            () => mediaEditor.onConfirm(), 0, center)
        )}
      </div>
    );
  };
}

export namespace MediaEditorTabs.Crop {
  const ASPECT_RATIOS = [
    {id: METypes.AspectRatio.Free, icon: MEIcons.AspectRatio.Free},
    {id: METypes.AspectRatio.Original, icon: MEIcons.AspectRatio.Orginal},
    {id: METypes.AspectRatio.Square, icon: MEIcons.AspectRatio.Square},
    {id: METypes.AspectRatio._3_2, icon: MEIcons.AspectRatio.A3_2, reversedId: METypes.AspectRatio._2_3},
    {id: METypes.AspectRatio._4_3, icon: MEIcons.AspectRatio.A4_3, reversedId: METypes.AspectRatio._3_4},
    {id: METypes.AspectRatio._5_4, icon: MEIcons.AspectRatio.A5_4, reversedId: METypes.AspectRatio._4_5},
    {id: METypes.AspectRatio._7_5, icon: MEIcons.AspectRatio.A7_5, reversedId: METypes.AspectRatio._5_7},
    {id: METypes.AspectRatio._16_9, icon: MEIcons.AspectRatio.A16_9, reversedId: METypes.AspectRatio._9_16}
  ];

  export const Component = () => {
    const [store, actions, mediaEditor] = useMediaEditor();
    return <div class='tab crop-tab'>
      <HeaderWithContent title='Aspect ratio' className='aspect-ratios'>
        <ul>
          {ASPECT_RATIOS.map((x) => (
            <li>
              <CustomButton
                icon={x.icon()}
                title={capitalizeFirstChar(x.id)}
                onClick={() => mediaEditor.setAspectRatio(x.id)}
                isLong
                active={store.tabs.cropTab.selectedAspectRatio === x.id}/>
              {x.reversedId !== undefined &&
                <CustomButton
                  className='reversed'
                  icon={x.icon()}
                  title={capitalizeFirstChar(x.reversedId)}
                  onClick={() => mediaEditor.setAspectRatio(x.reversedId)}
                  isLong
                  active={store.tabs.cropTab.selectedAspectRatio === x.reversedId}/>}
            </li>
          ))}
        </ul>
      </HeaderWithContent>
    </div>;
  }
}

export namespace MediaEditorTabs.Text {
  export const Component = () => {
    const [store, actions, mediaEditor] = useMediaEditor();
    const {textTabActions} = actions;

    return <div class='tab text-tab'>
      <CustomColorPicker.Component
        isColorPickerOpen={store.tabs.textTab.isColorPickerOpen}
        color={store.tabs.textTab.color}
        toggleColorPicker={(isColorPickerOpen) => actions.textTabActions.set({isColorPickerOpen})}
        onChange={(color) => textTabActions.set({color})}/>
      <div class="config-row">
        <div class="text-align">
          <CustomButton
            active={store.tabs.textTab.align === METypes.TextAlign.Left}
            icon={MEIcons.TextAlign.Left()}
            onClick={() => textTabActions.set({align: METypes.TextAlign.Left})}
          />
          <CustomButton
            active={store.tabs.textTab.align === METypes.TextAlign.Center}
            icon={MEIcons.TextAlign.Center()}
            onClick={() => textTabActions.set({align: METypes.TextAlign.Center})}
          />
          <CustomButton
            active={store.tabs.textTab.align === METypes.TextAlign.Right}
            icon={MEIcons.TextAlign.Right()}
            onClick={() => textTabActions.set({align: METypes.TextAlign.Right})}
          />
        </div>

        <div class="text-style">
          <CustomButton
            active={store.tabs.textTab.fontFrame === METypes.FontFrame.No}
            icon={MEIcons.FontFrame.No()}
            onClick={() => textTabActions.set({fontFrame: METypes.FontFrame.No})}
          />
          <CustomButton
            active={store.tabs.textTab.fontFrame === METypes.FontFrame.Black}
            icon={MEIcons.FontFrame.Black()}
            onClick={() => actions.textTabActions.set({fontFrame: METypes.FontFrame.Black})}
          />
          <CustomButton
            active={store.tabs.textTab.fontFrame === METypes.FontFrame.White}
            icon={MEIcons.FontFrame.White()}
            onClick={() => actions.textTabActions.set({fontFrame: METypes.FontFrame.White})}
          />
        </div>
      </div>
      {renderSlider('Size', ME_CONFIG.TEXT_TAB.MIN_FONT_SIZE, ME_CONFIG.TEXT_TAB.MAX_FONT_SIZE,
        () => Math.round(store.tabs.textTab.fontSize),
        (fontSize) => actions.textTabActions.set({fontSize}),
        () => mediaEditor.onConfirm(),
        undefined,
        false,
        hslaToString(store.tabs.textTab.color))}
      <HeaderWithContent title='Font' className='fonts'>
        <ul>
          {ME_CONFIG.AVAILABLE_FONTS.map((x) => (
            <li>
              <CustomButton
                title={x.label ?? x.family}
                onClick={() => actions.textTabActions.set({font: x})}
                active={store.tabs.textTab.font.family === x.family}
                isLong
                style={{
                  'font-family': x.family,
                  'font-weight': x.weight,
                  'font-style': x.style
                }}/>
            </li>))}
        </ul>
      </HeaderWithContent>
    </div>;
  }
}

export namespace MediaEditorTabs.Draw {
  const DRAW_TOOLS = [
    {id: METypes.DrawTool.Pen, icon: MEIcons.DrawTool.Pen()},
    {id: METypes.DrawTool.Arrow, icon: MEIcons.DrawTool.Arrow()},
    {id: METypes.DrawTool.Brush, icon: MEIcons.DrawTool.Brush()},
    {id: METypes.DrawTool.Neon, icon: MEIcons.DrawTool.Neon()},
    {id: METypes.DrawTool.Blur, icon: MEIcons.DrawTool.Blur()},
    {id: METypes.DrawTool.Eraser, icon: MEIcons.DrawTool.Eraser()}
  ];

  export const Component = () => {
    const [store, actions, mediaEditor] = useMediaEditor();
    const {drawTabActions} = actions;

    return <div class='tab draw-tab'>
      <CustomColorPicker.Component
        isColorPickerOpen={store.tabs.drawTab.isColorPickerOpen}
        color={drawTabActions.selectedTool().color}
        toggleColorPicker={(v) => drawTabActions.toggleColorPicker(v)}
        onChange={(color) => drawTabActions.setSelectedTool({color})}/>
      <div class='size'>
        {renderSlider('Size', ME_CONFIG.DRAW_TAB.MIN_BRUSH_SIZE, ME_CONFIG.DRAW_TAB.MAX_BRUSH_SIZE,
          () => drawTabActions.selectedTool().size,
          (size) => drawTabActions.setSelectedTool({size}),
          () => mediaEditor.onConfirm(),
          undefined,
          false,
          hslaToString(drawTabActions.selectedTool().color))}
      </div>
      <HeaderWithContent title='Tool'>
        <ul>
          {DRAW_TOOLS.map((x) => (
            <li>
              <CustomButton title={capitalizeFirstChar(x.id)}
                icon={x.icon}
                onClick={() => drawTabActions.changeTool(x.id)}
                active={drawTabActions.isActive(x.id)}
                isLong
                style={{
                  '--draw-tool-color': hslaToString(store.tabs.drawTab.tools[x.id].color)
                }}/>
            </li>
          ))}
        </ul>
      </HeaderWithContent>
    </div>
  }
}

export namespace MediaEditorTabs.Sticker {
  export const Component = () => {
    const [store, actions, mediaEditor] = useMediaEditor();

    const emoticonsDropdown = new EmoticonsDropdown({
      isMediaEditor: true,
      async customOnSelect(emoji) {
        // const doc = await rootScope.managers.appDocsManager.getDoc(emoji.docId);
        const doc = await rootScope.managers.appEmojiManager.getCustomEmojiDocument(emoji.docId);
        const div = document.createElement('div');
        const wrappedSticker = await wrapSticker({
          div,
          doc: doc,
          width: 512,
          height: 512,
          static: true,
          exportLoad: 2,
          needUpscale: true,
          useCache: false,
          onlyThumb: false,
          withThumb: false
        });
        if(wrappedSticker.load) await wrappedSticker.load();
        await wrappedSticker.render;
        const imgElement = div.querySelector('img');
        const imageBitmap = await MEHelpers.dataUrlToImageBitmap(imgElement.src);
        mediaEditor.addNewSticker(emoji.docId, imageBitmap);
      }
    });

    emoticonsDropdown.init();

    emoticonsDropdown.toggle(true);
    emoticonsDropdown.getElement().style.visibility = 'hidden';

    setTimeout(() => {
      const button = emoticonsDropdown.getElement().querySelector('button.btn-icon.menu-horizontal-div-item.emoji-tabs-stickers[data-tab=\'1\']')
      simulateClickEvent(button as HTMLElement);
      setTimeout(() => {
        emoticonsDropdown.getElement().style.visibility = 'visible';
      }, 300);
    }, 500);

    onCleanup(() => {
      emoticonsDropdown.hideAndDestroy();
    });

    return <div class='tab sticker-tab'>
      {emoticonsDropdown.getElement()}
    </div>
  }
}
