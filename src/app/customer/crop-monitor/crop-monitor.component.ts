import { Component, OnInit, AfterViewInit, EventEmitter } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { shareReplay } from 'rxjs/operators';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import * as mapboxgl from 'mapbox-gl';
import * as geojson from 'geojson';
import * as turf from '@turf/turf';
import { PlantDetailsModalComponent } from '../plant-details-modal/plant-details-modal.component';
import { environment } from 'src/environments/environment';

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
  
@Component({
	selector: 'app-crop-monitor',
	templateUrl: './crop-monitor.component.html',
	styleUrls: ['./crop-monitor.component.css']
})
export class CropMonitorComponent implements OnInit, AfterViewInit {

    oid: string | null;
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

	eventEmitter: EventEmitter<string>;
  
    constructor(private http: HttpClient, private dialogservice: MatDialog) { 
    
		this.oid = localStorage.getItem('OrgId');
	
		(mapboxgl as typeof mapboxgl).accessToken = environment.mapbox.accessToken;
		this.center = new mapboxgl.LngLat(-121.644, 36.629);
		this.bounds = new mapboxgl.LngLatBounds([-125, 28, -64, 51]);
		this.zoom_threshold = 20;
		this.zoom_over_threshold = false;
	
		this.heatmap_tabs = document.getElementsByClassName('menu-tab');
		this.heatmap_tab_selected_idx = 0;
		this.plant_size = new FormControl(0, { updateOn: 'change' });
		this.plant_hidx = new FormControl(0, { updateOn: 'change' });

		this.eventEmitter = new EventEmitter<string>();
  
    }
  
    ngOnInit(): void {
  
      	const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
      
		this.initPlantStatusGeojson();
		this.initLotBoundaryGeojson();
		this.initSoilConditionGeojson();
          
      }
    
    ngAfterViewInit(): void {
  
      	let map: mapboxgl.Map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/stout/ckrdmp6tk2mud18mkqpzfjqr8', 
			center: this.center,
			maxBounds: this.bounds,
			zoom: 20.4,
			minZoom: 4,
			doubleClickZoom: false
		});
  
      	map.on('load', () => {
  
			map.addControl(new mapboxgl.NavigationControl(), 'top-left');
			map.addControl(new mapboxgl.ScaleControl({ maxWidth: 200, unit: 'imperial' }), 'bottom-left');
	
			map.addSource('lots', {
				'type': 'geojson',
				'data': this.lot_boundary_geojson
			});
				
			map.addSource('soil-condition', {
				'type': 'geojson',
				'data': this.soil_condition_geojson
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
			if (map.getZoom() >= this.zoom_threshold) 
				this.zoom_over_threshold = true;
			else 
				this.zoom_over_threshold = false;
		});
	
		this.plant_size.valueChanges.subscribe((value: number) => {
			map.setFilter('plant-size-heat', ['>=', ['number', ['get', 'diameter_cm']], value]);
		});

		this.plant_hidx.valueChanges.subscribe((value: number) => {
			map.setFilter('plant-hidx-heat', ['>=', ['number', ['get', 'health_index']], value]);
		});
  
      	this.eventEmitter.subscribe((ev: string) => {
        	switch (ev) {
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
  
    onSelectMenuItem(ev: Event): void {
      	ev.preventDefault();
        ev.stopPropagation();
      	if (ev.target instanceof Element ) {
			switch (ev.target.textContent) {
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
          		if (i == this.heatmap_tab_selected_idx) 
            		this.heatmap_tabs[i].classList.add('selected');
          		else 
            		this.heatmap_tabs[i].classList.remove('selected');
          	}
        }
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
  
    displayPlantDetails(pid: string): void {

      let config: MatDialogConfig = new MatDialogConfig();
      config.disableClose = true;
      config.autoFocus = true;
      this.dialogservice.open(PlantDetailsModalComponent, config);

    }
    
}
