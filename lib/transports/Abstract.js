var events = require('events') ;
var util = require('util') ;

util.inherits( AbstractTransport , events.EventEmitter ) ;

module.exports = AbstractTransport ;

function AbstractTransport ( ) {

}
