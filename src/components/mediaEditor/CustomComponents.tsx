import {hexToRgb, ColorHsla, hexaToHsla, rgbaToHsla, hslaToRgba, rgbaToHexa, hslaToString} from '../../helpers/color';
import clamp from '../../helpers/number/clamp';
import InputField, {InputState} from '../inputField';
import {Accessor, createEffect, createSignal, JSX, onCleanup, onMount, Show} from 'solid-js';
import {createStore} from 'solid-js/store';
import {MEIcons} from './icons';
import {ME_CONFIG} from './config';

export const CustomButton = (params: {
  title?: string,
  icon?: JSX.Element,
  disabled?: boolean,
  isLong?: boolean,
  active?: boolean,
  isRounded?: boolean,
  className?: string,
  style?: JSX.CSSProperties,
  onClick?: () => void
}) => {
  const classes = [
    'btn-icon',
    'custom-button',
    params.isLong && 'long-btn',
    params.isRounded && 'rounded',
    params.className
  ].filter(Boolean).join(' ');
  // ? The params.active should be included here to ensure it updates on changes
  return <button class={`${classes} ${params.active && 'active'}`}
    onclick={params.onClick}
    disabled={params.disabled}
    style={params.style}>
    {params.icon}
    {params.title && <span>{params.title}</span>}
  </button>
}

const CustomSlider = (props: {
  min: number,
  max: number,
  step: number,
  value: number,
  isCenter?: boolean,
  style?: JSX.CSSProperties,
  onChange: (newValue: number) => void,
  onConfirm: () => void,
}) => {
  let inputRef: HTMLInputElement | undefined;
  const updateStyle = (value: number) => {
    if(!inputRef || !props.isCenter) return;
    const totalValue = Math.abs(props.min) + Math.abs(props.max);
    const progressPercentage = (Math.abs(value) / totalValue) * 100;
    const normalizedProgressPercentage = ((Math.abs(props.min) + value) / totalValue) * 100;
    inputRef.style.setProperty('--before-width', `${progressPercentage}%`);
    inputRef.style.setProperty('--before-left', normalizedProgressPercentage > 50 ? '50%' : 'unset');
    inputRef.style.setProperty('--before-right', normalizedProgressPercentage < 50 ? '50%' : 'unset');
  }

  const handleInput = (e: Event) => {
    const newValue = parseFloat((e.target as HTMLInputElement).value);
    updateStyle(newValue);
    props.onChange(newValue);
  };

  createEffect(() =>{
    updateStyle(props.value);
  }, [props.value]);

  return (
    <input
      ref={(el) => {
        inputRef = el;
        updateStyle(props.value);
      }}
      class={`customSlider ${props.isCenter ? 'slider-center' : 'slider-left'}`}
      type='range'
      min={props.min}
      max={props.max}
      step={props.step}
      value={props.value}
      onInput={handleInput}
      onMouseUp={props.onConfirm}
      style={props.style}
    />
  );
};

export const renderSlider = (
  label: string,
  min: number,
  max: number,
  value: Accessor<number>,
  onChange: (v: number) => void,
  onConfirm: () => void,
  defaultValue?: number,
  isCenter?: boolean,
  color?: string
) => {
  return <HeaderWithContent title={label}
    rightElement={<div
      style={{
        'font-weight': 500,
        'color': `${defaultValue === undefined || value() === defaultValue ? '#717579' : 'var(--primary-color)'}`}}>
      {value()}
    </div>}>
    <CustomSlider
      min={min}
      max={max}
      step={1}
      value={value()}
      onChange={onChange}
      onConfirm={onConfirm}
      isCenter={isCenter}
      style={{
        width: '100%',
        ...color ? {'--main-color': color} : {}
      }}
    />
  </HeaderWithContent>
}

export namespace CustomColorPicker {
  // const HEX_DEFAULT_COLORS = [
  //   '#ffffff',
  //   '#FE4438',
  //   '#FF8901',
  //   '#FFD60A',
  //   '#33C759',
  //   '#62E5E0',
  //   '#0A84FF',
  //   '#BD5CF3'
  // ];

  // const RGB_DEFAULT_COLORS = HEX_DEFAULT_COLORS.map(x => hexToRgb(x));

