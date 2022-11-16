"use strict"
const request = require("request");
const FS = require('fs');
const cryptoJs = require("crypto-js");
const crypto = require("crypto");
// const sign = crypto.createSign('SHA1');
// const { exec } = require("child_process");
var https = require('https');
const path = require("path");

const NodeRSA = require('node-rsa');
const Api = require("./Api");

// const child_process = require('child_process');
class Kiwi {
	#name = "kiwi";#api;#core;#HTTP_STATUSES;#connector;#toolbox;
	#serial;#terminal;#login;
	#oscc;
	#list = [];#paymentsList = [];#activePayments = [];#onProcess = false;
	constructor(...args) {
		this.#serial = "c43f40f4-b586-4a5d-9352-14885043fb3a";
		this.#terminal = "10698455";
		this.#login = "testApp";
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#connector = this.#core.Connector;
		this.#toolbox = this.#core.Toolbox;
		// this.#oscc = new OpenSslClassCommands(`${__dirname}/certs/`);
		this.#api = new Api(this.#core);
		this.#Init();

		// установка нового сертификата. Для этого авторизация происходит по одноразовому паролю и потом передается публичный ключ
		// Процедура устновки нового сертициката
		// setTimeout(()=> this.#InitProcedure("getAgentBalance"), 1000);
	}
	async #Init() {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM dicts_data
			WHERE dict = 'kiwiAgents' AND del = '0'
		`);
		for (let row of rows) this.#list.push(new KiwiAgent(row, this.#connector, this.#toolbox));
		setTimeout(async ()=> {
			let person;
			for (let item of this.#list) {
				// console.log("Агент=> ", item.Title, " => ", " Список терминалов=>", item.Terminals, " Персоны=> ", item.Persons);
				person = item.Persons.find(item=> item.UID == "13250871"); // paymentXml
			}
			if (person) {
				console.log("person=> ", person);
				// await person.GenerateKeyPair("8B728n8K5A");
				// await person.GetBalance();
				// await person.MakePayment();
				// await person.SetPublicKey();
			}
			await this.UpdatePaymentsList();
		}, 1000);


		//
	}
	// filter => date, owner и тд
	PaymentsList(filter) {
		return this.#paymentsList;
	}
	async UpdatePaymentsList() {
		this.#paymentsList = await this.#connector.Request("dexol", `
			SELECT * FROM kiwi_payments_list
		`);
		for (let task of this.#paymentsList) {
			if (task.status == 1) {
				let activeTask = new PaymentsTask(task);
				for (let agent of this.#list) {
					let terminal = agent.Terminals.find(item=> item.UID == task.terminal);
					if (terminal) terminal.AddTaskPayment(activeTask);
				}
			}
		};
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
			allowed.find(item=> item.name == packet.subcom).method(packet, users, response, this);
		}
	}
}
module.exports = Kiwi;

class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.apps.kiwi";
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

const kiwiErrors = {
	0: "Ok",
	5: "Номер не принадлежит оператору",
	150: "Неверный пароль или нет прав на этот терминал",
	151: "Невозможно выполнить операцию. Одноразовый пароль.",
	202: "Ошибка данных запроса",
	133: "Нет прав на прием платежей",
	152: "Невозможно выполнить операцию. Неодноразовый пароль",
	155: "Прием платежа для данного провайдера запрещен",
	246: "Терминал привязан к другому компьютеру",
	295: "Ошибка в названии интерфейса или действия",
	300: "Другая (неизвестная) ошибка провайдера",
	244: "Терминал не зарегистрирован у оператора"
}




class KiwiAgent {
	#id;#phone;#address;#ip = [];#role;#title;#connector;#toolbox;
	#terminals = [];#uid;
	constructor(row, connector, toolbox) {
		this.#id = row.record_id;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#Init(row);
	}
	get ID() { return this.#id; }
	get UID() { return this.#uid; }
	get Terminals() { return this.#terminals; }
	get Title() { return this.#title; }
	get Persons() {
		let persons = [];
		for (let item of this.#terminals) persons = persons.concat(item.Persons);
		return persons;
	}
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = data?.uid;
		this.#title = data?.title;
		let terminals = data?.terminals?.map(item=> parseInt(item));
		if (terminals) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM dicts_data
				WHERE dict = 'KiwiTerminals' AND del = '0' AND id_record IN (${terminals.join(",")})
			`);
			for (let row of rows) this.#terminals.push(new KiwiTerminal(row, this.#connector, this.#toolbox, this.#id));
		}
	}
}

