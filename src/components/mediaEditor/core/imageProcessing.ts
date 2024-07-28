import {METypes} from './types';

namespace Shaders {
  export const enhanceFragmentShaderCode = `
    precision highp float;
    varying vec2 vTextureCoord;
    uniform sampler2D sTexture;
    uniform sampler2D inputImageTexture2;
    uniform float intensity;
    float enhance(float value) {
        const vec2 offset = vec2(0.001953125, 0.03125);
        value = value + offset.x;
        vec2 coord = (clamp(vTextureCoord, 0.125, 1.0 - 0.125001) - 0.125) * 4.0;
        vec2 frac = fract(coord);
        coord = floor(coord);
        float p00 = float(coord.y * 4.0 + coord.x) * 0.0625 + offset.y;
        float p01 = float(coord.y * 4.0 + coord.x + 1.0) * 0.0625 + offset.y;
        float p10 = float((coord.y + 1.0) * 4.0 + coord.x) * 0.0625 + offset.y;
        float p11 = float((coord.y + 1.0) * 4.0 + coord.x + 1.0) * 0.0625 + offset.y;
        vec3 c00 = texture2D(inputImageTexture2, vec2(value, p00)).rgb;
        vec3 c01 = texture2D(inputImageTexture2, vec2(value, p01)).rgb;
        vec3 c10 = texture2D(inputImageTexture2, vec2(value, p10)).rgb;
        vec3 c11 = texture2D(inputImageTexture2, vec2(value, p11)).rgb;
        float c1 = ((c00.r - c00.g) / (c00.b - c00.g));
        float c2 = ((c01.r - c01.g) / (c01.b - c01.g));
        float c3 = ((c10.r - c10.g) / (c10.b - c10.g));
        float c4 = ((c11.r - c11.g) / (c11.b - c11.g));
        float c1_2 = mix(c1, c2, frac.x);
        float c3_4 = mix(c3, c4, frac.x);
        return mix(c1_2, c3_4, frac.y);
    }
    vec3 hsv_to_rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    void main() {
        vec4 texel = texture2D(sTexture, vTextureCoord);
        vec4 hsv = texel;
        hsv.y = min(1.0, hsv.y * 1.2);
        hsv.z = min(1.0, enhance(hsv.z) * 1.1);
        gl_FragColor = vec4(hsv_to_rgb(mix(texel.xyz, hsv.xyz, intensity)), texel.w);
    }`

  export const sharpenVertexShaderCode =`
  attribute vec4 position;
  attribute vec2 inputTexCoord;
  varying vec2 vTextureCoord;

  uniform highp float inputWidth;
  uniform highp float inputHeight;
  varying vec2 leftTexCoord;
  varying vec2 rightTexCoord;
  varying vec2 topTexCoord;
  varying vec2 bottomTexCoord;

  void main() {
      gl_Position = position;
      vTextureCoord = inputTexCoord;
      highp vec2 widthStep = vec2(1.0 / inputWidth, 0.0);
      highp vec2 heightStep = vec2(0.0, 1.0 / inputHeight);
      leftTexCoord = inputTexCoord - widthStep;
      rightTexCoord = inputTexCoord + widthStep;
      topTexCoord = inputTexCoord + heightStep;
      bottomTexCoord = inputTexCoord - heightStep;
  }`;

  export const sharpenFragmentShaderCode =
  `precision highp float;
  varying vec2 vTextureCoord;
  varying vec2 leftTexCoord;
  varying vec2 rightTexCoord;
  varying vec2 topTexCoord;
  varying vec2 bottomTexCoord;
  uniform sampler2D sTexture;
  uniform float sharpen;

  void main() {
      vec4 result = texture2D(sTexture, vTextureCoord);

      vec3 leftTextureColor = texture2D(sTexture, leftTexCoord).rgb;
      vec3 rightTextureColor = texture2D(sTexture, rightTexCoord).rgb;
      vec3 topTextureColor = texture2D(sTexture, topTexCoord).rgb;
      vec3 bottomTextureColor = texture2D(sTexture, bottomTexCoord).rgb;
      result.rgb = result.rgb * (1.0 + 4.0 * sharpen) - (leftTextureColor + rightTextureColor + topTextureColor + bottomTextureColor) * sharpen;

      gl_FragColor = result;
  }`

  export const simpleVertexShaderCode = `
  attribute vec4 position;
  attribute vec2 inputTexCoord;
  varying vec2 vTextureCoord;
  void main() {
      gl_Position = position;
      vTextureCoord = inputTexCoord;
  }`;

