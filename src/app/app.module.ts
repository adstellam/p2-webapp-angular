import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { JwtModule } from '@auth0/angular-jwt';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule} from '@angular/material/button-toggle';
import { MatRadioModule } from '@angular/material/radio'
import { MatIconModule } from '@angular/material/icon';

import { AppRoutingModule } from './app-routing.module';
import { CustomerModule } from './customer/customer.module';
import { SupportModule } from './support/support.module';

import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';
import { CultivatorHourlyAnalyticsDialogComponent } from './cultivator-hourly-analytics-dialog/cultivator-hourly-analytics-dialog.component';
import { CultivatorDailyAnalyticsDialogComponent } from './cultivator-daily-analytics-dialog/cultivator-daily-analytics-dialog.component';

import { HttpErrorInterceptorService } from './services/http/http-error-interceptor.service';
import { environment } from 'src/environments/environment';


export function tokenGetter(): string|null {
    return localStorage.getItem('Jwt');
}


@NgModule({
	declarations: [
		AppComponent,
		LoginComponent,
  		PageNotFoundComponent,
		CultivatorHourlyAnalyticsDialogComponent,
		CultivatorDailyAnalyticsDialogComponent,
	],
	imports: [
		BrowserModule,
		RouterModule,
		ReactiveFormsModule,
		HttpClientModule,
		JwtModule.forRoot({
            config: {
                tokenGetter: tokenGetter,
                allowedDomains: environment.jwt.allowedDomains,
                disallowedRoutes: environment.jwt.disallowedRoutes
            }
        }),
		MatSelectModule,
		MatDialogModule,
		MatTableModule,
		MatButtonModule,
		MatButtonToggleModule,
		MatRadioModule,
		MatIconModule,
		AppRoutingModule,
		CustomerModule,
		SupportModule
	],
	providers: [
		{ provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptorService, multi: true }
	],
	entryComponents: [
		CultivatorHourlyAnalyticsDialogComponent,
		CultivatorDailyAnalyticsDialogComponent
	],
	bootstrap: [
		AppComponent
	]
})
export class AppModule { }
