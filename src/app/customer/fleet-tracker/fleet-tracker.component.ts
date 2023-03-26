import { Component, OnInit, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, firstValueFrom, shareReplay } from 'rxjs';
import { WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketService } from 'src/app/services/ws/websocket.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import * as mapboxgl from 'mapbox-gl';
import * as geojson from 'geojson';
import * as turf from '@turf/turf';
import { environment } from 'src/environments/environment';

import { CultivatorHourlyAnalyticsDialogComponent } from '../../cultivator-hourly-analytics-dialog/cultivator-hourly-analytics-dialog.component';
import { CultivatorDailyAnalyticsDialogComponent} from '../../cultivator-daily-analytics-dialog/cultivator-daily-analytics-dialog.component';


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

type CultivatorProperties = {
	cid: string;
}

type CultivatorPosProperties = CultivatorProperties & {
	age_sec: number;
}

type LotProperties = {
	lid?: string;
	name?: string;
}

type WebsocketData = {
	cid: string;
	ts: string;
	lon: number;
	lat: number;
}


@Component({
	selector: 'app-fleet-tracker',
	templateUrl: './fleet-tracker.component.html',
	styleUrls: ['./fleet-tracker.component.css']
})
export class FleetTrackerComponent implements OnInit {

	oid: string | null;
  	form: FormGroup;
	cids: string[] = [];
	cultivator_status: string[] =  [];
	int_seq: number[];
	date_seq: string[];
	cultivator_trace_geojson!: geojson.FeatureCollection<geojson.LineString, CultivatorProperties>;
	cultivator_subtrace_geojson!: geojson.FeatureCollection<geojson.LineString, CultivatorProperties>;
	cultivator_pos_geojson!: geojson.FeatureCollection<geojson.Point, CultivatorPosProperties>;
	lot_boundary_geojson!: geojson.FeatureCollection<geojson.Polygon, LotProperties>;
	wsData: WebSocketSubject<WebsocketData>;
	eventEmitter: EventEmitter<string>;

	center: mapboxgl.LngLat;
	bounds: mapboxgl.LngLatBounds;
	zoom_threshold: number;
	zoom_over_threshold: boolean;


