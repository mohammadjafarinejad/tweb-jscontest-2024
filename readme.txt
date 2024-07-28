Telegram JS Contest Round 2
Participant: Mohammad Jafarinejad

https://t.me/mmdjn_contest


### Media Editor Types (~/core/type.ts)

This file contains all types, enums, and interfaces for the MediaEditor:

- **METypes.Geo:** Geometric types.
- **METypes.Item:** Item-related types.
- **METypes.Pointer:** Pointer-related types.




### Media Editor Store (~/core/store.ts)

The `MediaEditorStore` class, using SolidJS `createStore`, manages all shared data and states, and supports an stack-based undo-redo system (this.historyActions).
The store has two parts: `store` for accessing data and `action` for interacting with it.
SolidJS updates components that use store data and event listeners track changes where data doesn't auto-update.

Undo-redo data is in `store.state`, while other data is categorized by use case.

Example usage from context.ts:
```javascript
const {tabsActions, drawTabAction, historyActions} = this.actions;

tabsActions.setActiveTab(METypes.TabType.Draw);

historyActions.saveState();

this.actions.onAny((event) => {
	if(event === 'activeTabChanged') {
        console.log(this.store.tabs.activeTabType);
      }
});

historyActions.undo();
```




### Media Editor Context (~/core/context.ts)

The core of the MediaEditor logic, acts as a bridge between components, events, store, and the canvas rendering layer..




### Media Editor Renderer (~/core/renderer.ts)

This class handles multi-layer rendering by listening to state changes. It efficiently re-renders only the affected layers, combines them using a buffer, and updates the on-screen canvas during animation frames.

By using multi-layer offscreen rendering, a buffer layer, and throttled rendering calls, performance during user interactions with the canvas is significantly improved.

Rendering Layers:

- Background Layer: Enhance settings (*OFFSCREEN-WEBGL1*)
- Drawing Layer (*OFFSCREEN-2D*)
- Items Layer: Texts, stickers (*OFFSCREEN-2D*)
- Buffer Layer: Merges all layers on changes to show in `Rendering Layer` (*OFFSCREEN-2D*)
- Rendering Layer: On-screen display (*ONSCREEN-2D*)




### Media Editor Helpers (~/core/helpers.ts)

General utility functions for the MediaEditor




### Image Processing (~/core/imageProcessing.ts)

- WebGl app to apply enhance settings to the image (BackGround Layer)
- Helper function to create Guassion Blur for `Blur Draw tool`, first it will scale down image to 256px then it will apply blur alghorithm




### More Notes and Features

- **Lazy Font Loading:** Fonts load lazily and re-render texts when loaded.

- **Layer Sizing:** Offscreen layers have a fixed optimal size. RenderingLayer size adjusts based on crop settings, window resize, and fullscreen mode.

- **Coordinate System:** Items use left-top coordinates for offscreen layers. `renderingScaleFactor` transforms data for RenderingLayer.

- **Compatibility:**: I checked All features and APIs i used with [caniuse.com](https://caniuse.com) to ensure they work on Chrome and Safari.

- **SVG Optimization:** Compressed `DrawTool-Blur.svg` from 2MB to 150KB.

- **Draw Tool:** Brush size changes with speed; it also use a drawing stabilizer.

- **Multi-Line Text:** Supports multi-line text rendering.

- **Relative Base Sizing:** Sticker, font, and brush sizes adjust based on image size.

- **Development:** `MEHelpers.Development.initializeDev()` sets up preset configurations (`ME_CONFIG.IS_DEV`). Currently disabled;
