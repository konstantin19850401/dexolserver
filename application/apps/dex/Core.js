"use strict"
const Api = require("./Api");
const RulesMega = require("./RulesMega");
const RulesMts = require("./RulesMts");
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
	get Core() { return this.#core; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#name = data?.uid || "";
		this.#title = data?.title || "";
		this.#status = data?.status || 0;
		this.#baseName = data?.base || "";
		this.#operator = await this.#GetOperator(data?.operator);
		// await this.#LoadJournals();




		// setTimeout( async ()=> await this.GetPeriod({delStatus: 0, baseName: "mega", jtype: "archive", search: "федор", creationMethod: 1, status: 4, store: 9999, start: "20090601", end: "20090610" }), 5000);
		//setTimeout( async ()=> await this.GetJRecord({jtype: "archive", id: 500}), 5000);
		// setTimeout( async ()=> { 
		// 	let res = await this.DeleteJRecord({jtype: "archive", id: 500});
		// 	if (res) console.log("запись удалена");
		// 	if (!res) console.log("запись не удалена");
		// }, 5000);
		// setTimeout( async ()=> await this.EditJRecord({jtype: "journal", id: 500}), 5000);
		// setTimeout( async ()=> await JRecord.Create({status: 1, userId: "dex", store: 1740, type: 1, jtype: 1, signature: "6366363636366363", jdocdate: "20221205145033333", document: {
		// 	FizDocType: 1,
		// 	FizDocSeries: 8305,
		// 	FizDocNumber: 866468,
		// 	FizDocOrg: "ОУФМС РФ по КБР в Чегемском р-не",
		// 	FizDocOrgCode: "000-000",
		// 	Birth: "01.04.1985",
		// 	DocDate: "26.04.2005",
		// 	FizDocDate: "05.04.2005",
		// 	FirstName: "Мыы",
		// 	SecondName: "Яыыы",
		// 	LastName: "Оввв",
		// 	FizBirthPlace: "ывсывсыв",
		// 	Sex: "1",
		// 	Citizenship: "10",
		// 	AddrZip: "222249",
		// 	AddrCountry: "1",
		// 	AddrState: "4",
		// 	AddrCity: "sdc",
		// 	AddrPhone: "9999999999"
		// }}, this), 5000);


		setTimeout( ()=> { let converter = new Converter(this.#toolbox, this.#connector, this, RulesMts); }, 3000 );
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
	async LoadRecord(jurName, id) {
		let journals = [{id: 1, name: "journal", storage: this.#journal}, {id: 2, name: "archive", storage: this.#archive}];
		let journal = journals.find(item=> item.name == jurName);
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM ${this.#baseName}
			WHERE id = '${id}'
		`);
		if (rows.length == 1) journal.storage.push(new JRecord(rows[0], this.#connector, this.#toolbox, this));
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

		dict = base.Dictionaries.List.find(item=> item.Name == "dexCreationDocTypes");
		!row.type && errs.push("Не указано каким образом создан документ.") ||
		!dict.Data.find(item=> parseInt(item.id) === parseInt(row.type) && parseInt(item.status) === 1) && errs.push(`Поле "Метод создания" не содержится в справочнике.`);

		dict = base.Dictionaries.List.find(item=> item.Name == "dexJTypes");
		!row.jtype && errs.push("Не указан тип журнала.") ||
		row?.jtype == 2 && errs.push("Невозможно создать новый документ в архиве") ||
		!dict.Data.find(item=> parseInt(item.id) === parseInt(row.jtype) && parseInt(item.status) === 1) && errs.push(`Поле "Тип журнала" не содержится в справочнике.`);

		dict = base.Dictionaries.List.find(item=> item.Name == "stores");
		!row.store && errs.push("Не указано отделение.") ||
		!dict.Data.find(item=> parseInt(item.dexUid) === parseInt(row.store) && parseInt(item.status) === 1) && errs.push(`Поле "Отделение" не содержится в справочнике.`);

		// проверка полей документа
		if (errs.length == 0) {
			let store = dict.Data.find(item=> parseInt(item.dexUid) === parseInt(row.store));
			row.document.DocCity = store.dexDocCity || "";

			dict = base.Dictionaries.List.find(item=> item.Name == "identityDocuments");
			!row?.document?.FizDocType && errs.push("Не указан тип документа удостоверяющего личность.") ||
			!dict.Data.find(item=> parseInt(item.id) === parseInt(row.document.FizDocType) && parseInt(item.status) === 1) &&
			errs.push(`Поле "Тип документа" не содержится в справочнике.`) ||
			(errs = errs.concat(await base.Toolbox.CheckPassport(row.document, base.Connector, {Birth: row.document.Birth})));

			let rxName = /^(([a-zA-Z' -]{2,80})|([а-яА-ЯЁё' -]{2,80}))$/u;
			!row?.document?.LastName && errs.push(`Поле "Фамилия" обязательно для заполнения.`) ||
			!rxName.test(row.document.LastName) && errs.push(`Поле "Фамилия" не соответствует шаблону.`);
			!row?.document?.FirstName && errs.push(`Поле "Имя" обязательно для заполнения.`) ||
			!rxName.test(row.document.FirstName) && errs.push(`Поле "Имя" не соответствует шаблону.`);
			row?.document?.SecondName && row.document.SecondName != "" && !rxName.test(row.document.SecondName) && errs.push(`Поле "Отчество" не соответствует шаблону.`);

			let rxZip = /^\d{6}$/;
			!row?.document?.AddrZip && errs.push(`Поле "Индекс" обязательно для заполнения.`) ||
			!rxZip.test(row.document.AddrZip) && errs.push(`Поле "Индекс" не соответствует шаблону.`);

			let rxString = /^[A-ZА-ЯЁ]+$/i;
			!row?.document?.FizBirthPlace && errs.push(`Поле "Место рождения" обязательно для заполнения.`)||
			!rxString.test(row.document.FizBirthPlace)  && errs.push(`Поле "Место рождения" не соответствует шаблону.`);

			(!row?.document?.AddrCity || row.document.AddrCity == "") && errs.push(`Поле "Адрес регистрации-Населенный пункт" обязательно для пополнения.`);

			let rxPhone = /^\d{10}$/;
			!row?.document?.AddrPhone && errs.push(`Поле "Контактный телефон" обязательно для заполнения.`) ||
			!rxPhone.test(row.document.AddrPhone) && errs.push(`Поле "Контактный телефон" не соответствует шаблону.`);

			dict = base.Dictionaries.List.find(item=> item.Name == "countries");
			!row?.document?.Citizenship && errs.push(`Поле "Гражданство" обязательно для заполнения.`) ||
			!dict.Data.find(item=> item.id == parseInt(row.document.Citizenship)) && errs.push(`Поле "Гражданство" не содержится в справочнике.`);

			dict = base.Dictionaries.List.find(item=> item.Name == "sex");
			!row?.document?.Sex && errs.push(`Поле "Пол" обязательно для заполнения.`) ||
			!dict.Data.find(item=> item.id == parseInt(row.document.Sex)) && errs.push(`Поле "Пол" не содержится в справочнике.`);

			dict = base.Dictionaries.List.find(item=> item.Name == "regions");
			!row?.document?.AddrState && errs.push(`Поле "Субъект РФ" обязательно для заполнения.`) ||
			!dict.Data.find(item=> item.id == parseInt(row.document.AddrState)) && errs.push(`Поле "Адрес регистрации - Субъект РФ" не содержится в справочнике.`);

			dict = base.Dictionaries.List.find(item=> item.Name == "countries");
			!row?.document?.AddrCountry && errs.push(`Поле "Адрес регистрации - Страна" обязательно для заполнения.`) ||
			!dict.Data.find(item=> item.id == parseInt(row.document.AddrCountry)) && errs.push(`Поле "Адрес регистрации - Страна" не содержится в справочнике.`);

			dict = base.Dictionaries.List.find(item=> item.Name == "stores");
			row.document.Fs = dict.Data.find(item=> parseInt(item.dexUid) === parseInt(row.store))?.Fs || 2;

		}

		// if (errs.length == 0) {
		// 	let checkSim = [];
		// 	!row?.document?.sim && checkSim.push(`Не указаны параметры sim-карты`) ||
		// 	!row?.document?.sim?.docReceipt && checkSim.push(`Не указан документ поступления`) ||
		// 	!row?.document?.sim?.docRistribution && checkSim.push(`Не указан документ распределения`) ||
		// 	!row?.document?.sim?.MSISDN && checkSim.push("Не указан номер sim-карты") ||
		// 	!row?.document?.sim?.ICC && checkSim.push("Не указан серийный номер sim-карты");

		// 	if (checkSim.length == 0) {
		// 		let docReceipt = this.base.Core.Applications.find(item=> item.Name == "sklad").GetDocById(row.document.sim.docReceipt);
		// 		let docRistribution = this.base.Core.Applications.find(item=> item.Name == "sklad").GetDocById(row.document.sim.docRistribution);
		// 		!docReceipt && errs.push(`Указанный документ поступления не существует.`) ||
		// 		!docReceipt.Data.find(item=> item.MSISDN == row.document.sim.MSISDN && item.ICC == row.document.sim.ICC) errs.push("Документ поступления не содержит данные sim-карты.") ||
		// 		!docRistribution && errs.push(`Указанный документ распределения не существует.`) ||
		// 		!docRistribution.Data.find(item=> item.MSISDN == row.document.sim.MSISDN && item.ICC == row.document.sim.ICC) errs.push("Документ поступления не содержит данные sim-карты.");
		// 	} else errs = errs.concat(checkSim);
		// }

		if (errs.length == 0) {
			for (let key in row.document) {
				row.document[key] = base.Toolbox.HtmlSpecialChars(row.document[key]);
			}
			let result = await base.Connector.Request("dexol", `
				INSERT INTO \`${base.BaseName}\`
				SET userId = '${row.userId}', jtype = '1', store = '${row.store}', status = '${row.status}', signature = '${row.signature}', jdocdate = '${row.jdocdate}', data = '${JSON.stringify(row.document)}', type = '${row.type}', del = '0'
			`);
			if (!result || result.affectedRows != 1) errs.push("Ошибка в процессе добавления записи");
			else {
				await base.LoadRecord("journal", result.insertId);
			}
		}
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

class Converter {
	#toolbox;#connector;#base;#operator;#rules;
	constructor(toolbox, connector, base, rules) {
		this.#toolbox = toolbox;
		this.#connector = connector;
		this.#base = base;
		this.#operator = base.Operator;
		this.#rules = rules;
		if (this.#base.BaseName == "dex_mts_sts_062013") {
			this.#Init();
		}
		// this.#Init();
		// console.log("this.#base.Name=> ", this.#base.Name);
		// console.log("this.#base.Name=> ", this.#base.BaseName);
		// console.log("this.#operator=> ", this.#operator);
	}
	async #Init() {
		await this.#connector.Request("dexol", `
            CREATE TABLE IF NOT EXISTS ${this.#base.BaseName} (
                id INT(15) AUTO_INCREMENT NOT NULL,
                userId VARCHAR(32) NOT NULL,
                jtype TINYINT(1) NOT NULL,
                store INT(10) NOT NULL,
                status INT(2) NOT NULL,
                signature VARCHAR(25) NOT NULL,
                jdocdate VARCHAR(17) NOT NULL,
                data TEXT NOT NULL,
                type TINYINT(1) NOT NULL,
                del INT(2) NOT NULL DEFAULT 0,
                primary key (id)
            ) ENGINE = InnoDB
            PARTITION BY HASH(id) (
            	PARTITION p0 ENGINE=InnoDB,
				PARTITION p1 ENGINE=InnoDB,
				PARTITION p2 ENGINE=InnoDB,
				PARTITION p3 ENGINE=InnoDB,
				PARTITION p4 ENGINE=InnoDB,
				PARTITION p5 ENGINE=InnoDB,
				PARTITION p6 ENGINE=InnoDB,
				PARTITION p7 ENGINE=InnoDB,
				PARTITION p8 ENGINE=InnoDB,
				PARTITION p9 ENGINE=InnoDB
            )
        `);

		let jtypes = [{id: 2, name: "archive"}, {id: 1, name: "journal"}]
        // let jtypes = [{id: 2, name: "archive"}]
        // let jtypes = [{id: 1, name: "journal"}];
        for (let jtype of jtypes) {
            let cc = 0;
            let cnt = 0;let arr = [];
            // console.log("запрос типа ", jtype.name);
            console.log("получение данных и вставка ", jtype.name);
            let rows = await this.#connector.Request(this.#base.Name, `SELECT * FROM ${jtype.name}`);
             console.log("Данные получены");
            let date = this.#toolbox.Moment();
            let inserts = [];
            for (let row of rows) {
                let docType = 1;// 1 - вручную. 2 - автоматически автодоком, 3 - автоматически из выгрузки из удаленки оператора. Данные не полные. 4 - на основании другого документа
                // console.log(row.data);
                let temp = await this.#toolbox.XmlToString(row.data);
                let data = {document: {}};
                if (temp?.Document) {
                    data.document.DocCity = Array.isArray(temp.Document?.DocCity) ? temp.Document?.DocCity[0] : "";
                    data.document.DocNum = Array.isArray(temp.Document?.DocNum) ? temp.Document?.DocNum[0] : "";
                    data.document.DocDateJournal = Array.isArray(temp.Document?.DocDateJournal) ? temp.Document?.DocDateJournal[0] : "";
                    data.document.DocDate = Array.isArray(temp?.Document?.DocDate) ? temp?.Document?.DocDate[0] : "";
                    data.document.CodeWord = Array.isArray(temp.Document?.CodeWord) ? temp.Document?.CodeWord[0] : "";
                    data.document.MSISDN = Array.isArray(temp.Document?.MSISDN) ? temp.Document?.MSISDN[0] : "";
                    data.document.ICC = Array.isArray(temp.Document?.ICC) ? temp.Document?.ICC[0] : "";
                    data.document.ICCCTL = Array.isArray(temp.Document?.ICCCTL) ? temp.Document?.ICCCTL[0] : "";
                    data.document.FirstName = Array.isArray(temp.Document?.FirstName) ? temp.Document?.FirstName[0] : "";
                    data.document.SecondName = Array.isArray(temp.Document?.SecondName) ? temp.Document?.SecondName[0] : "";
                    data.document.LastName = Array.isArray(temp.Document?.LastName) ? temp.Document?.LastName[0] : "";
                    data.document.Birth = Array.isArray(temp.Document?.Birth) ? temp.Document?.Birth[0] : "";

                    data.document.FizDocNumber = Array.isArray(temp.Document?.FizDocNumber) ? temp.Document?.FizDocNumber[0] : "";
                    data.document.FizDocSeries = Array.isArray(temp.Document?.FizDocSeries) ? temp.Document?.FizDocSeries[0] : "";
                    data.document.FizDocOrgCode = Array.isArray(temp.Document?.FizDocOrgCode) ? temp.Document?.FizDocOrgCode[0] : "";
                    data.document.FizDocOrg = Array.isArray(temp.Document?.FizDocOrg) ? temp.Document?.FizDocOrg[0] : "";
                    data.document.FizDocDate = Array.isArray(temp.Document?.FizDocDate) ? temp.Document?.FizDocDate[0] : "";
                    data.document.FizBirthPlace = Array.isArray(temp.Document?.FizBirthPlace) ? temp.Document?.FizBirthPlace[0] : "";

                    data.document.AddrZip = Array.isArray(temp.Document?.AddrZip) ? temp.Document?.AddrZip[0] : "";
                    data.document.AddrStreet = Array.isArray(temp.Document?.AddrStreet) ? temp.Document?.AddrStreet[0] : "";
                    data.document.AddrHouse = Array.isArray(temp.Document?.AddrHouse) ? temp.Document?.AddrHouse[0] : "";
                    data.document.AddrBuilding = Array.isArray(temp.Document?.AddrBuilding) ? temp.Document?.AddrBuilding[0] : "";
                    data.document.AddrApartment = Array.isArray(temp.Document?.AddrApartment) ? temp.Document?.AddrApartment[0] : "";
                    if (data.document.AddrApartment == ".") data.document.AddrApartment = "";
                    data.document.AddrPhone = Array.isArray(temp.Document?.AddrPhone) ? temp.Document?.AddrPhone[0] : "";
                    data.document.AddrRegion = Array.isArray(temp.Document?.AddrRegion) ? temp.Document?.AddrRegion[0] : "";

                    data.document.ContactEmail = Array.isArray(temp.Document?.ContactEmail) ? temp.Document?.ContactEmail[0] : "";
                    data.document.FizInn = Array.isArray(temp.Document?.FizInn) ? temp.Document?.FizInn[0] : "";

                    data.document.DeliveryStreet = Array.isArray(temp.Document?.DeliveryStreet) ? temp.Document?.DeliveryStreet[0] : "";
                    data.document.DeliveryHouse = Array.isArray(temp.Document?.DeliveryHouse) ? temp.Document?.DeliveryHouse[0] : "";
                    data.document.DeliveryBuilding = Array.isArray(temp.Document?.DeliveryBuilding) ? temp.Document?.DeliveryBuilding[0] : "";
                    data.document.DeliveryApartment = Array.isArray(temp.Document?.DeliveryApartment) ? temp.Document?.DeliveryApartment[0] : "";
                    if (data.document.DeliveryApartment == ".") data.document.DeliveryApartment = "";
                    data.document.DeliveryZip = Array.isArray(temp.Document?.DeliveryZip) ? temp.Document?.DeliveryZip[0] : "";
                    data.document.DeliveryRegion = Array.isArray(temp.Document?.DeliveryRegion) ? temp.Document?.DeliveryRegion[0] : "";

                    if (this.#operator == "MTS") {
                    	data.document.AssignedDPCode = Array.isArray(temp.Document?.AssignedDPCode) ? temp.Document?.AssignedDPCode[0] : "";
                    	data.document.DPCodeKind = Array.isArray(temp.Document?.DPCodeKind) ? temp.Document?.DPCodeKind[0] : "";
                    }
                 

                    //категория оплаты
                    if (temp.Document?.DocCategory) {
                        if (this.#operator == "MEGAFON") data.document.DocCategory = RulesMega.DocCategory(parseInt(temp.Document?.DocCategory[0]));
                    }

                    // // пол
                    if (temp.Document?.Sex) {
                        data.document.Sex = this.#rules.Sex(parseInt(temp.Document?.Sex[0]));
                    }

                    // // профиль отправки
                    // if (temp.Document?.ProfileCode) {
                    //     if (this.#operator == "MEGAFON") data.document.ProfileCode = RulesMega.ProfileCode(temp.Document?.ProfileCode[0]);
                    //     if (data.document.ProfileCode == "" && Array.isArray(temp.Document?.ProfileCode) && temp.Document?.ProfileCode[0] != "") {
                    //         if (arr.indexOf(temp.Document.ProfileCode[0]) == -1) {
                    //             arr.push(temp.Document.ProfileCode[0]);
                    //             console.log(`"${temp.Document.ProfileCode[0].toLowerCase()}",`);
                    //             if (cc == 10) break;
                    //             else cc++;
                    //         }
                    //     }
                    // }

                    // // страна
                    if (temp.Document?.AddrCountry) {
                        data.document.AddrCountry = this.#rules.GetCountry(temp.Document?.AddrCountry[0]);
                        if (data.document.AddrCountry == "" && Array.isArray(temp.Document?.AddrCountry) && temp.Document?.AddrCountry[0] != "") {
                            console.log(`для >${temp.Document?.AddrState[0]}< нет значения страны. id = `, row.id);
                            if (cc == 5) break;
                            else cc++;
                        }
                    } else {
                    	data.document.AddrCountry = "";
                    }
                    // // страна доставки
                    // if (temp.Document?.DeliveryCountry) {
                    //     if (this.#operator == "MEGAFON") {
                    //         data.document.DeliveryCountry = RulesMega.GetCountry(temp.Document?.DeliveryCountry[0]);
                    //         if (data.document.DeliveryCountry == "" && Array.isArray(temp.Document?.DeliveryCountry) && temp.Document?.DeliveryCountry[0] != "") {
                    //             console.log(`для >${temp.Document?.DeliveryCountry[0]}< нет значения страны доставки. id = `, row.id);
                    //             if (cc == 5) break;
                    //             else cc++;
                    //         }
                    //     }
                    // }

                    // // тип абонента(резидент/нерезидент)
                    // if (temp.Document?.DocClientType) {
                        if (this.#operator == "MEGAFON") {
                            data.document.DocClientType = this.#rules.DocClientType(temp.Document?.DocClientType[0]);
                        } else if (this.#operator == "MTS") {
                        	try {
                        		data.document.DocClientType = temp.Document?.DocCategory ? this.#rules.DocClientType(temp.Document?.DocCategory[0]) : "";
                        	} catch(e) {
                        		console.log(row.id);
                        		console.log(e);
                        	}

                        }

                    // }

                    // регион
                    if (temp.Document?.AddrState) {
                        data.document.AddrState = this.#rules.AddrState(temp.Document?.AddrState[0]);
                        if (data.document.AddrState == "" && Array.isArray(temp.Document?.AddrState) && temp.Document?.AddrState[0] != "") {
                            if (arr.indexOf(temp.Document.AddrState[0]) == -1) {
                                arr.push(temp.Document.AddrState[0]);
                                console.log(`"${temp.Document.AddrState[0].toLowerCase()}",`);
                                if (cc == 40) break;
                                else cc++;
                            }

                        }
                    }
                    // регион доставки
                    // if (temp.Document?.DeliveryState) {
                    //     if (this.#operator == "MEGAFON") {
                    //         data.document.DeliveryState = RulesMega.AddrState(temp.Document?.DeliveryState[0]);
                    //         if (data.document.DeliveryState == "" && Array.isArray(temp.Document?.DeliveryState) && temp.Document?.DeliveryState[0] != "") {
                    //             if (arr.indexOf(temp.Document.DeliveryState[0]) == -1) {
                    //                 arr.push(temp.Document.DeliveryState[0]);
                    //                 console.log(`"${temp.Document.DeliveryState[0].toLowerCase()}",`);
                    //                 if (cc == 40) break;
                    //                 else cc++;
                    //             }

                    //         }
                    //     }
                    // }

                    // фирменный салон связи или нет
                    if (Array.isArray(temp.Document?.fs)) {
                        data.document.Fs = this.#rules.Fs(temp.Document.fs);
                    } else data.document.Fs = 2;


                    // //тип документа
                    if (this.#operator == "MEGAFON") {
                    	if (temp.Document?.gf && Array.isArray(temp.Document?.gf) && temp.Document?.gf[0] == "True") {
	                        try {
	                            data.document.FizDocType = this.#rules.FizDocTypeNew(parseInt(temp.Document?.FizDocType[0]));
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    } else {
	                        try {
	                            if (this.#toolbox.IsNumber(temp.Document?.FizDocType[0])) {
	                                data.document.FizDocType = this.#rules.FizDocTypeOld(parseInt(temp.Document?.FizDocType[0]));
	                            } else {
	                                data.document.FizDocType = this.#rules.FizDocTypeOldString(temp.Document?.FizDocType[0]);
	                            }
	                        } catch(e) {
	                            docType = 3;
	                        }
	                    }
                    } else if (this.#operator == "MTS") {
                    	if (temp.Document?.FizDocType && Array.isArray(temp.Document?.FizDocType)) {
                    		if (temp.Document?.FizDocType[0]?._) {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]?._));
	                    	} else {
	                    		data.document.FizDocType = this.#rules.FizDocType(parseInt(temp.Document?.FizDocType[0]));
	                    	}
                    	} else data.document.FizDocType = "";

                    }

                    if (data.document.FizDocType == "" && temp.Document?.FizDocType) {
                    	if (arr.indexOf(parseInt(temp.Document?.FizDocType[0]?._)) == -1) {
                    		arr.push(parseInt(temp.Document?.FizDocType[0]?._));
                    		console.log("Тип документа отсутствует для id = ", row.id, " ==> ", temp.Document?.FizDocType[0]?._);
                    		cc++
                    	}
                    }

					
					if (temp.Document?.FizDocCitizen && Array.isArray(temp.Document.FizDocCitizen)) {
						if (this.#operator == "MTS") {
							data.document.Citizenship = temp.Document?.FizDocCitizen[0]?.$?.tag ? this.#rules.GetCountry(temp.Document?.FizDocCitizen[0]?.$?.tag) : "";
							if (data.document.Citizenship == "") {
								if (arr.indexOf(temp.Document?.FizDocCitizen[0]?.$?.tag) == -1) {
	                                arr.push(temp.Document?.FizDocCitizen[0]?.$?.tag);
	                                console.log(`"${temp.Document?.FizDocCitizen[0]?.$?.tag}", `, temp.Document?.FizDocCitizen[0]?._, " id=>", row.id);
	                                // if (cc == 10) break;
	                                cc++;
	                            }
							}
						}	
					}                    


                    for (let key in data.document) data.document[key] = this.#toolbox.HtmlSpecialChars(data.document[key]);

                    // // console.log("data=> ", data.document);

                    // // если docType == 1, надо бы тогда с журналом разобраться
                    if (docType == 1) {
                        let logs = await this.#toolbox.XmlToString(row.journal);
                        if (logs && logs?.journal?.record && logs?.journal?.record[0]) {
                            if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.record && logs?.root?.record[0]) {
                        	if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.record[0]?.text && logs?.root?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else if (logs && logs?.root?.journal) {
                        	if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
                                docType = 2;
                            } else if (logs?.root?.journal?.record && logs?.root?.journal?.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
                                docType = 4;
                            }
                        } else { 
                        	if (!logs) {
                        		logs = {};
                        		docType = 2;
                        	} else {
                        		console.log(logs);
                        		console.log("для записи ", row.id, " журнал вполне возможно с ошибкой");
                        	}
                        }
                    }

                    let userId;
                    if (row.userid == "dex") userId = "";
                    else {
                        userId = this.#rules.UserId(row.userid);
                        if (userId == "") {
                        	// console.log(`нет userid для >${row.userid}< row.id=> `, row.id);
                        	cc++;
                        }
                    }
                    if (cc == 40) break;

                    let time = date(row.signature, "YYYYMMDDhhmmssSSS").format("YYYY-MM-DD hh:mm:ss.SSS");
                    // await this.#connector.Request("dexol", `
                    //     INSERT INTO dex_${this.#name}
                    //     SET userId = '${userId}', jtype = '${jtype.id}', store = '${row.unitid}', status = '${row.status}', signature = '${row.signature}', jdocdate = '${row.jdocdate}', data = '${JSON.stringify(data)}', date = '${time}', type = '${docType}'
                    // `);
                    // break;
                    // this.#journal.set(row.id, data);
                    //
                    //

                    let value = `('${userId}','${jtype.id}','${row.unitid}','${row.status}','${row.signature}','${row.jdocdate}','${JSON.stringify(data)}','${docType}')`;
                    inserts.push(value);


                    if (inserts.length == 100 || cnt == rows.length - 1) {
                        if (inserts.length > 0) {
                            let result = await this.#connector.Request("dexol", `
                                INSERT INTO ${this.#base.BaseName} (userId, jtype, store, status, signature, jdocdate, data, type)
                                VALUES ${inserts.join(",")}
                            `);
                            // console.log(result);
                            if (inserts.length != result.affectedRows) console.log("не соответствует");
                            inserts = [];
                        }
                    }
                } else console.log("нет значения");
                // break;


                cnt++;
            }
            console.log("вставка окончена. Обработано ", cnt, " записей");
        }
	}
}