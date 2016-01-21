var _ = require('underscore');
var EventEmmitter = require('events');
var util = require('util');
var format = util.format ;
var AbstractTransport = require('./transports/Abstract');
var AbstractService = require('./services/Abstract');
var uuid = require('node-uuid');
var assert = require('assert');
var log4js = require('log4js');
module.exports = Worker ;


function Worker ( namespace , pubSubTransport , pushTransport , opts ) {

	EventEmmitter.call(this);
	
	assert( !!namespace , 'First argument must be string containing the namespace for subscribed notifications.' );
	assert( pubSubTransport instanceof AbstractTransport , 'Second argument must be an instance of AbstractTransport' );
	assert( pushTransport instanceof AbstractService , 'Third argument must be an instance of AbstractPushTransport' );
	
	this._queueName = namespace ;
	this._queueNameUnregistered = format( "%s_unregistered" , this._queueName ) ;
	this._pubSubTransport = pubSubTransport ;
	this._pushTransport = pushTransport ;
	this._logger = opts && opts.logger || log4js.getLogger();
	this._ackTimeout = opts && opts.ackTimeout || 60*1000 ;

}

global.WorkerEvents = {
	PushSent : 'onPushSent',
	PushError: 'onPushError'
}

util.inherits(Worker, EventEmmitter);

Worker.prototype.onInvalidDevice = function ( handler ) {

	this._pubSubTransport.subscribe( this._queueNameUnregistered , handler.bind(this) ) ;

};



Worker.prototype.init = function ( onBeforePush ) {
	
	var self = this ;
	
	self._pubSubTransport.subscribe( self._queueName , function ( data , ack ) {
		
		var doPush = self.handle.bind(self) ;
		
		if ( typeof onBeforePush == 'function' ) {
			onBeforePush.call( self , data , doPush , ack ) ;
		} else {
			doPush(data,ack) ;
		}
		
	});
	
};

Worker.prototype.handle = function ( data , cb ) {
	
	var self = this ;
	var pushTransport = self._pushTransport ;
	var tokenOrRegId = _.find( data ,function(v,k){return ['token','registration_id'].indexOf(k)>=0}) ;
	var id = uuid();
	var attemptEvt = format('attempted:%s',id);
	var errEvt = format('failed:%s',id);
	var ackEvt = format('acknowledged:%s',id);
	var popFromQueue = _.once(cb||function(){});
	var unbindListeners = function(){
		pushTransport.receipts.removeAllListeners(attemptEvt);
		pushTransport.receipts.removeAllListeners(errEvt);
		pushTransport.receipts.removeAllListeners(ackEvt);
		popFromQueue();
	};
	
	pushTransport.receipts.once(attemptEvt,function(){
		popFromQueue();
		setTimeout(function(){
			unbindListeners();
		},self._ackTimeout);
	});
	pushTransport.receipts.once(ackEvt,function(){
        // emit 'open' event instantly
        setTimeout(function() {
            self.emit('sent', data);
        }, 0);

		unbindListeners();
		self._logger.info('Acknowledged Message:\n%s\n',JSON.stringify(data)) ;
	});
	pushTransport.receipts.once(errEvt,function(error, errorData){
		unbindListeners();
		console.log('here',arguments);

        /*setTimeout(function() {
            self.emit('push_error', data, error);
        }, 0);*/

        var errorObject = { error: error.toString(),
                            source: data };

		switch ( error.toString() ) {
			case 'TokenUnparseable':
				self._logger.debug('Error parsing token:\n%s\n%s\n',error,JSON.stringify(data)) ;
			case 'TokenInvalid' :
			case 'InvalidRegistration' :
			case 'NotRegistered' :
			case 'TokenUnparseable' :
				self._pubSubTransport.publish( self._queueNameUnregistered , errorObject ) ;
				break;
			case 'CanonicalIdError' :
				self._pubSubTransport.publish( self._queueNameUnregistered , errorObject ) ;
				break;
			case 'PayloadInvalid' :
				self._pubSubTransport._logger.debug('Invalid payload in message:\n%s\n',JSON.stringify(data)) ;
				break;
			case 'TransmissionError' :
				self._pubSubTransport._logger.debug('ReQueueing Message due to TransmissionError:\n%s\n',JSON.stringify(data)) ;
				pubSub.publish( self._queueName , data ) ; // <- requeue
				break ;
			default :
				self._pubSubTransport._logger.debug('Error processing message:\n%s\n%s\n',error,JSON.stringify(data)) ;
				break ;
		}
	});
	
	pushTransport.send(id,data);
	
};
