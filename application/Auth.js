"use strict"
const CONNECTOR_NAME = "mysql";
const User = require("./User");
class Auth {
	#connector;#HTTP_STATUSES;#toolbox;#collector;
	constructor(connector, HTTP_STATUSES, toolbox) {
		this.#connector = connector;
		this.#HTTP_STATUSES = HTTP_STATUSES;
		this.#toolbox = toolbox;
	}
	static get ConnectorName() { return CONNECTOR_NAME; }

	async #InitSession(packet, users, response) {
		let obj = {};
		if (packet?.data?.login && packet?.data?.password) {
			let rpacket;
			let rows = await this.#connector.Request("dexol", `
				SELECT users.username, users.data, users.group, users.status
                FROM \`users\`
                LEFT JOIN \`groups\` AS g ON users.group = g.uid
                WHERE users.username = '${packet.data.login}' AND users.password = '${packet.data.password}'
			`);

			if (rows.length == 1) {
				let user = new User(rows[0], this.#toolbox);
				if (user.Status == 0) {
					let errs = [`User ${user.Username} inactive`];
					rpacket = new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.LOCKED, data: {errs: errs}});
				} else if (user.Status == 2) {
					let errs = [`User ${user.Username} locked`];
					rpacket = new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.LOCKED, data: {errs: errs}});
				} else {
					users.push(user);
					let data = {uid: user.Uid, apps: user.AppsList, message: `Welcome, ${user.FSName}`};
					rpacket = new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.OK, data: data, hash: packet?.hash});
				}
				response.end(rpacket.ToString());
			} else {
				let errs = ["Wrong login and/or password"];
				rpacket = new Packet({subcom: "initsession", status: this.#HTTP_STATUSES.UNAUTHORIZED, data: {errs: errs}, hash: packet?.hash})
				response.end(rpacket.ToString());
			}
		}
	}
	async #Killsession(packet, users, response) {
		let index = users.findIndex(item => item.Uid == packet.uid);
		if (index != -1) {
			let user = users.find(item => item.Uid == packet.uid);
			let data = {message: "User logged out"};
			let rpacket = new Packet({subcom: "Killsession", status: this.#HTTP_STATUSES.CLIENT_CLOSED_REQUEST, hash: packet.hash, data: data});
			user.CloseConnection(rpacket.ToString());
			users.splice(index, 1);
		}
	}
	async #Locksession(packet, users, response) {
		let user = users.find(item => item.Uid == packet.uid);
		if (user) {
			user.Lock();
			let data = {message: "Session is lock"};
			let rpacket = new Packet({subcom: "locksession", status: this.#HTTP_STATUSES.OK, hash: packet.hash, data: data});
			user.CloseConnection(rpacket.ToString());
		}
	}
	async #UnLockSession(packet, users, response) {
		let user = users.find(item => item.Uid == packet.uid);
		if (user) {
			user.UnLock();
			let data = {message: "Session is unlock"};
			let rpacket = new Packet({subcom: "unlocksession", status: this.#HTTP_STATUSES.OK, hash: packet.hash, data: data});
			user.CloseConnection(rpacket.ToString());
		}
	}
	async Check(packet, users, response) {
		let allowed = [
			{ name: "initsession", 		method: (...args) => { this.#InitSession(...args) } },
			{ name: "killsession", 		method: (...args) => { this.#Killsession(...args) } },
			{ name: "locksession",	 	method: (...args) => { this.#Locksession(...args) } },
			{ name: "unlocksession", 	method: (...args) => { this.#UnLockSession(...args) } },
		]
		if (!allowed.find(item=> item.name == packet.subcom)) {
			response.end(new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {errs: ["Method not allowed"]}}).ToString());
		} else {
			packet.subcom != "initsession" && response.end(new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.subcom).method(packet, users, response);
		}
	}
}
module.exports = Auth;

class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.core.auth";
		this.#packet.subcom = args?.subcom;
		this.#packet.data = args?.data;
		this.#packet.status = args?.status;
		this.#packet.message = args?.message;
		this.#packet.hash = args?.hash;
	}
	set Hash(hash) { this.#packet.hash = hash; }
	GetPacket() { return this.#packet; }
	ToString() { return JSON.stringify(this.#packet); }
}