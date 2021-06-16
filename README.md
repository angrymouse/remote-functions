![RF.js  Logo](readme_b.svg)

# Remote Functions library

Simple, but yet powerful library built for easy communication between server and client

## Installation

```sh
# cd path/to/my/project (node.js backend)
npm i remote-functions
```

### Or using yarn:

```sh
# cd path/to/my/project (node.js yarn backend)
yarn add remote-functions
```

## Usage

### On server side

#### index.js

```js
let FManager = require("remote-functions");
let rf = new FManager();
let WebSocket = require("ws");
let wss = WebSocket.Server({ port: 8080 });

wss.on("connection", (socket) => {
    let { handleMessage, disconnected } = rf.connectClient(data=>socket.send(data));
    socket.on("close", disconnected);
    socket.on("message", handleMessage);
});

let crypto = require("crypto");
//module, that works only in node.js environment (database or etc, we used crypto only for example)
function getUUID(prefix, cb) {
    setInterval(() => {
        cb("hello!"); // we can even work with callbacks!
    }, 1000);
    // prefix used to show that we can pass any arguments to functions
    console.log(prefix);
    return prefix + "-" + crypto.randomUUID();
    // if function is asynchronous, don't worry, we can work with async functions!
}
rf.addFunc(getUUID);
// we need to register our function to use it

```

### On client side

#### index.html

```html
<!DOCTYPE html>
<html>
<head>
    <title>RF.js test</title>
</head>
<body>
    <script src="https://unpkg.com/remote-functions@latest/bundle/rf.js"></script>
    <script defer src="script.js"></script>
</body>
</html>
```

#### script.js

```js
(async () => {
    // All functions in RF.js is asynchronous by the nature, so we wrapped our code in async function to use awaits

    let ws = new WebSocket("ws://localhost:8080");
    let rf = new RF((data) => ws.send(data));
    ws.onmessage = (message) => rf.RFMessageReceived(message.data);
    await rf.prepare();

    let uuidFromServer = await rf.getUUID("myprefix", (text) => {
        console.log(text); //we can work with callbacks!
    });
    //MAGIC! Calling function on server!

    console.log(uuidFromServer);
    // myprefix-1234-5678-9012-3456
})();


```
