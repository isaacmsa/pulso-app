import config from '../app.json';

it('desactiva el respaldo automático de Android', () => {
  // Sin esto, la huella de la red de casa y los eventos se respaldarían en Google Drive.
  expect((config.expo.android as { allowBackup?: boolean }).allowBackup).toBe(false);
});
