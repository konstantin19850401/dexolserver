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
	#tasks = [];#maxPayment = 160;
	#paymentsList = [];#isBusy = 0;
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
	get IsBusy() { return this.#isBusy; }

	#PrintMessage(message) {
		console.log(message);
	}
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
			let task = this.#tasks.find(item=> parseInt(item.Id) == parseInt(row.id));
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
				// console.log("xml=> ", xml);
				request.post(data, async (err, response, body)=> {
					if (err) {
						console.log("err=> ", err);
						resolve({status: 2});
					} else {
						let json = await this.#toolbox.XmlToString(body);
						// console.log(body);
						if (json?.response?.$?.result == 0) {
							if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result == 0) {
								if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 3) {
									resolve({status: 0});
								} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.status == 0) {
									if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.result == 16) {
										resolve({status: 16});
									} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.result == 202) {
										resolve({status: 202});
									} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.result == 215) {
										resolve({status: 215}); 
									} else if (json?.response?.providers[0]?.checkPaymentRequisites[0]?.payment[0]?.$?.result == 272) {
										resolve({status: 272}); 
									} else {
										resolve({status: 3});
									}
									this.#PrintMessage(body);

								} else {
									this.#PrintMessage(body)
									resolve({status: 1});
								}
							} else {
								this.#PrintMessage(body)
								resolve({status: 4, result: json?.response?.providers[0]?.checkPaymentRequisites[0]?.$?.result});
							}
						} else {
							this.#PrintMessage(body)
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
									this.#PrintMessage(body)
									resolve({status: 4, result: json?.response?.providers[0]?.addOfflinePayment[0]?.$?.result});
								}
							} else {
								this.#PrintMessage(body)
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
	async #GetPaymentStatus(personUid, payment) {
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
	async CheckPaymentStatus(personUid, payment) {
		if (this.#isBusy == 0) {
			this.#isBusy = 1;
			let result = await this.#GetPaymentStatus(personUid, payment);
			this.#isBusy = 0;
			return result;
		}
	}
	async SendPayment(payment, task) {
		if (this.#isBusy == 0) {
			console.log("отправляем платеж на сумму ", payment.amount, " для номера ", payment.num, " для задачи ", task.Id);
			this.#isBusy = 1;
			let methods = [
				{method: async (...args)=> { return await this.GetProviderByPhone(...args); },     name: "GetProviderByPhone", errStatus: 7},
				{method: async (...args)=> { return await this.GetLastId(...args); },              name: "GetLastId", errStatus: 3},
				{method: async (...args)=> { return await this.GetBalance(...args); },             name: "GetBalance", errStatus: 10},
				{method: async (...args)=> { return await this.CheckPaymentRequisites(...args); }, name: "CheckPaymentRequisites", errStatus: 4},
				{method: async (...args)=> { return await this.#AddOfflinePayment(...args); },     name: "AddOfflinePayment", errStatus: 5},
			];

			for (let item of methods) {
				let result = await item.method(task.Person, payment);
				if (result.status != 0) {
					if (item.name == "CheckPaymentRequisites") {
						if (result.status == 16) payment.status = 16;
						else if (result.status == 202) payment.status = 202;
						else if (result.status == 215) { 
							console.log("платеж надо провести попозже");
							payment.status = 215;
						} else if (result.status == 272) { 
							console.log("Провайдер в данный момент не доступен, пересчитать задачу");
							payment.status = 272;
							await task.RebuildTask();
						}  
						else payment.status = 4;
					} else {
						payment.status = item.errStatus;
					}
					await task.SaveTaskData();
					this.#isBusy = 0;
					return;
				}
				if (item.name == "GetProviderByPhone") payment.service = result.id;
				if (item.name == "GetLastId") payment.id = result.id + 1;
				if (item.name == "GetBalance" && result.balance < payment.amount) {
					payment.status = 8;
					await task.SaveTaskData();
					this.#isBusy = 0;
					return;
				}
			}
			payment.status = 6;
			this.#isBusy = 0;
			await task.SaveTaskData();
			return;
		}






		// this.#isBusy = 1;
		// console.log("отправляем платеж на сумму ", payment.amount, " для номера ", payment.num, " для задачи ", task.Id);
		// payment.status = 1;
		// let provider = await this.GetProviderByPhone(task.Person, payment);
		// if (provider.status != 0) {
		// 	payment.status = 7;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// payment.service = provider.id;
		// let lastPayment = await this.GetLastId(task.Person);
		// if (lastPayment.status != 0) {
		// 	payment.status = 3;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// payment.id = lastPayment.id + 1;
		// let agentBalance = await this.GetBalance(task.Person);
		// if (lastPayment.status != 0) {
		// 	payment.status = 10;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// if (agentBalance.balance < payment.amount) {
		// 	payment.status = 8;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// let checkPayment = await this.CheckPaymentRequisites(task.Person, payment);
		// if (checkPayment.status != 0) {
		// 	if (checkPayment.status == 16) payment.status = 16; // Превышен суточный лимит на сумму операций
		// 	else payment.status = 4;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// let offlinePayment = await this.#AddOfflinePayment(task.Person, payment);
		// if (offlinePayment.status != 0) {
		// 	payment.status = 5;
		// 	await task.SaveTaskData();
		// 	this.#isBusy = 0;
		// 	return;
		// }
		// payment.status = 6;
		// await task.SaveTaskData();
		// // console.log("provider=> ", provider);
		// // console.log("lastPayment=> ", lastPayment);
		// // console.log("agentBalance=> ", agentBalance);
		// // console.log("checkPayment=> ", checkPayment);
		// this.#isBusy = 0;
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
	#minInterval;#maxInterval;#list;#data;#comment;#delayed = 0;#dateStart;
	#cnt = 0;#ignoreStatuses = [0,1,4,5,6,7,8,9,10,16,202];
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
			dateStart: this.#dateStart,
			comment: this.#comment,
			sum: this.#list.reduce((total, item)=> total + parseInt(item.amount), 0),
			successSum: this.#list.reduce((total, item)=> item.status == 0 && (total += parseInt(item.amount)) || (total += 0), 0),
			cnt: this.#list.length,
			successCnt: this.#list.reduce((total, item)=> item.status == 0 && (total += 1) || (total += 0), 0),
			list: this.#list,
			status: this.#status,
		}
	}

	#Init(row) {
		this.#data = JSON.parse(row.data);
		this.#minInterval = this.#data?.minInterval || 10;
		this.#maxInterval = this.#data?.maxInterval || 25;
		this.#comment = this.#data?.comment || "";
		this.#delayed = this.#data?.delayed == 1 ? this.#data.delayed : 0;
		this.#dateStart = this.#delayed == 1 ? this.#data.dateStart : this.#creationDate;
		this.#list = this.#data.list;
		if (this.#status == 1) {
			this.#SetDates();
			this.#tick = setInterval(async ()=> { await this.#CheckPayment() }, 20000);
		}
	}
	#SetDates() {
		let moment;
		let cmoment = this.#toolbox.Moment()();
		if (this.#delayed == 1) {
			console.log("отложенная задача");
			let dateStart = this.#toolbox.Moment()(this.#dateStart);
			console.log("dateStart=> ", dateStart);
			if (dateStart.isAfter(cmoment)) moment = dateStart;
			else {
				moment = cmoment;
			}
		} else {
			moment = this.#toolbox.Moment()();
		}
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
		// проверить статусы
		for (let payment of this.#list) {
			if (payment.status == 6) {
				if (this.#terminal.IsBusy == 0) {
					console.log("Есть платеж на проверку статуса ", payment.num);
					let check = await this.#terminal.CheckPaymentStatus(this.#person, payment);
					if (check.status == 0) {
						if (check.paymentStatus == 2) {
							payment.status = 0;
							console.log("платеж успешен");
							this.#paymentStatusCheck = this.#paymentStatusCheck.filter(item=> item.hash != payment.hash);
						} else if (check.paymentStatus == 0) {
							payment.status = 5;
							this.#paymentStatusCheck = this.#paymentStatusCheck.filter(item=> item.hash != payment.hash);
						} else if (check.paymentStatus == 3 || check.paymentStatus == 1) this.#paymentStatusCheck.push(payment);
					} else payment.status = 5;
					await this.SaveTaskData();
				} else {
					console.log("Есть платеж на проверку статуса. Но терминал пока занят ", payment.num);
				}
			}
		}


		let payment = this.#list.find(item=> this.#ignoreStatuses.indexOf(item.status) == -1);
		if (!payment) {
			if (this.#paymentStatusCheck.length == 0) await this.#Complete();
		} else {
			if (this.#terminal.IsBusy == 0) {
				let start = true;
				let moment = this.#toolbox.Moment();
				let currentDate = moment();
				let paymentDate = moment(payment.date).format("YYYY-MM-DDTHH:mm:ss");
				if (currentDate.isAfter(paymentDate) && start) {
					payment.status = 0;
					await this.#terminal.SendPayment(payment, this);
				}
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
	RebuildTask() {
		console.log("Сделаем пересчет задачи");
		this.#SetDates();
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
	244: "Терминал не зарегистрирован у оператора",
	272: "Временно нет связи с провайдером",
	246: "Терминал привязан к другому компьютеру",
	295: "Ошибка в названии интерфейса или действия",
	300: "Другая (неизвестная) ошибка провайдера",
	
}

const serverErrors = {
	0: "Ок",
	1: "Не указана персона",
	2: "Ошибка запроса",
	3: "Ошибка результата авторизации. Смотреть результат операции в ошибках киви",
	4: "Ошибка результата запроса к методу. Смотреть результат операции в ошибках киви",
}