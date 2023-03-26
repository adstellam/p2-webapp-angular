import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
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

type Detection = {
	class_id: number;
	confidence?: number;
    top: number;
    left: number
    height: number;
    width: number;
}

type ImageMetadata = {
	width: number | null;
	height: number | null;
	detections: Detection[] | null;
}

type CanvasRenderingData = {
	blob: Blob | null;
	meta: ImageMetadata | null;
}

type PlantType = {
	code: string;
	name: string;
}


@Component({
	selector: 'app-fleet-view',
	templateUrl: './fleet-view.component.html',
	styleUrls: ['./fleet-view.component.css']
})
export class FleetViewComponent implements OnInit, OnDestroy {

	oid: string | null;
	cids: string[] = [];
	cultivator_cams: number[][] = [];
	cultivator_status: string[] = [];
	plant_types: PlantType[] = [];
	form: FormGroup;
	cid_input$: BehaviorSubject<string>;
	view_area: HTMLElement | null = null;
	timers: any[] = [];
	delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
	
	constructor(private fb: FormBuilder, private http: HttpClient) { 

		this.oid = localStorage.getItem('OrgId');
		this.form = this.fb.group({
			cid: ['#'],
		}, { updateOn: 'change' });
		this.cid_input$ = new BehaviorSubject<string>(this.form.controls.cid.value);

	}

