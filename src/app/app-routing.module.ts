import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LoginComponent } from './login/login.component';
import { CustomerHomeComponent } from './customer/customer-home/customer-home.component';
import { SupportHomeComponent } from './support/support-home/support-home.component';
import { FleetTrackerComponent } from './customer/fleet-tracker/fleet-tracker.component';
import { FleetViewComponent } from './customer/fleet-view/fleet-view.component';
import { CropMonitorComponent } from './customer/crop-monitor/crop-monitor.component';
import { YieldAnalyzerComponent } from './customer/yield-analyzer/yield-analyzer.component';
import { CostAnalyzerComponent } from './customer/cost-analyzer/cost-analyzer.component';
import { AdminTaskComponent } from './customer/admin-task/admin-task.component';
import { PageNotFoundComponent } from './page-not-found/page-not-found.component';

const routes: Routes = [
	{ 
		path: 'login', 
		component: LoginComponent 
	},
	{ 
		path: 'customer-home/:oid', 
		component: CustomerHomeComponent, 
		children: [
			{
				path: 'fleet-tracker',
				component: FleetTrackerComponent
			},
			{
				path: 'fleet-view',
				component: FleetViewComponent
			},
			{
				path: 'crop-monitor',
				component: CropMonitorComponent
			},
			{
				path: 'yield-analyzer',
				component: YieldAnalyzerComponent
			},
			{
				path: 'cost-analyzer',
				component: CostAnalyzerComponent
			},
			{
				path: 'admin-tasks',
				component: AdminTaskComponent
			},
			{
				path: '',
				component: FleetTrackerComponent
			}
		]
	},
	{ 
		path: 'support-home', 
		component: SupportHomeComponent, 
		children: [

		]
	},
	{
		path: '',
		redirectTo: '/login', 
        pathMatch: 'full' 
	},
	{
		path: '**',
		component: PageNotFoundComponent
	}
];

@NgModule({
	imports: [
		RouterModule.forRoot(routes)
	],
	exports: [
		RouterModule
	]
})
export class AppRoutingModule { }
