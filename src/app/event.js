import ipc from 'ipc';


class EventHandler {
    constructor() {}
    joinChannel(channelName) {
        ipc.send('client-join-channel', channelName);
    }
    leaveChannel(channelName) {
        ipc.send('client-leave-channel', channelName);
    }
    sendMessage(channelName, message) {
        ipc.send('client-send-message', channelName, message);
    }
    sendPM(toNick, message) {
        ipc.send('client-send-pm', toNick, message);
    }
    sendAction(channelName, message) {
        ipc.send('client-send-action', channelName, message);
    }
}


module.exports = new EventHandler();
