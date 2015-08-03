var ipc = require('ipc');
var config = require('../config.js');
var notifier = require('node-notifier');

export class Notifier {
    sendNotification(title, message) {
        notifier.notify({
            title: title,
            message: message,
            sound: config.irc.servers[0].notificationPing,
        });
    }
}