  export const toolsFragmentShaderCode = `
  varying highp vec2 vTextureCoord;
  uniform sampler2D sTexture;
  uniform highp float width;
  uniform highp float height;
  uniform sampler2D curvesImage;
  uniform lowp float skipTone;
  uniform lowp float shadows;
  const mediump vec3 hsLuminanceWeighting = vec3(0.3, 0.3, 0.3);
  uniform lowp float highlights;
  uniform lowp float contrast;
  uniform lowp float fadeAmount;
  const mediump vec3 satLuminanceWeighting = vec3(0.2126, 0.7152, 0.0722);
  uniform lowp float saturation;
  uniform lowp float shadowsTintIntensity;
  uniform lowp float highlightsTintIntensity;
  uniform lowp vec3 shadowsTintColor;
  uniform lowp vec3 highlightsTintColor;
  uniform lowp float exposure;
  uniform lowp float warmth;
  uniform lowp float grain;
  const lowp float permTexUnit = 1.0 / 256.0;
  const lowp float permTexUnitHalf = 0.5 / 256.0;
  const lowp float grainsize = 2.3;
  uniform lowp float vignette;
  highp float getLuma(highp vec3 rgbP) {
      return (0.299 * rgbP.r) + (0.587 * rgbP.g) + (0.114 * rgbP.b);
  }
  lowp vec3 rgbToHsv(lowp vec3 c) {
      highp vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      highp vec4 p = c.g < c.b ? vec4(c.bg, K.wz) : vec4(c.gb, K.xy);
      highp vec4 q = c.r < p.x ? vec4(p.xyw, c.r) : vec4(c.r, p.yzx);
      highp float d = q.x - min(q.w, q.y);
      highp float e = 1.0e-10;
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  lowp vec3 hsvToRgb(lowp vec3 c) {
      highp vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
      highp vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  highp vec3 rgbToHsl(highp vec3 color) {
      highp vec3 hsl;
      highp float fmin = min(min(color.r, color.g), color.b);
      highp float fmax = max(max(color.r, color.g), color.b);
      highp float delta = fmax - fmin;
      hsl.z = (fmax + fmin) / 2.0;
      if (delta == 0.0) {
          hsl.x = 0.0;
          hsl.y = 0.0;
      } else {
          if (hsl.z < 0.5) {
              hsl.y = delta / (fmax + fmin);
          } else {
              hsl.y = delta / (2.0 - fmax - fmin);
          }
          highp float deltaR = (((fmax - color.r) / 6.0) + (delta / 2.0)) / delta;
          highp float deltaG = (((fmax - color.g) / 6.0) + (delta / 2.0)) / delta;
          highp float deltaB = (((fmax - color.b) / 6.0) + (delta / 2.0)) / delta;
          if (color.r == fmax) {
              hsl.x = deltaB - deltaG;
          } else if (color.g == fmax) {
              hsl.x = (1.0 / 3.0) + deltaR - deltaB;
          } else if (color.b == fmax) {
              hsl.x = (2.0 / 3.0) + deltaG - deltaR;
          }
          if (hsl.x < 0.0) {
              hsl.x += 1.0;
          } else if (hsl.x > 1.0) {
              hsl.x -= 1.0;
          }
      }
      return hsl;
  }
  highp float hueToRgb(highp float f1, highp float f2, highp float hue) {
      if (hue < 0.0) {
          hue += 1.0;
      } else if (hue > 1.0) {
          hue -= 1.0;
      }
      highp float res;
      if ((6.0 * hue) < 1.0) {
          res = f1 + (f2 - f1) * 6.0 * hue;
      } else if ((2.0 * hue) < 1.0) {
          res = f2;
      } else if ((3.0 * hue) < 2.0) {
          res = f1 + (f2 - f1) * ((2.0 / 3.0) - hue) * 6.0;
      } else {
          res = f1;
      }
      return res;
  }
  highp vec3 hslToRgb(highp vec3 hsl) {
      if (hsl.y == 0.0) {
          return vec3(hsl.z);
      } else {
          highp float f2;
          if (hsl.z < 0.5) {
              f2 = hsl.z * (1.0 + hsl.y);
          } else {
              f2 = (hsl.z + hsl.y) - (hsl.y * hsl.z);
          }
          highp float f1 = 2.0 * hsl.z - f2;
          return vec3(hueToRgb(f1, f2, hsl.x + (1.0/3.0)), hueToRgb(f1, f2, hsl.x), hueToRgb(f1, f2, hsl.x - (1.0/3.0)));
      }
  }
  highp vec3 rgbToYuv(highp vec3 inP) {
      highp float luma = getLuma(inP);
      return vec3(luma, (1.0 / 1.772) * (inP.b - luma), (1.0 / 1.402) * (inP.r - luma));
  }
  lowp vec3 yuvToRgb(highp vec3 inP) {
      return vec3(1.402 * inP.b + inP.r, (inP.r - (0.299 * 1.402 / 0.587) * inP.b - (0.114 * 1.772 / 0.587) * inP.g), 1.772 * inP.g + inP.r);
  }
  lowp float easeInOutSigmoid(lowp float value, lowp float strength) {
      if (value > 0.5) {
          return 1.0 - pow(2.0 - 2.0 * value, 1.0 / (1.0 - strength)) * 0.5;
      } else {
          return pow(2.0 * value, 1.0 / (1.0 - strength)) * 0.5;
      }
  }
  lowp vec3 applyLuminanceCurve(lowp vec3 pixel) {
      highp float index = floor(clamp(pixel.z / (1.0 / 200.0), 0.0, 199.0));
      pixel.y = mix(0.0, pixel.y, smoothstep(0.0, 0.1, pixel.z) * (1.0 - smoothstep(0.8, 1.0, pixel.z)));
      pixel.z = texture2D(curvesImage, vec2(1.0 / 200.0 * index, 0)).a;
      return pixel;
  }
  lowp vec3 applyRGBCurve(lowp vec3 pixel) {
  highp float index = floor(clamp(pixel.r / (1.0 / 200.0), 0.0, 199.0));
  pixel.r = texture2D(curvesImage, vec2(1.0 / 200.0 * index, 0)).r;
  index = floor(clamp(pixel.g / (1.0 / 200.0), 0.0, 199.0));
  pixel.g = clamp(texture2D(curvesImage, vec2(1.0 / 200.0 * index, 0)).g, 0.0, 1.0);
  index = floor(clamp(pixel.b / (1.0 / 200.0), 0.0, 199.0));
  pixel.b = clamp(texture2D(curvesImage, vec2(1.0 / 200.0 * index, 0)).b, 0.0, 1.0);
  return pixel;
  }
  highp vec3 fadeAdjust(highp vec3 color, highp float fadeVal) {
  return (color * (1.0 - fadeVal)) + ((color + (vec3(-0.9772) * pow(vec3(color), vec3(3.0)) + vec3(1.708) * pow(vec3(color), vec3(2.0)) + vec3(-0.1603) * vec3(color) + vec3(0.2878) - color * vec3(0.9))) * fadeVal);
  }
  lowp vec3 tintRaiseShadowsCurve(lowp vec3 color) {
  return vec3(-0.003671) * pow(color, vec3(3.0)) + vec3(0.3842) * pow(color, vec3(2.0)) + vec3(0.3764) * color + vec3(0.2515);
  }
  lowp vec3 tintShadows(lowp vec3 texel, lowp vec3 tintColor, lowp float tintAmount) {
  return clamp(mix(texel, mix(texel, tintRaiseShadowsCurve(texel), tintColor), tintAmount), 0.0, 1.0);
  }
  lowp vec3 tintHighlights(lowp vec3 texel, lowp vec3 tintColor, lowp float tintAmount) {
  return clamp(mix(texel, mix(texel, vec3(1.0) - tintRaiseShadowsCurve(vec3(1.0) - texel), (vec3(1.0) - tintColor)), tintAmount), 0.0, 1.0);
  }
  highp vec4 rnm(in highp vec2 tc) {
  highp float noise = sin(dot(tc, vec2(12.9898, 78.233))) * 43758.5453;
  return vec4(fract(noise), fract(noise * 1.2154), fract(noise * 1.3453), fract(noise * 1.3647)) * 2.0 - 1.0;
  }
  highp float fade(in highp float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }
  highp float pnoise3D(in highp vec3 p) {
  highp vec3 pi = permTexUnit * floor(p) + permTexUnitHalf;
  highp vec3 pf = fract(p);
  highp float perm = rnm(pi.xy).a;
  highp float n000 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf);
  highp float n001 = dot(rnm(vec2(perm, pi.z + permTexUnit)).rgb * 4.0 - 1.0, pf - vec3(0.0, 0.0, 1.0));
  perm = rnm(pi.xy + vec2(0.0, permTexUnit)).a;
  highp float n010 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(0.0, 1.0, 0.0));
  highp float n011 = dot(rnm(vec2(perm, pi.z + permTexUnit)).rgb * 4.0 - 1.0, pf - vec3(0.0, 1.0, 1.0));
  perm = rnm(pi.xy + vec2(permTexUnit, 0.0)).a;
  highp float n100 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(1.0, 0.0, 0.0));
  highp float n101 = dot(rnm(vec2(perm, pi.z + permTexUnit)).rgb * 4.0 - 1.0, pf - vec3(1.0, 0.0, 1.0));
  perm = rnm(pi.xy + vec2(permTexUnit, permTexUnit)).a;
  highp float n110 = dot(rnm(vec2(perm, pi.z)).rgb * 4.0 - 1.0, pf - vec3(1.0, 1.0, 0.0));
  highp float n111 = dot(rnm(vec2(perm, pi.z + permTexUnit)).rgb * 4.0 - 1.0, pf - vec3(1.0, 1.0, 1.0));
  highp vec4 n_x = mix(vec4(n000, n001, n010, n011), vec4(n100, n101, n110, n111), fade(pf.x));
  highp vec2 n_xy = mix(n_x.xy, n_x.zw, fade(pf.y));
  return mix(n_xy.x, n_xy.y, fade(pf.z));
  }
  lowp vec2 coordRot(in lowp vec2 tc, in lowp float angle) {
  return vec2(((tc.x * 2.0 - 1.0) * cos(angle) - (tc.y * 2.0 - 1.0) * sin(angle)) * 0.5 + 0.5, ((tc.y * 2.0 - 1.0) * cos(angle) + (tc.x * 2.0 - 1.0) * sin(angle)) * 0.5 + 0.5);
  }
  void main() {
  lowp vec4 source = texture2D(sTexture, vTextureCoord);
  lowp vec4 result = source;
  const lowp float toolEpsilon = 0.005;
  if (skipTone < toolEpsilon) {
  result = vec4(applyRGBCurve(hslToRgb(applyLuminanceCurve(rgbToHsl(result.rgb)))), result.a);
  }
  mediump float hsLuminance = dot(result.rgb, hsLuminanceWeighting);
  mediump float shadow = clamp((pow(hsLuminance, 1.0 / shadows) + (-0.76) * pow(hsLuminance, 2.0 / shadows)) - hsLuminance, 0.0, 1.0);
  mediump float highlight = clamp((1.0 - (pow(1.0 - hsLuminance, 1.0 / (2.0 - highlights)) + (-0.8) * pow(1.0 - hsLuminance, 2.0 / (2.0 - highlights)))) - hsLuminance, -1.0, 0.0);
  lowp vec3 hsresult = vec3(0.0, 0.0, 0.0) + ((hsLuminance + shadow + highlight) - 0.0) * ((result.rgb - vec3(0.0, 0.0, 0.0)) / (hsLuminance - 0.0));
  mediump float contrastedLuminance = ((hsLuminance - 0.5) * 1.5) + 0.5;
  mediump float whiteInterp = contrastedLuminance * contrastedLuminance * contrastedLuminance;
  mediump float whiteTarget = clamp(highlights, 1.0, 2.0) - 1.0;
  hsresult = mix(hsresult, vec3(1.0), whiteInterp * whiteTarget);
  mediump float invContrastedLuminance = 1.0 - contrastedLuminance;
  mediump float blackInterp = invContrastedLuminance * invContrastedLuminance * invContrastedLuminance;
  mediump float blackTarget = 1.0 - clamp(shadows, 0.0, 1.0);
  hsresult = mix(hsresult, vec3(0.0), blackInterp * blackTarget);
  result = vec4(hsresult.rgb, result.a);
  result = vec4(clamp(((result.rgb - vec3(0.5)) * contrast + vec3(0.5)), 0.0, 1.0), result.a);
  if (abs(fadeAmount) > toolEpsilon) {
  result.rgb = fadeAdjust(result.rgb, fadeAmount);
  }
  lowp float satLuminance = dot(result.rgb, satLuminanceWeighting);
  lowp vec3 greyScaleColor = vec3(satLuminance);
  result = vec4(clamp(mix(greyScaleColor, result.rgb, saturation), 0.0, 1.0), result.a);
  if (abs(shadowsTintIntensity) > toolEpsilon) {
  result.rgb = tintShadows(result.rgb, shadowsTintColor, shadowsTintIntensity * 2.0);
  }
  if (abs(highlightsTintIntensity) > toolEpsilon) {
  result.rgb = tintHighlights(result.rgb, highlightsTintColor, highlightsTintIntensity * 2.0);
  }
  if (abs(exposure) > toolEpsilon) {
  mediump float mag = exposure * 1.045;
  mediump float exppower = 1.0 + abs(mag);
  if (mag < 0.0) {
  exppower = 1.0 / exppower;
  }
  result.r = 1.0 - pow((1.0 - result.r), exppower);
  result.g = 1.0 - pow((1.0 - result.g), exppower);
  result.b = 1.0 - pow((1.0 - result.b), exppower);
  }
  if (abs(warmth) > toolEpsilon) {
  highp vec3 yuvVec;
  if (warmth > 0.0 ) {
  yuvVec = vec3(0.1765, -0.1255, 0.0902);
  } else {
  yuvVec = -vec3(0.0588, 0.1569, -0.1255);
  }
  highp vec3 yuvColor = rgbToYuv(result.rgb);
  highp float luma = yuvColor.r;
  highp float curveScale = sin(luma * 3.14159);
  yuvColor += 0.375 * warmth * curveScale * yuvVec;
  result.rgb = yuvToRgb(yuvColor);
  }
  if (abs(grain) > toolEpsilon) {
  highp vec3 rotOffset = vec3(1.425, 3.892, 5.835);
  highp vec2 rotCoordsR = coordRot(vTextureCoord, rotOffset.x);
  highp vec3 noise = vec3(pnoise3D(vec3(rotCoordsR * vec2(width / grainsize, height / grainsize),0.0)));
  lowp vec3 lumcoeff = vec3(0.299,0.587,0.114);
  lowp float luminance = dot(result.rgb, lumcoeff);
  lowp float lum = smoothstep(0.2, 0.0, luminance);
  lum += luminance;
  noise = mix(noise,vec3(0.0),pow(lum,4.0));
  result.rgb = result.rgb + noise * grain;
  }
  if (abs(vignette) > toolEpsilon) {
  const lowp float midpoint = 0.7;
  const lowp float fuzziness = 0.62;
  lowp float radDist = length(vTextureCoord - 0.5) / sqrt(0.5);
  lowp float mag = easeInOutSigmoid(radDist * midpoint, fuzziness) * vignette * 0.645;
  result.rgb = mix(pow(result.rgb, vec3(1.0 / (1.0 - mag))), vec3(0.0), mag * mag);
  }
  gl_FragColor = result;
  }
  `;
}

