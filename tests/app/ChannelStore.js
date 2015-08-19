'use strict';
var sinon = require('sinon');

var assert = require('assert');
var ChannelStore = require('../../dist/app/ChannelStore').ChannelStore;
var ChannelType = require('../../dist/app/ChannelStore').ChannelType;
var UserType = require('../../dist/app/ChannelStore').UserType;
var ServerStore = require('../../dist/app/ChannelStore').ServerStore;
var User = require('../../dist/app/ChannelStore').User;
var MessageType = require('../../dist/app/messages').MessageType;


describe('ChannelStore', function(){

    beforeEach(function(){
        this.channelStore = new ChannelStore('Booo', ChannelType.standard);
    });

    it('can add a new message', function(){
        this.channelStore.addMessage('john', 'blahblah', MessageType.standard);
        assert.equal(this.channelStore.messages.length, 1);
        assert.equal(this.channelStore.messages[0].message, 'blahblah')
    });

    it('bumps the unread count when active and a message is added', function(){
        this.channelStore.addMessage('john', 'message', MessageType.standard);
        assert.equal(this.channelStore.unread, 1);
    });

    it('does not bump the message count when other types of messages are added', function(){
        this.channelStore.addMessage('john', 'message', MessageType.standard);
        assert.equal(this.channelStore.unread, 1);
    });

    it('adds a ghost user if it doesn\'t recognize the user the message is from', function() {
        this.channelStore.addMessage('fromUser', 'blah', MessageType.standard);
        assert.equal(this.channelStore.users['fromUser'].userType, UserType.ghost)
        assert.equal(this.channelStore.usernames.indexOf('fromUser'), -1);
    });

    it('does not change a recognized user', function() {
        this.channelStore.addUser('fromUser');
        this.channelStore.addMessage('fromUser', 'blah', MessageType.standard);
        assert.equal(this.channelStore.users['fromUser'].userType, UserType.standard);
    });

    it('adds a channel ping if message should ping', function() {
        this.channelStore.shouldPing = function() {return true;};
        this.channelStore.addMessage('fromUser', 'blah', MessageType.standard);
        assert(this.channelStore.unreadPing);
    });

    it('does not add a channel ping if it shouldnt', function() {
        this.channelStore.shouldPing = function() {return false;};
        this.channelStore.addMessage('fromUser', 'blah', MessageType.standard);
        assert(!this.channelStore.unreadPing);
    });
});

describe('ServerStore', function(){

    beforeEach(function(){
        this.serverStore = new ServerStore({joinChannel: sinon.spy()});
        this.serverStore.addNewChannel('channel', ChannelType.standard);
        this.channel = this.serverStore.channels['channel'];
    });

    it('adds new users to channel on setChannelNames', function(){
        let newUsers = {'john': '@', 'bill': '+'};
        this.channel.addUser('jeff');
        this.channel.addUser('bill');
        this.serverStore.setChannelNames('channel', newUsers);
        assert(this.channel.users['john'].active);
        assert(this.channel.users['bill'].active);
    });

    it('deactivates old users on setChannelNames', function(){
        let newUsers = {'john': '@', 'bill': '+'};
        this.channel.addUser('jeff');
        this.channel.addUser('bill');
        this.serverStore.setChannelNames('channel', newUsers);

        assert(!this.channel.users['jeff'].active);
        assert(this.channel.usernames.indexOf('jeff') === -1);
    });

    it('activates ghost users if in names setChannelNames', function(){
        let newUsers = {john: '@', bill: '+'};
        this.channel.addUser('jeff');
        this.channel.addUser('bill');
        this.channel.users.bill.setActive(false);

        this.serverStore.setChannelNames('channel', newUsers);

        assert(this.channel.users.bill.active);
        assert(this.channel.usernames.indexOf('bill') !== -1);
    });
});
