var ipc = require('ipc');
var util = require('util');

var irc = require('irc');


class Irc {
    constructor(mainWindow, config) {
        var self = this;
        this._mainWindow = mainWindow;

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

        this.ircClient.addListener('names', this.sendNamesEvent.bind(this));
        this.ircClient.addListener('join', this.joinEvent.bind(this));
        this.ircClient.addListener('part', this.partEvent.bind(this));
        this.ircClient.addListener('message', this.sendMessageEvent.bind(this));
        this.ircClient.addListener('action', this.actionEvent.bind(this));


        this.ircClient.addListener('registered', function(message) {
            self._mainWindow.webContents.send('registered', message);
            for (var i = 0; i < server.channels.length; i++) {
                self.joinChannel(server.channels[i]);
            }
        });

        this.bindRecieveEvents();
    }
    disconnect() {
        this.ircClient.disconnect();
    }
    bindRecieveEvents() {
        ipc.on('client-send-message', this.clientSendMessage.bind(this));
        ipc.on('client-send-action', this.clientSendAction.bind(this));
        ipc.on('client-send-pm', this.clientSendPM.bind(this));
        ipc.on('client-join-channel', this.clientJoinChannel.bind(this));
        ipc.on('client-leave-channel', this.clientLeaveChannel.bind(this));
        ipc.on('client-disconnect', this.disconnect.bind(this));
    }
    clientSendMessage(e, channelName, message) {
        this.sendMessageEvent(this.ircClient.nick, channelName, message);
        this.ircClient.say(channelName, message);
    }
    clientSendAction(e, channelName, message) {
        this.actionEvent(this.ircClient.nick, channelName, message, null);
        this.ircClient.action(channelName, message);
    }
    clientSendPM(e, toNick, message) {
        this.sendPMEvent(toNick, message);
        this.ircClient.say(toNick, message);
    }
    clientJoinChannel(e, channelName) {
        this.joinChannel(channelName);
    }
    clientLeaveChannel(e, channelName) {
        var self = this;
        this.ircClient.part(channelName, function(){
            self.sendLeaveChannelSuccess(channelName);
        });
    }
    sendPMEvent(toNick, message) {
        this._mainWindow.webContents.send(
            'private-message', toNick, this.ircClient.nick, message
        )
    }
    sendMessageEvent(nick, toChannelName, text, message) {
        if (toChannelName === this.ircClient.nick) {
            return this._mainWindow.webContents.send(
                'private-message', nick, nick, text
            )
        }
        this._mainWindow.webContents.send('message', toChannelName, nick, text);
    }
    actionEvent(from, toChannelName, text, message) {
        this._mainWindow.webContents.send(
            'message', toChannelName, from, text, 'action'
        )
    }
    joinEvent(channel, nick, message) {
        this._mainWindow.webContents.send('join-channel', channel, nick, message);
    }
    partEvent(channel, nick, reason, message) {
        this._mainWindow.webContents.send('part-channel', channel, nick, reason, message);
    }
    sendNamesEvent(channel, names) {
        this._mainWindow.webContents.send('channel-names', channel, names);
    }
    sendJoinChannelSuccess(channelName) {
        this._mainWindow.webContents.send('join-channel-success', channelName);
    }
    sendLeaveChannelSuccess(channelName) {
        this._mainWindow.webContents.send('leave-channel-success', channelName);
    }
    joinChannel(channelName) {
        var self = this;
        this.ircClient.join(channelName, function(){
            self.sendJoinChannelSuccess(channelName);
        })
    }
}

module.exports = Irc;