  const useMouseHelper = (options: {
    onDrag?: (event: MouseEvent) => void;
    onDragFinished?: (event: MouseEvent) => void;
    onMouseDown?: (event: MouseEvent) => void;
    onMouseUp?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
  } = {}) => {
    const [isMouseDown, setIsMouseDown] = createSignal(false);
    const [isDragging, setIsDragging] = createSignal(false);
    const [delta, setDelta] = createSignal({x: 0, y: 0});
    const [offset, setOffset] = createSignal({x: 0, y: 0});
    const [latestPoint, setLatestPoint] = createSignal({x: 0, y: 0});

    let startX = 0;
    let startY = 0;

    const handleDrag = (value: boolean, event: MouseEvent) => {
      if(isDragging() !== value) {
        setIsDragging(value);
        if(!value) options.onDragFinished?.(event);
      }
      else {
        options.onDrag?.(event);
      }
    }

    const handleMouseDown = (event: MouseEvent) => {
      setIsMouseDown(true);
      startX = event.clientX;
      startY = event.clientY;
      setLatestPoint({x: startX, y: startY});
      options.onMouseDown?.(event);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseUp = (event: MouseEvent) => {
      setIsMouseDown(false);
      handleDrag(false, event);
      options.onMouseUp?.(event);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if(isMouseDown()) {
        const currentX = event.clientX;
        const currentY = event.clientY;
        setDelta({x: currentX - startX, y: currentY - startY});
        setOffset({x: currentX - latestPoint().x, y: currentY - latestPoint().y});
        setLatestPoint({x: currentX, y: currentY});
        handleDrag(true, event);
      }
    };

    const handleMouseLeave = (event: MouseEvent) => {
      if(isMouseDown()) {
        // setIsMouseDown(false);
        // handleDrag(false, event);
      }
      options.onMouseLeave?.(event);
    };

    return {
      isMouseDown,
      isDragging,
      delta,
      offset,
      latestPoint,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleMouseLeave
    };
  };

  const ColorPickerSlider = (props: {
    hue: number,
    onHueChanged: (value: number) => void,
    style?: JSX.CSSProperties
  }) => {
    return <input
      class='slider'
      type='range'
      id='hue'
      min='0'
      max='360'
      value={props.hue}
      onInput={(e) => { props.onHueChanged(Number(e.currentTarget.value)); }}
      style={{
        '--thumb-color': `hsla(${props.hue}, 100%, 50%, ${1})`
      }}
    />
  }

  const ColorBox = (props: {
    color: ColorHsla,
    onChange: (s: number, l: number) => void;
  }) => {
    let colorArea: HTMLDivElement | undefined;
    let colorBoxPointer: HTMLDivElement | undefined;
    const mouseHelper = useMouseHelper({
      onMouseDown(event) {
        selectColor(event);
      },
      onDrag(event) {
        selectColor(event);
      }
    });

    const selectColor = (event: MouseEvent) => {
      if(colorArea && colorBoxPointer) {
        const rect = colorArea.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 0, rect.width);
        const y = clamp(event.clientY - rect.top, 0, rect.height);

        const xProgress = clamp((x / rect.width) * 100, 0, 100);
        const yProgress = clamp(100 - (y / rect.height) * 100, 0, 100);
        const s = clamp(xProgress, 0, 100);
        const l = clamp(yProgress - (50 * (xProgress / 100) * (yProgress / 100)), 0, 100);
        props.onChange(s,  l);
      }
    };

    const updatePointer = () => {
      if(colorArea && colorBoxPointer) {
        const rect = colorArea.getBoundingClientRect();
        const x = (props.color.s / 100) * rect.width;
        let yProgress = props.color.l + (50 * (clamp(props.color.l * 2, 0, 100) / 100) * (props.color.s / 100));
        yProgress = clamp(yProgress, 0, 100);
        const y = (1 - (yProgress / 100)) * rect.height;
        // console.log('updatePointer', props.color, x, y);
        colorBoxPointer.style.left = `${x}px`;
        colorBoxPointer.style.top = `${y}px`;
      }
    };

    createEffect(() => {
      updatePointer();
    });

    return <div
      ref={(el) => {
        colorArea = el;
        updatePointer();
      }}
      class='color-box'
      onmousedown={mouseHelper.handleMouseDown}
      onmousemove={mouseHelper.handleMouseMove}
      onmouseup={mouseHelper.handleMouseUp}
      onmouseleave={mouseHelper.handleMouseLeave}
    >
      <div class='bg1'></div>
      <div class='bg2'></div>
      <div
        class='pointer'
        ref={(el) => {
          colorBoxPointer = el;
          updatePointer();
        }}
      ></div>
    </div>
  }

