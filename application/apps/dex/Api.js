"use strict"
class Api {
	#HTTP_STATUSES;#connector;#core;
	constructor(...args) {
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#connector = this.#core.Connector;
	}
	#GetAppData(packet, users) {
		let user = users.find(item => item.Uid == packet.uid);
		let dicts = this.#core.Dicts.List;
		let data = {action: packet.data.action};
		let rpacket = new Packet({status: this.#HTTP_STATUSES.OK, data: data, hash: packet.hash});
		user.CloseConnection(rpacket.ToString());
	}
	Check(packet, users, response) {
		let allowed = [
			{name: "getAppData",           method: (...args) => { this.#GetAppData(...args) } },
			// {name: }
		];
		if (!allowed.find(item=> item.name == packet?.data?.action)) {
			let p = {status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {action: packet?.data?.action, errs: ["Action not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			response.end(new Packet({status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.data.action).method(packet, users, response);
		}
	}
}
module.exports = Api;


class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.apps.dex";
		this.#packet.subcom = "api";
		this.#packet.data = args?.data;
		this.#packet.status = args?.status;
		this.#packet.message = args?.message;
		this.#packet.hash = args?.hash;
	}
	set Hash(hash) { this.#packet.hash = hash; }
	GetPacket() { return this.#packet; }
	ToString() { return JSON.stringify(this.#packet); }
}