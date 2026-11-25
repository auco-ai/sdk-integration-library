import { LANGUAGES } from '../src';
import {
  mount,
  resetDom,
  signConfig,
  uploadConfig,
  uxOptions,
  VALID_KEY,
} from './helpers';

beforeEach(() => resetDom());

describe('ready handshake', () => {
  it('sends the init payload to the frame origin and calls onSDKReady', async () => {
    const config = signConfig();
    const { toFrame, fromFrame, origin } = mount(config);

    await fromFrame({ ready: true });

    expect(toFrame).toHaveBeenCalledTimes(1);
    const [payload, targetOrigin] = toFrame.mock.calls[0];
    expect(targetOrigin).toBe('https://sign.auco.ai');
    expect(targetOrigin).toBe(origin);
    expect(payload).toMatchObject({
      language: 'es',
      document: 'WO0J4L3YWBWE',
      uxOptions,
      keyPublic: undefined,
    });
    expect(payload).toHaveProperty('sdkParentURL');
    expect(payload).not.toHaveProperty('flowType');
    expect(config.events.onSDKReady).toHaveBeenCalledTimes(1);
  });

  it.each(['upload', 'read', 'attachments', 'validation-attachments'] as const)(
    'adds flowType for the upload-family sdk %s',
    async sdkType => {
      const { toFrame, fromFrame } = mount(uploadConfig({ sdkType }));
      await fromFrame({ ready: true });
      expect(toFrame.mock.calls[0][0]).toMatchObject({
        flowType: sdkType,
        keyPublic: VALID_KEY,
      });
    }
  );

  it('does not add flowType for upload-v2', async () => {
    const { toFrame, fromFrame } = mount(
      uploadConfig({ sdkType: 'upload-v2' })
    );
    await fromFrame({ ready: true });
    expect(toFrame.mock.calls[0][0]).not.toHaveProperty('flowType');
  });
});

describe('token', () => {
  it('asks onSDKToken and replies with the token', async () => {
    const onSDKToken = jest.fn().mockResolvedValue('jwt');
    const { toFrame, fromFrame, origin } = mount(
      signConfig({
        events: { onSDKReady: jest.fn(), onSDKClose: jest.fn(), onSDKToken },
      })
    );

    await fromFrame({ type: 'token' });

    expect(onSDKToken).toHaveBeenCalledTimes(1);
    expect(toFrame).toHaveBeenCalledWith(
      { type: 'token', token: 'jwt' },
      origin
    );
  });
});

describe('frame events', () => {
  it('forwards SDK-PAY data to onSDKPay', async () => {
    const onSDKPay = jest.fn();
    const { fromFrame } = mount(
      uploadConfig({
        events: { onSDKReady: jest.fn(), onSDKClose: jest.fn(), onSDKPay },
      })
    );
    const data = { code: 'ABC', epaycoKey: 'key' };
    await fromFrame({ type: 'SDK-PAY', data });
    expect(onSDKPay).toHaveBeenCalledWith(data);
  });

  it('forwards SDK-NOTIFICATION data to onSDKNotification', async () => {
    const onSDKNotification = jest.fn();
    const { fromFrame } = mount(
      signConfig({
        events: {
          onSDKReady: jest.fn(),
          onSDKClose: jest.fn(),
          onSDKNotification,
        },
      })
    );
    const data = { message: 'Abandoned', options: { tag: 'Abandoned' } };
    await fromFrame({ type: 'SDK-NOTIFICATION', data });
    expect(onSDKNotification).toHaveBeenCalledWith(data);
  });

  it('passes document, redirectTo and signProfile to onSDKClose', async () => {
    const config = uploadConfig();
    const { fromFrame } = mount(config);
    const signProfile = [{ id: '1', name: 'A', email: 'a@a.co', phone: '1' }];
    await fromFrame({
      type: 'SDK-CLOSE',
      document: 'DOC',
      redirectTo: '/home',
      signProfile,
    });
    expect(config.events.onSDKClose).toHaveBeenCalledWith(
      'DOC',
      '/home',
      signProfile
    );
  });

  it('passes similarity and status to onSDKClose for validation', async () => {
    const onSDKClose = jest.fn();
    const { fromFrame } = mount(
      signConfig({
        sdkType: 'validation',
        events: { onSDKReady: jest.fn(), onSDKClose },
      })
    );
    await fromFrame({ type: 'SDK-CLOSE', similarity: 0.97, status: 'DONE' });
    expect(onSDKClose).toHaveBeenCalledWith(0.97, 'DONE', []);
  });

  it('calls onSDKFinish and onSDKBack', async () => {
    const onSDKFinish = jest.fn();
    const onSDKBack = jest.fn();
    const events = {
      onSDKReady: jest.fn(),
      onSDKClose: jest.fn(),
      onSDKFinish,
      onSDKBack,
    };
    const first = mount(signConfig({ events }));
    await first.fromFrame({ type: 'SDK-FINISH' });
    expect(onSDKFinish).toHaveBeenCalledTimes(1);

    resetDom();
    const second = mount(signConfig({ events }));
    await second.fromFrame({ type: 'SDK-BACK' });
    expect(onSDKBack).toHaveBeenCalledTimes(1);
  });
});

