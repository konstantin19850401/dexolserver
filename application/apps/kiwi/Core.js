"use strict"
const path = require("path");
const fs = require('fs');
const NodeRSA = require('node-rsa');
const request = require("request");
const Api = require("./Api");


class Kiwi {
	#name = "kiwi";#core;#connector;#toolbox;#api;#HttpStatuses;
	#agents = [];
	constructor(...args) {
		this.#core = args[0];
		this.#connector = this.#core.Connector;
		this.#toolbox = this.#core.Toolbox;
		this.#api = new Api(this.#core);
		this.#HttpStatuses = this.#core.HttpStatuses;
		this.#api = new Api(this.#core);
		this.#Init();
	}
	get Name() { return this.#name; }
	get PaymentsList() {
		let rows = [];
		for (let agent of this.#agents) {
			for (let terminal of agent.Terminals) {
				terminal.PaymentsList.forEach(item=> rows.push(item.Data));
			}
		}
		return rows;
	}
	async #Init() {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM \`dicts_data\`
			WHERE dict = 'kiwiAgents' AND del = '0'
		`);
		for (let row of rows) {
			this.#agents.push(new KiwiAgent(row, this.#connector, this.#toolbox));
		}
	}
	async UpdateTerminalPaymentsList(terminalUid) {
		let terminal;
		for (let agent of this.#agents) {
			terminal = agent.Terminals.find(item=> item.Uid == terminalUid);
			if (terminal) {
				terminal.UpdatePaymentsList();
				break;
			}
		}
	}

	Check(packet, users, response) {
		let allowed = [
			{name: "api",           method: (...args) => { this.#api.Check(...args) } }
		];
		if (!allowed.find(item=> item.name == packet.subcom)) {
			let p = {subcom: packet.subcom, status: this.#HttpStatuses.METHOD_NOT_ALLOWED, data: {errs: ["Method not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			if (packet.subcom != "api") response.end(new Packet({subcom: packet.subcom, status: this.#HttpStatuses.OK, message: "Ok"}).ToString());
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


class KiwiAgent {
	#id;#connector;#toolbox;
	#uid;#title;#status;
	#terminals = [];
	constructor(row, connector, toolbox) {
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#id = row.record_id;
		this.#Init(row);
	}
	get Id() { return this.#id }
	get Uid() { return this.#uid }
	get Title() { return this.#title; }
	get Terminals() { return this.#terminals; }
	get Status() { return this.#status; }
	get Persons() {
		let persons = [];
		for (let terminal of terminals) {
			persons = persons.concat(terminal.Persons);
		}
		return persons;
	}

	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = data?.uid;
		this.#title = data?.title;
		this.#status = data?.status || 0;
		let terminals = data?.terminals?.map(item=> parseInt(item));
		if (terminals && terminals.length > 0) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM \`dicts_data\`
				WHERE dict = 'KiwiTerminals' AND del = '0' AND id_record IN (${terminals.join(",")})
			`);
			for (let row of rows) {
				this.#terminals.push(new KiwiTerminal(row, this.#connector, this.#toolbox, this));
			}
		}
	}
}

