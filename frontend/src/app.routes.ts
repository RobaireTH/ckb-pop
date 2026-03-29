import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { CheckInComponent } from './components/check-in/check-in.component';
import { MintingComponent } from './components/minting/minting.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { CreateEventComponent } from './components/create-event/create-event.component';
import { LiveQrComponent } from './components/live-qr/live-qr.component';
import { IntegrateComponent } from './components/integrate/integrate.component';
import { ClaimComponent } from './components/claim/claim.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'check-in', component: CheckInComponent },
  { path: 'minting', component: MintingComponent }, 
  { path: 'gallery', component: GalleryComponent },
  { path: 'create', component: CreateEventComponent },
  { path: 'claim', component: ClaimComponent },
  { path: 'integrate', component: IntegrateComponent },
  { path: 'event/:id/live', component: LiveQrComponent },
  { path: '**', redirectTo: '' }
];
