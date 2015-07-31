var ipc = require('ipc');
var React = require('react');


class Message {
    constructor(from, to, message, highlight, type) {
        this.from = from
        this.to = to
        this.message = message
        this.highlight = highlight
        this.type = type
        this.time = moment().format('h:mm:ss')
    }
    render(key) {
        return (
            <div key={key} className={classNames("message", this.type, {"message-highlight": this.highlight})}>
                <span className="message-time">{'[' + this.time + ']'}</span>
                <span className="message-from" style={{color: this.from.color}}>
                    {'<' + this.from.formattedName + '>'}
                </span>
                <span className="message-message">{this.message}</span>
            </div>
        );
    }
}

function isJoin(message) {
    return message.startsWith('/join ');
}

function sendJoin(activeChannel, message) {
    var channelName = message.split(' ')[1];
    if (channelName) {
        ipc.send('client-join-channel', channelName);
    }
}

function isPM(message) {
    return message.startsWith('/msg ');
}

function sendPM(activeChannel, message) {
    var pmargs = message.split(' ');
    pmargs.shift();
    let toNick = pmargs.shift();
    ipc.send('client-send-pm', toNick, pmargs.join(' '));
}

function isMessage(message) {
    return !message.startsWith('/');
}

function sendMessage(activeChannel, message) {
    ipc.send('client-send-message', activeChannel, message);
}

var messageParseOrder = [
    {
        parser: isJoin,
        sender: sendJoin
    },
    {
        parser: isPM,
        sender: sendPM,
    },
    {
        parser: isMessage,
        sender: sendMessage
    }
];


module.exports.messageParseOrder = messageParseOrder;
module.exports.sendJoin = sendJoin
module.exports.formatMessage = formatMessage;
module.exports.Message = Message;
