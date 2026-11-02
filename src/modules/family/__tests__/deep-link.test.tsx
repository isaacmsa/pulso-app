import { QueryClientProvider } from '@tanstack/react-query';
import { renderRouter, screen } from 'expo-router/testing-library';
import { createTestQueryClient } from '../../../shared/query/test-client';
import FollowScreen from '../screens/FollowScreen';

function Follow() {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <FollowScreen />
    </QueryClientProvider>
  );
}

it('el enlace /c/ABCD2345 abre seguir con el código', async () => {
  await renderRouter({ index: () => null, 'c/[code]': Follow }, { initialUrl: '/c/ABCD2345' });
  expect(await screen.findByLabelText('Seguir esta casa')).toBeOnTheScreen();
  expect(screen.getByLabelText('Código de la casa').props.value).toBe('ABCD2345');
});

it('el enlace con el código en minúsculas también lo escribe en mayúsculas', async () => {
  await renderRouter({ index: () => null, 'c/[code]': Follow }, { initialUrl: '/c/abcd2345' });
  expect(await screen.findByLabelText('Código de la casa')).toHaveProp('value', 'ABCD2345');
});
