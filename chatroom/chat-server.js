// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
 
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	//var filename = path.join(__dirname, "static", url.parse(req.url).pathname);
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
 
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// setup some variables
//var curRoom = "lobby";
//var curAdmin ="";
var userlist = [];
var roomlist = ["lobby"];
var roominfo = {};
var userinfo = {};

function ROOM(name) {
    this.name = name;
	this.admin="";
	this.users = [];
	this.ban = [];
	this. havepass = false;
	this.password="";
}

function USER(name,room,id) {
    this.name = name;
	this.curroom = room;
	this.id = id;
	this.adminroom = [];
}

roominfo["lobby"] = new ROOM("lobby");


// Do the Socket.IO magic:
var io = socketio.listen(app);
io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
 
	function updateuserlist(roomname) {
		//userlist.push(socket.nickname);
		updateroomlist();
		console.log("in updateuserlist, room="+roomname+"; users="+roominfo[roomname].users);
		io.sockets.to(roomname).emit('showusers', {room:roomname});
	}
	
	function updateroomlist() {
		io.sockets.emit('showrooms', {roomlist: roomlist, roominfo:roominfo, alluserlist: userlist});
    }
	
//	updateroomlist();
	
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		
		console.log("message: "+data.message +", from"+socket.nickname); // log it to the Node.JS output
