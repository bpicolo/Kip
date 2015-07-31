module.exports.keybinds = {
    previousChannel: 'command+shift+[',
    nextChannel: 'command+shift+]'
}

module.exports.irc = {
    inlineImages: true,
    servers: [{
        showJoinLeave: true,
        showInlineImages: true,
        showNotifications: true,
        notificationPing: true,
        name: 'MyIRCServer',
        address: 'irc.place.com',
        port: 6667,
        password: 'password',
        secure: true,
        channels: ['#coding'],
        nick: 'kip',
        pingOn: ['kip']
    }]
}
