import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, of, firstValueFrom, forkJoin, shareReplay } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { Chart, ChartItem, ChartConfiguration, registerables } from 'chart.js';
Chart.register(...registerables);
import { environment } from 'src/environments/environment';
import { SELECT_PANEL_INDENT_PADDING_X } from '@angular/material/select/select';

type Cultivator = {
	cid: string;
	oid: string;
	description: object;
	ipv4: string;
	pos: CultivatorPosData;
	cams: number[];
}

type CultivatorPosData = {
	ts: string;
	lon: number;
	lat: number;
}

type HourlyAnalyticsData = {
	hour: number;
	speed: number | null;
	uptime: number | null;
	area: number | null;
	crops: number | null;
}

type DialogData = {
	cid: string;
	date: string;
}

type Toggle = 'chart' | 'table';
type Measure = 'speed' | 'uptime' | 'area' | 'crops';
type Unit = 'metric' | 'imperial';


@Component({
	selector: 'app-cultivator-hourly-analytics-dialog',
	templateUrl: './cultivator-hourly-analytics-dialog.component.html',
	styleUrls: ['./cultivator-hourly-analytics-dialog.component.css']
})
export class CultivatorHourlyAnalyticsDialogComponent implements OnInit {

	form: FormGroup;
	fc_unit: FormControl;
	fc_cid: FormControl;
	fc_date: FormControl;
	dialog_title: string = '';
	dialog_subtitle: string = '';
	oid: string | null;
	cids: string[] = [];
	cultivator_status: string[] = [];
	date_seq: string[];
	table_data_source!: MatTableDataSource<HourlyAnalyticsData>;
	table_columns: string[] = ['hour', 'speed', 'uptime', 'area', 'crops'];
	
	chart!: Chart;
	use_chart: boolean = true;
	use_metric: boolean = true;
	show_cultivator_selector: boolean = false;
	show_date_selector: boolean = false;
	

  	constructor(private fb: FormBuilder, private http: HttpClient, @Inject(MAT_DIALOG_DATA) public dialogData: DialogData, private dialogRef: MatDialogRef<CultivatorHourlyAnalyticsDialogComponent>) { 
		
		this.oid = localStorage.getItem('OrgId');

		this.form = this.fb.group({
			toggle: ['chart'],
			measure: ['speed'],
		}, { updateOn: 'change' });

		this.fc_unit = new FormControl('metric');
		this.fc_cid = new FormControl(this.dialogData.cid);
		this.fc_date = new FormControl(this.dialogData.date);

		const now: Date = new Date();
		this.date_seq = this.getLocalDateSequence(new Date(new Date().setDate(now.getDate() - 6)).toString(), now.toString());

	}

  	ngOnInit(): void {

		const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
		this.http.post<Cultivator[]>(`${environment.api.url}/cultivators`, { oid: this.oid }, { headers: headers })
			.pipe(shareReplay())
			.subscribe((cultivators: Cultivator[]) => {
				cultivators.sort((a: Cultivator, b: Cultivator) => {
					return parseInt(a.cid) - parseInt(b.cid);
				})
				cultivators.forEach((cultivator: Cultivator) => {
					this.cids.push(cultivator.cid);
					const age_milli: number = new Date().getTime() - new Date(cultivator.pos.ts).getTime();
					let status: string;
					if (age_milli < 60*1000 )
						status = `Active`;
					else if (age_milli <= 3600*1000)
						status = `Idle for ${Math.floor(age_milli/(60*1000))} min`;
					else if (age_milli <= 3600*24*1000)
						status = `Idle for ${Math.floor(age_milli/(3600*1000))} hours`;
					else if (age_milli <= 3600*24*5*1000)
						status = `Idle for ${Math.floor(age_milli/(5*24*3600*1000))} days`;
					else
						status = `Idle for 5+ days`;
					this.cultivator_status.push(status);
				});	
			});
		
		const ctx: ChartItem = 'canvas-for-analytics-chart';
		const config: ChartConfiguration = {
			type: 'bar',
			data: {
				labels: [],
				datasets: [
					{
						label: '',
						data: []
					}
				]
			},
			options: {
				responsive: true,
				/*
				parsing: {
					xAxisKey: 'hour',
					yAxisKey: 'speed'
				},
				*/
				scales: {
					x: {
						
					},
					y: {
						max: 2500
					}
				}
			}
		};
		this.chart = new Chart(ctx, config);

		this.createDialogTitle(this.fc_cid.value, this.fc_date.value);
		this.createDatasetToUpdateDialogContent(this.fc_cid.value, this.fc_date.value);

		this.form.controls.toggle.valueChanges.subscribe((toggle: Toggle) => {
			if (toggle == 'chart')
				this.use_chart = true;
			else
				this.use_chart = false;
		});	

		this.fc_unit.valueChanges.subscribe((unit: Unit) => {
			if (unit == 'metric')
				this.use_metric = true;
			else
				this.use_metric = false;
		});

		this.fc_cid.valueChanges.subscribe((cid: string) => {
			this.createDialogTitle(cid, this.fc_date.value);
			this.createDatasetToUpdateDialogContent(cid, this.fc_date.value);
		});

		this.fc_date.valueChanges.subscribe((date: string) => {
			this.createDialogTitle(this.fc_cid.value, date);
			this.createDatasetToUpdateDialogContent(this.fc_cid.value, date);
		});
		
  	}

