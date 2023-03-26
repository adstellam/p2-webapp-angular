import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, ParamMap } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth/auth.service';


@Component({
	selector: 'app-customer-home',
	templateUrl: './customer-home.component.html',
	styleUrls: ['./customer-home.component.css']
})
export class CustomerHomeComponent implements OnInit {

  	uid: string|null;
  	oid: string|null;
	customer_logo_path: string = '';
	sidebar_anchors: HTMLCollectionOf<Element> = document.getElementsByClassName('this.sidebar_anchor');
  
    constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient, private authService: AuthService) {
		this.uid = localStorage.getItem('UserId');
		this.oid = this.route.snapshot.paramMap.get('oid');
		this.customer_logo_path = `../../../assets/images/${this.oid}/logo.png`; 
	}

	ngOnInit(): void {
    	
	}

    onSignOut(): void {
        this.authService.removeJwt();
        this.router.navigate(['/login']);
    }

}