  	constructor(private fb: FormBuilder, private http: HttpClient, private websocketservice: WebsocketService, private dialog: MatDialog) { 

		this.oid = localStorage.getItem('OrgId');

		this.form = this.fb.group({
			cid: ['all'],
			days: ['3'],
			date: ['full']
		}, { updateOn: 'change' });

		(mapboxgl as typeof mapboxgl).accessToken = environment.mapbox.accessToken;
		this.center = new mapboxgl.LngLat(-118.15, 34.68);
		this.bounds = new mapboxgl.LngLatBounds([-127.5, 25.7, -64.5, 47.7]);
		this.zoom_threshold = 20;
		this.zoom_over_threshold = false;

		const now = new Date();
		this.date_seq = this.getLocalDateSequence(new Date(new Date().setDate(now.getDate() - this.form.controls.days.value + 1)).toString(), now.toString());
		this.int_seq = [...Array(30).keys()].slice(1);

		this.wsData = this.websocketservice.getWebsocket();
		this.eventEmitter = new EventEmitter<string>();

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
				this.initCultivatorTraceGeojson();
				this.initCultivatorSubtraceGeojson();
				this.initCultivatorPosGeojson();
				this.initLotBoundaryGeojson();
				this.addInitialDataToCultivatorTraceGeojson();
				this.addInitialDataToCultivatorPosGeojson();
			});
		
  	}

  	ngAfterViewInit(): void {

		let map: mapboxgl.Map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/stout/ckrdmp6tk2mud18mkqpzfjqr8', 
			center: this.center,
			maxBounds: this.bounds,
			zoom: 6.5,
			minZoom: 4,
			doubleClickZoom: false
		});

		map.on('load', () => {

			map.addControl(new mapboxgl.NavigationControl(), 'top-left');
			map.addControl(new mapboxgl.ScaleControl({ maxWidth: 200, unit: 'imperial' }), 'bottom-left');

			map.addSource('cultivator-trace', {
				'type': 'geojson',
				'data': this.cultivator_trace_geojson
			});

			map.addSource('cultivator-subtrace', {
				'type': 'geojson',
				'data': this.cultivator_subtrace_geojson
			});
		
			map.addSource('cultivator-pos', {
				'type': 'geojson',
				'data': this.cultivator_pos_geojson
			});

			map.addSource('lots', {
				'type': 'geojson',
				'data': this.lot_boundary_geojson
			});
			
			map.addLayer({
				'id': 'cultivator-trace-line',
				'type': 'line',
				'source': 'cultivator-trace',
				'layout': {
					'visibility': 'visible',
					'line-join': 'round',
					'line-cap': 'round'
				},
				'paint': {
					'line-color': '#ff8000',
					'line-width': [
						'interpolate',
						['exponential', 2],
						['zoom'],
						14, 7,
						22, 7
					],
					'line-opacity': [
						'interpolate',
						['linear'],
						['zoom'],
						14, 0.4,
						22, 1
					]
				}
			});

			map.addLayer({
				'id': 'cultivator-subtrace-line',
				'type': 'line',
				'source': 'cultivator-subtrace',
				'layout': {
					'visibility': 'visible',
					'line-join': 'round',
					'line-cap': 'round'
				},
				'paint': {
					'line-color': '#ff3333',
					'line-width': [
						'interpolate',
						['exponential', 2],
						['zoom'],
						14, 3,
						22, 3
					],
					'line-opacity': 1
				}
			});
		
			map.addLayer({
				'id': 'cultivator-pos-circle',
				'type': 'circle',
				'source': 'cultivator-pos',
				'layout': {
					'visibility': 'visible'
				},
				'paint': {
					'circle-radius': 12,
					//'circle-color': '#ff0000',
					'circle-color': [
						'step',
						['get', 'age_sec'],
						'rgb(255,0,0)',
						60, 'rgb(102,0,51)',
						3600, 'rgb(51,0,26)',
						14400, 'rgb(0,0,0)'
					],
					'circle-opacity': 1,
					'circle-stroke-color': '#ffffff',
					'circle-stroke-width': 3
				}
			});
		
			map.addLayer({
				'id': 'cultivator-pos-symbol',
				'type': 'symbol',
				'source': 'cultivator-pos',
				'layout': {
					'visibility': 'visible',
					'text-field': ['get', 'cid'],
					'text-size': 14
				},
				'paint': {
					'text-color': '#fff'
				}
			});

			map.addLayer({
				'id': 'lots-fill',
				'type': 'fill',
				'source': 'lots',
				'layout': {},
				'paint': {
					'fill-color': 'rgb(47,247,213)',
					'fill-opacity': 0
				}
			});
		
			map.addLayer({
				'id': 'lots-line',
				'type': 'line',
				'source': 'lots',
				'layout': {},
				'paint': {
					'line-color': 'rgb(255,0,0)',
					'line-width': 1
				}
			});

			map.setLayoutProperty('20210630-sp-1-2-plants-layer', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-spreckels-1-2-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-spreckels-1-3-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-harris-1-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210702-stout-tileset', 'visibility', 'none');

			this.wsData.subscribe((data: WebsocketData) => {
				let i = this.cids.indexOf(data.cid);
				this.cultivator_trace_geojson.features[i].geometry.coordinates.push([data.lon, data.lat]);
				this.cultivator_pos_geojson.features[i].geometry.coordinates = [data.lon, data.lat];
				this.cultivator_pos_geojson.features[i].properties.age_sec = 0;
				let cultivator_trace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-trace') as mapboxgl.GeoJSONSource;
				cultivator_trace_source.setData(this.cultivator_trace_geojson);
				let cultivator_pos_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-pos') as mapboxgl.GeoJSONSource;
				cultivator_pos_source.setData(this.cultivator_pos_geojson);
			});

		});

		// click on a lot to view its properties in a popup
		map.on('click', 'lots-fill', (ev: mapboxgl.MapLayerMouseEvent) => {
			if (ev.features) {
				let feature: mapboxgl.MapboxGeoJSONFeature = ev.features[0];
				let centroid: number[] = turf.centerOfMass(feature).geometry.coordinates;
				new mapboxgl.Popup()
					.setLngLat([centroid[0], centroid[1]])
					.setHTML(`<b>Lot:</b> ${feature.properties ? feature.properties.name : null}`)
					.addTo(map);
			}
		});
		
		// doubleclick on a lot to fit its bound to map
		map.on('dblclick', 'lots-fill', (ev: mapboxgl.MapLayerMouseEvent) => {
			if (ev.features) {
				let feature: mapboxgl.MapboxGeoJSONFeature = ev.features[0];
				let bbox: number[] = turf.bbox(feature);
				if (map.getZoom() < this.zoom_threshold) {
					map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40 });
				}    
			}
		});    

		// click on cultivator-trace to view its properties in a popup
		map.on('click', 'cultivator-pos-circle', (ev: mapboxgl.MapLayerMouseEvent) => {
			let clickbox: mapboxgl.Point[] = [new mapboxgl.Point(ev.point.x - 8, ev.point.y - 8), new mapboxgl.Point(ev.point.x + 8, ev.point.y + 8)];
			let feature: mapboxgl.MapboxGeoJSONFeature = map.queryRenderedFeatures([clickbox[0], clickbox[1]])[0];
			map.flyTo({ 
				center: [(feature.geometry as geojson.Point).coordinates[0], (feature.geometry as geojson.Point).coordinates[1]],
				zoom: 14
			});
		});
		
		this.form.controls.cid.valueChanges.subscribe((cid: string) => {
			//
			this.form.controls.date.reset('full', { emitEvent: false });
			//
			if (cid != 'all') {
				map.setFilter('cultivator-trace-line', ['==', ['to-string', ['get', 'cid']], cid]);
				map.setFilter('cultivator-pos-circle', ['==', ['to-string', ['get', 'cid']], cid]);
				map.setFilter('cultivator-pos-symbol', ['==', ['to-string', ['get', 'cid']], cid]);
				this.cultivator_pos_geojson.features.forEach((feature: geojson.Feature<geojson.Point, CultivatorPosProperties>) => {
					if (feature.properties.cid == cid) 
						map.flyTo({
							center: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
							zoom: 14
						});
				});
			} else {
				map.setFilter('cultivator-trace-line', ['boolean', true]);
				map.setFilter('cultivator-pos-circle', ['boolean', true]);
				map.setFilter('cultivator-pos-symbol', ['boolean', true]);
				map.flyTo({ 
					center: this.center,
					zoom: 6.5
				});
			}
		});

		this.form.controls.days.valueChanges.subscribe((days: number) => {
			//
			this.form.controls.date.reset('full', { emitEvent: false });
			//
			const now: Date = new Date();
			const ts_iso_begin: string = new Date(new Date().setDate(now.getDate() - days + 1)).toISOString();
			const ts_iso_end: string = now.toISOString();
			this.date_seq = this.getLocalDateSequence(new Date(new Date().setDate(now.getDate() - days + 1)).toString(), now.toString());
			//
			if (this.form.controls.cid.value != 'all') {
				const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
				this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${this.form.controls.cid.value}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers })
					.pipe(shareReplay())
					.subscribe((trace: geojson.Position[]) => {
						this.cultivator_trace_geojson.features[this.cids.indexOf(this.form.controls.cid.value)].geometry.coordinates = trace;
					});
				const cultivator_trace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-trace') as mapboxgl.GeoJSONSource;
				cultivator_trace_source.setData(this.cultivator_trace_geojson);
			} else {
				const http_promises: Promise<geojson.Position[]>[] = [];
				const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
				this.cids.forEach((cid: string) => {
					const http$: Observable<geojson.Position[]> = this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${cid}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers }).pipe(shareReplay());
					http_promises.push(firstValueFrom(http$));
				});
				Promise.all(http_promises).then((resolutions: geojson.Position[][]) => {
					this.cids.forEach((cid: string, idx: number) => {
						this.cultivator_trace_geojson.features[idx].geometry.coordinates = resolutions[idx];
					});
					const cultivator_trace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-trace') as mapboxgl.GeoJSONSource;
					cultivator_trace_source.setData(this.cultivator_trace_geojson);
				});
			}
		});

		this.form.controls.date.valueChanges.subscribe((date: string) => {
			//
			this.cids.forEach((cid: string, idx: number) => {
				this.cultivator_subtrace_geojson.features[idx].geometry.coordinates = [];
			});
			//
			if (date != 'full') {
				const ts_iso_begin: string = new Date(date).toISOString();
				const ts_iso_end: string = new Date(new Date(date).getTime() + 24*3600*1000 - 1000).toISOString();
				if (this.form.controls.cid.value != 'all') {
					const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
					this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${this.form.controls.cid.value}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers })
						.pipe(shareReplay())
						.subscribe((trace: geojson.Position[]) => {
							this.cultivator_subtrace_geojson.features[this.cids.indexOf(this.form.controls.cid.value)].geometry.coordinates = trace;
							let cultivator_subtrace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-subtrace') as mapboxgl.GeoJSONSource;
							cultivator_subtrace_source.setData(this.cultivator_subtrace_geojson);
						});
				} else {
					const http_promises: Promise<geojson.Position[]>[] = [];
					const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
					this.cids.forEach((cid: string) => {
						let http$: Observable<geojson.Position[]> = this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${cid}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers }).pipe(shareReplay());	
						http_promises.push(firstValueFrom(http$));
					});
					Promise.all(http_promises).then((resolutions: geojson.Position[][]) => {
						this.cids.forEach((cid: string, idx: number) => {
							this.cultivator_subtrace_geojson.features[idx].geometry.coordinates = resolutions[idx];
						});
						let cultivator_subtrace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-subtrace') as mapboxgl.GeoJSONSource;
						cultivator_subtrace_source.setData(this.cultivator_subtrace_geojson);
					});
				}
			} 
			if (date == 'full') {
				const now: number = new Date().getTime();
				const ts_loc_begin = new Date(now - (this.form.controls.days.value - 1)*24*3600*1000).toString().slice(4, 15);
				const ts_iso_begin = new Date(ts_loc_begin).toISOString();
				const ts_iso_end = new Date().toISOString();
				if (this.form.controls.cid.value != 'all') {
					const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
					this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${this.form.controls.cid.value}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers })
						.pipe(shareReplay())
						.subscribe((trace: geojson.Position[]) => {
							this.cultivator_subtrace_geojson.features[this.cids.indexOf(this.form.controls.cid.value)].geometry.coordinates = trace;
							let cultivator_subtrace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-subtrace') as mapboxgl.GeoJSONSource;
							cultivator_subtrace_source.setData(this.cultivator_subtrace_geojson);
						});	
				} else {
					const http_promises: Promise<geojson.Position[]>[] = [];
					const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
					this.cids.forEach((cid: string) => {
						let http$: Observable<geojson.Position[]> = this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${cid}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers }).pipe(shareReplay());	
						http_promises.push(firstValueFrom(http$));
					});
					Promise.all(http_promises).then((resolutions: geojson.Position[][]) => {
						this.cids.forEach((cid: string, idx: number) => {
							this.cultivator_subtrace_geojson.features[idx].geometry.coordinates = resolutions[idx];
						});
						let cultivator_subtrace_source: mapboxgl.GeoJSONSource = map.getSource('cultivator-subtrace') as mapboxgl.GeoJSONSource;
						cultivator_subtrace_source.setData(this.cultivator_subtrace_geojson);
					});
				}
			}
		});

	} 

	ngOnDestroy() {

		//this.websocketservice.closeWebsocket();

	}

	openHourlyAnalyticsDialog(cid: string, date: string): void {	

		if (date != 'full') 
			this.dialog.open(CultivatorHourlyAnalyticsDialogComponent, {
				width: "50%",
				height: "70%",
				position: {
					left: "500px",
					top: "5%"
				},
				data: { 
					cid: cid, 
					date: new Date().toString().slice(4, 15), 
				},
				closeOnNavigation: true,
				disableClose: true
			});
		else 
			this.dialog.open(CultivatorHourlyAnalyticsDialogComponent, {
				width: "50%",
				height: "70%",
				position: {
					left: "500px",
					top: "5%"
				},
				data: { 
					cid: cid, 
					date: date, 
				},
				closeOnNavigation: true,
				disableClose: true
			});

	}

	openDailyAnalyticsDialog(cid: string, days: number): void {

		this.dialog.open(CultivatorDailyAnalyticsDialogComponent, {
			width: "50%",
			height: "70%",
			position: {
				left: "500px",
				top: "5%"
			},
			data: { 
				cid: cid, 
				days: days < 7 ? 7 : days
			},
			closeOnNavigation: true,
			disableClose: true
		});

	}

	initCultivatorTraceGeojson(): void {

		const cultivator_trace_geojson: geojson.FeatureCollection<geojson.LineString, CultivatorProperties> = {
			"type": "FeatureCollection",
			"features": []
		};
		for (let cid of this.cids) {
			const cultivator_trace_feature_str: string = `
				{ 
					"type": "Feature",
					"properties": {
						"cid": ${cid}
					},
					"geometry": {
						"coordinates": [],
						"type": "LineString"
					}
				}
			`;
			const cultivator_trace_feature: geojson.Feature<geojson.LineString, CultivatorProperties> = JSON.parse(cultivator_trace_feature_str);
			cultivator_trace_geojson.features.push(cultivator_trace_feature);
		}
		this.cultivator_trace_geojson = cultivator_trace_geojson;

	}

	initCultivatorSubtraceGeojson(): void {

		const cultivator_trace_geojson: geojson.FeatureCollection<geojson.LineString, CultivatorProperties> = {
			"type": "FeatureCollection",
			"features": []
		};
		for (let cid of this.cids) {
			const cultivator_trace_feature_str: string = `
				{ 
					"type": "Feature",
					"properties": {
						"cid": ${cid}
					},
					"geometry": {
						"coordinates": [],
						"type": "LineString"
					}
				}
			`;
			const cultivator_trace_feature: geojson.Feature<geojson.LineString, CultivatorProperties> = JSON.parse(cultivator_trace_feature_str);
			cultivator_trace_geojson.features.push(cultivator_trace_feature);
		}
		this.cultivator_subtrace_geojson = cultivator_trace_geojson;

	}
	
	initCultivatorPosGeojson(): void {

		const cultivator_pos_geojson: geojson.FeatureCollection<geojson.Point, CultivatorPosProperties> = {
			"type": "FeatureCollection",
			"features": []
		};
		for (let cid of this.cids) {
			const cultivator_pos_feature_str: string = `
				{ 
					"type": "Feature",
					"properties": {
						"cid": ${cid},
						"age_sec": ${365*24*3600}
					},
					"geometry": {
						"coordinates": [],
						"type": "Point"
					}
				}
			`;
			const cultivator_pos_feature: geojson.Feature<geojson.Point, CultivatorPosProperties> = JSON.parse(cultivator_pos_feature_str);
			cultivator_pos_geojson.features.push(cultivator_pos_feature);
		}
		this.cultivator_pos_geojson = cultivator_pos_geojson;

	}

	initLotBoundaryGeojson(): void {

		const lot_boundary_geojson: geojson.FeatureCollection<geojson.Polygon, LotProperties> = {
			"type": "FeatureCollection",
			"features": []
		}
		this.lot_boundary_geojson = lot_boundary_geojson;

	}

	addInitialDataToCultivatorTraceGeojson(): void {

		const now: number = new Date().getTime();
		const ts_loc_begin: string = new Date(now - (this.form.controls.days.value - 1)*24*3600*1000).toString().slice(4, 15);
		const ts_iso_begin: string = new Date(ts_loc_begin).toISOString();
		const ts_iso_end: string = new Date().toISOString();
		this.cids.forEach((cid: string, idx: number) => {
			const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
			this.http.post<geojson.Position[]>(`${environment.api.url}/cultivators/${cid}/trace`, { ts_begin: ts_iso_begin, ts_end: ts_iso_end }, { headers: headers })
				.pipe(shareReplay())
				.subscribe((trace: geojson.Position[] | null) => {
					if (trace) 
						this.cultivator_trace_geojson.features[idx].geometry.coordinates = trace;
				});
		});

	}

	addInitialDataToCultivatorPosGeojson(): void {

		this.cids.forEach((cid: string, idx: number) => {
			this.http.get<CultivatorPosData>(`${environment.api.url}/cultivators/${cid}/pos`)
				.pipe(shareReplay())
				.subscribe((pos: CultivatorPosData | null) => {
					if (pos) {
						const age_milli: number = new Date().getTime() - new Date(pos.ts).getTime();
						//No need to account for timezoneOffset as far as the cultivators table has the full ISO string as its ts column value.
						//let age_milli: number = new Date().getTime() - (new Date(pos.ts).getTime() + new Date().getTimezoneOffset()*60000);
						this.cultivator_pos_geojson.features[idx].geometry.coordinates = [pos.lon, pos.lat];
						this.cultivator_pos_geojson.features[idx].properties.age_sec = age_milli/1000; 
					}
				});
		});

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