class KiwiTerminal {
	#id;#connector;#toolbox;#agent;
	#uid;#serial;#title;#persons = [];#status;
	#software = "Dealer v0";
	#tasks = [];#maxPayment = 110;
	#paymentsList = [];
	constructor(row, connector, toolbox, agent) {
		this.#id = row.record_id;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#agent = agent;
		this.#Init(row);
	}
	get Id() { return this.#id; }
	get Uid() { return this.#uid; }
	get Persons() { return this.#persons; }
	get Serial() { return this.#serial; }
	get Status() { return this.#status; }
	get Software() { return this.#software; }
	get PaymentsList() { return this.#paymentsList; }

	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = parseInt(data?.uid);
		this.#serial = data?.serial;
		this.#title = data?.title;
		this.#status = data?.status || 0;
		let persons = data?.persons?.map(item=> parseInt(item));
		if (persons && persons.length > 0) {
			let rows = await this.#connector.Request("dexol", `
				SELECT * FROM \`dicts_data\`
				WHERE dict = 'kiwiPersons' AND del = '0' AND id_record IN (${persons.join(",")})
			`);
			for (let row of rows) {
				this.#persons.push(new KiwiPerson(row, this.#connector, this.#toolbox, this));
			}
		}
		// а теперь задачи-пополняшки
		await this.UpdatePaymentsList();
	}
	async #ClearCompletedTasks() {
		if (this.#tasks.length > 0) {
			this.#tasks = this.#tasks.filter(item=> item.Status == 1);
		}
	}
	async UpdatePaymentsList() {
		let rows = await this.#connector.Request("dexol", `
			SELECT * FROM \`kiwi_payments_list\`
			WHERE terminal = '${this.#uid}'
		`);
		for (let row of rows) {
			let task = this.#tasks.find(item=> item.Id == row.id);
			if (!task) {
				let paymentTask = new PaymentsTask(row, this.#connector, this.#toolbox, this, ()=> { this.#ClearCompletedTasks() } );
				this.#paymentsList.push(paymentTask);
				this.#tasks.push(paymentTask);
			}
		}
	}
	async GetBalance(personUid) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client serial="" terminal="${this.#uid}" software="${this.#software}"/><agents><getBalance/></agents></request>`;
				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.agents[0]?.getBalance[0]?.$?.result == 0) {
								let balance = parseInt(json?.response?.agents[0]?.getBalance[0]["balance"][0]);
								resolve({status: 0, balance: balance});
							} else {
								resolve({status: 4, result: json?.response?.terminals[0]?.getLastIds[0]?.$?.result});
							}
						} else {
							resolve({status: 3, result: json?.response?.$?.result});
						}
					}
				});
			} else {
				resolve({status: 1});
			}
		});
	}
	async GetLastId(personUid) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#uid}" software="${this.#software}"/><terminals><getLastIds/></terminals></request>`;
				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.terminals[0]?.getLastIds[0]?.$?.result == 0) {
								let id = parseInt(json?.response?.terminals[0]?.getLastIds[0]["last-payment"][0]?.$?.id);
								let receiptNumber = parseInt(json?.response?.terminals[0]?.getLastIds[0]["last-payment"][0]?.$["receipt-number"]);
								resolve({status: 0, id: id, receiptNumber: receiptNumber});
							} else {
								resolve({status: 4, result: json?.response?.terminals[0]?.getLastIds[0]?.$?.result});
							}
						} else {
							resolve({status: 3, result: json?.response?.$?.result});
						}
					}
				});
			} else {
				resolve({status: 1});
			}
		});
	}
	async CheckPaymentRequisites(personUid, payment) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let moment = this.#toolbox.Moment();
				let date = moment().format("YYYY-MM-DDThh:mm:ss");
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#uid}" software="${this.#software}"/><providers><checkPaymentRequisites><payment id="${payment.id}"><from currency="643" amount="${payment.amount}.00"/><to currency="643" service="${payment.service}" amount="${payment.amount}.00" account="${payment.num}"/><receipt id="${payment.id}" date="${payment.date}"/></payment></checkPaymentRequisites></providers></request>`;

				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result == 0) {
								if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 3) {
									resolve({status: 0});
								} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 0) {
									resolve({status: 3});
								} else {
									resolve({status: 1});
								}
							} else {
								resolve({status: 4, result: json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result});
							}
						} else {
							resolve({status: 3, result: json?.response?.$?.result});
						}
					}
				});
			} else {
				resolve({status: 1});
			}
		});
	}
	async #AddOfflinePayment(personUid, payment) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let moment = this.#toolbox.Moment();
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#uid}" software="${this.#software}"/><providers><addOfflinePayment><payment id="${payment.id}"><from currency="643" amount="${payment.amount}.00"/><to currency="643" service="${payment.service}" amount="${payment.amount}.00" account="${payment.num}" moneyType="0"/><receipt id="${payment.id}" date="${payment.date}"/></payment></addOfflinePayment></providers></request>`;
				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				if (payment.amount < this.#maxPayment) {
					request.post(data, async (err, response, body)=> {
						if (err) {
							console.log("err=> ", err);
							resolve({status: 2});
						} else {
							// console.log("===> ", body);
							let json = await this.#toolbox.XmlToString(body);
							// console.log("json=> ", JSON.stringify(json));
							if (json?.response?.$?.result == 0) {
								if (json?.response?.providers[0]?.addOfflinePayment[0]?.$?.result == 0) {
									resolve({status: 0});
								} else {
									resolve({status: 4, result: json?.response?.providers[0]?.addOfflinePayment[0]?.$?.result});
								}
							} else {
								resolve({status: 3, result: json?.response?.$?.result});
							}
						}
					});
				} else {
					resolve({status: -2});
				}
			} else {
				resolve({status: 1});
			}
		});
	}
	async CheckPaymentStatus(personUid, payment) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let moment = this.#toolbox.Moment();
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#uid}" software="${this.#software}"/><providers><getPaymentStatus><payment id="${payment.id}"/></getPaymentStatus></providers></request>`;
				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.providers[0]?.getPaymentStatus[0]?.$?.result == 0) {
								if (json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.result == 0) {
									let payment = json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$;
									resolve({status: 0, paymentStatus: parseInt(payment?.status)});
								} else resolve({status: -1, result: json?.response?.providers[0]?.getPaymentStatus[0]?.payment[0]?.$?.result});
							} else {
								resolve({status: 4, result: json?.response?.providers[0]?.getPaymentStatus[0]?.$?.result});
							}
						} else {
							resolve({status: 3, result: json?.response?.$?.result});
						}
					}
				});
			} else {
				resolve({status: 1});
			}
		});
	}
	async GetProviderByPhone(personUid, payment) {
		return new Promise((resolve, reject)=> {
			let person = this.#persons.find(item=> item.Uid == personUid);
			if (person) {
				let xml = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#uid}" software="${this.#software}"/><providers><getProviderByPhone><phone>${payment.num}</phone></getProviderByPhone></providers></request>`;
				let sign = person.PersonRSA.sign(xml, "base64");
				let data = {
					url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
					headers: {
						"Content-Type" : "text/XML",
						"X-Digital-Sign" : sign,
						"X-Digital-Sign-Alg": "SHA1withRSA",
						"X-Digital-Sign-Login": person.Login
					},
					body: xml
				}
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.providers[0]?.getProviderByPhone[0]?.$?.result == 0) {
								let provider = json?.response?.providers[0]?.getProviderByPhone[0]?.providerId[0];
								resolve({status: 0, id: provider});
							} else {
								resolve({status: 4, result: json?.response?.providers[0]?.getProviderByPhone[0]?.$?.result});
							}
						} else {
							resolve({status: 3, result: json?.response?.$?.result});
						}
					}
				});
			} else {
				resolve({status: 1});
			}
		});
	}
	async SendPayment(payment, task) {
		console.log("отправляем платеж на сумму ", payment.amount, " для номера ", payment.num, " для задачи ", task.Id);
		payment.status = 1;
		let provider = await this.GetProviderByPhone(task.Person, payment);
		if (provider.status != 0) {
			payment.status = 7;
			await task.SaveTaskData();
			return;
		}
		payment.service = provider.id;
		let lastPayment = await this.GetLastId(task.Person);
		if (lastPayment.status != 0) {
			payment.status = 3;
			await task.SaveTaskData();
			return;
		}
		payment.id = lastPayment.id + 1;
		let agentBalance = await this.GetBalance(task.Person);
		if (lastPayment.status != 0) {
			payment.status = 10;
			await task.SaveTaskData();
			return;
		}
		if (agentBalance.balance < payment.amount) {
			payment.status = 8;
			await task.SaveTaskData();
			return;
		}
		let checkPayment = await this.CheckPaymentRequisites(task.Person, payment);
		if (checkPayment.status != 0) {
			payment.status = 4;
			await task.SaveTaskData();
			return;
		}
		let offlinePayment = await this.#AddOfflinePayment(task.Person, payment);
		if (offlinePayment.status != 0) {
			payment.status = 5;
			await task.SaveTaskData();
			return;
		}
		payment.status = 6;
		await task.SaveTaskData();
		// console.log("provider=> ", provider);
		// console.log("lastPayment=> ", lastPayment);
		// console.log("agentBalance=> ", agentBalance);
		// console.log("checkPayment=> ", checkPayment);
	}

}

