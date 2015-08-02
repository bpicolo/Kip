var remote = require('remote');
var Menu = remote.require('menu');
var MenuItem = remote.require('menu-item');

var eventHandler = require('./event');


var standardContextTemplate = [
    {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        selector: 'copy:'
    }
]


var applicationMenuTemplate = [
    {
        label: 'Kip',
        submenu: [
            {
                label: 'About Kip',
                selector: 'orderFrontStandardAboutPanel:'
            },
            {
                type: 'separator'
            },
            {
                label: 'Hide Kip',
                accelerator: 'CmdOrCtrl+H',
                selector: 'hide:'
            },
            {
                label: 'Hide Others',
                accelerator: 'CmdOrCtrl+Shift+H',
                selector: 'hideOtherApplications:'
            },
            {
                label: 'Show All',
                selector: 'unhideAllApplications:'
            },
            {
                type: 'separator'
            },
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                selector: 'terminate:'
            },
        ]
    },
  {
    label: 'Edit',
    submenu: [
      {
        label: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        selector: 'undo:'
      },
      {
        label: 'Redo',
        accelerator: 'Shift+CmdOrCtrl+Z',
        selector: 'redo:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Cut',
        accelerator: 'CmdOrCtrl+X',
        selector: 'cut:'
      },
      {
        label: 'Copy',
        accelerator: 'CmdOrCtrl+C',
        selector: 'copy:'
      },
      {
        label: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        selector: 'paste:'
      },
      {
        label: 'Select All',
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:'
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Toggle DevTools',
        accelerator: 'Alt+CmdOrCtrl+I',
        click: function() { remote.getCurrentWindow().toggleDevTools(); }
      },
    ]
  },
  {
    label: 'Window',
    submenu: [
      {
        label: 'Minimize',
        accelerator: 'CmdOrCtrl+M',
        selector: 'performMiniaturize:'
      },
      {
        label: 'Close',
        accelerator: 'CmdOrCtrl+W',
        selector: 'performClose:'
      },
      {
        type: 'separator'
      },
      {
        label: 'Bring All to Front',
        selector: 'arrangeInFront:'
      }
    ]
  },
  {
    label: 'Help',
    submenu: []
  }
]

function createApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenuTemplate));
}

function createContextMenu(e) {
  let self = this;  // IrcWindow context
  let className = e.target.className;
  var menu = new Menu();

  if (e.target.className === 'channel-name') {
    let leaveChannel = (function(channelName){
        function _leaveChannel() {
            self.leaveChannel(channelName);
        }
        return _leaveChannel;
    })(e.target.innerText);
    menu.append(new MenuItem({
        label: 'Leave Channel',
        click: leaveChannel
    }));
  }
  if (e.target.className === 'username') {
    let pmUser = (function(username){
        function _pmUser() {
            self.joinPrivateMessageChannel(username);
        }
        return _pmUser;
    })(e.target.innerText);
    menu.append(new MenuItem({
        label: 'Send Message',
        click: pmUser
    }));
  }

  menu.popup(remote.getCurrentWindow());
}




module.exports.createApplicationMenu = createApplicationMenu;
module.exports.createContextMenu = createContextMenu;