"use strict"
class Apps {
	#list = [];#HTTP_STATUSES;
	#core;
	constructor(...args) {
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
	}
	#List(packet, users, response) {
		let user = users.find(item => item.Uid == packet.uid);
		if (user) {
			let data = {list: user.AppsList};
			let rpacket = new Packet({subcom: "list", status: this.#HTTP_STATUSES.OK, hash: packet.hash, data: data});
			user.CloseConnection(rpacket.ToString());
		}
	}
	#Select(packet, users, response) {
		let user = users.find(item => item.Uid == packet.uid);
		if (user) {
			let data = {appid: packet?.data?.appid};
			let status = this.#HTTP_STATUSES.FORBIDDEN;
			if (user.RunApp(packet?.data?.appid)) {
				status = this.#HTTP_STATUSES.OK;
			} else {
				data.errs = ["Application launch failed"];
			}
			let rpacket = new Packet({subcom: "select", status: status, hash: packet.hash, data: data});
			user.CloseConnection(rpacket.ToString());
		}
	}

	get Core() { return this.#core; }
	AddApp(app) { this.#list.push(app); }
	GetApp(app) { return this.#list.find(item=> item.Name == app); }
	Check(packet, users, response) {
		let allowed = [
			{ name: "list", 		method: (...args) => { this.#List(...args) } },
			{ name: "select", 		method: (...args) => { this.#Select(...args) } },
		]
		if (!allowed.find(item=> item.name == packet.subcom)) {
			let p = {subcom: packet.subcom, status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {errs: ["Method not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			packet.subcom != "initsession" && response.end(new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.subcom).method(packet, users, response);
		}
	}
}
module.exports = Apps;


class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.core.apps";
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