  export const Component = (props: {
    color: ColorHsla,
    isColorPickerOpen: boolean,
    // Accessor<ColorHsla>,
    toggleColorPicker: (v: boolean) => void
    onChange: (v: ColorHsla) => void
  }) => {
    // const [selectorOpen, setOpenedCustomColors] = createSignal(true);
    const handleSetColor = (color: ColorHsla | string, updateHexInput = true, updateRgbInput = true) => {
      if(color === undefined) { // * set to red
        color = {
          h: 0,
          s: 100,
          l: 50,
          a: 1
        };
      } else if(typeof(color) === 'string') {
        if(color[0] === '#') {
          color = hexaToHsla(color);
        } else {
          const rgb = color.match(/[.?\d]+/g);
          color = rgbaToHsla(+rgb[0], +rgb[1], +rgb[2], rgb[3] === undefined ? 1 : +rgb[3]);
        }
      }

      const rgbaArray = hslaToRgba(color.h, color.h, color.l, 1);
      if(updateHexInput) {
        hexInputField.setValueSilently(rgbaToHexa(rgbaArray));
        hexInputField.setState(InputState.Neutral);
      }
      if(updateRgbInput) {
        rgbInputField.setValueSilently(rgbaArray.slice(0, -1).join(', '));
        rgbInputField.setState(InputState.Neutral);
      }

      props.onChange(color);
    };

    const hexInputField = new InputField({label: 'Appearance.Color.Hex'});
    hexInputField.input.addEventListener('input', () => {
      let value = hexInputField.value.replace(/#/g, '').slice(0, 6);

      const match = value.match(/([a-fA-F\d]+)/);
      const valid = match && match[0].length === value.length && [/* 3, 4,  */6].includes(value.length);
      hexInputField.setState(valid ? InputState.Neutral : InputState.Error);

      value = '#' + value;
      hexInputField.setValueSilently(value);

      if(valid) {
        handleSetColor(value, false, true);
      }
    });

    // patched https://stackoverflow.com/a/34029238/6758968
    const rgbRegExp = /^(?:rgb)?\(?([01]?\d\d?|2[0-4]\d|25[0-5])(?:\W+)([01]?\d\d?|2[0-4]\d|25[0-5])\W+(?:([01]?\d\d?|2[0-4]\d|25[0-5])\)?)$/;
    const rgbInputField = new InputField({label: 'Appearance.Color.RGB'});
    rgbInputField.input.addEventListener('input', () => {
      const match = rgbInputField.value.match(rgbRegExp);
      rgbInputField.setState(match ? InputState.Neutral : InputState.Error);

      if(match) {
        handleSetColor(rgbaToHsla(+match[1], +match[2], +match[3]), true, false);
      }
    });

    hexInputField.container.style.setProperty('--height', '35px');
    hexInputField.container.style.setProperty('--line-height', '0.4rem');

    rgbInputField.container.style.setProperty('--height', '35px');
    rgbInputField.container.style.setProperty('--line-height', '0.4rem');

    const handleHueUpdate = (value: number) => {
      handleSetColor({
        ...props.color,
        h: clamp(value, 0, 360)
      });
    }

    const hslaToRGBString = (color: ColorHsla) => {
      return hslaToRgba(color.h, color.s, color.l, color.a).slice(0, 3).join('');
    }

    // console.log(RGB_DEFAULT_COLORS.map(x => x === hslaToRgba(props.color.h, props.color.s, props.color.l, props.color.a).slice(0, 3)));
    // console.log(RGB_DEFAULT_COLORS);
    // console.log( hslaToString(props.color), hslaToRgba(props.color.h, props.color.s, props.color.l, props.color.a).slice(0, 3));

    return (
      <div class='custom-color-picker'
        style={{
          '--hue-value': props.color.h,
          '--selected-color': hslaToString(props.color).replace(/^hsla\(|, 1\)$/g, '')
        }}
      >
        <div class='colors'>
          {props.isColorPickerOpen && <ColorPickerSlider
            hue={props.color.h}
            onHueChanged={handleHueUpdate}
          />}
          <Show when={!props.isColorPickerOpen}>
            {ME_CONFIG.COLORS.map(x =>
              <button
                class={`btn-icon colorPallete ${hslaToRGBString(props.color) === hslaToRGBString(x) ? 'active' : ''}`}
                onclick={() => {handleSetColor(x)}}>
                <div style={{'background-color': hslaToString(x)}}></div>
              </button>)}
          </Show>
          <button class={`btn-icon colorPallete toggle-color-picker ${props.isColorPickerOpen ? 'active' : ''}`}
            onclick={() => props.toggleColorPicker(!props.isColorPickerOpen)}>
            <div style={{'background': 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'}}></div>
          </button>
        </div>
        {props.isColorPickerOpen && <div class='container'>
          <ColorBox color={props.color} onChange={(s, l) => {
            handleSetColor({
              ...props.color,
              s,
              l
            });
          }}/>
          <div class='input-box'>
            {hexInputField.container}
            {rgbInputField.container}
          </div>
        </div>}
      </div>
    );
  }
}

export const HeaderWithContent = (props: {
  title: string;
  rightSide?: string;
  rightElement?: JSX.Element;
  children?: JSX.Element;
  className?: string;
}) => {
  return (
    <div class={`header-container ${props.className}`}>
      <div class='header'>
        <span class='title'>{props.title}</span>
        {props.rightSide && <span>{props.rightSide}</span>}
        {props.rightElement}
      </div>
      {props.children}
    </div>
  );
}

export const DegreeSlider = (props: {
  currentIndex: Accessor<number>;
  onFinishedDragging: () => void,
  onStartedDragging: () => void,
  onChange: (v: number) => void
}) => {
  let scrollContainer: HTMLDivElement;
  const _CONFIG = {
    STEP: 15,
    MIN_DEGREE: -120,
    MAX_DEGREE: 120,
    TOTAL: 120 - (-120),
    MIN_SELECTABLE_INDEX: -45,
    MAX_SELECTABLE_INDEX: 45,
    TOTAL_SELECTABLE: 45 - (-45),
    INCREASE: 2
  }

  const [scrollStore, setScrollStore] = createStore({
    dragging: false,
    startX: 0,
    startScrollLeft: 0,
    internalCurrentIndex: props.currentIndex(),
    isInternalUpdate: false
  });

  const totalMarks = Array.from({length: _CONFIG.TOTAL / _CONFIG.STEP + 1},
    (_, i) => _CONFIG.MIN_DEGREE + i * _CONFIG.STEP);

  const moveScrollTo = ({newIndex, newScrollLeft, smooth = true}: { newIndex?: number, newScrollLeft?: number, smooth?: boolean }) => {
    if(newIndex === undefined && newScrollLeft === undefined || newIndex !== undefined && newScrollLeft !== undefined) {
      throw new Error('Invalid arguments: Provide one of newIndex or newScrollLeft');
    }

    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const normalizedIndex = newIndex !== undefined ? (newIndex - _CONFIG.MIN_DEGREE) / _CONFIG.TOTAL * maxScroll : undefined;
    const scrollPosition = newScrollLeft ?? normalizedIndex;

    const minScrollAllowed = (_CONFIG.MIN_SELECTABLE_INDEX - _CONFIG.MIN_DEGREE) * (maxScroll / _CONFIG.TOTAL);
    const maxScrollAllowed = (_CONFIG.MAX_SELECTABLE_INDEX - _CONFIG.MIN_DEGREE) * (maxScroll / _CONFIG.TOTAL);
    const clampedScrollPosition = clamp(scrollPosition, minScrollAllowed, maxScrollAllowed);

    smooth ? smoothScrollTo(clampedScrollPosition) : scrollContainer.scrollLeft = clampedScrollPosition;
  };

  const updateCirclesOpacity = (newIndex: number) => {
    const circles = Array.from(scrollContainer.querySelectorAll('circle')) as SVGCircleElement[];
    circles.forEach(circle => {
      const circleIdValue = Number(circle.id);
      if(!circle.hasAttribute('data-original-opacity')) {
        circle.setAttribute('data-original-opacity', circle.getAttribute('opacity') || '1');
      }
      if(
        (circleIdValue >= 0 && circleIdValue <= newIndex) ||
        (circleIdValue >= newIndex && circleIdValue <= 0)
      ) {
        circle.setAttribute('opacity', '1');
      } else {
        circle.setAttribute('opacity', circle.getAttribute('data-original-opacity') || '0.2');
      }
    });
  };

  const getStepSize = () => {
    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    return (maxScroll / _CONFIG.TOTAL) * _CONFIG.STEP;
  };

  const smoothScrollTo = (targetScroll: number) => {
    const startScroll = scrollContainer.scrollLeft;
    const distance = targetScroll - startScroll;
    const durationMs = 250;
    let startTime: number;

    const scrollStep = (timestamp: number) => {
      if(scrollStore.dragging) return;
      if(!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easing = progress * (2 - progress); // Ease-in-out effect
      scrollContainer.scrollLeft = startScroll + distance * easing;

      if(elapsed < durationMs) {
        requestAnimationFrame(scrollStep);
      } else {
        scrollContainer.scrollLeft = targetScroll; // Ensure exact final position
      }
    };

    requestAnimationFrame(scrollStep);
  };

  const onMouseDown = (event: MouseEvent) => {
    props.onStartedDragging();
    setScrollStore({
      dragging: true,
      startX: event.pageX - scrollContainer.offsetLeft,
      startScrollLeft: scrollContainer.scrollLeft
    });
  };

  const onMouseMove = (event: MouseEvent) => {
    if(!scrollStore.dragging) return;

    const walk = (event.pageX - scrollContainer.offsetLeft - scrollStore.startX) * 1.5;
    moveScrollTo({
      newScrollLeft: scrollStore.startScrollLeft - walk,
      smooth: false
    });
  };

  const onMouseUp = () => {
    props.onFinishedDragging();
    setScrollStore({dragging: false, isInternalUpdate: false});
  }

  createEffect(() => {
    if(!scrollStore.isInternalUpdate) {
      const newIndex = props.currentIndex();
      if(newIndex !== scrollStore.internalCurrentIndex) {
        moveScrollTo({newIndex});
        setScrollStore({isInternalUpdate: true});
      }
    }
  }, [props.currentIndex]);

  const onScroll = () => {
    if(!scrollContainer) return;

    const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
    const normalizedValue = maxScroll ? scrollContainer.scrollLeft / maxScroll : 0;
    let newIndex = _CONFIG.MIN_DEGREE + Math.floor(_CONFIG.TOTAL * normalizedValue);
    newIndex = clamp(newIndex, _CONFIG.MIN_SELECTABLE_INDEX, _CONFIG.MAX_SELECTABLE_INDEX);

    if(newIndex !== scrollStore.internalCurrentIndex) {
      updateCirclesOpacity(newIndex);
      setScrollStore({internalCurrentIndex: newIndex, isInternalUpdate: true});
      props.onChange(newIndex);
    }
  };

  const onWheel = (event: WheelEvent) => {
    if(!scrollContainer) return;

    const stepSize = getStepSize();
    const direction = Math.sign(event.deltaY);
    const newScrollLeft = Math.round((scrollContainer.scrollLeft + direction * stepSize) / stepSize) * stepSize;
    moveScrollTo({newScrollLeft});
  };

  onMount(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    scrollContainer.addEventListener('scroll', onScroll);
    scrollContainer.addEventListener('wheel', onWheel, {passive: true});

    if(scrollContainer) {
      moveScrollTo({newIndex: scrollStore.internalCurrentIndex, smooth: false});
      updateCirclesOpacity(scrollStore.internalCurrentIndex);
    }

    onCleanup(() => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      scrollContainer.removeEventListener('scroll', onScroll);
      scrollContainer.removeEventListener('wheel', onWheel);
    });
  });

  return (
    <div class="degree-slider">
      <div class="marks"
        onMouseDown={onMouseDown}
        ref={el => scrollContainer = el}
      >
        {totalMarks.map((mark, index) => {
          return <div class="degree-step">
            {mark}°
            <svg width="54px" height="4" viewBox="0 0 54 4" xmlns="http://www.w3.org/2000/svg">
              {index !== 0 && (
                <>
                  <circle id={`${mark-(_CONFIG.INCREASE*3)}`} cx="6.25%" cy="2" r="1.5" fill="white" opacity="0.2"/>
                  <circle id={`${mark-(_CONFIG.INCREASE*2)}`} cx="20.83%" cy="2" r="1.5" fill="white" opacity="0.2" />
                  <circle id={`${mark-(_CONFIG.INCREASE*1)}`} cx="35.41%" cy="2" r="1.5" fill="white" opacity="0.2" />
                </>
              )}
              <circle id={`${mark+(_CONFIG.INCREASE*0)}`} cx="50%" cy="2" r="1.5" fill="white" opacity="0.5" />
              {index !== totalMarks.length-1 && (
                <>
                  <circle id={`${mark+(_CONFIG.INCREASE*1)}`} cx="64.59%" cy="2" r="1.5" fill="white" opacity="0.2" />
                  <circle id={`${mark+(_CONFIG.INCREASE*2)}`} cx="79.17%" cy="2" r="1.5" fill="white" opacity="0.2" />
                  <circle id={`${mark+(_CONFIG.INCREASE*3)}`} cx="93.75%" cy="2" r="1.5" fill="white" opacity="0.2" />
                </>
              )}
            </svg>
          </div>
        }
        )}
        <div class="active-mark">
          {props.currentIndex()}°
          <div class="pointer"><MEIcons.UpArrow /></div>
        </div>
      </div>
    </div>
  );
};
