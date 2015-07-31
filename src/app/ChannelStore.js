var Autocomplete = require('autocomplete');
var Message = require('./messages').Message;


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

class ChannelStore {
    constructor(name, type, pings) {
        this.type = type;
        this.name = name;
        this.users = {};
        this.usernames = [];
        this.autocomplete = new Autocomplete();
        this.messages = [];
        this.pings = pings || [];
        this.unread = 0;
        this.unreadPing = false;
        this._active = false;
    }
    active(newState) {
        this.unread = 0
        this.unreadPing = false;
        this._active = newState;
    }
    shouldPing(message) {
        for (var i = 0; i < this.pings.length; i++) {
            if (message.indexOf(this.pings[0]) !== -1){
                return true;
            }
        }
        return false;
    }
    showUnread() {
        return !this._active && this.unread > 0;
    }
    addPartMessage(nick, partMessage) {
        this.messages.push(new Message(
            this.users[nick], this.name, partMessage, false, 'leave'
        ))
    }
    addMessage(from, text, type) {
        if (!this._active) {
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
    removeUser(username) {
        this.users[username].setActive(false);
        this.usernames.splice(this.usernames.indexOf(username), 1);
        this.autocomplete.removeElement(username);
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
}

module.exports = ChannelStore;
