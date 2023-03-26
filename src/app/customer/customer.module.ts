import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from "@angular/material/table";
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';

import { CustomerHomeComponent } from './customer-home/customer-home.component';
import { FleetTrackerComponent } from './fleet-tracker/fleet-tracker.component';
import { FleetViewComponent } from './fleet-view/fleet-view.component';
import { CropMonitorComponent } from './crop-monitor/crop-monitor.component';
import { YieldAnalyzerComponent } from './yield-analyzer/yield-analyzer.component';
import { CostAnalyzerComponent } from './cost-analyzer/cost-analyzer.component';
import { PlantDetailsModalComponent } from './plant-details-modal/plant-details-modal.component';
import { AdminTaskComponent } from './admin-task/admin-task.component';


@NgModule({
  	declarations: [
		CustomerHomeComponent,
		FleetTrackerComponent,
		FleetViewComponent,
		CropMonitorComponent,
		YieldAnalyzerComponent,
		CostAnalyzerComponent,
  		PlantDetailsModalComponent,
    CropMonitorComponent,
    AdminTaskComponent,
  	],
  	imports: [
    	CommonModule,
		BrowserAnimationsModule,
		RouterModule,
		ReactiveFormsModule,
		HttpClientModule,
		MatSelectModule,
		MatDialogModule,
		MatTableModule,
		MatButtonModule,
		MatTooltipModule,
		MatIconModule
  	],
  	providers: [
	]
})
export class CustomerModule { }