	ngOnInit(): void {

		this.view_area = document.getElementById("view-area");

		const headers: HttpHeaders = new HttpHeaders().set("Content-Type", "application/json");
		this.http.post<Cultivator[]>(`${environment.api.url}/cultivators`, { oid: this.oid }, { headers: headers })
			.pipe(shareReplay())
			.subscribe((cultivators: Cultivator[]) => {
				cultivators.sort((a: Cultivator, b: Cultivator) => {
					return parseInt(a.cid) - parseInt(b.cid);
				})
				cultivators.forEach((cultivator: Cultivator) => {
					this.cids.push(cultivator.cid);
					this.cultivator_cams.push(cultivator.cams);
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

		this.http.get<PlantType[]>(`${environment.api.url}/plant_types`)
			.pipe(shareReplay())
			.subscribe((plant_types: PlantType[]) => {
				this.plant_types = plant_types;
			});

		this.form.controls.cid.valueChanges.subscribe((cid: string) => { 
			this.cid_input$.next(cid);
			this.timers.forEach((timer: any) => {
				clearInterval(timer);
			});
			this.timers = [];
			while (this.view_area && this.view_area.lastChild) 
				this.view_area.removeChild(this.view_area.lastChild);	
			this.cultivator_cams[this.cids.indexOf(cid)].forEach((cam: number) => {
				this.appendCanvasToViewArea(cid, cam);
				this.drawImageAndAnnotateOnCanvas(cid, cam);
				this.timers.push(setInterval(() => { 
					this.drawImageAndAnnotateOnCanvas(cid, cam);
				}, 120000));
			});
		});

	}

	ngOnDestroy(): void {

		this.timers.forEach((timer: any) => {
			clearInterval(timer);
		});

	}

	onClickCultivator(cid: string): void {

		this.form.controls.cid.setValue(cid);

	}

	getImageBlob(cid: string, cam: number): Observable<Blob> {

		return this.http.get(`${environment.fvserv.url}/blob/${cid}/${cam}`, { responseType: 'blob' }).pipe(shareReplay());
	
	}

	getImageMetadata(cid: string, cam: number): Observable<ImageMetadata> {

		return this.http.get<ImageMetadata>(`${environment.fvserv.url}/meta/${cid}/${cam}`, { responseType: 'json' }).pipe(shareReplay());

	}

	appendCanvasToViewArea(cid: string, cam: number): void {	

		const canvas_container: HTMLElement = document.createElement("div");
		canvas_container.id = `canvas-container-${cam}`;
		canvas_container.style.width = "324px";
		canvas_container.style.height = "296px";
		canvas_container.style.margin = "16px";
		canvas_container.style.border = "solid 1px #d3d3d3";
		if (this.view_area)
			this.view_area.appendChild(canvas_container);

		const header: HTMLElement = document.createElement("div");
		header.style.width = "324px";
		header.style.height = "40px";
		header.style.backgroundColor = "#47476b";
		header.style.color = "#fff";
		header.style.fontSize = "16px";
		header.style.textAlign = "center";
		header.style.lineHeight = "40px";
		header.textContent = `Cultivator ${cid}: Camera ${cam}`;
		canvas_container.appendChild(header);
		
		const canvas: HTMLCanvasElement = document.createElement("canvas");
		canvas.id = `canvas-${cam}`;
		canvas.style.width = "324px";
		canvas.style.height = "256px";
		canvas.onclick = () => {
			this.showEnlargedImage(cid, cam);
		}
		canvas_container.appendChild(canvas);

	}

	drawImageAndAnnotateOnCanvas(cid: string, cam: number): void {
		
		const canvas: HTMLCanvasElement = document.getElementById(`canvas-${cam}`) as HTMLCanvasElement;
		const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');

		forkJoin({ blob: this.getImageBlob(cid, cam), meta: this.getImageMetadata(cid, cam) })
			.subscribe((data: CanvasRenderingData) => {
				canvas.width = data.meta?.width ?? 1296;
				canvas.height = data.meta?.height ?? 1024; 
				ctx?.clearRect(0, 0, canvas.width, canvas.height);
				const reader: FileReader = new FileReader();
				reader.onload = () => { 
					//draw image on canvas
					const img: HTMLImageElement = new Image(canvas.width, canvas.height);
					if (reader.result) {
						img.src = reader.result as string;
						img.onload = () => { 
							ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
							//annotate image on canvas
							data.meta?.detections?.forEach((det: Detection) => {
								if (ctx) {
									ctx.lineWidth = 8;
									if (det.class_id == 1 || det.class_id >= 60)
										ctx.strokeStyle = 'red';
									else
										ctx.strokeStyle = 'green';
									ctx.strokeRect(det.left, det.top, det.width, det.height);
									ctx.fillStyle = 'gray';
									ctx.fillRect(det.left, det.top - 60, det.width, 60);
									ctx.lineWidth = 8;
									ctx.strokeStyle = 'darkgray';
									ctx.strokeRect(det.left, det.top - 60, det.width, 60);
									ctx.font = '48px Poppins';
									ctx.textAlign = 'left';
									ctx.textBaseline = 'middle';
									ctx.fillStyle = 'white';
									this.plant_types.forEach((pt: PlantType) => {
									if (pt.code == String(det.class_id))
										ctx.fillText(" " + pt.name, det.left, det.top - 30);
									});
								}
							});
						};
					}
				};
				if (data.blob)
					reader.readAsDataURL(data.blob);
			});

	}

	showEnlargedImage(cid: string, cam: number): void {

		const canvas: HTMLCanvasElement = document.createElement("canvas");
		const ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');
		
		canvas.style.position = "absolute";
		canvas.style.left = "0";
		canvas.style.top = "0";
		const img_width_to_height_ratio: number = 1296/1024;
		if (window.innerWidth >= window.innerHeight * img_width_to_height_ratio) {
			canvas.style.width = `${window.innerHeight * img_width_to_height_ratio}px`;
			canvas.style.height = `${window.innerHeight}px`;
		} else  {
			canvas.style.width =   `${window.innerWidth}px`;
			canvas.style.height =  `${window.innerWidth/img_width_to_height_ratio}px`;
		}
		canvas.style.height = `${document.documentElement.clientHeight}px`;
		canvas.style.border = "solid 1px #fff";
		this.view_area?.appendChild(canvas);

		forkJoin({ blob: this.getImageBlob(cid, cam), meta: this.getImageMetadata(cid, cam) })
			.subscribe((data: CanvasRenderingData) => {
				canvas.width = data.meta?.width ?? 1296;
				canvas.height = data.meta?.height ?? 1024; 
				ctx?.clearRect(0, 0, canvas.width, canvas.height);
				const reader: FileReader = new FileReader();
				reader.onload = () => { 
					//draw image on canvas
					const img: HTMLImageElement = new Image(canvas.width, canvas.height);
					if (reader.result) {
						img.src = reader.result as string;
						img.onload = () => { 
							ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
							//annotate image on canvas
							data.meta?.detections?.forEach((det: Detection) => {
								if (ctx) {
									ctx.lineWidth = 3;
									if (det.class_id == 1 || det.class_id >= 60)
										ctx.strokeStyle = 'red';
									else
										ctx.strokeStyle = 'green';
									ctx.strokeRect(det.left, det.top, det.width, det.height);
									ctx.fillStyle = 'gray';
									ctx.fillRect(det.left, det.top - 24, det.width, 24);
									ctx.lineWidth = 3;
									ctx.strokeStyle = 'darkgray';
									ctx.strokeRect(det.left, det.top - 24, det.width, 24);
									ctx.font = '18px Poppins';
									ctx.textAlign = 'left';
									ctx.textBaseline = 'middle';
									ctx.fillStyle = 'white';
									this.plant_types.forEach((pt: PlantType) => {
									if (pt.code == String(det.class_id))
										ctx.fillText(` ${pt.name} (${det.confidence?.toFixed(2)})`, det.left, det.top - 12);
									});
								}
							});
						};
					}
				};
				if (data.blob)
					reader.readAsDataURL(data.blob);
			});

			const close: HTMLElement | null = document.getElementById("enlarged-image-close");
			if (close) {
				close.style.display="block";
				close.style.position = "fixed";
				close.style.left = `${400 + canvas.scrollWidth - 24}px`;
				close.style.top = "12px";
				close.onclick = () => {
					ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
					this.view_area?.removeChild(canvas);
					close.style.display = "none";
				}
			}

	}
	
}
