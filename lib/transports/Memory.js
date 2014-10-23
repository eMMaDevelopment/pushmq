var fs = require('fs') ;
var _ = require('underscore') ;
var format = require('util').format ;
var util = require('util') ;
var EventEmitter = require('events').EventEmitter ;
var async = require('async') ;
var AbstractTransport = require('./Abstract') ;

module.exports = MemoryQueue ;

util.inherits( MemoryQueue , AbstractTransport ) ;

function MemoryQueue () {
	
	AbstractTransport.apply(this,arguments);
	
	this._queues = {} ;
	
	this._queueEmitter = new EventEmitter() ;
	
	
};

MemoryQueue.prototype._getQueue = function ( queueName ) {
	
	var _this = this ;
	
	if ( _this._queues[ queueName ] ) return _this._queues[ queueName ] ;
	
	_this._queues[ queueName ] = async.queue(function(data,ack){
		
		_this._queueEmitter.emit( queueName , data.content , ack ) ;
		
	},1) ;
	
	return _this._queues[ queueName ] ;
	
};

MemoryQueue.prototype.publish = function ( queueName , content , cb ) {
	
	var _this = this ;
	var queue = _this._getQueue(queueName) ;
	
	queue.push({ content : content }) ;
	
	if ( typeof cb == 'function' ) cb() ;
	
};

MemoryQueue.prototype.subscribe = function ( queueName , handler ) {
	
	var _this = this ;
	
	_this._queueEmitter.on( queueName , function ( message , ack ) {
		
		setImmediate( handler , message , ack ) ;
		
	})
	
};
