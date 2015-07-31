var React = require('react');
var Combokeys = require('combokeys');
var combokeys = new Combokeys(document);
require('combokeys/plugins/global-bind')(combokeys);

var config = require('../config.js');


module.exports = React.createClass({
    getInitialState: function() {
        return {
            value: '',
            previousMessages: [],
            scrollbackIndex: null,
        };
    },
    autoComplete: function(e) {
        e.preventDefault();
        let frags = this.state.value.split(' ');
        let query = frags.pop();
        if (query) {
            let results = this.props.channel.autocomplete.search(query);
            let result = results[0] ? results[0] + ' ': query;
            frags.push(result);
            this.setState({'value': frags.join(' ')});
        }
    },
    parseAndSendCommand: function(command) {
        for (var i = 0; i < messageParseOrder.length; i++) {
            if (messageParseOrder[i].parser(command)) {
                messageParseOrder[i].sender(this.props.activeChannelName, command);
            }
        }
    },
    onSubmit: function(e) {
        e.preventDefault();
        let command = this.state.value;
        this.state.previousMessages.unshift(command);
        let scrollbackLength = config.irc.scrollbackLength || 100;
        if (this.state.previousMessages.length > scrollbackLength) {
            this.state.previousMessages.pop();
        }
        this.setState({
            previousMessages: this.state.previousMessages,
            scrollbackIndex: null,
            value: ''
        });
        this.parseAndSendCommand(command);
    },
    onChange: function(e) {
        this.setState({value: e.target.value});
    },
    onBlur: function(e) {
        combokeys.unbind('tab');
    },
    onFocus: function(e) {
        combokeys.bindGlobal('tab', this.autoComplete);
    },
    getFocus: function() {
        this.refs['irc-input'].getDOMNode().focus();
    },
    previousScrollback: function(e) {
        e && e.preventDefault();
        if (this.state.scrollbackIndex === null) {
            this.state.scrollbackIndex = 0;
        } else if (this.state.scrollbackIndex < this.state.previousMessages.length - 1){
            this.state.scrollbackIndex++;
        }

        this.setState({
            scrollbackIndex: this.state.scrollbackIndex,
            value: this.state.previousMessages[this.state.scrollbackIndex],
        });
    },
    nextScrollback: function(e) {
        e && e.preventDefault();
        if (this.state.scrollbackIndex === null) {
            return;
        } else if (this.state.scrollbackIndex > 0){
            this.state.scrollbackIndex--;
        } else {
            this.state.scrollbackIndex = null;
        }
        let value = this.state.previousMessages[this.state.scrollbackIndex] || '';
        if (this.state.scrollbackIndex < this.state.previousMessages.length) {
            this.setState({
                scrollbackIndex: this.state.scrollbackIndex,
                value: value,
            });
        }
    },
    componentDidMount: function() {
        combokeys.bindGlobal('any-character', this.getFocus);
        combokeys.bindGlobal('up', this.previousScrollback);
        combokeys.bindGlobal('down', this.nextScrollback);
    },
    render: function() {
        return (
            <form onSubmit={this.onSubmit} className="irc-input-bar">
                <input type="text"
                    className="irc-input"
                    ref="irc-input"
                    onBlue={this.onBlur}
                    onChange={this.onChange}
                    onFocus={this.onFocus}
                    placeholder={"Send a message..."}
                    value={this.state.value}
                >
                </input>
                <button type="submit" className="hidden-submit"/>
            </form>
        )
    }
});
