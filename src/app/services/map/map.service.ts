import { Injectable } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { environment } from 'src/environments/environment';

@Injectable({
	providedIn: 'root'
})
export class MapService {

	constructor() { 
		(mapboxgl as typeof mapboxgl).accessToken = environment.mapbox.accessToken;
	}

	buildMap(center: mapboxgl.LngLat, bounds: mapboxgl.LngLatBounds): mapboxgl.Map {

		let map: mapboxgl.Map = new mapboxgl.Map({
			container: 'map',
			style: 'mapbox://styles/stout/ckrdmp6tk2mud18mkqpzfjqr8', 
			center: center,
			bounds: bounds,
			zoom: 14,
			minZoom: 4,
			doubleClickZoom: false
		});
		
		map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    	map.addControl(new mapboxgl.ScaleControl({ maxWidth: 200, unit: 'imperial' }), 'bottom-left');

		map.setLayoutProperty('20210630-sp-1-2-plants-layer', 'visibility', 'none');
		map.setLayoutProperty('stout-20210701-spreckels-1-2-tileset', 'visibility', 'none');
		map.setLayoutProperty('stout-20210701-spreckels-1-3-tileset', 'visibility', 'none');
		map.setLayoutProperty('stout-20210701-harris-1-tileset', 'visibility', 'none');
		map.setLayoutProperty('stout-20210702-stout-tileset', 'visibility', 'none')

		return map;
		
	}

}
