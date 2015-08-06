import { Dispatcher } from 'flux';
import EventEmitter from 'events';
import Autocomplete from 'autocomplete';
import { Message, ConnectMessage } from './messages';
import eventHandler from './event';
import config from '../config';
import { Notifier } from './notifications';

export var channelDispatcher = new Dispatcher();
var notifier = new Notifier();

class User {
    constructor(username, userType) {
        this.active = true;
        this.userType = userType;
        this.username = username;
        this.color = util.getRandomColor();
        let userTypeString = (userType === 'ghost') ? '' : userType;
        this.formattedName = userTypeString + this.username
    }
    setActive(active) {
        this.active = active;
    }
}

var iconMap = {
    'private-message': 'glyphicon-user',
    'standard': 'glyphicon-comment'
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
            this.users[nick], this.name, partMessage, false, 'leave'
        ))
    }
    addMessage(from, text, type) {
        if (!this._active && type === 'text-message') {
            this.unread++;
        }
        if (!this.users[from]) {
            this.users[from] = new User(from, 'ghost');
        }
        let shouldPing = this.shouldPing(text);
        this.unreadPing = this.unreadPing || shouldPing;
        this.messages.push(new Message(
            this.users[from], this.name, text, shouldPing, type
        ))

        return shouldPing;
    }
    clearUsers() {
        this.users = {};
        this.usernames = [];
        this.autocomplete = new Autocomplete();
    }
    removeUser(username) {
        if (this.users[username]) {
            this.users[username].setActive(false);
            this.usernames.splice(this.usernames.indexOf(username), 1);
            this.autocomplete.removeElement(username);
        }
    }
    addUser(username, type) {
        let userType = type || '';
        if (this.users[username]) {
            if (this.users[username].userType === 'ghost') {
                this.users[username].userType = userType;
            }
            return this.users[username].setActive(true);
        }
        this.users[username] = new User(username, userType);
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


class ServerStore {
    constructor() {
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
            eventHandler.joinChannel(channelName);
        } else {
            eventHandler.joinChannel(channelName);
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
        if (this.channels[channelName].type === 'private-message') {
            // Not real IRC channels, don't send LEAVE event.
            return this.markLeftChannel(channelName);
        }
        eventHandler.leaveChannel(channelName);
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
        // Hold a reference to these until we refresh them
        let users = channel.users;
        let usernames = channel.usernames;
        channel.clearUsers();
        for (var key in names) {
            let userType = names[key]
            channel.addUser(key, userType);
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


export var serverStore = new ServerStore();
