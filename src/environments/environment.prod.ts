export const environment = {
  	production: true,
	mapbox: {
		accessToken: ''
	},
	api: {
		//url: 'https://xxx:22443/api' //ALB
		//url: 'http://localhost:22080/api' //nginx on localhost
	},
	fvserv: {
		//url: 'https://xxx:22443/fleetview' //ALB
		//url: 'http://localhost:22080/fleetview' //nginx on localhost
	  },
	ws: {
		//url: 'wss://xxx:22443/ws' //ALB
		//url: 'ws://localhost:9880/ws' 
	},
	cube: {

	},
	jwt: {
		allowedDomains: ['xxx'], //ALB
		//allowedDomains: ['localhost:22080'], //nginx on localhost
		disallowedRoutes: ['']
	}
};
