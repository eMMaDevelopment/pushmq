var fs = require('fs') ;
var _ = require('underscore') ;
var format = require('util').format ;
var util = require('util') ;
var AbstractService = require('./Abstract') ;
var querystring = require('querystring');
var https = require('https');
var EventEmitter = require('events').EventEmitter ;

module.exports = GCM ;

util.inherits( GCM , AbstractService ) ;

function GCM ( config ) {

	AbstractService.apply(this,arguments);

	if ( ! ( config && config.apiKey && config.apiKey.length ) ) {

		throw new Error('apiKey must be specified.') ;

	}

	this._apiKey = config.apiKey ;
	this._host = config.host || 'android.googleapis.com' ;
	this._path = config.path || '/gcm/send' ;
	this._port = config.port || 443 ;
	this.receipts = new EventEmitter();

};

GCM.prototype.send = function ( id, data ) {

	var self = this ;
	var registration_id = data.registration_id ;
	var payload = data.payload || data.data ;
	var gcmOpts = data.gcm || {} ;
	var gcmMessage = querystring.stringify( buildGcmMessage( registration_id , gcmOpts , payload ) ) ;
	var attemptEvt = format('attempted:%s',id);
	var errEvt = format('failed:%s',id);
	var ackEvt = format('acknowledged:%s',id);
	var reqOpts = {
    host: self._host ,
    port: self._port ,
    path: self._path ,
    method: 'POST',
    secureProtocol: 'TLSv1_method',
    headers: {
	    'Host': self._host ,
	    'Authorization': 'key=' + self._apiKey,
	    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
	    'Content-length': gcmMessage.length
    }
  };

	var request = https.request(reqOpts, function(res) {

    if (res.statusCode == 503) {

			// If the server is temporary unavailable, the C2DM spec requires that we implement exponential backoff
      // and respect any Retry-After header

			var retryAfter = parseRetryAfter( req.headers['retry-after'] )

			// return and stop listening to incoming 'data' events
			// wait the retry time before processing the queue again by emitting 'sent'

			return setTimeout(function(){
				self.receipts.emit(errEvt,'TransmissionError');
			},retryAfter);

		}

		var data = '';
		var respond = _.once(function () {

			var error = parseErrorResponse( data ) ;
			var messageId = parseMessageId( data ) ;
			var canonicalId = parseCanonicalId( data ) ;

			if ( error ) {
				// Only retry if error is QuotaExceeded or DeviceQuotaExceeded
				if ( ['InternalServerError','QuotaExceeded', 'DeviceQuotaExceeded', 'InvalidServerResponse'].indexOf(error) >= 0 ) {
					self.receipts.emit(errEvt,'TransmissionError');
				} else {
					self.receipts.emit(errEvt,error);
				}
			} else if ( canonicalId ){
				self.receipts.emit(errEvt, 'CanonicalIdError' , { expiring_id : registration_id , canonical_id : canonicalId });
			} else {
				self.receipts.emit(ackEvt);
			}

		});

		res.on('data', function(chunk) { data += chunk; });
		res.on('close', respond);
		res.on('end', respond);
		res.once('data',function(){
			self.receipts.emit(attemptEvt);
		});

	});

	request.once('error', function(error) {
		self.receipts.emit(errEvt,'TransmissionError');
	});

	request.end(gcmMessage);

};

function buildGcmMessage ( registration_id , gcmOpts , payload ) {

	var d = _.extend( {} , gcmOpts , { registration_id : registration_id } ) ;

	Object.keys( payload ).forEach(function(k,i){

		d[ format("data.%s" , k ) ] = payload[ k ] ;

	});

	return d ;

}

function parseRetryAfter ( retryAfter ) {

  if (retryAfter) {
    var retrySeconds = retryAfter * 1;
    if (isNaN(retrySeconds)) {
      // The Retry-After header is a HTTP-date, try to parse it
      retrySeconds = new Date(retryAfter).getTime() - new Date().getTime();
    }
    if (!isNaN(retrySeconds) && retrySeconds > 0) {


			return retrySeconds*1000;

    }
  }

	return 0 ;

}

function parseErrorResponse ( data ) {

	if (data.indexOf('id=') === 0) {
		return null ;
	}

  if (data.indexOf('Error=') === 0) {
    return data.substring(6).trim();
	}

	return 'InvalidServerResponse' ;
}

function parseCanonicalId ( data ) {

	if (data.indexOf('id=') < 0) {
		return null ;
	}

	var ids = data.split( /\s/ ) ;
	var messageId = ids[0].split('=')[1] ;
	var canonicalId = ids[1] && ids[1].split('=')[1] || undefined ;

	return canonicalId ;

}

function parseMessageId ( data ) {

	if (data.indexOf('id=') < 0) {
		return null ;
	}

	var ids = data.split( /\s/ ) ;
	var messageId = ids[0].split('=')[1] ;

	return messageId ;

}