// статусы платежей. 0 - отправлен, 1 - в процессе отправки, 2 - ожидает обработки
class KiwiTerminal {
	#serial;#ip;#address;#phone;#maxOnePay;#maxDayPay;#email;#connector;#toolbox;
	#persons = [];
	#id;#uid;#title;#person;
	#tasks = [];
	#sinterval;
	constructor(row, connector, toolbox, person) {
		this.#id = row.record_id;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#person = person;
		this.#Init(row);
	}
	get ID() { return this.#id; }
	get UID() { return this.#uid; }
	get Persons() { return this.#persons; }
	get Serial() { return this.#serial; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = data?.uid;
		this.#serial = data?.serial;
		this.#title = data?.title;
		let persons = data?.persons?.map(item=> parseInt(item));
		if (persons) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM dicts_data
				WHERE dict = 'kiwiPersons' AND del = '0' AND id_record IN (${persons.join(",")})
			`);
			for (let row of rows) this.#persons.push(new KiwiPerson(row, this.#connector, this.#toolbox, this));
		}
	}
	#CheckPayments() {
		// console.log("проверяем");
		let moment = this.#toolbox.Moment();
		let currentDate = moment();
		// console.log(moment);
		//
		this.#tasks = this.#tasks.filter(item=> item.Status == 1);
		for (let task of this.#tasks) {
			// console.log(task.List);
			// console.log("активный таск");
			let cnt = 0;
			for (let item of task.List) {
				let paymentDate = moment(item.date).format("YYYY-MM-DDTHH:mm:ss");
				// console.log("item=> ", item);
				if (typeof item.status == "undefined" && currentDate.isAfter(paymentDate)) {
					// console.log("item=> ", item);
					console.log(`осуществляем платеж на номер ${item.num} на сумму ${item.amount}`);
					item.status = 0;
				}
				if (item.status == 0) {
					// console.log("увеличиваем ", " len=> ", task.List.length);
					cnt++;
				}
				if (cnt == task.List.length) {
					console.log("таск выполнен");

					task.Complete();
					break;
				}
				// console.log("item=> ", item);
			}
		}
	}
	#StartPayment() {
		if (!this.#sinterval) {
			this.#sinterval = setInterval(()=> { this.#CheckPayments() }, 10000);
		}
	}
	AddTaskPayment(task) {
		if ( this.#persons.find(item=> item.UID == task.Person) ) {
			this.#PrepareTask(task);
			this.#StartPayment();
		} else {
			console.log("нет такой персоны для теминала");
		}
	}
	#PrepareTask(task) {
		console.log("да", " min=> ",task.MinInterval, "max=> ", task.MaxInterval);
		let moment = this.#toolbox.Moment()();
		let time = 0;
		for (let item of task.List) {
			let rand = this.#toolbox.RandomPositiveInt(task.MinInterval, task.MaxInterval);


			let date = moment.add(rand, "minutes");
			item.date = date.format("YYYY-MM-DDTHH:mm:ss");
			// console.log("moment=> ", moment, " добавляем ", rand, " time стало=> ", date.format("YYYY-MM-DDTHH:mm:ss"));
		}
		this.#tasks.push(task);
	}
}

class KiwiPerson {
	#login;#roles = [];#status;#connector;#toolbox;
	#id;#uid;#title;#terminal;
	#keyPair;#publicKey;#privateKey;#nodeRSA;
	constructor(row, connector, toolbox, terminal) {
		this.#id = row.record_id;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#terminal = terminal;
		this.#Init(row);
	}
	get UID() { return this.#uid; }
	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = data.uid;
		this.#login = data.login;
		this.#status = data.status;
		this.#title = data.title;

		await this.#LoadCerts();
	}
	async #LoadCerts() {
		try {
			let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
			FS.mkdirSync(personPath, { recursive: true });
			this.#publicKey = FS.readFileSync(`${personPath}public.key`, "utf8");
			this.#privateKey = FS.readFileSync(`${personPath}private.key`, "utf8");
			this.#nodeRSA = new NodeRSA();
			this.#nodeRSA.setOptions({signingScheme: "sha1"});
			this.#nodeRSA.importKey(this.#privateKey, "pkcs8");
		} catch(e) {
			console.log(e);
		}
	}
	async GenerateKeyPair(password) {
		const key = new NodeRSA();
		key.generateKeyPair(1024);
		let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		FS.mkdirSync(personPath, { recursive: true });
		FS.writeFileSync(`${personPath}public.key`, key.exportKey("pkcs8-public"));
		FS.writeFileSync(`${personPath}private.key`, key.exportKey("pkcs8"));
		let oneTimePassword = password;
		let md5Password = cryptoJs.MD5(oneTimePassword).toString();

		let arr = key.exportKey("pkcs8-public").split("\n");
		arr.shift();
		arr.pop();
		let cert = arr.join("");
		let data = {
			url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
			headers: {
				"Content-Type" : "text/html;charset=windows-1251"
			},
			body: `<?xml version="1.0" encoding="windows-1251"?>
				<request>
					<auth login="${this.#login}" signAlg="MD5" sign="${md5Password}"/>
					<client software="Dealer v0" terminal="${this.#terminal.UID}"/>
					<persons>
						<setPublicKey>
							<store-type>1</store-type>
							<pubkey>${cert}</pubkey>
						</setPublicKey>
					</persons>
			</request>`
		}
		request.post(data, (err, response, body)=> {
			if (err) console.log("err=> ", err);
			console.log(body);
		});
	}
	async GetBalance() {
		let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		let keyData = FS.readFileSync(`${personPath}private.key`, "utf8");

		const key = new NodeRSA();
		key.setOptions({signingScheme: "sha1"});
		key.importKey(keyData, "pkcs8");

		let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client serial="" terminal="${this.#terminal.UID}" software="Dealer v0 "/><agents><getBalance/></agents></request>`;
		console.log(rdata);
		// const sign = key.encrypt(rdata, "base64", "utf8");

		const sign1 = key.sign(rdata, "base64");

		console.log(sign1);

		// console.log("sign=> ", sign);

		let data = {
			url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
			headers: {
				"Content-Type" : "text/XML",
				"X-Digital-Sign" : sign1,
				"X-Digital-Sign-Alg": "SHA1withRSA",
				"X-Digital-Sign-Login": this.#login
			},
			body: rdata
		}
		request.post(data, (err, response, body)=> {
			if (err) console.log("err=> ", err);
			console.log(body);
		});


		// console.log(sign);
	}
	async GetProviderByPhone() {
		let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		let keyData = FS.readFileSync(`${personPath}private.key`, "utf8");

		const key = new NodeRSA();
		key.setOptions({signingScheme: "sha1"});
		key.importKey(keyData, "pkcs8");

		let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><getProviderByPhone><phone>9053443444</phone></getProviderByPhone></providers></request>`;
		console.log(rdata);
		// const sign = key.encrypt(rdata, "base64", "utf8");

		const sign1 = key.sign(rdata, "base64");

		console.log(sign1);

		// console.log("sign=> ", sign);

		let data = {
			url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
			headers: {
				"Content-Type" : "text/XML",
				"X-Digital-Sign" : sign1,
				"X-Digital-Sign-Alg": "SHA1withRSA",
				"X-Digital-Sign-Login": this.#login
			},
			body: rdata
		}
		request.post(data, (err, response, body)=> {
			if (err) console.log("err=> ", err);
			console.log(body);
		});
	}
	async #GetLastIds() {
		return new Promise((resolve, reject)=> {
			let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><terminals><getLastIds/></terminals></request>`;
			let sign = this.#nodeRSA.sign(xml, "base64");
			let data = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"Content-Type" : "text/XML",
					"X-Digital-Sign" : sign,
					"X-Digital-Sign-Alg": "SHA1withRSA",
					"X-Digital-Sign-Login": this.#login
				},
				body: xml
			}
			request.post(data, async (err, response, body)=> {
				if (err) {
					console.log("err=> ", err);
					resolve({status: -1});
				} else {
					let json = await this.#toolbox.XmlToString(body);
					if (json?.response?.$?.result == 0) {
						if (json?.response?.terminals[0]?.getLastIds[0]?.$?.result == 0) {
							let id = parseInt(json?.response?.terminals[0]?.getLastIds[0]["last-payment"][0]?.$?.id);
							let receiptNumber = parseInt(json?.response?.terminals[0]?.getLastIds[0]["last-payment"][0]?.$["receipt-number"]);
							resolve({status: 0, id: id, receiptNumber: receiptNumber});
						} else {
							resolve({status: -3});
						}
					} else {
						resolve({status: -2});
					}
				}
			});
		});

