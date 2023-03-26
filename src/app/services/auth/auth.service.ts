import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environments/environment';

type JwtObj = {
    jwt: string;
}

type JwtPayload = {
	iss: string;
	uid: string;
	oid: string;
	roles: string[];
}

@Injectable({
  	providedIn: 'root'
})
export class AuthService {

	jwt: any;
	jwtPayload: JwtPayload;

	constructor(private http: HttpClient, private jwtHelper: JwtHelperService) {
		this.jwt = localStorage.getItem('Jwt');
		this.jwtPayload = this.jwtHelper.decodeToken(this.jwt);
	};

    hasValidJwt(): boolean {
  		return !this.jwtHelper.isTokenExpired(this.jwt);
  	}

  	hasPrivilegedJwt(priv: string): boolean {
  	   	if (this.jwtPayload.roles.includes(priv)) {
  	   		return true;
  	   	} else {
  		    return false;
        }
  	}

    decodeJwt(jwt: string): JwtPayload {
        return this.jwtHelper.decodeToken(jwt);
    }

    authenticateByLoginCredential(username: string, password: string): Observable<JwtObj> {
        const headers = new HttpHeaders().set('Content-Type', 'application/json');
        return this.http.post<JwtObj>(`${environment.api.url}/login`, { username: username, password: password }, { headers }).pipe(shareReplay());
    }

  	removeJwt() {
  		localStorage.removeItem('Jwt');
  	}
  
}
