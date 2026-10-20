import { render, screen } from '@testing-library/react-native';
import Home from '../app/index';

it('muestra el nombre de la app y el acceso al registrador', async () => {
  await render(<Home />);
  expect(screen.getByText('Pulso')).toBeTruthy();
  expect(screen.getByText('Abrir registrador')).toBeTruthy();
});
