import Linkify from 'react-linkify';
import shell from 'shell';
import { channelDispatcher, serverStore } from './ChannelStore';
import ipc from 'ipc';
import classNames from 'classnames';
import React from 'react';
import config from '../config.js';
import eventHandler from './event';
import moment from 'moment';

var detectImageRe = /(https?:\/\/.*\.(?:png|jpg|gif))/g;


export var MessageType = {
    standard: 'text-message',
    'private': 'private-message',
    join: 'join',
    kick: 'kick',
    kill: 'kill',
    quit: 'quit',
    leave: 'leave'
}


export class ConnectMessage {
    constructor(connected) {
        this.time = moment().format('h:mm:ss');
        this.type = 'connection';
        if (connected) {
            this.message = 'You have been reconnected to the channel.';
        } else {
            this.message = 'You have been disconnected from the channel.';
        }
    }
    render(key) {
        return (
            <div key={key} className={classNames('message', this.type)}>
                <span className="message-time">{'[' + this.time + ']'}</span>
                <span className="message-message">
                    {this.message}
                </span>
            </div>
        );
    }
}
// This is a clear butchery of React, though to be fair we expect these to be
// immutable...let's do this better >.> Wut was I thinking
export class Message {
    constructor(from, to, message, highlight, type) {
        this.from = from
        this.to = to
        this.message = message
        this.highlight = highlight
        this.type = type
        this.time = moment().format('h:mm:ss')
        if (config.irc.showInlineImages) {
            this.detectImage();
        }
    }
    detectImage() {
        let groups = this.message.match(detectImageRe);
        if (groups) {
            this.imageSrc = groups[0];
        }
    }
    onImageLoad() {
        channelDispatcher.dispatch({actionType: 'content-load'})
    }
    openLink(e) {
        e.preventDefault();
        shell.openExternal(e.target.href);
    }
    render(key) {
        let inlineImage = null;
        if (this.imageSrc) {
            inlineImage = (
                <div className="message-inline-image">
                    <img
                        onLoad={this.onImageLoad}
                        onError={this.onImageLoad} src={this.imageSrc}/>
                </div>
            );
        }
        let isAction = (this.type === 'action');
        let messageFrom = null;
        if (isAction) {
            messageFrom = (
                <span className="message-from" style={{color: this.from.color, fontWeight: 'BOLD'}}>
                    {'•' + this.from.formattedName}
                </span>
            );
        } else {
            messageFrom = (
                <span className="message-from" style={{color: this.from.color}}>
                    {'<' + this.from.formattedName + '>'}
                </span>
            );
        }

        return (
            <div key={key} className={classNames("message", this.type, {"message-highlight": this.highlight})}>
                <span className="message-time">{'[' + this.time + ']'}</span>
                {messageFrom}
                <span className="message-message" style={isAction ? {color: this.from.color} : {}}>
                    <Linkify properties={{onClick: this.openLink}}>{this.message}</Linkify>
                </span>
                {inlineImage}
            </div>
        );
    }
}

function isJoin(message) {
    return message.startsWith('/join ');
}

export function sendJoin(activeChannel, message) {
    var channelName = message.split(' ')[1];
    if (channelName) {
        serverStore.addNewChannel(channelName, 'standard');
    }
}

function isLeave(message) {
    return message.startsWith('/leave');
}

function sendLeave(activeChannel, message) {
    var channelName = message.split(' ')[1];
    channelName = channelName || activeChannel;
    if (channelName) {
        eventHandler.leaveChannel(channelName);
    }
}

function isPM(message) {
    return message.startsWith('/msg ');
}

function sendPM(activeChannel, message) {
    var pmargs = message.split(' ');
    pmargs.shift();
    let toNick = pmargs.shift();
    eventHandler.sendPM(toNick, pmargs.join(' '));
}

function isAction(message) {
    return message.startsWith('/me ');
}

function sendAction(activeChannel, message) {
    var actionArgs = message.split(' ');
    actionArgs.shift();
    eventHandler.sendAction(activeChannel, actionArgs.join(' '));
}

function isMessage(message) {
    return !message.startsWith('/');
}

function sendMessage(activeChannel, message) {
    eventHandler.sendMessage(activeChannel, message);
}

// This is clearly stupid and we should just check for commands and otherwise send a message
export var messageParseOrder = [
    {
        parser: isJoin,
        sender: sendJoin
    },
    {
        parser: isLeave,
        sender: sendLeave
    },
    {
        parser: isPM,
        sender: sendPM,
    },
    {
        parser: isAction,
        sender: sendAction,
    },
    {
        parser: isMessage,
        sender: sendMessage
    }
];
