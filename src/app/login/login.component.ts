import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth/auth.service';

type JwtObj = {
    jwt: string;
}

type JwtPayload = {
	iss: string;
	uid: string;
	oid: string;
	roles: string[];
}

@Component({
  	selector: 'app-login',
  	templateUrl: './login.component.html',
  	styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {

	loginForm: FormGroup; 

    constructor(private fb: FormBuilder, private router: Router, private authService: AuthService) { 
        this.loginForm = this.fb.group({
            username: ['', Validators.required],
            password: ['', Validators.required]
        });
	}
    
    ngOnInit(): void {
        
    }

    login(): void {
        if (this.loginForm.value.username && this.loginForm.value.password) {
            this.authService.authenticateByLoginCredential(this.loginForm.value.username, this.loginForm.value.password).subscribe(
                (jwt: JwtObj) => {
                    localStorage.setItem('Jwt', jwt.jwt);
                    //console.log("JWT: ", jwt.jwt);
                    const jwtDecoded: JwtPayload = this.authService.decodeJwt(jwt.jwt);
            
                    localStorage.setItem('UserId', jwtDecoded.uid);
					localStorage.setItem('OrgId', jwtDecoded.oid);
                    
					if (jwtDecoded.oid != 'stout')
                    	this.router.navigate(['/customer-home', jwtDecoded.oid, { uid: jwtDecoded.uid }]);
					else
						this.router.navigate(['/support-home', { uid: jwtDecoded.uid, roles: jwtDecoded.roles }]);
            	},
                (err) => {
                    window.alert("Incorrect username or password. Try again.");
                    this.router.navigateByUrl('/login');
                }
            );
		}
    }

    showReadMe(): void {
        window.alert("This is a demo version. For any question or comment regarding this app, send a message to msuh@stoutagtech.com.");
    }

}
