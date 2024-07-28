import PopupElement from '.';
import apiManagerProxy from '../../lib/mtproto/mtprotoworker';
import {MediaEditorComponent} from '../mediaEditor/index';
import {render} from 'solid-js/web';

let currentPopup: PopupMediaEditor;

export function getCurrentMediaEditorPopup() {
  return currentPopup;
}

export default class PopupMediaEditor extends PopupElement {
  constructor(private _file: File, private _onConfirm: (newFile: File) => void) {
    super('popup-send-photo popup-media-editor', {
      closable: false,
      title: false,
      scrollable: false
    });

    this._construct();
  }

  private async _construct() {
    const self = this;
    const mediaSrc = await apiManagerProxy.invoke('createObjectURL', this._file);

    var header = this.container.getElementsByClassName('popup-header')[0];
    this.container.removeChild(header);

    const dispose = render(() => {
      return MediaEditorComponent({
        file: this._file,
        mediaSrc,
        onConfirm(newFile) {
          self._onConfirm(newFile);
          self.destroy();
        },
        onClose() {
          self.destroy();
        }
      });
    }, this.container);


    this.addEventListener('close', () => {
      if(currentPopup === this) {
        dispose();
        currentPopup = undefined;
      }
    });

    currentPopup = this;
  }
}

(window as any).PopupMediaEditor = PopupMediaEditor;
