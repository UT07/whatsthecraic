import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('react-router-dom', () => {
  return {
    __esModule: true,
    Routes: ({ children }) => <div data-testid="routes">{children}</div>,
    Route: ({ element }) => element || null,
    Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>
  };
}, { virtual: true });

jest.mock('framer-motion', () => ({
  __esModule: true,
  motion: {
    main: ({ children, ...props }) => <main {...props}>{children}</main>
  }
}));

jest.mock('./services/apiClient', () => ({
  getToken: () => null,
  getUser: () => null
}));

jest.mock('./components/Navbar', () => ({
  __esModule: true,
  default: () => <nav>Mock Navbar</nav>
}));

jest.mock('./pages/Dashboard', () => ({ __esModule: true, default: () => <div>Dashboard Page</div> }));
jest.mock('./pages/DJs', () => ({ __esModule: true, default: () => <div>DJs Page</div> }));
jest.mock('./pages/Venues', () => ({ __esModule: true, default: () => <div>Venues Page</div> }));
jest.mock('./pages/CombinedGigs', () => ({ __esModule: true, default: () => <div>Discover Page</div> }));
jest.mock('./pages/Organizer', () => ({ __esModule: true, default: () => <div>Organizer Page</div> }));
jest.mock('./pages/Preferences', () => ({ __esModule: true, default: () => <div>Preferences Page</div> }));
jest.mock('./pages/AdminML', () => ({ __esModule: true, default: () => <div>Admin ML Page</div> }));
jest.mock('./pages/Auth/Login', () => ({ __esModule: true, default: () => <div>Login Page</div> }));
jest.mock('./pages/Auth/Signup', () => ({ __esModule: true, default: () => <div>Signup Page</div> }));
jest.mock('./pages/Auth/ForgotPassword', () => ({ __esModule: true, default: () => <div>Forgot Password Page</div> }));

const App = require('./App').default;

test('renders login experience for unauthenticated users', async () => {
  render(<App />);
  expect(screen.getByText('Mock Navbar')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
