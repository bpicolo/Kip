import remote from 'remote';

import eventHandler from './event';

var Menu = remote.require('menu');
var MenuItem = remote.require('menu-item');


var channelContextMenu = [
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


export function createApplicationMenu() {
    Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenuTemplate));
}


export function createUserListContextMenu(username, joinPrivateMessageCallback) {
  var menu = new Menu();

  let pmUser = (function(){
      function _pmUser() {
          joinPrivateMessageCallback(username);
      }
      return _pmUser;
  })();
  menu.append(new MenuItem({
      label: 'Send Message',
      click: pmUser
  }));

  menu.popup(remote.getCurrentWindow());
}


export function createChannelListContextMenu(channelName, leaveChannelCallback) {
  var menu = new Menu();

  let leaveChannel = (function(){
    function _leaveChannel() {
      leaveChannelCallback(channelName);
    }
    return _leaveChannel;
  })();
  menu.append(new MenuItem({
      label: 'Leave Channel',
      click: leaveChannel
  }));

  menu.popup(remote.getCurrentWindow());
}


var channelContextMenu = Menu.buildFromTemplate(channelContextMenu);
export function showChannelContext(e) {
  channelContextMenu.popup(remote.getCurrentWindow());
}
