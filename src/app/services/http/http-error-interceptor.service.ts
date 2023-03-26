import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpHandler, HttpEvent, HttpRequest, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { retry, catchError } from 'rxjs/operators';


@Injectable()
export class HttpErrorInterceptorService implements HttpInterceptor {
    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request)
            .pipe(
                retry(1),
                catchError((err: HttpErrorResponse) => {
                    let errorMessage = '';
                    if (err.error instanceof ErrorEvent) {
                        // client-side error
                        errorMessage = `Error: ${err.error.message}`;
                    } else {
                        // server-side error
                        errorMessage = `Error Code: ${err.status}\nMessage: ${err.message}`;
                    }
                    window.alert(errorMessage);
                    return throwError(errorMessage);
                })
            )
    }
}
