var path = require('path');
var app = require('app');  // Module to control application life.
var BrowserWindow = require('browser-window');  // Module to create native browser window.

var Irc = require('./dist/irc');
var config = require('./dist/config');
// Report crashes to our server.
require('crash-reporter').start();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is GCed.
var mainWindow = null;
var ircClient = null;

// Quit when all windows are closed.
app.on('window-all-closed', function() {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform != 'darwin') {
    app.quit();
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', function() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 2000,
    height: 1500,
  });

  // and load the index.html of the app.
  mainWindow.openDevTools();
  if (config) {
    mainWindow.loadUrl(path.normalize('file://' + __dirname + '/dist/index.html'));
    mainWindow.webContents.on('did-finish-load', function() {
      ircClient = new Irc(mainWindow, config.irc);
    });
  }

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    ircClient.clientDisconnect();
    ircClient = null;
    mainWindow = null;
  });
});
