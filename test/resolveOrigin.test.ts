import { AucoSDK } from '../src';
import { Config, EnvType } from '../src/types';

const IFRAME_ID = 'auco-iframe';
const uxOptions = { primaryColor: '#021c30', alternateColor: '#a557f2' };

const unsubscribers: Array<() => void> = [];

beforeEach(() => {
  document.body.innerHTML = `<iframe id="${IFRAME_ID}"></iframe>`;
});

afterEach(() => {
  unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
});

const loadedOrigin = (config: Config) => {
  unsubscribers.push(AucoSDK(config));
  const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement;
  return new URL(iframe.src).origin;
};

// Mirrors the public docs example for sign: no keyPublic, no onSDKToken.
const signConfig = (env: EnvType, customOrigin?: string): Config => ({
  iframeId: IFRAME_ID,
  sdkType: 'sign',
  language: 'es',
  env,
  customOrigin,
  events: { onSDKReady: () => {}, onSDKClose: () => {} },
  sdkData: { document: 'WO0J4L3YWBWE', uxOptions },
});

const uploadConfig = (env: EnvType): Config => ({
  iframeId: IFRAME_ID,
  sdkType: 'upload',
  language: 'es',
  env,
  keyPublic: '00000000-0000-0000-0000-000000000000',
  events: { onSDKReady: () => {}, onSDKClose: () => {} },
  sdkData: { uxOptions },
});

describe('origin resolution', () => {
  it.each([
    ['PROD', 'https://sign.auco.ai'],
    ['STAGE', 'https://sign-stage.auco.ai'],
    ['DEV', 'https://sign-stage.auco.ai'],
    ['INTERNAL', 'https://sign-dev.auco.ai'],
  ] as const)('sign without keyPublic on %s loads %s', (env, expected) => {
    expect(loadedOrigin(signConfig(env))).toBe(expected);
  });

  it.each([
    ['PROD', 'https://upload.auco.ai'],
    ['DEV', 'https://upload-stage.auco.ai'],
    ['INTERNAL', 'https://upload-dev.auco.ai'],
  ] as const)('upload with keyPublic on %s loads %s', (env, expected) => {
    expect(loadedOrigin(uploadConfig(env))).toBe(expected);
  });

  it('customOrigin wins over env', () => {
    expect(loadedOrigin(signConfig('INTERNAL', 'http://localhost:4200'))).toBe(
      'http://localhost:4200'
    );
  });
});
