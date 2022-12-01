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
	get List() { return this.#list; }
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
	#journal = [];#archive = [];
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
	get Journal() { return this.#journal; }
	get Archive() { return this.#archive; }
	get Dictionaries() { return this.#core.Dicts; }
	get Toolbox() { return this.#toolbox; }
	get Connector() { return this.#connector; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#name = data?.uid || "";
		this.#title = data?.title || "";
		this.#status = data?.status || 0;
		this.#baseName = data?.base || "";
		this.#operator = await this.#GetOperator(data?.operator);
		await this.#LoadJournals();
		// setTimeout( async ()=> await this.GetPeriod({delStatus: 0, baseName: "mega", jtype: "archive", search: "федор", creationMethod: 1, status: 4, store: 9999, start: "20090601", end: "20090610" }), 5000);
		//setTimeout( async ()=> await this.GetJRecord({jtype: "archive", id: 500}), 5000);
		// setTimeout( async ()=> { 
		// 	let res = await this.DeleteJRecord({jtype: "archive", id: 500});
		// 	if (res) console.log("запись удалена");
		// 	if (!res) console.log("запись не удалена");
		// }, 5000);
		// setTimeout( async ()=> await this.EditJRecord({jtype: "journal", id: 500}), 5000);
		setTimeout( async ()=> await JRecord.Create({status: 1, store: 1740, type: 1, jtype: 1, document: {
			FizDocType: 1,
			FizDocSeries: 8305,
			FizDocNumber: 866468,
			FizDocOrg: "ОУФМС РФ по КБР в Чегемском р-не",
			FizDocOrgCode: "000-000",
			Birth: "01.04.1985",
			DocDate: "26.04.2005",
			FizDocDate: "05.04.2005",
			FirstName: "Мыы",
			SecondName: "Яыыы",
			LastName: "Оввв"
		}}, this), 5000);
	}
	async #LoadJournals() {
		let journals = [{id: 1, name: "journal", storage: this.#journal}, {id: 2, name: "archive", storage: this.#archive}];
		for (let journal of journals) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM ${this.#baseName}
				WHERE jtype = '${journal.id}'
			`);
			for (let row of rows) journal.storage.push(new JRecord(row, this.#connector, this.#toolbox, this));
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
	async GetPeriod(data) {
		let jtypes = ["journal", "archive"];
		if (!data.jtype || jtypes.indexOf(data.jtype) == -1) return [];
		else {
			let journal = data.jtype == "journal" ? this.#journal : this.#archive;
			let period = [];
			let moment = this.#toolbox.Moment();
			let mstart = moment(data.start, "YYYYMMDD");
			let mend = moment(data.end, "YYYYMMDD");
			if (Object.entries(data).length > 0) {
				period = journal.filter(item=> 
						(data?.del && item.DelStatus == data.delStatus) &&
						(data?.status && item.Status == data.status || !data?.status && true) &&
						(data?.store && item.Store == data.store || !data?.store && true) &&
						(data?.creationMethod && item.CreationMethod == data.creationMethod || !data?.creationMethod && true) &&
						(data?.start && moment(item.JDocDate, "YYYYMMDD").isAfter(mstart) && data?.end && moment(item.JDocDate, "YYYYMMDD").isBefore(mend)) &&
						(data?.search && Object.entries(item.Document).find(item=> item[1].toString().toLowerCase().indexOf(data.search.toLowerCase()) != -1) || !data?.search && true) 
				);
			}
			return period;
		}
	}
	async GetJRecord(data) {
		let jtypes = ["journal", "archive"];
		let jrecord = {};
		if (jtypes.indexOf(data.jtype) != -1) {
			let journal = data.jtype == "journal" ? this.#journal : this.#archive;
			jrecord = journal.find(item=> item.Id == data.id);
		}
		return jrecord;
	}
	async DeleteJRecord(data) {
		let jtypes = ["journal", "archive"];
		if (jtypes.indexOf(data.jtype) != -1) {
			let journal = data.jtype == "journal" ? this.#journal : this.#archive;
			let jrecord = journal.find(item=> item.Id == data.id);
			return jrecord && await jrecord.Delete() || false;
		}
		return false;
	}
	async AddNewJRecord(data) {
		if (data.jtype != "journal") return false;
	}
	async EditJRecord(data) {
		if (data.jtype != "journal") return false;
		let jrecord = await this.GetJRecord({id: data.id, jtype: "journal"});
		return jrecord && await jrecord.Update({id: 500, data: "", status: 1, signature: ""});
	}
	async ValidateJRecordDocument(document) {
		let errs = [];
		// for (let )
	}
}

class JRecord {
	#id;#connector;#toolbox;#base;#creator;#store;#signature;#creationMethod;#status;#jDocDate;#delStatus;
	#document;#logs;#docDate;
	constructor(row, connector, toolbox, base) {
		this.#id = row.id;
		this.#creator = row.userId;
		this.#store = row.store;
		this.#signature = row.signature;
		this.#status = row.status;
		this.#creationMethod = row.type; //1-вручную
		this.#jDocDate = row.jdocdate;
		this.#delStatus = row.del;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#base = base;
		this.#Init(row);
	}
	get Id() { return this.#id; }
	get Creator() { return this.#creator; }
	get Store() { return this.#store; }
	get Status() { return this.#status; }
	get Signature() { return this.#signature; }
	get CreationMethod() { return this.#creationMethod; }
	get JDocDate() { return this.#jDocDate; }
	get DocDate() { return this.#docDate; }
	get Document() { return this.#document; }
	get Logs() { return this.#logs; }
	get DelStatus() { return this.#delStatus; }
	// get StoreRecord() { return this.#storeRecord; }// ссылка на документ-распределения на складе

	async #Init(row) {
		let data = row.data != "" ? JSON.parse(row.data.replace(/\\/gi, `/`)) : {};
		this.#document = data?.document || {};
		this.#logs = data?.logs || {};
	}
	async Delete() {
		let result = await this.#connector.Request("dexol", `
			UPDATE \`${this.#base.BaseName}\` SET del = '1' WHERE id = '${this.#id}'
		`);
		return result.changedRows == 1 && (this.#delStatus = 1) || false;
	}
	static async Create(row, base) {
		let errs = [];

		// проверка основных полей
		let dict = base.Dictionaries.List.find(item=> item.Name == "dexDocumentStatuses");
		!row?.status && errs.push("Не указан статус.") ||
		!dict.Data.find(item=> parseInt(item.uid) === parseInt(row.status) && parseInt(item.status) === 1) && errs.push(`Поле "Статус" не содержится в справочнике.`);

		dict = base.Dictionaries.List.find(item=> item.Name == "stores");
		!row.store && errs.push("Не указано отделение.") ||
		!dict.Data.find(item=> parseInt(item.dexUid) === parseInt(row.store) && parseInt(item.status) === 1) && errs.push(`Поле "Отделение" не содержится в справочнике.`);

		dict = base.Dictionaries.List.find(item=> item.Name == "dexCreationDocTypes");
		!row.type && errs.push("Не указано каким образом создан документ.") ||
		!dict.Data.find(item=> parseInt(item.id) === parseInt(row.type) && parseInt(item.status) === 1) && errs.push(`Поле "Метод создания" не содержится в справочнике.`);

		dict = base.Dictionaries.List.find(item=> item.Name == "dexJTypes");
		!row.jtype && errs.push("Не указан тип журнала.") ||
		row?.jtype == 2 && errs.push("Невозможно создать новый документ в архиве") ||
		!dict.Data.find(item=> parseInt(item.id) === parseInt(row.jtype) && parseInt(item.status) === 1) && errs.push(`Поле "Тип журнала" не содержится в справочнике.`);

		// проверка полей документа
		dict = base.Dictionaries.List.find(item=> item.Name == "identityDocuments");
		!row?.document?.FizDocType && errs.push("Не указан тип документа удостоверяющего личность.") ||
		!dict.Data.find(item=> parseInt(item.id) === parseInt(row.document.FizDocType) && parseInt(item.status) === 1) && errs.push(`Поле "Тип документа" не содержится в справочнике.`) ||
		(errs = errs.concat(await base.Toolbox.CheckPassport(row.document, base.Connector, {Birth: row.document.Birth})));

		let rxName = /^(([a-zA-Z' -]{2,80})|([а-яА-ЯЁё' -]{2,80}))$/u;
		!row?.document?.LastName && errs.push(`Поле "Фамилия" обязательно для заполнения.`) || !rxName.test(row.document.LastName) && errs.push(`Поле "Фамилия" не соответствует шаблону.`);
		!row?.document?.FirstName && errs.push(`Поле "Имя" обязательно для заполнения.`) || !rxName.test(row.document.FirstName) && errs.push(`Поле "Имя" не соответствует шаблону.`);
		row?.document?.SecondName && row.document.SecondName != "" && !rxName.test(row.document.SecondName) && errs.push(`Поле "Отчество" не соответствует шаблону.`);


		// console.log("==> ", dict.Data);

		console.log("errs=>", errs);

	}
	async Update(fields) {
		let errs = [];
		if (!fields.id) return false;
		let allowed = ["jtype", "store", "jdocdate", "date", "data", "status"];
		let allowedFields = Object.fromEntries(Object.entries(fields).filter(([key]) => allowed.indexOf(key) != -1));

		if (allowedFields?.data) {
			errs = errs.concat(await this.base.ValidateJRecordDocument(allowedFields.data));

			for (let key in allowedFields.data) {
				allowedFields.data = this.#toolbox.HtmlSpecialChars(allowedFields.data[key]);
			}
			allowedFields.data = JSON.stringify(allowedFields.data);
		}
		let updates = [];
		for (let key in allowedFields) updates.push(`${key} = '${allowedFields[key]}'`);
		let result = await this.#connector.Request("dexol", `
			UPDATE \`${this.#base.BaseName}\` 
			SET ${updates.join(",")}
			WHERE id = '${fields.id}'
		`);
		return result.changedRows == 1 || false;
	}
}


let testJRecord = {
	document: {
		"FirstName":"Мариям",
		"SecondName":"Якубовна",
		"LastName":"Ольмезова"
	},
	log: {}
}