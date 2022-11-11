"use strict"
const Api = require("./Api");
const RulesMega = require("./RulesMega");
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
	async #Init() {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM dicts_data
			WHERE dict = 'bases'
		`);
		for (let row of rows) {
			if (row.id_record == 2 ) {
				this.#list.push(new Base(row, this.#connector, this.#core));
				break;
			}
			// break;
		}
		// setTimeout(()=> {
		// 	for (let item of this.#list) console.log(item.Name, " ", item.Title, " ", item.Status, "  ", item.Operator);
		// }, 1000);
	}
	get Name() { return this.#name; }

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
	#name;#title;#status;#connector;#toolbox;#operator;#core;
	#journal = new Map();#archive = new Map();#tp = [];#profiles = [];
	#units = [];#registers = [];
	constructor(row, connector, core) {
		this.#connector = connector;
		this.#core = core;
		this.#toolbox = core.Toolbox;


		this.#Init(row);
	}
	get Name() { return this.#name; }
	get Title() { return this.#title; }
	get Status() { return this.#status; }
	get Operator() { return this.#operator; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#name = data?.uid || "";
		this.#title = data?.title || "";
		this.#status = data?.status || 0;
		this.#operator = await this.#GetOperator(data?.operator);
		setTimeout(()=> this.#ConvertBase(), 5000);
	}
	async #ConvertBase() {
		await this.#connector.Request("dexol", `
			CREATE TABLE IF NOT EXISTS dex_${this.#name} (
				id INT(15) AUTO_INCREMENT NOT NULL,
				userId VARCHAR(32) NOT NULL,
				jtype TINYINT(1) NOT NULL,
				store INT(10) NOT NULL,
				status INT(2) NOT NULL,
				signature VARCHAR(25) NOT NULL,
				jdocdate VARCHAR(17) NOT NULL,
				date TIMESTAMP NOT NULL,
				data TEXT NOT NULL,
				type TINYINT(1) NOT NULL,
				del INT(2) NOT NULL DEFAULT 0,
				primary key (id)
			)
		`)

		let jtypes = [{id: 2, name: "archive"}, {id: 1, name: "journal"}]
		// let jtypes = [{id: 2, name: "archive"}]
		// let jtypes = [{id: 1, name: "journal"}]

		for (let jtype of jtypes) {
			let cc = 0;

			let cnt = 0;let arr = [];
			let rows = await this.#connector.Request("dexol", `SELECT * FROM ${jtype.name}`);
			console.log("получение данных и вставка ");
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

					//категория оплаты
					if (temp.Document?.DocCategory) {
						if (this.#operator == "MEGAFON") data.document.DocCategory = RulesMega.DocCategory(parseInt(temp.Document?.DocCategory[0]));
					}

					// пол
					if (temp.Document?.Sex) {
						if (this.#operator == "MEGAFON") data.document.Sex = RulesMega.Sex(parseInt(temp.Document?.Sex[0]));
					}

					// профиль отправки
					if (temp.Document?.ProfileCode) {
						if (this.#operator == "MEGAFON") data.document.ProfileCode = RulesMega.ProfileCode(temp.Document?.ProfileCode[0]);
						if (data.document.ProfileCode == "" && Array.isArray(temp.Document?.ProfileCode) && temp.Document?.ProfileCode[0] != "") {
							if (arr.indexOf(temp.Document.ProfileCode[0]) == -1) {
								arr.push(temp.Document.ProfileCode[0]);
								console.log(`"${temp.Document.ProfileCode[0].toLowerCase()}",`);
								if (cc == 10) break;
								else cc++;
							}
						}
					}

					// страна
					if (temp.Document?.AddrCountry) {
						if (this.#operator == "MEGAFON") {
							data.document.AddCountry = RulesMega.GetCountry(temp.Document?.AddrCountry[0]);
							if (data.document.AddrCountry == "" && Array.isArray(temp.Document?.AddrCountry) && temp.Document?.AddrCountry[0] != "") {
								console.log(`для >${temp.Document?.AddrState[0]}< нет значения страны. id = `, row.id);
								if (cc == 5) break;
								else cc++;
							}
						}
					}
					// страна доставки
					if (temp.Document?.DeliveryCountry) {
						if (this.#operator == "MEGAFON") {
							data.document.DeliveryCountry = RulesMega.GetCountry(temp.Document?.DeliveryCountry[0]);
							if (data.document.DeliveryCountry == "" && Array.isArray(temp.Document?.DeliveryCountry) && temp.Document?.DeliveryCountry[0] != "") {
								console.log(`для >${temp.Document?.DeliveryCountry[0]}< нет значения страны доставки. id = `, row.id);
								if (cc == 5) break;
								else cc++;
							}
						}
					}

					// тип абонента(резидент/нерезидент)
					if (temp.Document?.DocClientType) {
						if (this.#operator == "MEGAFON") {
							data.document.DocClientType = RulesMega.DocClientType(temp.Document?.DocClientType[0]);
							if (data.document.DocClientType == "" && Array.isArray(temp.Document?.DocClientType) && temp.Document?.DocClientType[0] != "") {
								console.log(`для >${temp.Document?.DocClientType[0]}< нет значения категории абонента. id = `, row.id);
								if (cc == 5) break;
								else cc++;
							}
						}
					}

					// регион
					if (temp.Document?.AddrState) {
						if (this.#operator == "MEGAFON") {
							data.document.AddrState = RulesMega.AddrState(temp.Document?.AddrState[0]);
							if (data.document.AddrState == "" && Array.isArray(temp.Document?.AddrState) && temp.Document?.AddrState[0] != "") {
								if (arr.indexOf(temp.Document.AddrState[0]) == -1) {
									arr.push(temp.Document.AddrState[0]);
									console.log(`"${temp.Document.AddrState[0].toLowerCase()}",`);
									if (cc == 40) break;
									else cc++;
								}

							}
						}
					}
					// регион доставки
					if (temp.Document?.DeliveryState) {
						if (this.#operator == "MEGAFON") {
							data.document.DeliveryState = RulesMega.AddrState(temp.Document?.DeliveryState[0]);
							if (data.document.DeliveryState == "" && Array.isArray(temp.Document?.DeliveryState) && temp.Document?.DeliveryState[0] != "") {
								if (arr.indexOf(temp.Document.DeliveryState[0]) == -1) {
									arr.push(temp.Document.DeliveryState[0]);
									console.log(`"${temp.Document.DeliveryState[0].toLowerCase()}",`);
									if (cc == 40) break;
									else cc++;
								}

							}
						}
					}

					// фирменный салон связи или нет
					if (Array.isArray(temp.Document?.fs)) {

						if (this.#operator == "MEGAFON") data.document.Fs = RulesMega.Fs(temp.Document.fs);
					} else data.document.Fs = 2;


					//тип документа
					if (temp.Document?.gf && Array.isArray(temp.Document?.gf) && temp.Document?.gf[0] == "True") {
						try {
							data.document.FizDocType = RulesMega.FizDocTypeNew(parseInt(temp.Document?.FizDocType[0]));
						} catch(e) {
							docType = 3;
						}
					} else {
						try {
							if (this.#toolbox.IsNumber(temp.Document?.FizDocType[0])) {
								data.document.FizDocType = RulesMega.FizDocTypeOld(parseInt(temp.Document?.FizDocType[0]));
							} else {
								data.document.FizDocType = RulesMega.FizDocTypeOldString(temp.Document?.FizDocType[0]);
							}

						} catch(e) {
							docType = 3;
						}
					}
					if (data.document.FizDocType == "") console.log("Тип документа отсутствует для id = ", row.id);



					for (let key in data.document) data.document[key] = this.#toolbox.HtmlSpecialChars(data.document[key]);

					// console.log("data=> ", data.document);

					// если docType == 1, надо бы тогда с журналом разобраться
					if (docType == 1) {
						let logs = await this.#toolbox.XmlToString(row.journal);
						if (logs && logs?.journal?.record && logs?.journal?.record[0]) {
							if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ сформирован функцией формирования группы документов") {
								docType = 2;
							} else if (logs.journal.record[0]?.text && logs.journal.record[0]?.text == "Документ на основе другого документа добавлен в журнал") {
								docType = 4;
							}
						} else console.log("для записи ", row.id, " странный журнал");
					}

					let userId;
					if (row.userid == "dex") userId = "";
					else {
						userId = RulesMega.UserId(row.userid);
						if (userId == "") console.log("нет userid для ", row.userid);
					}

					let time = date(row.signature, "YYYYMMDDhhmmssSSS").format("YYYY-MM-DD hh:mm:ss.SSS");
					// await this.#connector.Request("dexol", `
					// 	INSERT INTO dex_${this.#name}
					// 	SET userId = '${userId}', jtype = '${jtype.id}', store = '${row.unitid}', status = '${row.status}', signature = '${row.signature}', jdocdate = '${row.jdocdate}', data = '${JSON.stringify(data)}', date = '${time}', type = '${docType}'
					// `);
					// break;
					// this.#journal.set(row.id, data);
					//
					//

					let value = `('${userId}','${jtype.id}','${row.unitid}','${row.status}','${row.signature}','${row.jdocdate}','${JSON.stringify(data)}','${time}','${docType}')`;
					inserts.push(value);


					if (inserts.length == 100 || cnt == rows.length - 1) {
						if (inserts.length > 0) {
							let result = await this.#connector.Request("dexol", `
								INSERT INTO dex_${this.#name} (userId, jtype, store, status, signature, jdocdate, data, date, type)
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
	Period(typeJournal, start, end, filter) {

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