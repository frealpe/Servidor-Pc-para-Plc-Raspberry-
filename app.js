// const { append } = require("express/lib/response");
const Server = require("./lib/server");

require("dotenv").config();
 
const server = new Server();
server.listen();
