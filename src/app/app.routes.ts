import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: Home, title: 'Home' },
  {
    path: 'accordion',
    loadComponent: () => import('./pages/accordion/accordion').then((m) => m.Accordion),
    title: 'Accordion',
  },
  {
    path: 'image-mask',
    loadComponent: () => import('./pages/image-mask/image-mask').then((m) => m.ImageMask),
    title: 'Image mask',
  },
  { path: '**', redirectTo: '' },
];
