const electron = require("electron");
const app = electron.app;

const BrowserWindow = electron.BrowserWindow;

const path = require("path");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900
  });

  // mainWindow.loadURL(`file://${path.join(__dirname, "./dist/index.html")}`);
  mainWindow.loadURL('http://localhost:1234');
  mainWindow.on("closed", () => (mainWindow = null));
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});