		// let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		// let keyData = FS.readFileSync(`${personPath}private.key`, "utf8");

		// const key = new NodeRSA();
		// key.setOptions({signingScheme: "sha1"});
		// key.importKey(keyData, "pkcs8");

		// let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><terminals><getLastIds/></terminals></request>`;
		// console.log(rdata);
		// // const sign = key.encrypt(rdata, "base64", "utf8");

		// const sign1 = key.sign(rdata, "base64");

		// console.log(sign1);

		// // console.log("sign=> ", sign);

		// let data = {
		// 	url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
		// 	headers: {
		// 		"Content-Type" : "text/XML",
		// 		"X-Digital-Sign" : sign1,
		// 		"X-Digital-Sign-Alg": "SHA1withRSA",
		// 		"X-Digital-Sign-Login": this.#login
		// 	},
		// 	body: rdata
		// }
		// request.post(data, (err, response, body)=> {
		// 	if (err) console.log("err=> ", err);
		// 	console.log(body);
		// });
	}
	async #CheckPayment(paymentId, number, service, amount) {
		return new Promise((resolve, reject)=> {
			let moment = this.#toolbox.Moment();
			let date = moment().format("YYYY-MM-DDThh:mm:ss");
			let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><checkPaymentRequisites><payment id="${paymentId}"><from currency="643" amount="${amount}.00"/><to currency="643" service="${service}" amount="${amount}.00" account="${number}"/><receipt id="${paymentId}" date="${date}"/></payment></checkPaymentRequisites></providers></request>`;
			let sign = this.#nodeRSA.sign(xml, "base64");
			let data = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"Content-Type" : "text/XML",
					"X-Digital-Sign" : sign,
					"X-Digital-Sign-Alg": "SHA1withRSA",
					"X-Digital-Sign-Login": this.#login
				},
				body: xml
			}
			request.post(data, async (err, response, body)=> {
				if (err) {
					console.log("err=> ", err);
					resolve({status: -1});
				} else {
					let json = await this.#toolbox.XmlToString(body);
					// console.log("json=> ", JSON.stringify(json));
					if (json?.response?.$?.result == 0) {
						if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result == 0) {
							// теперь проверить сам платеж
							if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 3) {
								resolve({status: 3});
							} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 0) {
								resolve({status: 0});
							} else {
								resolve({status: 1});
							}
						} else {
							resolve({status: -3});
						}
					} else {
						resolve({status: -2});
					}
				}
			});
		});
	}
	async #AddOfflinePayment(paymentId, number, service, amount, date) {
		return new Promise((resolve, reject)=> {
			let moment = this.#toolbox.Moment();
			let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><addOfflinePayment><payment id="${paymentId}"><from currency="643" amount="${amount}.00"/><to currency="643" service="${service}" amount="${amount}.00" account="${number}" moneyType="0"/><receipt id="${paymentId}" date="${date}"/></payment></addOfflinePayment></providers></request>`;
			let sign = this.#nodeRSA.sign(xml, "base64");
			let data = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"Content-Type" : "text/XML",
					"X-Digital-Sign" : sign,
					"X-Digital-Sign-Alg": "SHA1withRSA",
					"X-Digital-Sign-Login": this.#login
				},
				body: xml
			}
			if (amount < 100) {
				// console.log("xml=> ", xml);
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: -1});
					} else {
						console.log("===> ", body);
						let json = await this.#toolbox.XmlToString(body);
						console.log("json=> ", JSON.stringify(json));

						if (json?.response?.$?.result == 0) {
							// if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result == 0) {
							// 	// теперь проверить сам платеж
							// 	if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 3) {
							// 		resolve({status: 3, date: date});
							// 	} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 0) {
							// 		resolve({status: 0});
							// 	} else {
							// 		resolve({status: 1});
							// 	}
							// } else {
							// 	resolve({status: -3});
							// }
						} else {
							resolve({status: -2});
						}
					}
				});
			}
		});
	}
	async #GetPaymentStatus(paymentId) {
		return new Promise((resolve, reject)=> {
			let moment = this.#toolbox.Moment();
			let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><getPaymentStatus><payment id="${paymentId}"/></getPaymentStatus></providers></request>`;
			let sign = this.#nodeRSA.sign(xml, "base64");
			let data = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"Content-Type" : "text/XML",
					"X-Digital-Sign" : sign,
					"X-Digital-Sign-Alg": "SHA1withRSA",
					"X-Digital-Sign-Login": this.#login
				},
				body: xml
			}
			// console.log("xml=> ", xml);
			request.post(data, async (err, response, body)=> {
				if (err) {
					console.log("err=> ", err);
					resolve({status: -1});
				} else {
					console.log("===> ", body);
					let json = await this.#toolbox.XmlToString(body);
					console.log("json=> ", JSON.stringify(json));

					if (json?.response?.$?.result == 0) {
						if (json?.response?.providers[0]?.getPaymentStatus[0]?.$?.result == 0) {
							console.log("=> ", json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]);
							if (json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.result == 0) {
								let payment = json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$;
								console.log("все норм ", payment);
								resolve({status: 0, paymentStatus: parseInt(payment?.status)});
							} else resolve({status: -1, result: json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.result});

						// 	// теперь проверить сам платеж
						// 	if (json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.status == 3) {
						// // 		resolve({status: 3, date: date});
						// // 	} else if (json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.status == 0) {
						// // 		resolve({status: 0});
						// 	} else {
						// 		resolve({status: 1});
						// 	}
						} else {
							resolve({status: -3});
						}
					} else {
						resolve({status: -2});
					}
				}
			});
		});
	}

	async #encryptText() {

	}

	async SetPublicKey() {

		// console.log("this.#publicKey=> ", this.#publicKey);
		// console.log("this.#privateKey=> ", this.#privateKey);
		return new Promise((resolve, reject)=> {
			// console.log("crypto=> ", crypto);



			let oneTimePassword = "9nuccEHD6B";
			let md5Password = cryptoJs.MD5(oneTimePassword).toString();
			let forbiden = ["-----BEGIN RSA PUBLIC KEY-----", "-----END RSA PUBLIC KEY-----", " ",];
			let cert = this.#publicKey;
			for (let item of forbiden) {
				cert = cert.replace(item, "");
			}
			// cert = cert.replace(/\r\n/g, '');
			cert = cert.replace(/[^a-zа-яё0-9\s/+=]/gi, ' ');

			// cert = `=${cert}=`;
			// console.log("cert=> ", cert);

			// let data = {
			// 	url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
			// 	headers: {
			// 		"Content-Type" : "text/html;charset=windows-1251"
			// 	},
			// 	body: `<?xml version="1.0" encoding="windows-1251"?>
			// 		<request>
			// 			<auth login="${this.#login}" signAlg="MD5" sign="${md5Password}"/>
			// 			<client software="Dealer v0" terminal="${this.#terminal}"/>
			// 			<persons>
			// 				<setPublicKey>
			// 					<store-type>1</store-type>
			// 					<pubkey>${cert}</pubkey>
			// 				</setPublicKey>
			// 			</persons>
			// 	</request>`
			// }
			// request.post(data, (err, response, body)=> {
			// 	if (err) console.log("err=> ", err);
			// 	console.log(body);
			// 	resolve(body);
			// });
		});
	}


	async MakePayment() {
		let result = await this.#GetLastIds();
		console.log("GetLastIds=> ", result);
		if (result.status < 0) return {method: "GetLastIds", result: result, status: -1};
		let id = result.id+1;
		let service = 2;
		let amount = 3;
		let number = 9283037716;
		result = await this.#CheckPayment(id, number, service, amount);
		console.log("CheckPayment=> ", result);
		if (result < 0) return {method: "CheckPayment", result: result, status: -1};
		else if (result.status != 3) return {method: "CheckPayment", result: result, status: result.status};

		// result = await this.#AddOfflinePayment(id, number, service, amount, result.date);
		// console.log("AddOfflinePayment=> ", result);
		//
		result = await this.#GetPaymentStatus(0);
		if (result.status == 0 && result?.paymentStatus == 2) {
			console.log("Платеж проведен");
		}
		console.log("GetPaymentStatus=> ", result);
	}
}



