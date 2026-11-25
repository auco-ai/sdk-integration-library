import {
  TAucoSDK,
  Config,
  SDKTypeObjectKeys,
  SDKs,
  EnvType,
  LANGUAGES,
} from './types';

export * from './types';

function uuid() {
  const d = new Date();
  const s = d.toISOString().replaceAll(':', '-');
  return s;
}
/**
 * Teardown of the session currently attached to each iframe, so starting the
 * SDK again on the same iframe replaces the previous session instead of
 * stacking listeners.
 */
const activeSessions = new WeakMap<HTMLIFrameElement, () => void>();

export const AucoSDK: TAucoSDK = params => {
  parametersValidation(params);
  return setupEvents(params);
};

const parametersValidation = (params: Config) => {
  if (!params.iframeId) {
    throw new Error('Could not start SDK, iframeId is missing');
  }
  if (!LANGUAGES.includes(params?.language)) {
    throw new Error(
      `Could not start SDK, language is missing or invalid, available options are ${LANGUAGES.map(
        language => `'${language}'`
      ).join(', ')}`
    );
  }
  if (params.sdkType === 'upload' || params.sdkType === 'attachments') {
    if (params.sdkData.custom) {
      if (
        typeof params.sdkData.custom !== 'object' ||
        Array.isArray(params.sdkData.custom)
      )
        throw new Error(
          'Could not start SDK, custom data must be an object, received: ' +
            (Array.isArray(params.sdkData.custom)
              ? 'array'
              : typeof params.sdkData.custom)
        );
      else if (!Object.keys(params.sdkData.custom).length)
        throw new Error(
          'Could not start SDK, custom data is empty, received: ' +
            JSON.stringify(params.sdkData.custom)
        );
    }
  }
};
const setupEvents = (params: Config) => {
  const {
    iframeId,
    events,
    language,
    sdkData,
    keyPublic = undefined,
    customOrigin,
    sdkType,
    env,
  } = params;

  const { src, origin } = resolveOrigin(sdkType, env, customOrigin);

  const iframe = document.getElementById(iframeId) as HTMLIFrameElement;

  if (!iframe) {
    throw new Error(
      `Could not start SDK, Iframe with id: ${iframeId} not found`
    );
  }

  if (keyPublic && keyPublic.length !== 36) {
    throw new Error('Could not start SDK, invalid keyPublic');
  }

  const unsubscribe = () => {
    window.removeEventListener('message', onMessage);
    if (activeSessions.get(iframe) === unsubscribe) {
      activeSessions.delete(iframe);
    }
  };

  /**
   * Errors raised while handling a frame message happen inside an event
   * listener, where the integrator cannot catch them. Route them to
   * onSDKError instead of leaving an unhandled promise rejection.
   */
  const reportError = (error: unknown) => {
    const sdkError = error instanceof Error ? error : new Error(String(error));
    try {
      if (events.onSDKError) {
        events.onSDKError(sdkError);
        return;
      }
    } catch (handlerError) {
      console.error('[auco-sdk-integration]', handlerError);
    }
    console.error('[auco-sdk-integration]', sdkError);
  };

  function onMessage(event: MessageEvent) {
    // Same-origin iframes (two sign, or upload + read) must not hear each
    // other, so the source window has to be this iframe too.
    if (event.origin !== origin || event.source !== iframe.contentWindow)
      return;
    if (!event.data || typeof event.data !== 'object') return;
    handleMessage(event).catch(reportError);
  }

  async function handleMessage(event: MessageEvent) {
    if (event.data.ready) {
      iframe!.contentWindow?.postMessage(
        {
          language,
          ...sdkData,
          keyPublic,
          sdkParentURL: window.location.href,
          ...getExtraConstants(sdkType),
        },
        origin
      );
      await events.onSDKReady();
      return;
    }
    if (event.data.type === 'token') {
      if (!events.onSDKToken) {
        throw new Error(
          "Could not get token, SDK is asking for user token, but there isn't a onSDKToken function provided"
        );
      }
      const token = await events.onSDKToken();
      iframe!.contentWindow?.postMessage({ type: 'token', token }, origin);
    }
    if (event.data?.type === 'SDK-PAY') {
      if (!events.onSDKPay) {
        throw new Error(
          "SDK is asking for payment, but there isn't a onSDKPay function provided"
        );
      }
      await events.onSDKPay(event.data.data);
    }
    if (event.data?.type === 'SDK-NOTIFICATION') {
      if (events.onSDKNotification) {
        await events.onSDKNotification(event.data.data);
      }
    }
    if (event.data?.type === 'SDK-CLOSE') {
      await events.onSDKClose(
        event.data?.document ?? event.data?.similarity ?? '',
        event.data?.redirectTo ?? event.data?.status ?? '',
        event.data?.signProfile ?? []
      );
      if (event.data?.status !== 'PENDING') unsubscribe();
    }

    // Without a handler the session must keep listening: sign sends
    // SDK-CLOSE (with redirectTo) after SDK-FINISH, and upload-v2 restarts
    // and sends ready again after SDK-BACK.
    if (event.data?.type === 'SDK-FINISH') {
      if (events.onSDKFinish) {
        await events.onSDKFinish();
        unsubscribe();
      }
    }

    if (event.data?.type === 'SDK-BACK') {
      if (events.onSDKBack) {
        await events.onSDKBack();
        unsubscribe();
      }
    }
  }

  activeSessions.get(iframe)?.();
  activeSessions.set(iframe, unsubscribe);
  window.addEventListener('message', onMessage);
  iframe.src = src + '?id=' + uuid();
  return unsubscribe;
};
const getSDKURL: SDKTypeObjectKeys = {
  'upload-v2': 'https://uploadv2.auco.ai',
  upload: 'https://upload.auco.ai',
  sign: 'https://sign.auco.ai',
  attachments: 'https://upload.auco.ai',
  read: 'https://upload.auco.ai',
  'validation-attachments': 'https://upload.auco.ai',
  validation: 'https://veriface.auco.ai',
  fill: 'https://fill2.auco.ai',
};