class KiwiPerson {
	#id;#connector;#toolbox;#terminal;
	#uid;#login;#status;#title;#personDir;
	#nodeRSA;#publicKey;#privateKey;#ifIssetCert = false;
	constructor(row, connector, toolbox, terminal) {
		this.#id = row.record_id;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#terminal = terminal;
		this.#Init(row);
	}
	get Uid() { return this.#uid; }
	get Id() { return this.#id; }
	get Status() { return this.#status; }
	get Login() { return this.#login; }
	get PersonRSA() { return this.#nodeRSA; }

	async #Init(row) {
		let data = JSON.parse(row.data);
		this.#uid = data?.uid;
		this.#login = data?.login;
		this.#status = data?.status || 0;
		this.#title = data?.title;
		this.#personDir = path.normalize(`${__dirname}/certs/${this.#terminal.Uid}/${this.#login}/`);
		await this.#LoadCerts();
	}
	async #LoadCerts() {
		try {
			fs.mkdirSync(this.#personDir, { recursive: true });
			this.#publicKey = fs.readFileSync(`${this.#personDir}public.key`, "utf8");
			this.#privateKey = fs.readFileSync(`${this.#personDir}private.key`, "utf8");
			this.#nodeRSA = new NodeRSA();
			this.#nodeRSA.setOptions({signingScheme: "sha1"});
			this.#nodeRSA.importKey(this.#privateKey, "pkcs8");
			this.#ifIssetCert = true;
		} catch(e) {
			this.#ifIssetCert = false;
			console.log(e);
		}
	}
	async GenerateKeyPair(password) {
		return new Promise((resolve, reject)=> {
			this.#nodeRSA = new NodeRSA();
			this.#nodeRSA.generateKeyPair(1024);
			fs.mkdirSync(this.#personDir, { recursive: true });
			fs.writeFileSync(`${this.#personDir}public.key`, this.#nodeRSA.exportKey("pkcs8-public"));
			fs.writeFileSync(`${this.#personDir}private.key`, this.#nodeRSA.exportKey("pkcs8"));
			let oneTimePassword = password;
			let md5Password = cryptoJs.MD5(oneTimePassword).toString();
			let arr = this.#nodeRSA.exportKey("pkcs8-public").split("\n");
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
						<client software="${this.#terminal.Software}" terminal="${this.#terminal.Uid}"/>
						<persons>
							<setPublicKey>
								<store-type>1</store-type>
								<pubkey>${cert}</pubkey>
							</setPublicKey>
						</persons>
				</request>`
			}
			request.post(data, async (err, response, body)=> {
				if (err) console.log("err=> ", err);
				console.log(body);
				await this.#LoadCerts();
				resolve(true);
			});
		});
	}
}

class PaymentsTask {
	#id;#terminal;#person;#status;#connector;#toolbox;#creationDate;#clearMethod;#tick;
	#minInterval;#maxInterval;#list;#operator;#data;#comment;
	#cnt = 0;#ignoreStatuses = [0,1,4,5,6,7,8,9,10];
	#paymentStatusCheck = [];
	constructor(row, connector, toolbox, terminal, clearMethod) {
		this.#id = row.id;
		this.#terminal = terminal;
		this.#person = row.person;
		this.#status = row.status;
		this.#creationDate = row.date;
		this.#connector = connector;
		this.#toolbox = toolbox;
		this.#clearMethod = clearMethod;
		this.#Init(row);
	}
	get Status() { return this.#status; }
	get Id() { return this.#id; }
	get Person() { return this.#person; }
	get Data() {
		return {
			id: this.#id,
			terminal: this.#terminal.Uid,
			person: this.#person,
			date: this.#creationDate,
			comment: this.#comment,
			sum: this.#list.reduce((total, item)=> total + parseInt(item.amount), 0),
			list: this.#list,
			status: this.#status,
		}
	}

	#Init(row) {
		this.#data = JSON.parse(row.data);
		this.#minInterval = this.#data?.minInterval || 10;
		this.#maxInterval = this.#data?.maxInterval || 25;
		this.#operator = this.#data?.operator;
		this.#comment = this.#data?.comment || "";
		this.#list = this.#data.list;
		if (this.#status == 1) {
			this.#SetDates();
			this.#tick = setInterval(async ()=> { await this.#CheckPayment() }, 15000);
		}
	}
	#SetDates() {
		let moment = this.#toolbox.Moment()();
		for (let item of this.#list) {
			if (this.#ignoreStatuses.indexOf(item.status) == -1) {
				let randMin =  this.#toolbox.RandomPositiveInt(this.#minInterval, this.#maxInterval);
				let randSec =  this.#toolbox.RandomPositiveInt(0, 60);
				let date = moment.add(randMin, "minutes").add(randSec, "seconds");
				item.date = date.format("YYYY-MM-DDTHH:mm:ss");
				console.log("установим date=> ", item.date);
			}
		}
	}
	async #CheckPayment() {
		let payment = this.#list.find(item=> this.#ignoreStatuses.indexOf(item.status) == -1);
		if (!payment) {
			if (this.#paymentStatusCheck.length == 0) await this.#Complete();
		} else {
			let moment = this.#toolbox.Moment();
			let currentDate = moment();
			let paymentDate = moment(payment.date).format("YYYY-MM-DDTHH:mm:ss");
			if (currentDate.isAfter(paymentDate)) {
				await this.#terminal.SendPayment(payment, this);
			}
		}

		// проверить статусы
		for (let payment of this.#list) {
			if (payment.status == 6) {
				console.log("Есть платеж на проверку статуса ", payment.num);
				let check = await this.#terminal.CheckPaymentStatus(this.#person, payment);
				if (check.status == 0) {
					if (check.paymentStatus == 2) {
						payment.status = 0;
						this.#paymentStatusCheck = this.#paymentStatusCheck.filter(item=> item.hash != payment.hash);
					} else if (check.paymentStatus == 0) {
						payment.status = 5;
						this.#paymentStatusCheck = this.#paymentStatusCheck.filter(item=> item.hash != payment.hash);
					} else if (check.paymentStatus == 3 || check.paymentStatus == 1) this.#paymentStatusCheck.push(payment);
				} else payment.status = 5;
				await this.SaveTaskData();
			}
		}
	}
	async #Complete() {
		this.#status = 0;
		let result = await this.#connector.Request("dexol", `
			UPDATE \`kiwi_payments_list\`
			SET status = '0'
			WHERE id = '${this.#id}'
		`);
		if (result.affectedRows == 1) console.log(`Задача ${this.#id} завершена`);
		clearInterval(this.#tick);
		this.#clearMethod();
	}
	async SaveTaskData() {
		let data = JSON.stringify(this.#data);
		let result = await this.#connector.Request("dexol", `
			UPDATE \`kiwi_payments_list\`
			SET data = '${data}'
			WHERE id = '${this.#id}'
		`);
	}
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
	210: "Нет такой транзакции в базе",
	246: "Терминал привязан к другому компьютеру",
	295: "Ошибка в названии интерфейса или действия",
	300: "Другая (неизвестная) ошибка провайдера",
	244: "Терминал не зарегистрирован у оператора"
}

const serverErrors = {
	0: "Ок",
	1: "Не указана персона",
	2: "Ошибка запроса",
	3: "Ошибка результата авторизации. Смотреть результат операции в ошибках киви",
	4: "Ошибка результата запроса к методу. Смотреть результат операции в ошибках киви",
}