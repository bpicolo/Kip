var ipc = require('ipc');
var util = require('util');

var irc = require('irc');


class Irc {
    constructor(mainWindow, config) {
        var self = this;
        this._mainWindow = mainWindow;
        this._webContents = this._mainWindow.webContents;

        // TODO support more than one server
        let server = config.servers[0];

        this.ircClient = new irc.Client(server.address, server.nick, {
            port: server.port,
            password: server.password,
            secure: server.channels,
            channels: server.channels,
            retryCount: 3,
            stripColors: true,  // bad feature
        });

        this.ircClient.addListener('error', function(message) {
            console.log('error: ', message);
        });

        this.ircClient.addListener('names', this.sendNames.bind(this));
        this.ircClient.addListener('join', this.sendJoin.bind(this));
        this.ircClient.addListener('part', this.sendPart.bind(this));
        this.ircClient.addListener('message', this.sendMessage.bind(this));
        this.ircClient.addListener('action', this.sendAction.bind(this));

        this.ircClient.addListener('registered', function(message) {
            self._webContents.send('registered', message);
            for (var i = 0; i < server.channels.length; i++) {
                self.clientJoinChannel(null, server.channels[i]);
            }
        });

        this.bindRecieveEvents();
    }
    bindRecieveEvents() {
        ipc.on('client-send-message', this.clientSendMessage.bind(this));
        ipc.on('client-send-action', this.clientSendAction.bind(this));
        ipc.on('client-send-pm', this.clientSendPM.bind(this));
        ipc.on('client-join-channel', this.clientJoinChannel.bind(this));
        ipc.on('client-leave-channel', this.clientLeaveChannel.bind(this));
        ipc.on('client-disconnect', this.clientDisconnect.bind(this));
    }
    clientSendMessage(e, channelName, message) {
        this.sendMessage(this.ircClient.nick, channelName, message);
        this.ircClient.say(channelName, message);
    }
    clientSendAction(e, channelName, message) {
        this.sendAction(this.ircClient.nick, channelName, message, null);
        this.ircClient.action(channelName, message);
    }
    clientSendPM(e, toNick, message) {
        this.sendPMEvent(toNick, message);
        this.ircClient.say(toNick, message);
    }
    clientJoinChannel(e, channelName) {
        var self = this;
        this.ircClient.join(channelName, function(){
            self.sendJoinChannelSuccess(channelName);
        })
    }
    clientLeaveChannel(e, channelName) {
        var self = this;
        this.ircClient.part(channelName, function(){
            self.sendLeaveChannelSuccess(channelName);
        });
    }
    clientDisconnect() {
        this.ircClient.disconnect();
    }
    sendPMEvent(toNick, message) {
        this._webContents.send('private-message', toNick, this.ircClient.nick, message);
    }
    sendMessage(nick, toChannelName, text, message) {
        if (toChannelName === this.ircClient.nick) {
            return this._webContents.send('private-message', nick, nick, text)
        }
        this._webContents.send('message', toChannelName, nick, text);
    }
    sendAction(from, toChannelName, text, message) {
        this._webContents.send('message', toChannelName, from, text, 'action')
    }
    sendJoin(channel, nick, message) {
        this._webContents.send('user-join-channel', channel, nick, message);
    }
    sendPart(channel, nick, reason, message) {
        this._webContents.send('user-part-channel', channel, nick, reason, message);
    }
    sendNames(channel, names) {
        this._webContents.send('channel-names', channel, names);
    }
    sendJoinChannelSuccess(channelName) {
        this._webContents.send('join-channel-success', channelName);
    }
    sendLeaveChannelSuccess(channelName) {
        this._webContents.send('leave-channel-success', channelName);
    }
}

module.exports = Irc;