const getDevSDKURL: SDKTypeObjectKeys = {
  'upload-v2': 'https://uploadv2-stage.auco.ai',
  upload: 'https://upload-stage.auco.ai',
  sign: 'https://sign-stage.auco.ai',
  attachments: 'https://upload-stage.auco.ai',
  read: 'https://upload-stage.auco.ai',
  'validation-attachments': 'https://upload-stage.auco.ai',
  validation: 'https://veriface-stage.auco.ai',
  fill: 'https://fill2-stage.auco.ai',
};

const internalSDKDevURL: SDKTypeObjectKeys = {
  'upload-v2': 'https://uploadv2-dev.auco.ai',
  validation: 'https://veriface-dev.auco.ai',
  sign: 'https://sign-dev.auco.ai',
  upload: 'https://upload-dev.auco.ai',
  attachments: 'https://upload-dev.auco.ai',
  read: 'https://upload-dev.auco.ai',
  'validation-attachments': 'https://upload-dev.auco.ai',
  // fill has no dev environment, only stage and prod
  fill: 'https://fill2-stage.auco.ai',
};

/**
 * Returns the URL to load in the iframe and the origin its messages must come
 * from. Throws before touching the iframe when neither can be resolved.
 */
const resolveOrigin = (
  sdkType: SDKs,
  env: EnvType,
  customOrigin?: string
): { src: string; origin: string } => {
  if (customOrigin && customOrigin.length > 0) {
    let url: URL | undefined;
    try {
      url = new URL(customOrigin);
    } catch {
      url = undefined;
    }
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
      throw new Error(
        `Could not start SDK, customOrigin is not a valid http(s) URL: '${customOrigin}'`
      );
    }
    // event.origin never has a path or trailing slash, so compare against
    // the parsed origin rather than the raw string.
    return { src: customOrigin, origin: url.origin };
  }
  if (sdkType === 'list-validation') {
    throw new Error(
      "Could not start SDK, sdkType 'list-validation' is no longer available"
    );
  }
  if (!Object.prototype.hasOwnProperty.call(getSDKURL, sdkType)) {
    throw new Error(
      `Could not start SDK, sdkType is missing or invalid, available options are ${Object.keys(
        getSDKURL
      )
        .map(type => `'${type}'`)
        .join(', ')}`
    );
  }
  /**
   * The *-dev hosts are only reachable by the Auco team, so they require an
   * explicit `INTERNAL` env. Integrators asking for DEV or STAGE land on stage.
   */
  const urls =
    env === 'INTERNAL'
      ? internalSDKDevURL
      : env === 'DEV' || env === 'STAGE'
      ? getDevSDKURL
      : getSDKURL;
  const url = urls[sdkType];
  return { src: url, origin: url };
};

const flowTypesUploadSDK = {
  upload: 'upload',
  read: 'read',
  attachments: 'attachments',
  'validation-attachments': 'validation-attachments',
};
const getExtraConstants = (type: SDKs) => {
  let extraConstants = new Map();
  if (Object.keys(flowTypesUploadSDK).includes(type)) {
    extraConstants.set('flowType', type);
  }
  return Object.fromEntries(extraConstants);
};