	createDialogTitle(cid: string, date: string): void {

		if (cid != 'all') {
			this.dialog_title = `Hourly Performance of Cultivator ${cid}`;
			this.dialog_subtitle = date == 'full' ? 'Today' : date;
		} else {
			this.dialog_title = `Hourly Performance Averaged over All Cultivators`;
			this.dialog_subtitle = date == 'full' ? 'Today' : date;
		}
	
	}

	createDatasetToUpdateDialogContent(cid: string, date: string): void {

		const promises_of_hourly_analytics_data: Promise<HourlyAnalyticsData>[] = [];

		date = date != 'full' ? date : new Date().toString().slice(4,15);

		if (cid != 'all') 
			for (let hr = 6; hr < 21; hr++) {
				let ts_iso_begin: string = new Date(new Date(date).getTime() + hr*3600*1000).toISOString();
				let ts_iso_end: string = new Date(new Date(ts_iso_begin).getTime() + 3600*1000 - 1000).toISOString();
				let headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
				let join$ = forkJoin({
					hour: of(hr),
					speed: this.http.post<number>(`${environment.api.url}/cultivators/${cid}/distance`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers }).pipe(shareReplay()),
					uptime: of(null),
					area: of(null),
					crops: of(null)
				});
				promises_of_hourly_analytics_data.push(firstValueFrom(join$) as Promise<HourlyAnalyticsData>);
			}	
		else 
			for (let hr = 6; hr < 21; hr++) {
				let ts_iso_begin: string = new Date(new Date(date).getTime() + hr*3600*1000).toISOString();
				let ts_iso_end: string = new Date(new Date(ts_iso_begin).getTime() + 3600*1000 - 1000).toISOString();
				let headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
				let join$ = forkJoin({
					hour: of(hr),
					speed: this.http.post<number>(`${environment.api.url}/cultivators/${cid}/avg_distance`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers }).pipe(shareReplay()),
					uptime: of(null),
					area: of(null),
					crops: of(null)
				});
				promises_of_hourly_analytics_data.push(firstValueFrom(join$) as Promise<HourlyAnalyticsData>);
			}

		Promise.all(promises_of_hourly_analytics_data).then((dataset: HourlyAnalyticsData[]) => {

			this.table_data_source = new MatTableDataSource<HourlyAnalyticsData>(dataset);

			this.chart.data.labels = dataset.map(dataObject => dataObject.hour.toString());
			this.chart.data.datasets[0].label = this.form.controls.measure.value;
			this.chart.data.datasets[0].data = dataset.map(dataObject => dataObject[this.form.controls.measure.value as Measure]);
			this.chart.update();

			this.form.controls.measure.valueChanges.subscribe((measure: Measure) => {
				this.chart.data.datasets[0].label = measure;
				this.chart.data.datasets[0].data = dataset.map(dataObject => dataObject[measure as Measure]);
				this.chart.update();
			});

			this.fc_unit.valueChanges.subscribe((unit: Unit) => {
				if (unit == 'metric') {
					this.chart.data.datasets[0].data = dataset.map(dataObject => dataObject[this.form.controls.measure.value as Measure]);
				} else {
					const measure_values = dataset.map(dataObject => dataObject[this.form.controls.measure.value as Measure]);
					if (this.form.controls.measure.value == 'speed')
						measure_values.forEach((val: number | null, idx: number) => {
							measure_values[idx] = val ? val * 1.094 : null;
						});
					if (this.form.controls.measure.value == 'area')
						measure_values.forEach((val: number | null, idx: number) => {
						measure_values[idx] = val ? val * 0.000247 : null;
					});	
					this.chart.data.datasets[0].data = measure_values;
				}
				this.chart.update();
			});

		});	
		
	}

	closeDialog(): void {

		this.chart?.destroy();
		this.dialogRef.close();

	}

	openCultivatorSelector() {
		const button: HTMLElement | null = document.getElementById("change-cultivator-button");
		const rect: DOMRect | undefined = button?.getBoundingClientRect();
		const selector: HTMLElement | null = document.getElementById("cultivator-selector");
		selector?.setAttribute("style", `position: fixed; left: ${rect!.left - 48}px; top: ${rect!.bottom + 12}px; zIndex: 20;`);
		this.show_cultivator_selector = true;
		setTimeout(() => { 
			this.show_cultivator_selector = false;
		}, 10000);
	}

	openDateSelector() {
		const button: HTMLElement | null = document.getElementById("change-date-button");
		const rect: DOMRect | undefined = button?.getBoundingClientRect();
		const selector: HTMLElement | null = document.getElementById("date-selector");
		selector?.setAttribute("style", `position: fixed; left: ${rect!.right + 12}px; top: ${rect!.top}px; zIndex: 20;`);
		this.show_date_selector = true;
		setTimeout(() => { 
			this.show_date_selector = false; 
		}, 10000);
	}

	getLocalDateSequence(ts_loc_begin: string, ts_loc_end: string): string[] {

		let date_seq: string[] = [];
		const t_begin: number = new Date(ts_loc_begin).getTime();
		const t_end: number = new Date(ts_loc_end).getTime();
		let t: number = t_begin;
		while (t <= t_end) {
			date_seq.push(new Date(t).toString().slice(4,15));
			t = t + 24*3600*1000;
		}
		return date_seq.reverse();

	}

}