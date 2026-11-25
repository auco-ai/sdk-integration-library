import { AucoSDK, Config } from '../src';

export const IFRAME_ID = 'auco-iframe';
export const uxOptions = { primaryColor: '#021c30', alternateColor: '#a557f2' };
export const VALID_KEY = '00000000-0000-0000-0000-000000000000';

const unsubscribers: Array<() => void> = [];

export const resetDom = (iframeIds: string[] = [IFRAME_ID]) => {
  unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
  document.body.innerHTML = iframeIds
    .map(id => `<iframe id="${id}"></iframe>`)
    .join('');
};

export const flush = () => new Promise(resolve => setTimeout(resolve, 0));

export const getIframe = (id = IFRAME_ID) =>
  document.getElementById(id) as HTMLIFrameElement;

/**
 * Starts the SDK on an iframe and returns helpers to simulate the frame.
 */
export const mount = (config: Config) => {
  const iframe = getIframe(config.iframeId);
  const unsubscribe = AucoSDK(config);
  unsubscribers.push(unsubscribe);
  // Setting iframe.src swaps the frame window, so spy on it afterwards.
  const frameWindow = iframe.contentWindow as Window;
  const toFrame = jest
    .spyOn(frameWindow, 'postMessage')
    .mockImplementation(() => undefined);
  const origin = new URL(iframe.src).origin;

  const fromFrame = async (
    data: unknown,
    {
      from = origin,
      source = frameWindow,
    }: { from?: string; source?: Window | null } = {}
  ) => {
    window.dispatchEvent(
      new MessageEvent('message', { data, origin: from, source })
    );
    await flush();
  };

  return { iframe, origin, toFrame, fromFrame, unsubscribe };
};

export const signConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    iframeId: IFRAME_ID,
    sdkType: 'sign',
    language: 'es',
    env: 'PROD',
    events: { onSDKReady: jest.fn(), onSDKClose: jest.fn() },
    sdkData: { document: 'WO0J4L3YWBWE', uxOptions },
    ...overrides,
  } as Config);

export const uploadConfig = (overrides: Partial<Config> = {}): Config =>
  ({
    iframeId: IFRAME_ID,
    sdkType: 'upload',
    language: 'es',
    env: 'PROD',
    keyPublic: VALID_KEY,
    events: { onSDKReady: jest.fn(), onSDKClose: jest.fn() },
    sdkData: { uxOptions },
    ...overrides,
  } as Config);