//		console.log(socket.nickname);
		
		var curroom = userinfo[socket.nickname].curroom;
		io.sockets.in(curroom).emit("message_to_client",{message:data.message, from: socket.nickname, pub:true}); // broadcast the message to other users
	});
	
	socket.on('image', function(data){
		var curroom = userinfo[socket.nickname].curroom;
		var pub = data.pub;
		console.log("curroom is "+curroom+"; pub="+pub);
		io.sockets.in(curroom).emit("sendimg", {pub:pub});
	});
	
	socket.on("sendPriMsg", function(data){
		var fromroom = userinfo[socket.nickname].curroom;
		var users = roominfo[fromroom].users;
		var admin = roominfo[fromroom].admin;
		console.log("From: " + socket.nickname + " in room: " + fromroom + " to: "+data.sendto);
		if (!users.includes(data.sendto) && data.sendto !== admin ) {
            //var callback = false;
			var from = "NOTICE";
			var message = data.sendto + " is not in this room...";
			io.sockets.to(userinfo[socket.nickname].id).emit("message_to_client", {message:message, from:from, pub:false});
        }else if(fromroom!=="lobby"){
			if (data.sendto === admin && userinfo[admin].curroom !== fromroom){
				var fromother = socket.nickname + "("+fromroom+")";
				io.sockets.to(userinfo[data.sendto].id).emit("message_to_client", {message:data.message, from:fromother, pub:false});
				if (socket.nickname !== data.sendto) {
					io.sockets.to(userinfo[socket.nickname].id).emit("message_to_client", {message:data.message, from:fromother, pub:false});
				}
			}else{
				io.sockets.to(userinfo[data.sendto].id).emit("message_to_client", {message:data.message, from:socket.nickname, pub:false});
				if (socket.nickname !== data.sendto) {
					io.sockets.to(userinfo[socket.nickname].id).emit("message_to_client", {message:data.message, from:socket.nickname, pub:false});
				}
			}
		}else{
			io.sockets.to(userinfo[data.sendto].id).emit("message_to_client", {message:data.message, from:socket.nickname, pub:false});
			if (socket.nickname !== data.sendto) {
				io.sockets.to(userinfo[socket.nickname].id).emit("message_to_client", {message:data.message, from:socket.nickname, pub:false});
            }
		}
	});
	
	//login
	socket.on('login', function(data, callback){
		var nickname = data.message;
		console.log("we on login and the nickname is "+nickname);
		//window.alert("we on login and the nickname is "+nickname);
		if(userlist.includes(nickname)) {
			callback(false);
		}else{
			callback(true);
			socket.nickname = nickname;
			userlist.push(socket.nickname);
			userinfo[nickname] = new USER(nickname, "lobby",socket.id);
			socket.join("lobby");
			roominfo["lobby"].users.push(socket.nickname);
			console.log("username="+nickname+"; user id ="+socket.id);
			updateuserlist(userinfo[socket.nickname].curroom);
			
//			io.sockets.emit('showusers', userlist);
		}		
	});
	
	// create new room
	socket.on('newroom', function(data, callback){
		var roomname = data.name;
		if (roomlist.includes(roomname)) {
            callback(false);
//			name = roomname;
        }else if (data.havepsw) {
            var roompsw = data.password;
			callback(true);
//			name = "private room: "+roomname;
			roomlist.push(roomname);
			roominfo[roomname] = new ROOM(roomname);
			roominfo[roomname].admin = socket.nickname;
//			roominfo[roomname].users.push(socket.nickname);
			roominfo[roomname].havepass = true;
			roominfo[roomname].password = roompsw;
			userinfo[socket.nickname].adminroom.push(roomname);
			console.log("room.name: "+ roominfo[roomname].name + "; room.admin: " + roominfo[roomname].admin + "; room.users: " + roominfo[roomname].users + "; room.password: " + roominfo[roomname].password + "; user's rooms: "+ userinfo[socket.nickname].adminroom );
			updateroomlist();
        }else{
			callback(true);
			roomlist.push(roomname);
//			name= "public room: "+roomname;
			roominfo[roomname] = new ROOM(roomname);
			roominfo[roomname].admin = socket.nickname;
//			roominfo[roomname].users.push(socket.nickname);
			userinfo[socket.nickname].adminroom.push(roomname);
			console.log("room.name: "+ roominfo[roomname].name + "; room.admin: " + roominfo[roomname].admin + "; room.users: " + roominfo[roomname].users + "; user's rooms: "+ userinfo[socket.nickname].adminroom );

			updateroomlist();
		}
	});
	
	// request go to a new room
	socket.on('enroom', function(data, callback){
		var toroom = data.room;
		if (roominfo[toroom].havepass && data.pass){
			var pass = data.pass;
			if (pass.localeCompare(roominfo[toroom].password) === 0) {
                callback(true);
				// leave old room
				var oldroom = userinfo[socket.nickname].curroom;
				var olduserlist = roominfo[oldroom].users;
				socket.leave(oldroom);
				if (roominfo[oldroom].admin !== socket.nickname) {
                    olduserlist.splice(olduserlist.indexOf(socket.nickname),1);
					console.log(socket.nickname+" now leave "+ oldroom+", updated userlist is: "+ olduserlist);
				
					updateuserlist(oldroom);
                }
				
				
				// enter new room
				socket.join(toroom);
				
				if (roominfo[toroom].admin !== socket.nickname) {
					roominfo[toroom].users.push(socket.nickname);  
                }
				userinfo[socket.nickname].curroom = toroom;
				
				updateuserlist(toroom);			
            }else{
				callback(false);
			}
        }else{
			var poldroom = userinfo[socket.nickname].curroom;
			var polduserlist = roominfo[poldroom].users;
			socket.leave(poldroom);
			if (roominfo[poldroom].admin !== socket.nickname) {
                polduserlist.splice(polduserlist.indexOf(socket.nickname),1);
				console.log(socket.nickname+" now leave "+ poldroom +", updated userlist is: "+ polduserlist);
				updateuserlist(poldroom);
            }
//			updateuserlist(poldroom);
			
			// enter new room
			socket.join(toroom);
			if (roominfo[toroom].admin !== socket.nickname) {
				roominfo[toroom].users.push(socket.nickname);  
            }
			userinfo[socket.nickname].curroom = toroom;
			updateuserlist(toroom);
		}
	});

	socket.on('kickoff', function(data, callback){
		var kickwho = String(data.kickwho);
		var curroom = userinfo[socket.nickname].curroom;
		var users = roominfo[curroom].users;
		if (roominfo[curroom].admin !== socket.nickname) {
            callback(false);
//			console.log("You are not this admin");
        }else if(!users.includes(kickwho)){
			callback(false);
//			console.log("type of users = "+typeof(users[0])+"; type of kickwho = "+typeof(kickwho)+"; what is "+users.includes(kickwho));
		}else{
			
//			users.splice(users.indexOf(kickwho), 1);
			console.log("kicked user = "+ kickwho +"; curroom= "+curroom+"; now users in this room="+users);
//			updateuserlist(curroom);
			// for someon who has been kicked off, should be moved to lobby.
			var msg = "You have been kicked off from " + curroom;
			var from = "NOTICE";
			io.sockets.to(userinfo[kickwho].id).emit("message_to_client", {message:msg, from:from, pub:false});
			io.sockets.to(userinfo[kickwho].id).emit("bekicked");
//			console.log("kicked user = "+ kickwho +"; the id= "+userinfo[kickwho].id+"; now users in this room="+users);
			callback(true);
			console.log("kick off success");
		}
		
	});
	
	socket.on('ban', function(data,callback){
		var banwho = String(data.banwho);
		var curroom = userinfo[socket.nickname].curroom;
		var users = roominfo[curroom].users;
		var banlist = roominfo[curroom].ban;
		if (roominfo[curroom].admin !== socket.nickname) {
            callback(false);
//			console.log("You are not this admin");
        }else if(!users.includes(banwho)){
			callback(false);
//			console.log("type of users = "+typeof(users[0])+"; type of kickwho = "+typeof(kickwho)+"; what is "+users.includes(kickwho));
		}else{
			
//			users.splice(users.indexOf(banwho), 1);
			banlist.push(banwho);
//			updateuserlist(curroom);
			// for someon who has been kicked off, should be moved to lobby.
			var msg = "You have been baned from " + curroom;
			var from = "NOTICE";
			io.sockets.to(userinfo[banwho].id).emit("message_to_client", {message:msg, from:from, pub:false});
			io.sockets.to(userinfo[banwho].id).emit("bekicked");
//			console.log("lobby users = "+ roominfo["lobby"].users);
			callback(true);
			console.log("ban success");
		}
	});
	
	socket.on('unban', function(data, callback){
		var unbanwho = String(data.unbanwho);
		var curroom = userinfo[socket.nickname].curroom;
//		var users = roominfo[curroom].users;
		var banlist = roominfo[curroom].ban;
		if (roominfo[curroom].admin !== socket.nickname) {
            callback(false);
//			console.log("You are not this admin");
        }else if(!banlist.includes(unbanwho)){
			callback(false);
//			console.log("type of users = "+typeof(users[0])+"; type of kickwho = "+typeof(kickwho)+"; what is "+users.includes(kickwho));
		}else{
			banlist.splice(banlist.indexOf(unbanwho), 1);
			updateuserlist(curroom);
			var from = "NOTICE";
			var msg = "You are no longer baned from "+curroom;
			io.sockets.to(userinfo[unbanwho].id).emit("message_to_client", {message:msg, from:from, pub:false});
			callback(true);
		}
	});
	
	socket.on('invite', function(data, callback){
		var askwho = String(data.askwho);
		var curroom = userinfo[socket.nickname].curroom;
		if (roominfo[curroom].admin !== socket.nickname) {
            callback(false);
//			console.log("You are not this admin");
        }else{
			callback(true);
			io.sockets.to(userinfo[askwho].id).emit("beinvited", {room:curroom, pub:roominfo[curroom].havepass});
		}
	});
	
	// disconnect
	socket.on('disconnect', function(){
//		if(!socket.nichname) return;r
	
	if (userlist.includes(socket.nickname)) {
		console.log(socket.nickname+" is in disconnect");
        userlist.splice(userlist.indexOf(socket.nickname),1);
		var curroom = userinfo[socket.nickname].curroom;
		var curuserlist = roominfo[curroom].users;
		
		if (roominfo[curroom].admin !== socket.nickname) {
            curuserlist.splice(curuserlist.indexOf(socket.nickname),1);
			updateuserlist(curroom);
        }
		
		// adminroom
		var adminroom = userinfo[socket.nickname].adminroom;
		
		if (adminroom.length !== 0) {
			console.log("this user has admin room");
            adminroom.forEach(function(element){
				console.log("the element is "+ element);
				var users = roominfo[element].users;
				if (users.length !== 0) {
					var newadmin = users[0];
                    roominfo[element].admin = newadmin;
					users.splice(users.indexOf(newadmin), 1);
					userinfo[newadmin].adminroom.push(element);

					updateuserlist(element);
					var message = "New admin for this room is " + newadmin;
					var from = "NOTICE";
					io.sockets.in(element).emit("message_to_client",{message:message, from: from});
//					updateuserlist(element);
                }else{
					console.log("should destroy room here");
					delete roominfo.element;
					roomlist.splice(roomlist.indexOf(element), 1);
					console.log("roominfo: "+roominfo+"; roomlist: "+roomlist+"; element: "+element);
					updateroomlist();
				}
			});
        }
		var deleteuser = socket.nickname;
		delete userinfo.deleteuser;
    }
		
		
//		io.sockets.emit('showusers', userlist);		
	});
});


