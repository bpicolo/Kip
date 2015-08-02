var ipc = require('ipc');
var remote = require('remote');

var classNames = require('classnames');
var React = require('react');
var moment = require('moment');
var Combokeys = require('combokeys');
var combokeys = new Combokeys(document);
require('combokeys/plugins/global-bind')(combokeys);

var eventHandler = require('./app/event');
var ChannelStore = require('./app/ChannelStore');
var IrcInput = require('./app/IrcInput');
var Notifier = require('./app/notifications');
var formatMessage = require('./app/messages').formatMessage;
var menu = require('./app/menu');
var messageParseOrder = require('./app/messages').messageParseOrder;
var sendJoin = require('./app/messages').sendJoin;
var util = require('./app/util')

var config = require('./config.js')


var notifier = new Notifier();

var Channel = React.createClass({
    componentDidUpdate: function() {
        var node = this.getDOMNode();
        // TODO make this not scroll down if user is up on purpose
        // also inline images probably mess it up
        node.scrollTop = node.scrollHeight;
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
                        {"channel-highlight": channelName === self.props.activeChannelName}
                    )}
                >
                    <span className={classNames("glyphicon", channel.iconType())}/>
                    <span className={'channel-name'}>{channelName}</span>
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
    render: function() {
        var self = this;
        let users = this.props.channel.usernames.map(function(username, i){
            return (
                <div
                    key={i}
                    onDoubleClick={self.props.joinPrivateMessageChannel.bind(null, username)}
                    className={"username"}>
                    {self.props.channel.users[username].formattedName}
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
        let pingOn = config.irc.servers[0].pingOn || [];
        let serverName = config.irc.servers[0].name || config.irc.servers[0].address;
        menu.createApplicationMenu();
        return {
            serverName: serverName,
            channels: {},
            activeChannelName: null,
            channelList: [],
            settings: {
                pingOn: pingOn
            },
            nick: null,
        }
    },
    registeredEvent: function(message) {
        this.setState({nick: message.args[0]});
    },
    addMessage: function(channelName, fromUser, message, messageType) {
        let shouldPing = this.state.channels[channelName].addMessage(
            fromUser, message, messageType
        );
        if (shouldPing && config.irc.servers[0].showNotifications && fromUser !== this.state.nick) {
            notifier.sendNotification(`New message from ${fromUser} in ${channelName}`, message);
        }
    },
    addPrivateMessage: function(pmChannel, messageUser, message) {
        if (!this.state.channels[pmChannel]) {
            this.joinPrivateMessageChannel(pmChannel);
            this.state.channels[pmChannel].addUser(this.state.nick);
        }
        this.state.channels[pmChannel].addUser(messageUser);
        this.addMessage(pmChannel, messageUser, message, 'private-message');
        this.setState({channels: this.state.channels});
    },
    addMessageToChannel: function(channelName, from, message, type) {
        if (!this.state.channels[channelName]) {
            this.joinChannelEvent(channelName, from, message);
        }
        let messageType = type || 'text-message';
        this.addMessage(channelName, from, message, messageType);
        this.setState({channels: this.state.channels});
    },
    componentDidMount: function() {
        ipc.on('join-channel-success', this.joinChannelSuccess);
        ipc.on('leave-channel-success', this.leaveChannelSuccess);
        ipc.on('message', this.addMessageToChannel);
        ipc.on('private-message', this.addPrivateMessage);
        ipc.on('channel-names', this.channelNamesEvent);
        ipc.on('registered', this.registeredEvent);
        ipc.on('user-join-channel', this.joinChannelEvent);
        ipc.on('user-part-channel', this.partChannelEvent);
        this.setupKeybinds();
        this.setupBrowserEvents();
    },
    channelNamesEvent: function(channelName, names){
        let channel = this.state.channels[channelName];
        if (!channel) { return; }
        for (var key in names) {
            let userType = names[key]
            channel.addUser(key, userType);
        }
        this.updateChannels();
    },
    joinChannelEvent: function(channelName, nick, message){
        let channel = this.state.channels[channelName];
        if (!channel) { return; }
        let joinMessage = `(${message.user}@${message.host}) joined the channel`;
        channel.addUser(nick);
        this.addMessageToChannel(channelName, nick, joinMessage, 'join');
        this.updateChannels();
    },
    partChannelEvent: function(channelName, nick, reason, message){
        let channel = this.state.channels[channelName];
        if (!channel) { return; }
        let partMessage = `(${message.user}@${message.host}) left the channel`;
        channel.removeUser(nick);
        this.state.channels[channelName].addPartMessage(nick, partMessage);
        this.updateChannels();
    },
    joinPrivateMessageChannel: function(name) {
        if (!this.state.channels[name]) {
            this.state.channels[name] = new ChannelStore(
                name, 'private-message', this.state.settings.pingOn
            );
            this.state.channelList.push(name);
            this.updateChannels();
            this.setActiveChannel(name);
        } else {
            this.setActiveChannel(name);
        }
    },
    leaveChannel: function(channelName) {
        let channel = this.state.channels[channelName];
        if (channel.type === 'private-message') {
            // Not real IRC channels, don't send LEAVE event.
            return this.leaveChannelSuccess(channelName);
        }
        eventHandler.leaveChannel(channelName);
    },
    leaveChannelSuccess: function(channelName) {
        if (!this.state.channels[channelName]) {return;}
        if (this.state.activeChannelName === channelName) {
            if (this.state.channelList.length > 1) {
                this.previousChannel();
            } else {
                this.setState({activeChannelName:null});
            }
        }
        this.state.channels[channelName] = null;
        this.state.channelList.splice(
            this.state.channelList.indexOf(channelName), 1
        );
        this.updateChannels();
    },
    joinChannelSuccess: function(channelName) {
        if (!this.state.channels[channelName]) {
            this.state.channels[channelName] = new ChannelStore(
                channelName, 'standard', this.state.settings.pingOn
            );
            this.state.channelList.push(channelName);
            this.updateChannels();

            if (!this.state.activeChannelName) {
                this.setActiveChannel(channelName);
            }
        }
    },
    getActiveChannel: function() {
        return this.state.channels[this.state.activeChannelName];
    },
    updateChannels: function() {
        this.setState({channels: this.state.channels});
    },
    setActiveChannel: function(channelName) {
        if (channelName === this.state.activeChannelName || !this.state.channels[channelName]) {
            return;
        }
        let current = this.getActiveChannel();
        if (current) {
            current.active(false);
        }
        this.state.channels[channelName].active(true);
        this.setState({activeChannelName: channelName});
    },
    nextChannel: function(e) {
        e && e.preventDefault();
        if (this.state.channelList.length <= 1) { return; }
        let currentIndex = this.state.channelList.indexOf(this.state.activeChannelName);
        if (currentIndex === -1) { return; }
        if (currentIndex == this.state.channelList.length - 1) {
            return this.setActiveChannel(this.state.channelList[0]);
        }
        this.setActiveChannel(this.state.channelList[currentIndex + 1]);
    },
    previousChannel: function(e) {
        e && e.preventDefault();
        if (this.state.channelList.length <= 1) { return; }
        let currentIndex = this.state.channelList.indexOf(this.state.activeChannelName);
        if (currentIndex === -1) { return; }
        if (currentIndex == 0) {
            return this.setActiveChannel(this.state.channelList[this.state.channelList.length - 1])
        }
        this.setActiveChannel(this.state.channelList[currentIndex - 1]);
    },
    setupBrowserEvents: function() {
        window.onbeforeunload = function(e) {
            return false;
        };
        window.addEventListener(
            'contextmenu',
            menu.createContextMenu.bind(this),
            false
        );
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
            channel = <Channel channel={this.state.channels[this.state.activeChannelName]}/>;
            users = <UserList
                channel={this.state.channels[this.state.activeChannelName]}
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
                                activeChannelName={this.state.activeChannelName}/>
                        </div>
                        <div className="col-xs-10 right-wrapper">
                            <div className="col-xs-10 channel-wrap">
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