export class WebGLImageProcessing {
  private _enhanceShaderProgram: WebGLProgram | null = null;
  private _sharpenShaderProgram: WebGLProgram | null = null;
  private _toolsShaderProgram: WebGLProgram | null = null;

  private _enhanceHandles = {
    position: null as GLuint | null,
    inputTexCoord: null as GLuint | null,
    sourceImage: null as WebGLUniformLocation | null,
    intensity: null as WebGLUniformLocation | null,
    inputImageTexture2: null as WebGLUniformLocation | null
  };

  private _sharpenHandles = {
    sharpen: null as WebGLUniformLocation | null,
    width: null as WebGLUniformLocation | null,
    height: null as WebGLUniformLocation | null,
    position: null as GLuint | null,
    inputTexCoord: null as GLuint | null,
    sourceImage: null as WebGLUniformLocation | null
  };

  private _toolsHandles = {
    position: null as GLuint | null,
    inputTexCoord: null as GLuint | null,
    sourceImage: null as WebGLUniformLocation | null,
    shadows: null as WebGLUniformLocation | null,
    highlights: null as WebGLUniformLocation | null,
    exposure: null as WebGLUniformLocation | null,
    contrast: null as WebGLUniformLocation | null,
    saturation: null as WebGLUniformLocation | null,
    warmth: null as WebGLUniformLocation | null,
    vignette: null as WebGLUniformLocation | null,
    grain: null as WebGLUniformLocation | null,
    width: null as WebGLUniformLocation | null,
    height: null as WebGLUniformLocation | null,
    fadeAmount: null as WebGLUniformLocation | null,
    highlightsTintColor: null as WebGLUniformLocation | null,
    highlightsTintIntensity: null as WebGLUniformLocation | null,
    shadowsTintColor: null as WebGLUniformLocation | null,
    shadowsTintIntensity: null as WebGLUniformLocation | null,
    skipTone: null as WebGLUniformLocation | null
  };

