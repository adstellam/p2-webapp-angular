import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from 'src/environments/environment';

type WebsocketData = {
	cid: string;
	ts: string;
	lon: number;
	lat: number;
}


@Injectable({
  	providedIn: 'root'
})
export class WebsocketService {

	wsSubject: WebSocketSubject<any>;
	cids: string[];

  	constructor() {
		this.wsSubject = webSocket<any>(`${environment.ws.url}`);
		this.cids = ["2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","25","26","27"];
		this.wsSubject.next({ cultivator_ids: this.cids });
	}

	getWebsocket(): WebSocketSubject<any> {
		return this.wsSubject;
	}

	closeWebsocket(): void {
		this.wsSubject.complete();
	}
	
}
