import { Component, OnInit,  AfterViewInit, OnDestroy, EventEmitter} from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { shareReplay } from 'rxjs/operators';
import { WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketService } from 'src/app/services/ws/websocket.service';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import * as mapboxgl from 'mapbox-gl';
import * as geojson from 'geojson';
import * as turf from '@turf/turf';
import { PlantDetailsModalComponent } from '../plant-details-modal/plant-details-modal.component';
import { environment } from 'src/environments/environment';


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

type PlantProperties = {
	pid?: string;
	commodity_type?: string;
	diameter_cm?: number;
	healt_index?: number;
}

type LotProperties = {
	lid?: string;
	name?: string;
}

type SoilProperties = {
	id?: string;
	wvc?: number;
}

type WebsocketData = {
	cid: string;
	ts: string;
	lon: number;
	lat: number;
}


@Component({
	selector: 'app-overview-map',
	templateUrl: './overview-map.component.html',
	styleUrls: ['./overview-map.component.css']
})
export class OverviewMapComponent implements OnInit, AfterViewInit, OnDestroy {

	oid: string | null;
	cids: string[] = [];
	cultivator_trace_geojson!: geojson.FeatureCollection<geojson.LineString, CultivatorProperties>;
	cultivator_pos_geojson!: geojson.FeatureCollection<geojson.Point, CultivatorPosProperties> ;
	plant_status_geojson!: geojson.FeatureCollection<geojson.Point, PlantProperties>;
	lot_boundary_geojson!: geojson.FeatureCollection<geojson.Polygon, LotProperties>;
	soil_condition_geojson!: geojson.FeatureCollection<geojson.Polygon, SoilProperties>;

	center: mapboxgl.LngLat;
	bounds: mapboxgl.LngLatBounds;
	zoom_threshold: number;
	zoom_over_threshold: boolean;

	heatmap_tabs: HTMLCollectionOf<Element>;
	heatmap_tab_selected_idx: number;
	plant_size: FormControl;
	plant_hidx: FormControl;

	wsData: WebSocketSubject<WebsocketData>;
	eventEmitter: EventEmitter<string>;