  // Buffers
  private _vertexBuffer: WebGLBuffer | null = null;
  private _textureBuffer: WebGLBuffer | null = null;

  // Render targets
  private _renderTexture: WebGLTexture[] = [];
  private _renderFrameBuffer: WebGLFramebuffer[] = [];
  // private int[] enhanceTextures = new int[2];
  // private int[] enhanceFrameBuffer = new int[1];
  // private int[] bitmapTextre = new int[1];

  // Render buffer dimensions
  private _renderBufferWidth: GLfloat = 0;
  private _renderBufferHeight: GLfloat = 0;

  constructor(private _gl: WebGLRenderingContext) {}

  create(image: HTMLImageElement) {
    const gl = this._gl;
    this._renderBufferWidth = gl.canvas.width;
    this._renderBufferHeight = gl.canvas.height;

    this._vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, 1.0,
      1.0, 1.0,
      -1.0, -1.0,
      1.0, -1.0
    ]), gl.STATIC_DRAW);

    this._textureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      0.0, 0.0,
      1.0, 0.0,
      0.0, 1.0,
      1.0, 1.0
    ]), gl.STATIC_DRAW);

    this._createToolsShaderProgram();
    this._createSharpenShaderProgram();
    this._createEnhanceShaderProgram();

    for(let a = 0; a < 2; a++) {
      // Create texture
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, renderBufferWidth, renderBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this._renderBufferWidth, this._renderBufferHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);

      // Create framebuffer
      const frameBuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

      // Check framebuffer status
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if(status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error('Framebuffer is not complete:', status);
        return;
      }

      // Store framebuffer and texture
      this._renderFrameBuffer.push(frameBuffer);
      this._renderTexture.push(texture);
    }

    // Unbind the framebuffer, otherwise draw() doesnt work
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  draw(enhanceSettings: METypes.EnhanceSettings) {
    const delegate = this._getFilterShadersDelegate(enhanceSettings);
    const gl = this._gl;
    // skinSmoothPath
    this._drawEnhancePass(delegate);
    this._drawSharpenPass(delegate);
    this._drawCustomParamsPass(delegate);
    // draw blurred
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  destroy() {
    this._gl = null;
  }

  private _drawEnhancePass(delegate: ReturnType<typeof this._getFilterShadersDelegate>) {
    const gl = this._gl;
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this._renderFrameBuffer[1]);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._renderTexture[1], 0);

    gl.useProgram(this._enhanceShaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._renderTexture[0]);
    gl.uniform1i(this._enhanceHandles.sourceImage, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._renderTexture[1]);
    gl.uniform1i(this._enhanceHandles.inputImageTexture2, 1);

    if(delegate == null || delegate.shouldShowOriginal()) {
      gl.uniform1f(this._enhanceHandles.intensity, 0);
    } else {
      gl.uniform1f(this._enhanceHandles.intensity, delegate.getEnhanceValue());
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureBuffer);
    gl.enableVertexAttribArray(this._enhanceHandles.inputTexCoord);
    gl.vertexAttribPointer(this._enhanceHandles.inputTexCoord, 2, gl.FLOAT, false, 8, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.enableVertexAttribArray(this._enhanceHandles.position);
    gl.vertexAttribPointer(this._enhanceHandles.position, 2, gl.FLOAT, false, 8, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private _drawSharpenPass(delegate: ReturnType<typeof this._getFilterShadersDelegate>) {
    const gl = this._gl;
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this._renderFrameBuffer[0]);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._renderTexture[0], 0);

    gl.useProgram(this._sharpenShaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._renderTexture[1]);
    gl.uniform1i(this._sharpenHandles.sourceImage, 0);

    if(!delegate || delegate.shouldShowOriginal()) {
      gl.uniform1f(this._sharpenHandles.sharpen, 0);
    } else {
      gl.uniform1f(this._sharpenHandles.sharpen, delegate.getSharpenValue() > 0.6 ? 1 : 0);
    }

    gl.uniform1f(this._sharpenHandles.width, this._renderBufferWidth);
    gl.uniform1f(this._sharpenHandles.height, this._renderBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureBuffer);
    gl.enableVertexAttribArray(this._sharpenHandles.inputTexCoord);
    gl.vertexAttribPointer(this._sharpenHandles.inputTexCoord, 2, gl.FLOAT, false, 8, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.enableVertexAttribArray(this._sharpenHandles.position);
    gl.vertexAttribPointer(this._sharpenHandles.position, 2, gl.FLOAT, false, 8, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private _drawCustomParamsPass(delegate: ReturnType<typeof this._getFilterShadersDelegate>) {
    const gl = this._gl;
    // gl.bindFramebuffer(gl.FRAMEBUFFER, this._renderFrameBuffer[1]);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this._renderTexture[1], 0);

    gl.useProgram(this._toolsShaderProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this._renderTexture[0]);
    gl.uniform1i(this._toolsHandles.sourceImage, 0);

    if(delegate == null || delegate.shouldShowOriginal()) {
      gl.uniform1f(this._toolsHandles.shadows, 1);
      gl.uniform1f(this._toolsHandles.highlights, 1);
      gl.uniform1f(this._toolsHandles.exposure, 0);
      gl.uniform1f(this._toolsHandles.contrast, 1);
      gl.uniform1f(this._toolsHandles.saturation, 1);
      gl.uniform1f(this._toolsHandles.warmth, 0);
      gl.uniform1f(this._toolsHandles.vignette, 0);
      gl.uniform1f(this._toolsHandles.grain, 0);
      gl.uniform1f(this._toolsHandles.fadeAmount, 0);
      gl.uniform3f(this._toolsHandles.highlightsTintColor, 0, 0, 0);
      gl.uniform1f(this._toolsHandles.highlightsTintIntensity, 0);
      gl.uniform3f(this._toolsHandles.shadowsTintColor, 0, 0, 0);
      gl.uniform1f(this._toolsHandles.shadowsTintIntensity, 0);
      gl.uniform1f(this._toolsHandles.skipTone, 1);
    } else {
      gl.uniform1f(this._toolsHandles.shadows, delegate.getShadowsValue());
      gl.uniform1f(this._toolsHandles.highlights, delegate.getHighlightsValue());
      gl.uniform1f(this._toolsHandles.exposure, delegate.getExposureValue());
      gl.uniform1f(this._toolsHandles.contrast, delegate.getContrastValue());
      gl.uniform1f(this._toolsHandles.saturation, delegate.getSaturationValue());
      gl.uniform1f(this._toolsHandles.warmth, delegate.getWarmthValue());
      gl.uniform1f(this._toolsHandles.vignette, delegate.getVignetteValue());
      gl.uniform1f(this._toolsHandles.grain, delegate.getGrainValue());
      gl.uniform1f(this._toolsHandles.fadeAmount, delegate.getFadeValue());
      gl.uniform1f(this._toolsHandles.skipTone, 1);
    }

    gl.uniform1f(this._toolsHandles.width, this._renderBufferWidth);
    gl.uniform1f(this._toolsHandles.height, this._renderBufferHeight);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindBuffer(gl.ARRAY_BUFFER, this._textureBuffer);
    gl.enableVertexAttribArray(this._toolsHandles.inputTexCoord);
    gl.vertexAttribPointer(this._toolsHandles.inputTexCoord, 2, gl.FLOAT, false, 8, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.enableVertexAttribArray(this._toolsHandles.position);
    gl.vertexAttribPointer(this._toolsHandles.position, 2, gl.FLOAT, false, 8, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private _getFilterShadersDelegate(lastState: METypes.EnhanceSettings) {
    // Currently, this multiplier will be used to apply the enhancement effect.
    const enhanceMultiplier = (lastState.enhance / 100.0) / 2.5;
    return {
      shouldShowOriginal: () => false,
      getSoftenSkinValue: () => 100.0 / 100.0,
      getShadowsValue: () => (lastState.shadows * 0.55 + 100.0) / 100.0 + enhanceMultiplier,
      getHighlightsValue: () => (lastState.highlights * 0.75 + 100.0) / 100.0 + enhanceMultiplier,
      getEnhanceValue: () => lastState.enhance / 100.0,
      getExposureValue: () => lastState.brightness / 100.0,
      getContrastValue: () => (lastState.contrast / 100.0) * 0.3 + 1 + enhanceMultiplier,
      getWarmthValue: () => lastState.warmth / 100.0 + enhanceMultiplier,
      getVignetteValue: () => lastState.vignette / 100.0,
      getSharpenValue: () => 0.11 + (lastState.sharpen / 100.0) * 0.6,
      getGrainValue: () => (lastState.grain / 100.0) * 0.04,
      getFadeValue: () => lastState.fade / 100.0,
      getTintHighlightsIntensityValue: () => 0 === 0 ? 0 : 0.5,
      getTintShadowsIntensityValue: () => 0 === 0 ? 0 : 0.5,
      getSaturationValue: () => {
        let parameterValue = lastState.saturation / 100.0;
        if(parameterValue > 0) {
          parameterValue *= 1.05;
        }
        return parameterValue + 1;
      },
      getTintHighlightsColor: () => 0,
      getTintShadowsColor: () => 0,
      getBlurType: () => 0,
      getBlurExcludeSize: () => 0,
      getBlurExcludeBlurSize: () => 0,
      getBlurAngle: () =>0,
      getBlurExcludePoint: () => 0,
      shouldDrawCurvesPass: () => 0,
      fillAndGetCurveBuffer: () => {
        return 0;
        // lastState.curvesToolValue.fillBuffer();
        // return lastState.curvesToolValue.curveBuffer;
      }
    };
  }

  private _createEnhanceShaderProgram() {
    const gl = this._gl;
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, Shaders.simpleVertexShaderCode);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, Shaders.enhanceFragmentShaderCode);
    const program = this._createProgram(vertexShader, fragmentShader);
    this._enhanceShaderProgram = program;

    this._enhanceHandles.position = gl.getAttribLocation(program, 'position');
    this._enhanceHandles.inputTexCoord = gl.getAttribLocation(program, 'inputTexCoord');
    this._enhanceHandles.sourceImage = gl.getUniformLocation(program, 'sTexture');
    this._enhanceHandles.intensity = gl.getUniformLocation(program, 'intensity');
    this._enhanceHandles.inputImageTexture2 = gl.getUniformLocation(program, 'inputImageTexture2');
  }

  private _createSharpenShaderProgram() {
    const gl = this._gl;
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, Shaders.sharpenVertexShaderCode);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, Shaders.sharpenFragmentShaderCode);
    const program = this._createProgram(vertexShader, fragmentShader);
    this._sharpenShaderProgram = program;

    this._sharpenHandles.position = gl.getAttribLocation(program, 'position');
    this._sharpenHandles.inputTexCoord = gl.getAttribLocation(program, 'inputTexCoord');
    this._sharpenHandles.sourceImage = gl.getUniformLocation(program, 'sTexture');
    this._sharpenHandles.width = gl.getUniformLocation(program, 'inputWidth');
    this._sharpenHandles.height = gl.getUniformLocation(program, 'inputHeight');
    this._sharpenHandles.sharpen = gl.getUniformLocation(program, 'sharpen');
  }

  private _createToolsShaderProgram() {
    const gl = this._gl;
    const vertexShader = this._compileShader(gl.VERTEX_SHADER, Shaders.simpleVertexShaderCode);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, Shaders.toolsFragmentShaderCode);
    const program = this._createProgram(vertexShader, fragmentShader);
    this._toolsShaderProgram = program;

    this._toolsHandles.position = gl.getAttribLocation(program, 'position');
    this._toolsHandles.inputTexCoord = gl.getAttribLocation(program, 'inputTexCoord');
    this._toolsHandles.sourceImage = gl.getUniformLocation(program, 'sTexture');
    this._toolsHandles.shadows = gl.getUniformLocation(program, 'shadows');
    this._toolsHandles.highlights = gl.getUniformLocation(program, 'highlights');
    this._toolsHandles.exposure = gl.getUniformLocation(program, 'exposure');
    this._toolsHandles.contrast = gl.getUniformLocation(program, 'contrast');
    this._toolsHandles.saturation = gl.getUniformLocation(program, 'saturation');
    this._toolsHandles.warmth = gl.getUniformLocation(program, 'warmth');
    this._toolsHandles.vignette = gl.getUniformLocation(program, 'vignette');
    this._toolsHandles.grain = gl.getUniformLocation(program, 'grain');
    this._toolsHandles.fadeAmount = gl.getUniformLocation(program, 'fadeAmount');
    this._toolsHandles.highlightsTintColor = gl.getUniformLocation(program, 'highlightsTintColor');
    this._toolsHandles.highlightsTintIntensity = gl.getUniformLocation(program, 'highlightsTintIntensity');
    this._toolsHandles.shadowsTintColor = gl.getUniformLocation(program, 'shadowsTintColor');
    this._toolsHandles.shadowsTintIntensity = gl.getUniformLocation(program, 'shadowsTintIntensity');
    this._toolsHandles.skipTone = gl.getUniformLocation(program, 'skipTone');
    this._toolsHandles.width = gl.getUniformLocation(program, 'width');
    this._toolsHandles.height = gl.getUniformLocation(program, 'height');
  }

  private _createProgram(vertexShaderSource: WebGLShader, fragmentShaderSource: WebGLShader) {
    const gl = this._gl;
    if(!vertexShaderSource || !fragmentShaderSource) {
      throw new Error('Shader not found');
    }
    const program = gl.createProgram();
    if(!program) throw new Error('Failed to create program');
    gl.attachShader(program, vertexShaderSource);
    gl.attachShader(program, fragmentShaderSource);

    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(`vs info-log: ${gl.getShaderInfoLog(vertexShaderSource)}`);
      console.error(`fs info-log: ${gl.getShaderInfoLog(fragmentShaderSource)}`);
      gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  private _compileShader(type: GLenum, source: string) {
    const gl = this._gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${this._gl.getShaderInfoLog(shader)}`);
    }

    return shader;
  }
}

export namespace ImageProcessing.Filters {
  export async function gaussianBlur(source: OffscreenCanvas, sigma: number, blurQuality: number): Promise<ImageBitmap> {
    if(blurQuality < 0 || blurQuality > 1) throw new Error();

    const {width: originalWidth, height: originalHeight} = source;
    const canvas = new OffscreenCanvas(originalWidth * blurQuality, originalHeight * blurQuality);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    const smallPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const kernel = makeGaussKernel(sigma);

    for(let ch = 0; ch < 3; ch++) {
      gauss_internal(smallPixels, kernel, ch, false);
    }

    ctx.putImageData(smallPixels, 0, 0);

    return createImageBitmap(canvas, {resizeWidth: originalWidth, resizeHeight: originalHeight});
  }

  function makeGaussKernel(sigma: number): Float32Array {
    const GAUSSKERN = 6.0;
    let dim = Math.max(3.0, GAUSSKERN * sigma);
    dim = dim % 2 === 0 ? dim + 1 : dim; // Ensure it's an odd number
    const sqrtSigmaPi2 = Math.sqrt(Math.PI * 2.0) * sigma;
    const s2 = 2.0 * sigma * sigma;
    let sum = 0.0;

    const kernel = new Float32Array(dim);
    const half = Math.floor(kernel.length / 2);

    for(let j = 0, i = -half; j < kernel.length; i++, j++) {
      kernel[j] = Math.exp(-(i * i) / s2) / sqrtSigmaPi2;
      sum += kernel[j];
    }

    // Normalize the Gaussian kernel to prevent image darkening/brightening
    for(let i = 0; i < dim; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  function gauss_internal(
    pixels: ImageData,
    kernel: Float32Array,
    ch: number,
    gray: boolean
  ): void {
    const data = pixels.data;
    const w = pixels.width;
    const h = pixels.height;
    const buff = new Float32Array(w * h);
    const mk = Math.floor(kernel.length / 2);
    const kl = kernel.length;

    // First step: process columns
    for(let j = 0, hw = 0; j < h; j++, hw += w) {
      for(let i = 0; i < w; i++) {
        let sum = 0;
        for(let k = 0; k < kl; k++) {
          let col = i + (k - mk);
          col = Math.max(0, Math.min(w - 1, col));
          sum += data[(hw + col) * 4 + ch] * kernel[k];
        }
        buff[hw + i] = sum;
      }
    }

    // Second step: process rows
    for(let j = 0, offset = 0; j < h; j++, offset += w) {
      for(let i = 0; i < w; i++) {
        let sum = 0;
        for(let k = 0; k < kl; k++) {
          let row = j + (k - mk);
          row = Math.max(0, Math.min(h - 1, row));
          sum += buff[row * w + i] * kernel[k];
        }
        const off = (j * w + i) * 4;
        if(!gray) {
          data[off + ch] = sum;
        } else {
          data[off] = data[off + 1] = data[off + 2] = sum;
        }
      }
    }
  }
}
