import { RouterProvider } from 'react-router-dom';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Import the CSS file with Tailwind directives
import { datadogRum } from '@datadog/browser-rum';
import { reactPlugin } from '@datadog/browser-rum-react';
import { createBrowserRouter } from '@datadog/browser-rum-react/react-router-v6';
import ChatbotUI from './components/ChatInterface';
import MemoryPage from './components/MemorySelection';
import RAGInterface from './components/RAGInterface';
import ModelInterface from './components/ModelInterface';
import PrivateRoute from './components/PrivateRoute';
import { AuthFallback, LoginRoute } from './components/AuthRoutes';

datadogRum.init({
  applicationId: import.meta.env.VITE_DATADOG_APPLICATION_ID,
  clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
  site: import.meta.env.VITE_DATADOG_SITE,
  service: import.meta.env.VITE_DATADOG_SERVICE,
  env: import.meta.env.VITE_DATADOG_ENV,
  version: import.meta.env.VITE_VERSION,
  sessionSampleRate: 100,
  sessionReplaySampleRate: 20,
  defaultPrivacyLevel: 'mask-user-input',
  trackResources: true,
  trackLongTasks: true,
  trackUserInteractions: true,
  plugins: [reactPlugin({ router: true })],
});

const router = createBrowserRouter([
  {
    element: (
      <React.StrictMode>
        <App />
      </React.StrictMode>
    ),
    children: [
      {
        path: '/login',
        element: <LoginRoute />,
      },
      {
        element: <PrivateRoute />,
        children: [
          {
            index: true,
            element: <ChatbotUI />,
          },
          {
            path: '/chat',
            element: <ChatbotUI />,
          },
          {
            path: '/memory',
            element: <MemoryPage />,
          },
          {
            path: '/rag',
            element: <RAGInterface />,
          },
          {
            path: '/model',
            element: <ModelInterface />,
          },
        ],
      },
      {
        path: '*',
        element: <AuthFallback />,
      },
    ],
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<RouterProvider router={router} />);
