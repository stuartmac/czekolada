import React from 'react';
import ReactDOM from 'react-dom/client';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';

import './index.css';
import App, {AppRoutes} from './App';

import 'bootstrap/dist/css/bootstrap.min.css';

const router = createBrowserRouter(
  AppRoutes()
);


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App>
      <RouterProvider router={router} />
    </App>
  </React.StrictMode>
);
