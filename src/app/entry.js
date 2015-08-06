import ipc from 'ipc';
import remote from 'remote';

import classNames from 'classnames';
import React from 'react';
import Combokeys from 'combokeys';
import globalBind from 'combokeys/plugins/global-bind';

import { channelDispatcher, ChannelStore, serverStore } from './app/ChannelStore';
import eventHandler from './app/event';
import IrcInput from './app/IrcInput';
import * as menu from './app/menu';
import * as util from './app/util';
import config from './config';

var combokeys = globalBind(new Combokeys(document));

var Channel = React.createClass({
    handleDispatch: function(payload) {
        if (payload.actionType === 'content-load') {
            this.shouldScroll();
        }
    },
    shouldScroll: function() {
        // This shouldnt scroll if we're scrolled to the top on purpose
        var node = this.getDOMNode();
        node.scrollTop = node.scrollHeight;
    },
    componentDidMount: function() {
        channelDispatcher.register(this.handleDispatch)
    },
    componentDidUpdate: function() {
        this.shouldScroll();
    },
    render: function() {
        let messages = this.props.channel.messages.map(function(message, i){
            return message.render(i);
        })
        return (
            <div className="channel-window">
                {messages}
            </div>
        );
    }
});


var ChannelList = React.createClass({
    onContextMenu: function(e) {
        e.preventDefault();
        menu.createChannelListContextMenu(e.target.innerText, this.props.leaveChannel);
    },
    render: function() {
        var self = this;
        let channels = this.props.channelList.map(function(channelName, i){
            let unread = null;
            let channel = self.props.channels[channelName];
            if (channel.showUnread()) {
                unread = (
                    <span className={classNames(
                        "unread-count", {"unread-highlight": channel.unreadPing}
                    )}>
                        {self.props.channels[channelName].unread}
                    </span>
                );
            }
            return (
                <div key={i}
                    onClick={self.props.setActiveChannel.bind(null, channelName)}
                    className={classNames(
                        "channel-name-wrap",
                        {
                            "channel-disconnected": !self.props.channels[channelName].connected,
                            "channel-highlight": channelName === self.props.activeChannelName
                        }
                    )}
                >
                    <span className={classNames("glyphicon", channel.iconType())}/>
                    <span
                        onContextMenu={self.onContextMenu}
                        className={'channel-name'}>{channelName}
                    </span>
                    {unread}
                </div>
            );
        });
        return (
            <div className={'server-list noselect'}>
                <div className="server-name">{this.props.serverName}</div>
                <div className={'channel-list'}>
                    {channels}
                </div>
            </div>
        );
    }
});


var UserList = React.createClass({
    onContextMenu: function(e) {
        e.preventDefault();
        menu.createUserListContextMenu(
            e.target.innerText,
            this.props.joinPrivateMessageChannel
        )
    },
    render: function() {
        var self = this;
        let users = this.props.usernames.map(function(username, i){
            return (
                <div
                    key={i}
                    onDoubleClick={self.props.joinPrivateMessageChannel.bind(null, username)}
                    onContextMenu={self.onContextMenu}
                    className={"username"}>
                    {self.props.users[username].formattedName}
                </div>
            );
        });
        return (
            <div className={'user-list noselect'}>
                {users}
            </div>
        );
    }
});


