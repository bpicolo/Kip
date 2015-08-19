import Autocomplete from 'autocomplete';
import config from '../config';
import EventEmitter from 'events';
import * as util from './util';
import { Dispatcher } from 'flux';
import { Message, ConnectMessage, MessageType} from './messages';
import { Notifier } from './notifications';
var eventHandler = require('./event');

export var channelDispatcher = new Dispatcher();
var notifier = new Notifier();

class User {
    constructor(username, userType, userMode) {
        this.active = true;
        this.userMode = userMode;
        this.userType = userType;
        this.username = username;
        this.color = util.getRandomColor();
        let userModeString = (userMode === 'ghost') ? '' : userMode;
        this.formattedName = userModeString + this.username
    }
    setActive(active) {
        this.active = active;
    }
}


export var UserType = {
    ghost: 'ghost',
    standard: 'standard'
}


export var ChannelType = {
    standard: 'standard',
    privateMessage: 'private-message'
}

var iconMap = {
    [ChannelType.privateMessage]: 'glyphicon-user',
    [ChannelType.standard]: 'glyphicon-comment'
}


export class ChannelStore {
    constructor(name, type) {
        this.type = type;
        this.name = name;
        this.users = {};
        this.usernames = [];
        this.autocomplete = new Autocomplete();
        this.messages = [];
        this.unread = 0;
        this.unreadPing = false;
        this._active = false;
        this.connected = false;
    }
    addPartMessage(nick, partMessage) {
        this.messages.push(new Message(
            this.users[nick], this.name, partMessage, false, MessageType.leave
        ))
    }
    addMessage(from, text, type) {
        if (!this._active && type === MessageType.standard) {
            this.unread++;
        }
        if (!this.users[from]) {
            this.users[from] = new User(from, UserType.ghost);
        }
        let shouldPing = this.shouldPing(text);
        this.unreadPing = this.unreadPing || shouldPing;
        this.messages.push(new Message(
            this.users[from], this.name, text, shouldPing, type
        ))

        return shouldPing;
    }
    removeUser(username) {
        if (this.users[username]) {
            this.users[username].setActive(false);
            let idx = this.usernames.indexOf(username);
                if (idx !== -1) {
                    this.usernames.splice(idx, 1);
                }
            this.autocomplete.removeElement(username);
        }
    }
    addUser(username, mode) {
        let userMode = mode || '';
        if (this.users[username]) {
            if (this.users[username].userType === 'ghost') {
                this.users[username].userType = UserType.standard;
            }
            this.users[username].userMode = userMode;
            this.users[username].setActive(true);
        } else {
            this.users[username] = new User(username, UserType.standard, userMode);
        }
        this.autocomplete.addElement(username);
        this.usernames.push(username); // Todo fix @, + etc
        this.usernames.sort();
    }
    active(newState) {
        this.unread = 0
        this.unreadPing = false;
        this._active = newState;
    }
    shouldPing(message) {
        for (var i = 0; i < serverStore.settings.pingOn.length; i++) {
            if (message.indexOf(serverStore.settings.pingOn[0]) !== -1){
                return true;
            }
        }
        return false;
    }
    showUnread() {
        return !this._active && this.unread > 0;
    }
    iconType() {
        return iconMap[this.type];
    }
    disconnect() {
        this.connected = false;
        this.messages.push(new ConnectMessage(false));
    }
    reconnect() {
        this.connected = false;
        this.messages.push(new ConnectMessage(true));
    }
}


export class ServerStore {
    constructor(eventHandler) {
        this.eventHandler = eventHandler;
        this.serverName = null;
        this.channels = {};
        this.activeChannelName = null;
        this.channelList = [];
        this.settings = {
            pingOn: config.irc.servers[0].pingOn,
            showNotifications: config.irc.servers[0].showNotifications,
        };
        this.nick = null;
    }
    addMessage(channelName, fromUser, message, messageType) {
        let shouldPing = this.channels[channelName].addMessage(fromUser, message, messageType);
        if (shouldPing && this.settings.showNotifications && fromUser !== this.nick) {
            notifier.sendNotification(`New message from ${fromUser} in ${channelName}`, message);
        }
    }
    addNewChannel(channelName, channelType) {
        if (!this.channels[channelName]) {
            this.channels[channelName] = new ChannelStore(channelName, channelType);
            this.channelList.push(channelName);
            this.eventHandler.joinChannel(channelName);
        } else {
            this.eventHandler.joinChannel(channelName);
        }
    }
    markJoinedChannel(channelName) {
        this.channels[channelName].connected = true;
        if (!this.activeChannelName) {
            this.activeChannelName = channelName;
        }
    }
    leaveChannel(channelName) {
        if (!this.channels[channelName]) {return};
        if (this.channels[channelName].type === ChannelType.privateMessage) {
            // Not real IRC channels, don't send LEAVE event.
            return this.markLeftChannel(channelName);
        }
        this.eventHandler.leaveChannel(channelName);
    }
    getActiveChannel() {
        return this.channels[this.activeChannelName];
    }
    markLeftChannel(channelName) {
        if (!this.channels[channelName]) {return;}
        if (this.activeChannelName === channelName) {
            if (this.channelList.length > 1) {
                this.setPreviousChannel();
            } else {
                this.activeChannelName = null;
            }
        }

        delete this.channels[channelName];
        this.channelList.splice(
            this.channelList.indexOf(channelName), 1
        );
    }
    setActiveChannel(channelName) {
        if (channelName === this.activeChannelName || !this.channels[channelName]) {
            return;
        }
        let current = this.getActiveChannel();
        if (current) { current.active(false); }
        this.channels[channelName].active(true);
        this.activeChannelName = channelName;
    }
    setPreviousChannel() {
        if (this.channelList.length <= 1) { return; }
        let currentIndex = this.channelList.indexOf(this.activeChannelName);
        if (currentIndex === -1) { return; }
        if (currentIndex == 0) {
            return this.setActiveChannel(this.channelList[this.channelList.length - 1])
        }
        this.setActiveChannel(this.channelList[currentIndex - 1]);
    }
    setNextChannel() {
        if (this.channelList.length <= 1) { return; }
        let currentIndex = this.channelList.indexOf(this.activeChannelName);
        if (currentIndex === -1) { return; }
        if (currentIndex == this.channelList.length - 1) {
            return this.setActiveChannel(this.channelList[0]);
        }
        this.setActiveChannel(this.channelList[currentIndex + 1]);
    }
    setChannelNames(channelName, names) {
        let channel = this.channels[channelName];
        if (!channel) { return; }
        let usersToAdd = Object.keys(names).filter(function(username){
            return !channel.users[username] || !channel.users[username].active;
        });
        let usersToDeactivate = channel.usernames.filter(function(username){
            return !names[username];
        });

        for (let username of usersToAdd) {
            let userMode = names[username]
            channel.addUser(username, userMode);
        }
        for (let username of usersToDeactivate) {
            channel.removeUser(username);
        }

    }
    onDisconnect() {
        // Mark all channels disconnected and add disconnect messages
        for (var key in this.channels) {
            this.channels[key].disconnect();
        }
    }
    onReconnect() {
        for (var key in this.channels) {
            this.channels[key].reconnect();
        }
    }
    removeUserFromChannels(username, channels) {
        let self = this;
        channels.forEach(function(channel){
            if (self.channels[channel]) {
                self.channels[channel].removeUser(username);
            }
        });
    }
}


export var serverStore = new ServerStore(eventHandler);