describe('listener lifecycle', () => {
  const closeThenReady = async (status?: string) => {
    const config = signConfig();
    const { fromFrame } = mount(config);
    await fromFrame({ type: 'SDK-CLOSE', document: 'DOC', status });
    await fromFrame({ ready: true });
    return config.events.onSDKReady as jest.Mock;
  };

  it('stops listening after SDK-CLOSE', async () => {
    expect(await closeThenReady()).not.toHaveBeenCalled();
  });

  it('keeps listening after SDK-CLOSE with status PENDING', async () => {
    expect(await closeThenReady('PENDING')).toHaveBeenCalledTimes(1);
  });

  it.each(['SDK-FINISH', 'SDK-BACK'])(
    'stops listening after %s',
    async type => {
      const config = signConfig({
        events: {
          onSDKReady: jest.fn(),
          onSDKClose: jest.fn(),
          onSDKFinish: jest.fn(),
          onSDKBack: jest.fn(),
        },
      });
      const { fromFrame } = mount(config);
      await fromFrame({ type });
      await fromFrame({ ready: true });
      expect(config.events.onSDKReady).not.toHaveBeenCalled();
    }
  );

  it('stops listening after unsubscribe', async () => {
    const config = signConfig();
    const { fromFrame, unsubscribe } = mount(config);
    unsubscribe();
    await fromFrame({ ready: true });
    expect(config.events.onSDKReady).not.toHaveBeenCalled();
  });
});

describe('public entry', () => {
  it('exports the runtime constants of the types module', () => {
    expect(LANGUAGES).toEqual(['es', 'en', 'pt', 'fr']);
  });
});

describe('message filtering', () => {
  it('ignores messages from another same-origin iframe', async () => {
    resetDom(['first', 'second']);
    const first = signConfig({ iframeId: 'first' });
    const second = signConfig({ iframeId: 'second' });
    const a = mount(first);
    const b = mount(second);

    await a.fromFrame({ ready: true });
    await a.fromFrame({ type: 'SDK-CLOSE', document: 'DOC' });

    expect(first.events.onSDKReady).toHaveBeenCalledTimes(1);
    expect(first.events.onSDKClose).toHaveBeenCalledTimes(1);
    expect(a.toFrame).toHaveBeenCalledTimes(1);
    expect(second.events.onSDKReady).not.toHaveBeenCalled();
    expect(second.events.onSDKClose).not.toHaveBeenCalled();
    expect(b.toFrame).not.toHaveBeenCalled();
  });

  it('ignores messages without the iframe as source', async () => {
    const config = signConfig();
    const { fromFrame } = mount(config);
    await fromFrame({ ready: true }, { source: null });
    expect(config.events.onSDKReady).not.toHaveBeenCalled();
  });

  it('ignores messages from another origin', async () => {
    const config = signConfig();
    const { fromFrame, toFrame } = mount(config);
    await fromFrame({ ready: true }, { from: 'https://evil.example' });
    expect(toFrame).not.toHaveBeenCalled();
    expect(config.events.onSDKReady).not.toHaveBeenCalled();
  });
});

describe('error handling', () => {
  it('reports a missing onSDKToken to onSDKError', async () => {
    const onSDKError = jest.fn();
    const { fromFrame } = mount(
      signConfig({
        events: { onSDKReady: jest.fn(), onSDKClose: jest.fn(), onSDKError },
      })
    );
    await fromFrame({ type: 'token' });
    expect(onSDKError).toHaveBeenCalledTimes(1);
    expect(onSDKError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onSDKError.mock.calls[0][0].message).toMatch(/onSDKToken/);
  });

  it('reports errors thrown by integrator callbacks', async () => {
    const onSDKError = jest.fn();
    const failure = new Error('boom');
    const { fromFrame } = mount(
      signConfig({
        events: {
          onSDKReady: () => {
            throw failure;
          },
          onSDKClose: jest.fn(),
          onSDKError,
        },
      })
    );
    await fromFrame({ ready: true });
    expect(onSDKError).toHaveBeenCalledWith(failure);
  });

  it('logs to console.error when there is no onSDKError', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { fromFrame } = mount(signConfig());
    await fromFrame({ type: 'token' });
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('ignores messages without an object payload', async () => {
    const onSDKError = jest.fn();
    const config = signConfig({
      events: { onSDKReady: jest.fn(), onSDKClose: jest.fn(), onSDKError },
    });
    const { fromFrame, toFrame } = mount(config);
    await fromFrame(null);
    await fromFrame('ready');
    expect(onSDKError).not.toHaveBeenCalled();
    expect(toFrame).not.toHaveBeenCalled();
  });
});

describe('teardown', () => {
  it('keeps listening after SDK-FINISH without a handler (sign closes next)', async () => {
    const config = signConfig();
    const { fromFrame } = mount(config);
    await fromFrame({ type: 'SDK-FINISH' });
    await fromFrame({ type: 'SDK-CLOSE', redirectTo: 'https://app.auco.ai' });
    expect(config.events.onSDKClose).toHaveBeenCalledWith(
      '',
      'https://app.auco.ai',
      []
    );
  });

  it('keeps listening after SDK-BACK without a handler (upload-v2 restarts)', async () => {
    const config = uploadConfig({ sdkType: 'upload-v2' });
    const { fromFrame, toFrame } = mount(config);
    await fromFrame({ type: 'SDK-BACK' });
    await fromFrame({ ready: true });
    expect(toFrame).toHaveBeenCalledTimes(1);
    expect(config.events.onSDKReady).toHaveBeenCalledTimes(1);
  });

  it('replaces the previous session when started again on the same iframe', async () => {
    const first = signConfig();
    const second = signConfig();
    const old = mount(first);
    const current = mount(second);

    await current.fromFrame({ ready: true });

    expect(first.events.onSDKReady).not.toHaveBeenCalled();
    expect(second.events.onSDKReady).toHaveBeenCalledTimes(1);

    // The stale unsubscribe must not tear down the current session.
    old.unsubscribe();
    await current.fromFrame({ type: 'SDK-CLOSE', status: 'PENDING' });
    expect(second.events.onSDKClose).toHaveBeenCalledTimes(1);
  });

  it('can be unsubscribed more than once', () => {
    const { unsubscribe } = mount(signConfig());
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });
});
