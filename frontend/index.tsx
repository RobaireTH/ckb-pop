 // Critical for JIT
import { ErrorHandler, enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { AppComponent } from './src/app.component';
import { routes } from './src/app.routes';
import { GlobalErrorHandler } from './src/services/error-handler.service';

// Initialize Vercel Analytics and Speed Insights
inject();
injectSpeedInsights();

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
}).catch(err => console.error(err));

