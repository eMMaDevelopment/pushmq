var AbstractTransport = require('./transports/Abstract') ;
var AbstractService = require('./services/Abstract') ;
var format = require('util').format ;

module.exports = Publisher ;

function Publisher ( namespace , pubSubTransport ) {
	
	if ( ! namespace ) {
		
		throw new Error('First argument must be string containing the namespace for published notifications.');
		
	}
	
	if ( ! pubSubTransport instanceof AbstractTransport ) {
		
		throw new Error('Second argument must be an instance of AbstractTransport');
		
	}
	
	this._queueName = namespace ;
	
	this._pubSubTransport = pubSubTransport ;
	
} ;

Publisher.prototype.publish = function ( data , cb ) {
		
	return this._pubSubTransport.publish( this._queueName , data , cb ) ;
	
};