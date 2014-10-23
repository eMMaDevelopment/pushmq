# pushmq

transparently handle push notifications across multiple services (apns,gcm), backed by a queue (rabbitmq, more to come). 

## Usage

Install via NPM

    $ npm install pushmq

## Example- Publisher

```javascript
var pushmq = require('pushmq') ;
var config = require('./config') ;
var rabbit = new pushmq.transports.AMQP(config.rabbitmq) ;
var apns = new pushmq.services.APNS(config.apns) ;
var publisher = new pushmq.Publisher('apple_notifications',rabbit);

publisher.publish({ token : '2131324sdfgdsgdfg', payload : { foo : 'bar' } },function(){
	
	console.log('published')
	
})
```

## Example- Worker (simple) 

```javascript
var pushmq = require('pushmq') ;
var config = require('./config') ;
var rabbit = new pushmq.transports.AMQP(config.rabbitmq) ;
var apns = new pushmq.services.APNS(config.apns) ;
var worker = new pushmq.Worker('apple_notifications',rabbit,apns);

// start the worker and transparently process APNS messages over the rabbitmq transport
worker.init();
```

## Example- Worker (advanced) 

```javascript
var pushmq = require('pushmq') ;
var config = require('./config') ;
var rabbit = new pushmq.transports.AMQP(config.rabbitmq) ;
var apns = new pushmq.services.APNS(config.apns) ;
var worker = new pushmq.Worker('apple_notifications',rabbit,apns);

// start the worker and pass in a function to handle notifications. 
// Function receives 3 args (data,next,acknowledge). This allows you to
// 1) modify the data being pushed, or 2) short-circuit the notification.
// The 'next' function actually sends the push notification and takes
// two arguments ( data, acknowledge ). Messages must be acknowledged in
// order for the queue to be processed, so acknowledge must be passed as a
// callback to 'next'.

worker.init(function( d , next , acknowledge ){
	
	console.log('Got a notification. About to push.\n',d) ;
	
	// decide weather or not to continue with the push
	
	if ( d.payload.type == 'foo' ) {
		
		d.aps.alert = "FOO MESSAGE" ;
		
		next( d , acknowledge ) ;
		
	} else {
		
		// disregard this notification and acknowledge without pushing
		
		acknowledge() ;
		
	} 
	
});

// An additional queue will be created that contains tokens that 
// have been rejected by the service provider. You can subscribe
// to this queue as well. Again, these messages must be acknowledged
// in order to run continuously.

worker.onInvalidDevice(function(d,acknowledge){
	
	console.log('Got an invalid device identifier\n',d) ;
	
	db.removeToken( d.token , function () {
		
		acknowledge();
			
	})
	
})
```