var IrcWindow = React.createClass({
    getInitialState: function() {
        serverStore.settings.serverName = config.irc.servers[0].name || config.irc.servers[0].address;
        menu.createApplicationMenu();
        return {
            serverName: serverStore.settings.serverName,
            channels: {},
            activeChannelName: null,
            channelList: [],
            nick: null,
            users: {},
            usernames: [],
            messages: [],
        }
    },
    registeredEvent: function(message) {
        // IRC server is ready to recieve info
        let self = this;
        let defaultChannels = config.irc.servers[0].channels;
        defaultChannels.forEach(function(channelName){
            self.attemptJoinChannel(channelName);
        })
        serverStore.nick = message.args[0];
        this.setState({nick: serverStore.nick});
    },
    onDisconnect: function() {
        serverStore.onDisconnect();
        ipc.send('client-reconnect');
        this.refreshActiveChannel();
    },
    onReconnect: function() {
        serverStore.onReconnect();
        this.refreshActiveChannel();
    },
    addPrivateMessage: function(pmChannel, messageUser, message) {
        if (!this.state.channels[pmChannel]) {
            this.joinPrivateMessageChannel(pmChannel);
            this.state.channels[pmChannel].addUser(this.state.nick);
        }
        this.state.channels[pmChannel].addUser(messageUser);
        this.addMessageToChannel(pmChannel, messageUser, message, 'private-message');
    },
    addMessageToChannel: function(channelName, from, message, type) {
        let messageType = type || 'text-message';
        serverStore.addMessage(channelName, from, message, messageType);
        if (this.state.activeChannelName === channelName) {
            this.refreshMessages();
        } else {
            this.updateChannels();
        }
    },
    componentDidMount: function() {
        ipc.on('join-channel-success', this.joinChannelSuccess);
        ipc.on('leave-channel-success', this.leaveChannelSuccess);
        ipc.on('message', this.addMessageToChannel);
        ipc.on('private-message', this.addPrivateMessage);
        ipc.on('channel-names', this.channelNamesEvent);
        ipc.on('registered', this.registeredEvent);
        ipc.on('user-join-channel', this.joinChannelEvent);
        ipc.on('user-kick', this.kickUser);
        ipc.on('user-kill', this.killUser);
        ipc.on('user-quit', this.userQuit);
        ipc.on('user-part-channel', this.partChannelEvent);
        ipc.on('disconnect', this.onDisconnect);
        ipc.on('reconnect', this.onReconnect);
        this.setupKeybinds();
        this.setupBrowserEvents();
    },
    channelNamesEvent: function(channelName, names){
        serverStore.setChannelNames(channelName, names);
        // No need to re-render
        if (channelName !== this.state.activeChannelName){ return; };
        this.refreshUserList();
    },
    refreshUserList: function() {
        this.setState({
            'users': serverStore.channels[this.state.activeChannelName].users,
            'usernames': serverStore.channels[this.state.activeChannelName].usernames
        });
    },
    joinChannelEvent: function(channelName, nick, message){
        let channel = serverStore.channels[channelName];
        if (!channel) { return; }
        channel.addUser(nick);
        if (config.irc.showJoinLeave) {
            let joinMessage = `(${message.user}@${message.host}) joined the channel`;
            this.addMessageToChannel(channelName, nick, joinMessage, 'join');
        }
        if (channelName === this.state.activeChannelName) {
            this.refreshUserList();
            this.refreshMessages();
        }
    },
    killUser: function(username, reason, channels, message) {
        let self = this;
        serverStore.removeUserFromChannels(username, channels);
        if (channels.indexOf(this.state.activeChannelName) !== -1) {
            // Defer this to flux?
            this.refreshUserList();
            if (config.irc.showJoinLeave) {
                let message = 'has been killed from IRC.';
                this.addMessageToChannel(
                    this.state.activeChannelName,
                    username,
                    message,
                    'kill'
                )
            }
        }
    },
    userQuit: function(username, reason, channels, message) {
        let self = this;
        serverStore.removeUserFromChannels(username, channels);
        if (channels.indexOf(this.state.activeChannelName) !== -1) {
            // Defer this to flux?
            this.refreshUserList();
            if (config.irc.showJoinLeave) {
                let message = 'has quit IRC.';
                this.addMessageToChannel(
                    this.state.activeChannelName,
                    username,
                    message,
                    'quit'
                )
            }
        }
    },
    kickUser: function(channelName, nick, by, reason, message) {
        serverStore.killUser(username, channels);
        if (config.irc.showJoinLeave) {
            let kickMessage = `(${nick} was kicked by ${by}): ${reason}`;
            this.addMessageToChannel(channelName, nick, kickMessage, 'kick');
        }
        if (channelName === this.state.activeChannelName){
            this.refreshUserList();
            this.refreshMessages();
        }
    },
    partChannelEvent: function(channelName, nick, reason, message){
        let channel = serverStore.channels[channelName];
        if (!channel) { return; }
        channel.removeUser(nick);
        if (config.irc.showJoinLeave) {
            let partMessage = `(${message.user}@${message.host}) left the channel`;
            serverStore.channels[channelName].addPartMessage(nick, partMessage);
        }
        if (channelName === this.state.activeChannelName) {
            this.refreshUserList();
            this.refreshMessages();
        }
    },
    joinPrivateMessageChannel: function(name) {
        if (!this.state.channels[name]) {
            serverStore.addNewChannel(name, 'private-message');
            this.updateChannels();
        } else {
            this.setActiveChannel(name);
        }
    },
    leaveChannel: function(channelName) {
        serverStore.leaveChannel(channelName);
    },
    leaveChannelSuccess: function(channelName) {
        serverStore.markLeftChannel(channelName);
        this.updateChannels();
    },
    attemptJoinChannel: function(channelName) {
        serverStore.addNewChannel(channelName, 'standard');
    },
    joinChannelSuccess: function(channelName) {
        serverStore.markJoinedChannel(channelName);
        this.updateChannels();
        this.refreshActiveChannel();
    },
    getActiveChannel: function() {
        return this.state.channels[this.state.activeChannelName];
    },
    setActiveChannel: function(channelName) {
        serverStore.setActiveChannel(channelName);
        this.refreshActiveChannel();
    },
    refreshActiveChannel: function() {
        let channel = serverStore.getActiveChannel();
        let users = {};
        let usernames = [];
        let messages = [];
        if (channel) {
            users = channel.users;
            usernames = channel.usernames;
            messages = channel.messages;
        }
        this.setState({
            activeChannelName: serverStore.activeChannelName,
            users: users,
            usernames: usernames,
            messages: messages,
        });
    },
    refreshMessages: function() {
        let channel = serverStore.getActiveChannel();
        let messages = [];
        if (channel) {
            messages = channel.messages;
        }
        this.setState({messages: messages});
    },
    updateChannels: function() {
        this.setState({
            channels: serverStore.channels,
            channelList: serverStore.channelList,
            activeChannelName: serverStore.activeChannelName,
        });
    },
    nextChannel: function(e) {
        e && e.preventDefault();
        serverStore.setNextChannel();
        this.refreshActiveChannel();
    },
    previousChannel: function(e) {
        e && e.preventDefault();
        serverStore.setPreviousChannel();
        this.refreshActiveChannel();
    },
    setupBrowserEvents: function() {
        window.onbeforeunload = function(e) {
            return false;
        };
    },
    setupKeybinds: function() {
        combokeys.bindGlobal(config.keybinds.previousChannel, this.previousChannel);
        combokeys.bindGlobal(config.keybinds.nextChannel, this.nextChannel);
    },
    render: function() {
        let self = this;
        let channel = null;
        let users = null;
        if (this.state.activeChannelName) {
            channel = <Channel
                        channel={this.state.channels[this.state.activeChannelName]}/>;
            users = <UserList
                users={this.state.users}
                usernames={this.state.usernames}
                joinPrivateMessageChannel={this.joinPrivateMessageChannel}/>;
        }
        return (
            <div>
                <div className="container-fluid window">
                    <div className="row upper-window">
                        <div className="col-xs-2 server-list-wrapper">
                            <ChannelList
                                serverName={this.state.serverName}
                                channels={this.state.channels}
                                channelList={this.state.channelList}
                                setActiveChannel={this.setActiveChannel}
                                activeChannelName={this.state.activeChannelName}
                                leaveChannel={this.leaveChannel}/>
                        </div>
                        <div className="col-xs-10 right-wrapper">
                            <div
                                className="col-xs-10 channel-wrap"
                                onContextMenu={menu.showChannelContext}>
                                {channel}
                            </div>
                            <div className="col-xs-2 user-list-wrap">
                                {users}
                            </div>

                            <div className="col-xs-12 irc-input-wrap">
                                <IrcInput
                                    channel={self.getActiveChannel()}
                                    activeChannelName={this.state.activeChannelName}/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});


React.render(<IrcWindow/>, document.body);
