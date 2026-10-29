import * as Notifications from 'expo-notifications';
import { recordConfirmation } from '../../power-detection/power-monitor';
import {
  resetConfirmationCache,
  setupNotifications,
  startConfirmationResponses,
} from '../confirmation';

jest.mock('expo-notifications', () => ({
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  getLastNotificationResponse: jest.fn(),
  clearLastNotificationResponse: jest.fn(),
}));
jest.mock('../../power-detection/power-monitor', () => ({ recordConfirmation: jest.fn() }));

const notifications = Notifications as jest.Mocked<typeof Notifications>;
const record = recordConfirmation as jest.Mock;

const OUTAGE_START = 1_793_570_000_000;

function response(
  actionIdentifier: string,
  data: Record<string, unknown> = { type: 'confirm', outageStart: OUTAGE_START },
  identifier = 'notif-1',
) {
  return {
    actionIdentifier,
    notification: { request: { identifier, content: { data } } },
  } as never;
}

let listener: (r: never) => void;
let remove: jest.Mock;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.resetAllMocks();
  resetConfirmationCache();
  remove = jest.fn();
  notifications.addNotificationResponseReceivedListener.mockImplementation((l) => {
    listener = l as never;
    return { remove } as never;
  });
  notifications.getLastNotificationResponse.mockReturnValue(null);
  notifications.setNotificationCategoryAsync.mockResolvedValue({} as never);
  record.mockResolvedValue(true);
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => warnSpy.mockRestore());

const flush = () => new Promise((r) => setImmediate(r));

describe('confirmación Sí/No', () => {
  it('tocar Sí guarda confirmation con answer true y el outageStart del push', async () => {
    startConfirmationResponses();
    listener(response('yes'));
    await flush();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(OUTAGE_START, true);
  });

  it('tocar No guarda answer false', async () => {
    startConfirmationResponses();
    listener(response('no'));
    await flush();
    expect(record).toHaveBeenCalledWith(OUTAGE_START, false);
  });

  it('la misma respuesta dos veces guarda una sola', async () => {
    notifications.getLastNotificationResponse.mockReturnValue(response('yes'));
    startConfirmationResponses(); // arranque en frío: la respuesta que abrió la app
    listener(response('yes')); // y el mismo aviso por el oyente
    await flush();
    expect(record).toHaveBeenCalledTimes(1);
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('un push sin outageStart válido no guarda nada', async () => {
    startConfirmationResponses();
    listener(response('yes', { type: 'confirm' }, 'a'));
    listener(response('yes', { type: 'confirm', outageStart: 0 }, 'b'));
    listener(response('yes', { type: 'confirm', outageStart: -3 }, 'c'));
    listener(response('yes', { type: 'confirm', outageStart: 'ayer' }, 'd'));
    listener(response('yes', { type: 'confirm', outageStart: 1.5 }, 'e'));
    await flush();
    expect(record).not.toHaveBeenCalled();
  });

  it('tocar el cuerpo del aviso (sin acción) no guarda confirmación', async () => {
    startConfirmationResponses();
    listener(response(Notifications.DEFAULT_ACTION_IDENTIFIER));
    await flush();
    expect(record).not.toHaveBeenCalled();
  });

  it('si el nativo falla, la respuesta se puede reintentar', async () => {
    record.mockRejectedValueOnce(new Error('boom'));
    startConfirmationResponses();
    listener(response('yes'));
    await flush();
    listener(response('yes'));
    await flush();
    expect(record).toHaveBeenCalledTimes(2);
  });

  it('dejar de escuchar quita el oyente', () => {
    startConfirmationResponses()();
    expect(remove).toHaveBeenCalled();
  });
});

describe('setupNotifications', () => {
  it('muestra los avisos con la app abierta y registra la categoría con Sí y No que abren la app', async () => {
    await setupNotifications();
    const handler = notifications.setNotificationHandler.mock.calls[0]?.[0];
    expect(await handler?.handleNotification({} as never)).toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
    expect(notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('confirm_outage', [
      { identifier: 'yes', buttonTitle: 'Sí', options: { opensAppToForeground: true } },
      { identifier: 'no', buttonTitle: 'No', options: { opensAppToForeground: true } },
    ]);
  });
});
