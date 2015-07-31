var React = require('react');
var Combokeys = require('combokeys');
var combokeys = new Combokeys(document);
require('combokeys/plugins/global-bind')(combokeys);


module.exports = React.createClass({
    getInitialState: function() {
        return {value: ''};
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
        this.setState({value: null});
        React.findDOMNode(this.refs['irc-input']).value = '';
        this.parseAndSendCommand(this.state.value);
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
    componentDidMount: function() {
        combokeys.bindGlobal('any-character', this.getFocus);
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
