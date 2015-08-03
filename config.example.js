module.exports.keybinds = {
    previousChannel: 'command+shift+[',
    nextChannel: 'command+shift+]'
}

module.exports.irc = {
    inlineImages: true,
    showJoinLeave: true,
    showInlineImages: true,  // Whether to render images inline
    servers: [{
        showNotifications: true,  // Whether to show system-level notifications
        notificationPing: true,
        name: 'MyIRCServer',
        address: 'irc.place.com',
        port: 6667,
        password: 'password',
        secure: true,  // SSL?
        channels: ['#coding'],  // Channels to join by default
        nick: 'kip',
        pingOn: ['kip'] // Phrases to recieve desktop notifications / highlights for
    }]
}