	constructor(private http: HttpClient, private websocketservice: WebsocketService, private dialogservice: MatDialog) { 
	
		this.oid = localStorage.getItem('OrgId');

		(mapboxgl as typeof mapboxgl).accessToken = environment.mapbox.accessToken;
		this.center = new mapboxgl.LngLat(-118.15, 34.68);
		this.bounds = new mapboxgl.LngLatBounds([-125, 28, -64, 51]);
		this.zoom_threshold = 20;
		this.zoom_over_threshold = false;

		this.heatmap_tabs = document.getElementsByClassName('menu-tab');
		this.heatmap_tab_selected_idx = 0;
		this.plant_size = new FormControl(0, { updateOn: 'change' });
		this.plant_hidx = new FormControl(0, { updateOn: 'change' });

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
				});	
				this.initCultivatorTraceGeojson();
				this.initCultivatorPosGeojson();
				this.initPlantStatusGeojson();
				this.initLotBoundaryGeojson();
				this.initSoilConditionGeojson();
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

			if (this.cultivator_trace_geojson) {
				map.addSource('cultivator-trace', {
					'type': 'geojson',
					'data': this.cultivator_trace_geojson
				});
			
			}

			map.addSource('cultivator-pos', {
				'type': 'geojson',
				'data': this.cultivator_pos_geojson
			});

			map.addSource('lots', {
				'type': 'geojson',
				'data': this.lot_boundary_geojson
			});
			
			map.addSource('soil-condition', {
				'type': 'geojson',
				'data': this.soil_condition_geojson
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
		
			map.addLayer({
				'id': 'soil-condition-fill',
				'type': 'fill',
				'source': 'soil-condition',
				'layout': {
					'visibility': 'none'
				},
				'paint': {
				   'fill-color': [
						'step',
						['get', 'vwc'],
						'rgb(215,25,28)',
						20, 'rgb(253,174,97)',
						40, 'rgb(255,255,191)',
						60, 'rgb(171,221,164)',
						80, 'rgb(43,131,186)'
				   ],
				   'fill-opacity': 0.5
				}
			});
		
			map.addLayer({
				'id': 'plant-size-heat',
				'type': 'heatmap',
				'source': 'composite',
				'source-layer': '20210630-Sp-1-2-plants-layer',
				'maxzoom': this.zoom_threshold,
				'layout': {
					'visibility': 'visible'
				},
				'paint': {
					// increase weight as plant diameter increases
					'heatmap-weight': [
						'interpolate',
						['linear'],
						['get', 'diameter_cm'],
						0, 0,
						30, 1
					],
					// increase intensity as zoom level increases
					'heatmap-intensity': [
						'interpolate',
						['linear'],
						['zoom'],
						14, 1,
						this.zoom_threshold, 3
					],
					// increase radius as zoom level increases
					'heatmap-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						14, 3,
						this.zoom_threshold, 15
					],
					// use sequential color palette to use exponentially as the weight increases
					'heatmap-color': [
						'interpolate',
						['linear'],
						['heatmap-density'],
						0, 'rgba(236,222,239,0)',
						0.2, 'rgb(208,209,230)',
						0.4, 'rgb(166,189,219)',
						0.6, 'rgb(103,169,207)',
						0.8, 'rgb(28,144,153)'
					],
					// decrease opacity to transition into the circle layer
					//'heatmap-opacity': [
					//    'interpolate',
					//    ['linear'],
					//    ['zoom'],
					//    14, 1,
					//    this.zoom_threshold, 0.3
					//],
				}
			});
		
			map.addLayer({
				'id': 'plant-hidx-heat',
				'type': 'heatmap',
				'source': 'composite',
				'source-layer': '20210630-Sp-1-2-plants-layer',
				'maxzoom': this.zoom_threshold,
				'layout': {
					'visibility': 'none'
				},
				'paint': {
					// increase weight as plant diameter increases
					'heatmap-weight': [
						'interpolate',
						['linear'],
						['get', 'health_index'],
						0, 0,
						100, 1
					],
					// increase intensity as zoom level increases
					'heatmap-intensity': [
						'interpolate',
						['linear'],
						['zoom'],
						14, 1,
						this.zoom_threshold, 3
					],
					// increase radius as zoom level increases
					'heatmap-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						14, 3,
						this.zoom_threshold, 15
					],
					// use sequential color palette to use exponentially as the weight increases
					'heatmap-color': [
						'interpolate',
						['linear'],
						['heatmap-density'],
						0, 'rgba(236,222,239,0)',
						0.2, 'rgb(208,209,230)',
						0.4, 'rgb(166,189,219)',
						0.6, 'rgb(103,169,207)',
						0.8, 'rgb(28,144,153)'
					],
					// decrease opacity to transition into the circle layer
					//'heatmap-opacity': [
					//    'interpolate',
					//    ['linear'],
					//    ['zoom'],
					//    14, 1,
					//    this.zoom_threshold, 0.3
					//],
				}
			});
		
			map.addLayer({
				'id': 'plants-circle',
				'type': 'circle',
				'source': 'composite',
				'source-layer': '20210630-Sp-1-2-plants-layer',
				'minzoom': this.zoom_threshold,
				'layout': {
					'visibility': 'visible'
				},
				'paint': {
					// increase the circle radius with an increase in the zoom level (19 to 22) or plant diameter (0 to 30)
					'circle-radius': [
						'interpolate',
						['linear'],
						['zoom'],
						this.zoom_threshold, 
						[
							'interpolate',
							['linear'],
							['get', 'diameter_cm'],
							1, 1,
							30, 5
						],
						22,
						[
							'interpolate',
							['linear'],
							['get', 'diameter_cm'],
							1, 5,
							30, 10
						]
					],
					// color-code the circle for different bands of health index; use red stroke for the circle if irregualr
					'circle-color': [
						'step',
						['get', 'health_index'],
						'#ff99ff',
						20, '#cc99ff',
						40, '#99ccff',
						60, '#3399ff',
						80, '#0099ff'
					],
					'circle-opacity': 0.5,
					'circle-stroke-color': [
						'case',
						['==', ['get', 'irregular'], 'false'], '#003399',
						['==', ['get', 'irregular'], 'true'], '#ff0000',
						'#000'
					],
					'circle-stroke-width': 3
				}
			});

			map.setLayoutProperty('20210630-sp-1-2-plants-layer', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-spreckels-1-2-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-spreckels-1-3-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210701-harris-1-tileset', 'visibility', 'none');
			map.setLayoutProperty('stout-20210702-stout-tileset', 'visibility', 'none');

			this.wsData.subscribe((data: WebsocketData) => {
				let i: number = this.cids.indexOf(data.cid);
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

		// click on an individual plant to view its size and health in a popup
		map.on('click', 'plants-circle', (ev: mapboxgl.MapLayerMouseEvent) => {
			if (ev.features) {
				let feature: mapboxgl.MapboxGeoJSONFeature = ev.features[0];
				new mapboxgl.Popup()
					.setLngLat([(feature.geometry as geojson.Point).coordinates[0], (feature.geometry as geojson.Point).coordinates[1]])
					.setHTML(`<b>Commodity:</b> ${feature.properties ? feature.properties.commodity_type : null} <br>
							  <b>Size:</b> ${feature.properties ? feature.properties.diameter_cm : null} <br>
							  <b>Health:</b> ${feature.properties ? feature.properties.health_index: null} <br>
							  <b>Irregular:</b> ${feature.properties ? feature.properties.irregular: null}`)
					.addTo(map);
			}
		});

		// doubleclick on an individual plant to view its picture image in a model
		map.on('dblclick', 'plants-circle', (ev: mapboxgl.MapLayerMouseEvent) => {
			ev.originalEvent.stopPropagation();
			let clickbox: mapboxgl.Point[] = [new mapboxgl.Point(ev.point.x - 8, ev.point.y - 8), new mapboxgl.Point(ev.point.x + 8, ev.point.y + 8)];
			let feature: mapboxgl.MapboxGeoJSONFeature = map.queryRenderedFeatures([clickbox[0], clickbox[1]])[0];
			if (feature.properties) {
				this.displayPlantDetails(feature.properties.id);
			}
		});   

		// zoom over map
		map.on('zoom', () => {
			if (map.getZoom() >= this.zoom_threshold) {
				this.zoom_over_threshold = true;
			} else {
				this.zoom_over_threshold = false;
			}
		});

		this.plant_size.valueChanges.subscribe((value: number) => {
			map.setFilter('plant-size-heat', ['>=', ['number', ['get', 'diameter_cm']], value]);
		});
		this.plant_hidx.valueChanges.subscribe((value: number) => {
			map.setFilter('plant-hidx-heat', ['>=', ['number', ['get', 'health_index']], value]);
		});

		this.eventEmitter.subscribe((ev: string) => {
			switch (ev) {
				case 'cultivators-visible':
					map.setLayoutProperty('cultivator-trace-line', 'visibility', 'visible');
					map.setLayoutProperty('cultivator-pos-circle', 'visibility', 'visible');
					map.setLayoutProperty('cultivator-pos-symbol', 'visibility', 'visible');
					break;
				case 'cultivators-invisible':
					map.setLayoutProperty('cultivator-trace-line', 'visibility', 'none');
					map.setLayoutProperty('cultivator-pos-circle', 'visibility', 'none');
					map.setLayoutProperty('cultivator-pos-symbol', 'visibility', 'none');
					break;
				case 'drone-images-visible':
					map.setLayoutProperty('stout-20210701-spreckels-1-2-tileset', 'visibility', 'visible');
					map.setLayoutProperty('stout-20210701-spreckels-1-3-tileset', 'visibility', 'visible');
					map.setLayoutProperty('stout-20210701-harris-1-tileset', 'visibility', 'visible');
					map.setLayoutProperty('stout-20210702-stout-tileset', 'visibility', 'visible');
					map.moveLayer('plants-circle');
					break;
				case 'drone-images-invisible':
					map.setLayoutProperty('stout-20210701-spreckels-1-2-tileset', 'visibility', 'none');
					map.setLayoutProperty('stout-20210701-spreckels-1-3-tileset', 'visibility', 'none');
					map.setLayoutProperty('stout-20210701-harris-1-tileset', 'visibility', 'none');
					map.setLayoutProperty('stout-20210702-stout-tileset', 'visibility', 'none');
					break;
				case 'soil-condition-visible':
					map.setLayoutProperty('soil-condition-fill', 'visibility', 'visible');
					break;
				case 'soil-condition-invisible':
					map.setLayoutProperty('soil-condition-fill', 'visibility', 'none');
					break;
				case 'plant-size-heat':
					map.setLayoutProperty('plant-size-heat', 'visibility', 'visible');
					map.setLayoutProperty('plant-hidx-heat', 'visibility', 'none');
					break;
				case 'plant-hidx-heat':
					map.setLayoutProperty('plant-hidx-heat', 'visibility', 'visible');
					map.setLayoutProperty('plant-size-heat', 'visibility', 'none');
					break;
				case 'plant-edth-heat':
					break;
				default:	
			}
		});

	}

	ngOnDestroy() {
		//this.websocketservice.closeWebsocket();
    }

	onSelectMenuItem(ev: Event): void {
		ev.preventDefault();
        ev.stopPropagation();
		if (ev.target instanceof Element ) {
			switch (ev.target.textContent) {
				case 'Cultivators':
					if (! ev.target.classList.contains('selected')) {  
						this.eventEmitter.emit('cultivators-visible');
					} else {
						this.eventEmitter.emit('cultivators-invisible');	
					}
					break;
				case 'Drone Images':
					if (! ev.target.classList.contains('selected')) {   
						this.eventEmitter.emit('drone-images-visible');
					} else {
						this.eventEmitter.emit('drone-images-invisible');
					}
					break;
				case 'Soil Condition':
					if (! ev.target.classList.contains('selected')) { 
						this.eventEmitter.emit('soil-condition-visible');
					} else {
						this.eventEmitter.emit('soil-condition-invisible');
					}
					break;
				default:
			}
			ev.target.classList.toggle("selected");
		}
    }

	onSelectMenuTab(ev: Event): void {
		ev.preventDefault();
        ev.stopPropagation();  
		if (ev.target instanceof Element) {
			switch (ev.target.textContent) {
				case 'Size':
					this.heatmap_tab_selected_idx = 0;
					this.eventEmitter.emit('plant-size-heat');
					break;
				case 'Health':
					this.heatmap_tab_selected_idx = 1;
					this.eventEmitter.emit('plant-hidx-heat');
					break;
				case 'EDTH':
					this.heatmap_tab_selected_idx = 2;
					this.eventEmitter.emit('plant-edth-heat');
					break;
				default:
			}
			for (let i = 0; i < this.heatmap_tabs.length; i++) {
				if (i == this.heatmap_tab_selected_idx) {
					this.heatmap_tabs[i].classList.add('selected');
				} else {
					this.heatmap_tabs[i].classList.remove('selected');
				}
			}
		}
	}

	initCultivatorTraceGeojson(): void {
		let cultivator_trace_geojson: geojson.FeatureCollection<geojson.LineString, CultivatorProperties> = {
			"type": "FeatureCollection",
			"features": []
		};
		for (let cid of this.cids) {
			let cultivator_trace_feature_str: string = `
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
			let cultivator_trace_feature: geojson.Feature<geojson.LineString, CultivatorProperties> = JSON.parse(cultivator_trace_feature_str);
			cultivator_trace_geojson.features.push(cultivator_trace_feature);
		}
		this.cultivator_trace_geojson = cultivator_trace_geojson;
	}
	
	initCultivatorPosGeojson(): void {
		let cultivator_pos_geojson: geojson.FeatureCollection<geojson.Point, CultivatorPosProperties> = {
			"type": "FeatureCollection",
			"features": []
		};
		for (let cid of this.cids) {
			let cultivator_pos_feature_str: string = `
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
			let cultivator_pos_feature: geojson.Feature<geojson.Point, CultivatorPosProperties> = JSON.parse(cultivator_pos_feature_str);
			cultivator_pos_geojson.features.push(cultivator_pos_feature);
		}
		this.cultivator_pos_geojson = cultivator_pos_geojson;
	}

	initPlantStatusGeojson(): void {
		let plant_status_geojson: geojson.FeatureCollection<geojson.Point, PlantProperties> = {
			"type": "FeatureCollection",
			"features": []
		}
		this.plant_status_geojson = plant_status_geojson;
	}

	initLotBoundaryGeojson(): void {
		let lot_boundary_geojson: geojson.FeatureCollection<geojson.Polygon, LotProperties> = {
			"type": "FeatureCollection",
			"features": []
		}
		this.lot_boundary_geojson = lot_boundary_geojson;
	}

	initSoilConditionGeojson(): void {
		let soil_condition_geojson: geojson.FeatureCollection<geojson.Polygon, SoilProperties> = {
			"type": "FeatureCollection",
			"features": []
		}
		this.soil_condition_geojson = soil_condition_geojson;
	}

	addInitialDataToCultivatorTraceGeojson(): void {
		for (let cid of this.cids) {
			// Get trace geometry from the beginning of the current hour
			this.http.get<geojson.Position[]>(`${environment.api.url}/cultivators/${cid}/trace`)
				.pipe(shareReplay())
				.subscribe((trace: geojson.Position[] | null) => {
					if (trace) {
						this.cultivator_trace_geojson.features[this.cids.indexOf(cid)].geometry.coordinates = trace;
					}
				});
		}
	}

	addInitialDataToCultivatorPosGeojson(): void {
		for (let cid of this.cids) {
			// Get the latest known pos data
			this.http.get<CultivatorPosData>(`${environment.api.url}/cultivators/${cid}/pos`)
				.pipe(shareReplay())
				.subscribe((pos: CultivatorPosData | null) => {
					if (pos) {
						let age_milli: number = new Date().getTime() - new Date(pos.ts).getTime();
						//No need to account for timezoneOffset as far as the cultivators table has the full ISO string as its ts column value.
						//let age_milli: number = new Date().getTime() - (new Date(pos.ts).getTime() - new Date().getTimezoneOffset()*60000);
						this.cultivator_pos_geojson.features[this.cids.indexOf(cid)].geometry.coordinates = [pos.lon, pos.lat];
						this.cultivator_pos_geojson.features[this.cids.indexOf(cid)].properties.age_sec = age_milli/1000;
					}
				});
		}
	}

	displayPlantDetails(pid: string): void {
		let config: MatDialogConfig = new MatDialogConfig();
		config.disableClose = true;
		config.autoFocus = true;
		this.dialogservice.open(PlantDetailsModalComponent, config);
	}
	
}
