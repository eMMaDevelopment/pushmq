var fs = require('fs') ;
var _ = require('underscore') ;
var format = require('util').format ;
var util = require('util') ;
var AbstractTransport = require('./Abstract') ;
var amq = require('amq') ;

util.inherits( AMQP_Transport , AbstractTransport ) ;

module.exports = AMQP_Transport ;

function AMQP_Transport ( amqpConfig , socketOpts , addtlOpts ) {
	
	AbstractTransport.apply(this,arguments);

	var _this = this ;
	var addtlOpts = addtlOpts || {} ;
	var exchangeName = addtlOpts.exchange && addtlOpts.exchange.name || 'push.mq' ;
	var exchangeOpts = addtlOpts.exchange && _.omit(addtlOpts.exchange , 'name' ) || { type : 'direct' , durable : true , autoDelete : false , confirm : true } ;
	
	_this._connection = amqpConfig.connection || amq.createConnection( amqpConfig , socketOpts ) ;
	_this._exchange = _this._connection.exchange( exchangeName , exchangeOpts ) ;
	_this._boundQueues = {} ;
		
};

AMQP_Transport.prototype.connection = function () {
	
	return this._connection ;
	
}

AMQP_Transport.prototype._getQueue = function ( queueName ) {
	
	if ( this._boundQueues[ queueName ] ) return this._boundQueues[ queueName ] ;
	this.setQueue( queueName , {  durable : true , autoDelete : false } );
	return this._boundQueues[ queueName ]  ;
	
};

AMQP_Transport.prototype.setQueue = function ( queueName , opts ) {
	var q = this._connection.queue(queueName , _.extend({ confirm: true, durable : true , autoDelete : false },opts||{}));
	q.bind(this._exchange);
	return this._boundQueues[ queueName ] = q ;
};

AMQP_Transport.prototype.publish = function ( queueName , content , cb ) {
	var opts = { contentType : 'application/json' , deliveryMode : true } ;
	var m = JSON.stringify( content ) ;
	this._getQueue( queueName ).publish( m , opts , cb ) ;
};

AMQP_Transport.prototype.subscribe = function ( queueName , handler ) {
	
	var queue = this._getQueue( queueName ) ;
	
	return queue.consume(function( data ) {
		
		var ack = queue.ack.bind(queue,data);
		var message = JSON.parse( data.content ) ;
		
		setImmediate( handler , message , ack ) ;

	});
		
};