class PaymentsTask {
	#list = [];#minInterval;#maxInterval;#operator;#dateCreate;#person;#status;#next;#sum;#id;
	constructor(row) {
		let data = JSON.parse(row.data);
		this.#list = data.list;
		this.#id = row.id;
		this.#minInterval = data.minInterval ? data.minInterval : 2;
		this.#maxInterval = data.maxInterval ? data.maxInterval : 10;
		this.#operator = data.operator ? data.operator : "";
		this.#dateCreate = row.date;
		this.#person = row.person;
		this.#status = row.status;
		this.#sum = data.list.reduce((total, item)=> total + parseInt(item.amount), 0);
	}
	get List() { return this.#list; }
	get MinInterval() { return this.#minInterval; }
	get MaxInterval() { return this.#maxInterval; }
	get Operator() { return this.#operator; }
	get DateCreate() { return this.#dateCreate; }
	get Person() { return this.#person; }
	get Status() { return this.#status; }
	get Sum() { return this.#sum; }

	Complete() { this.#status = 0; }
}



class OpenSslClassCommands {
	#certsFolder;
	constructor(certsFolder) {
		this.#certsFolder = certsFolder;
	}
	static async CreatePrivateCert(terminal, login) {
		return new Promise((resolve, reject)=> {
			//есть ли дир. Если нет, создать
			FS.mkdirSync(`${__dirname}/certs/${terminal}/${login}`, { recursive: true });
			exec(`openssl genrsa -out ${__dirname}/certs/${terminal}/${login}/private.key 1024`, (error, stdout, stderr) => {
			    if (error) {
			        console.log(`error: ${error.message}`);
			        resolve({errs: error, status: -1});
			    }
			    if (stderr) {
			    	resolve({errs: stderr, status: 0});
			    }
			    resolve({errs: [], status: 1});
			});
		});
	}
	static async CreatePublicCert(terminal, login) {
		return new Promise((resolve, reject)=> {
			//есть ли дир. Если нет, создать
			exec(`openssl rsa -in ${__dirname}/certs/${terminal}/${login}/private.key -pubout -out ${__dirname}/certs/${terminal}/${login}/public.key`,
				(error, stdout, stderr) => {
				    if (error) {
				        console.log(`error: ${error.message}`);
				        resolve({errs: error, status: -1});
				    }
				    if (stderr) {
				    	resolve({errs: stderr, status: 0});
				    }
				    resolve({errs: [], status: 1});
				}
			);
		});
	}
	static async CryptPassword(password) {
		return cryptoJs.MD5(password).toString();
	}
	static async Encrypt() {}
	static async Decript() {}
}