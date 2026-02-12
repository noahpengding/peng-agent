import React from 'react';
import { Outlet } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';

const App: React.FC = () => {
<<<<<<< HEAD
  return (
    <Provider store={store}>
      <Outlet />
    </Provider>
  );
};

export default App;
