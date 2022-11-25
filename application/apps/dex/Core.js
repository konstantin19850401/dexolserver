"use strict"
const Api = require("./Api");
class Core {
	#name = "dex";#api;#core;#HTTP_STATUSES;#connector;#toolbox;
	#list = [];
	constructor(...args) {
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#connector = this.#core.Connector;
		this.#toolbox = this.#core.Toolbox;
		this.#api = new Api(this.#core);
		this.#Init();
	}
	get Name() { return this.#name; }
	async #Init() {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM dicts_data
			WHERE dict = 'bases' AND del = '0'
		`);
		for (let row of rows) {
			this.#list.push(new Base(row, this.#connector, this.#core));
		}
	}
	Check(packet, users, response) {
		let allowed = [
			{name: "api",           method: (...args) => { this.#api.Check(...args) } }
		];
		if (!allowed.find(item=> item.name == packet.subcom)) {
			let p = {subcom: packet.subcom, status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {errs: ["Method not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			if (packet.subcom != "api") response.end(new Packet({subcom: packet.subcom, status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.subcom).method(packet, users, response);
		}
	}
}
module.exports = Core;

class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.apps.dex";
		this.#packet.subcom = args?.subcom;
		this.#packet.data = args?.data;
		this.#packet.status = args?.status;
		this.#packet.message = args?.message;
		this.#packet.hash = args?.hash;
	}
}


class Base {
	#connector;#toolbox;#core;
	#name;#operator;#title;#status;#baseName;
	#journal = new Map();#archive = new Map();

	// #name;#title;#status;#operator;
	// #journal = new Map();#archive = new Map();#tp = [];#profiles = [];
	// #units = [];#registers = [];
	constructor(row, connector, core) {
		this.#connector = connector;
		this.#core = core;
		this.#toolbox = core.Toolbox;
		this.#Init(row);
	}
	get Name() { return this.#name; }
	get BaseName() { return this.#baseName; }
	get Title() { return this.#title; }
	get Status() { return this.#status; }
	get Operator() { return this.#operator; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#name = data?.uid || "";
		this.#title = data?.title || "";
		this.#status = data?.status || 0;
		this.#baseName = data?.base || "";
		this.#operator = await this.#GetOperator(data?.operator);
		await this.#LoadJournals();
	}

	Period(typeJournal, start, end, filter) {

	}

	async #LoadJournals() {
		let journals = [{id: 1, name: "journal", storage: this.#journal}, {id: 2, name: "archive", storage: this.#archive}];
		for (let journal of journals) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM ${this.#baseName}
				WHERE jtype = '${journal.id}' AND del = '0'
			`);
			for (let row of rows) journal.storage.set(row.id, new JRecord(row, this.#connector, this.#toolbox));
		}
	}
	async #GetOperator(id) {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM dicts_data WHERE dict = 'operators'
		`);
		for (let row of rows) {
			if (row.id_record == id) {
				let data = JSON.parse(row.data);
				return data.uid;
			}
		}
		return;
	}
}

class JRecord {
	#id;#connector;#toolbox;#creator;#store;#signature;#creationMethod;
	#document;#logs;#jDocDate;#docDate;
	constructor(row, connector, toolbox) {
		this.#id = row.id;
		this.#creator = row.userId;
		this.#store = row.store;
		this.#signature = row.signature;
		this.#creationMethod = row.type; //1-вручную
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#Init(row);
	}
	get Id() { return this.#id; }
	get Creator() { return this.#creator; }
	get Store() { return this.#store; }
	get Signature() { return this.#signature; }
	get CreationMethod() { return this.#creationMethod; }
	get JDocDate() { return this.#jDocDate; }
	get DocDate() { return this.#docDate; }
	get Document() { return this.#document; }
	get Logs() { return this.#logs; }
	// get StoreRecord() { return this.#storeRecord; }// ссылка на документ-распределения на складе

	async #Init(row) {
		let data = JSON.parse(row.data.replace(/\\/gi, `/`));
		this.#document = data?.document || {};
		this.#logs = data?.logs || {};
	}
}