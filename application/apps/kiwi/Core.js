"use strict"
const request = require("request");
const FS = require('fs');
const cryptoJs = require("crypto-js");
const crypto = require("crypto");
// const sign = crypto.createSign('SHA1');
const { exec } = require("child_process");
var https = require('https');
const path = require("path");

const NodeRSA = require('node-rsa');

const child_process = require('child_process');
class Kiwi {
	#name = "kiwi";#api;#core;#HTTP_STATUSES;#connector;#toolbox;
	#serial;#terminal;#login;
	#oscc;
	#list = [];
	constructor(...args) {
		this.#serial = "c43f40f4-b586-4a5d-9352-14885043fb3a";
		this.#terminal = "10698455";
		this.#login = "testApp";
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#connector = this.#core.Connector;
		this.#toolbox = this.#core.Toolbox;
		// this.#oscc = new OpenSslClassCommands(`${__dirname}/certs/`);
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
		// setTimeout(async ()=> {
		// 	let person;
		// 	for (let item of this.#list) {
		// 		console.log("Агент=> ", item.Title, " => ", " Список терминалов=>", item.Terminals, " Персоны=> ", item.Persons);

		// 		// person = item.Persons.find(item=> item.UID == "13250371"); // testApp
		// 		// person = item.Persons.find(item=> item.UID == "13250826"); // xmlApp
		// 		// person = item.Persons.find(item=> item.UID == "13250871"); // paymentXml
		// 		person = item.Persons.find(item=> item.UID == "13250896"); // kassir_payment
		// 	}
		// 	if (person) {
		// 		console.log("person=> ", person);
		// 		// await person.GenerateKeyPair("8B728n8K5A");
		// 		// await person.GetBalance();
		// 		// await person.CheckPayment();
		// 		// await person.SetPublicKey();
		// 	}
		// }, 1000)
	}

	async #InitProcedure(procedure) {
		// await this.#SetNewCertToKiwi();

		// await this.#GetAgentBalance();
	}


	get Name() { return this.#name; }


	async #ParseResult(procedure, result) {
		if (procedure == "newSertificate") {
			if (result?.response?.$?.result && result?.response?.$?.result == 0) {
				let setPublicKeyResult = result?.response?.persons[0]?.setPublicKey[0]?.$?.result;
				if (setPublicKeyResult == 0) return true;
			}
		} else if (procedure == "getAgentBalance") {
			result = await this.#toolbox.XmlToString(result);
			if (result?.response?.$?.result && result?.response?.$?.result == 0) return true;
		}

		return false;
	}

	// процедура процерки баланса агента
	async #GetAgentBalance() {
		return new Promise((resolve, reject)=> {
			let data = `<?xml version="1.0" encoding="windows-1251"?>
				<request>
				 <client terminal="${this.#terminal}" software="Dealer v0"/>
				 <agents>
				 <getBalance/>
				 </agents>
				</request>`;











			// // exec(``);
			// // FS.writeFileSync(`${__dirname}/certs/${this.#terminal}/${this.#login}/request.txt`, data);
			// // exec(`cd ${__dirname}/certs/${this.#terminal}/${this.#login}/`)
			// //
			// // \nopenssl dgst –sha1 -out request.sign –sign ${__dirname}/certs/${this.#terminal}/${this.#login}/private.key ${__dirname}/certs/${this.#terminal}/${this.#login}/request.txt

			let privatePath = path.normalize(`${__dirname}/certs/${this.#terminal}/${this.#login}/private.key`);
			let signPath = path.normalize(`${__dirname}/certs/${this.#terminal}/${this.#login}/request.sign`);
			let requestPath = path.normalize(`${__dirname}/certs/${this.#terminal}/${this.#login}/request.txt`)

			// let cmd = `openssl dgst –sha1 -out ${signPath} –sign ${privateFile} ${requestFile}`;






			let requestStr = FS.readFileSync(requestPath, 'utf8');
			let privateStr = FS.readFileSync(privatePath, 'utf8');

			// let forbiden = ["-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----", " ",];
			// for (let item of forbiden) {
			// 	privateStr = privateStr.replace(item, "");
			// }
			// privateStr = privateStr.replace(/\r\n/g, '');

			const algo = "sha1";
			const sign = crypto.sign(algo, requestStr, privateStr);


			console.log("sign=> ", sign.toString('base64'));




			let data1 = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"X-Digital-Sign" : sign,
					"X-Digital-Sign": "SHA1withRSA",
					"X-Digital-Sign-Login": this.#login
				},
				body: data
			}
			request.post(data1, (err, response, body)=> {
				if (err) console.log("err=> ", err);
				console.log(body);
				resolve(body);
			});






			// const openssl = child_process.spawn('openssl', [
			//   'dgst',
			//   '–sha1',
			//   '-out', sign,
			//   '–sign', privateCert, requestTxt
			// ], { stdio: "inherit" });


			// console.log(cmd);
			// let cmd = `openssl dgst –sha1 -out ${__dirname}/certs/${this.#terminal}/${this.#login}/request.sign`;

			// exec(cmd, (error, stdout, stderr) => {
			//     if (error) {
			//         console.log(`error: ${error.message}`);
			//         resolve({errs: error, status: -1});
			//     }
			//     if (stderr) {
			//     	resolve({errs: stderr, status: 0});
			//     }
			//     resolve({errs: [], status: 1});
			// });
		});
	}
	// окончание процедуры процерки баланса агента



	// процедура установки сертификата на сервер киви
	async #InsertNewCertificate() {
		let result = await this.#toolbox.XmlToString(await this.#SetPublicKey("xdmMQTYJ2A"));
		if (result?.response?.$?.result && result?.response?.$?.result == 0) {
			let setPublicKeyResult = result?.response?.persons[0]?.setPublicKey[0]?.$?.result;
			if (setPublicKeyResult == 0) return true;
		}
		return false;
	}
	async #SetPublicKey(password) {
		let pass = await OpenSslClassCommands.CryptPassword(this.#terminal, this.#login, password);
		let md5Password = await OpenSslClassCommands.CryptPassword(password);
		return new Promise((resolve, reject)=> {
			let cert = FS.readFileSync(`${__dirname}/certs/${this.#terminal}/${this.#login}/public.key`, "utf-8");
			let forbiden = ["-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----", " ",];
			for (let item of forbiden) {
				cert = cert.replace(item, "");
			}
			cert = cert.replace(/\r\n/g, '');
			let data = {
				url: 'https://xml1.qiwi.com/xmlgate/xml.jsp',
				headers: {
					"Content-Type" : "text/html;charset=windows-1251"
				},
				body: `<?xml version="1.0" encoding="windows-1251"?>
					<request>
						<auth login="${this.#login}" signAlg="MD5" sign="${md5Password}"/>
						<client software="Dealer v0" terminal="${this.#terminal}"/>
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
				resolve(body);
			});
		});
	}
	// окончание процедуры уставновки сертификата на сервер





	async #SetNewCertToKiwi() {
		// для начала создадим новые сертификаты
		let createPrivate = await OpenSslClassCommands.CreatePrivateCert(this.#terminal, this.#login);
		if (createPrivate.status == 0 || createPrivate.status == 1) {
			let createPublic = await OpenSslClassCommands.CreatePublicCert(this.#terminal, this.#login);
			if (createPublic.status == 0 || createPublic == 1) {
				let spk = await this.#SetPublicKey("RfxQQEJy3A");
			}
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
	150: "Неверный пароль или нет прав на этот терминал",
	151: "Невозможно выполнить операцию. Одноразовый пароль.",
	202: "Ошибка данных запроса",
	133: "Нет прав на прием платежей",
	152: "Невозможно выполнить операцию. Неодноразовый пароль",
	155: "Прием платежа для данного провайдера запрещен",
	246: "Терминал привязан к другому компьютеру",
	295: "Ошибка в названии интерфейса или действия",
	300: "Другая (неизвестная) ошибка провайдера"
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

class KiwiTerminal {
	#serial;#ip;#address;#phone;#maxOnePay;#maxDayPay;#email;#connector;#toolbox;
	#persons = [];
	#id;#uid;#title;#person;
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
}

class KiwiPerson {
	#login;#roles = [];#status;#connector;#toolbox;
	#id;#uid;#title;#terminal;
	#keyPair;#publicKey;#privateKey;
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

		let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><getProviderByPhone><phone>9283407570</phone></getProviderByPhone></providers></request>`;
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
	async GetLastIds() {
		let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		let keyData = FS.readFileSync(`${personPath}private.key`, "utf8");

		const key = new NodeRSA();
		key.setOptions({signingScheme: "sha1"});
		key.importKey(keyData, "pkcs8");

		let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><terminals><getLastIds/></terminals></request>`;
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
	async CheckPayment() {
		// await this.GetLastIds();
		await this.GetProviderByPhone();

		// let personPath = path.normalize(`${__dirname}/certs/${this.#terminal.UID}/${this.#login}/`);
		// let keyData = FS.readFileSync(`${personPath}private.key`, "utf8");

		// const key = new NodeRSA();
		// key.setOptions({signingScheme: "sha1"});
		// key.importKey(keyData, "pkcs8");

		// let rdata = `<?xml version="1.0" encoding="windows-1251"?><request><client terminal="${this.#terminal.UID}" software="Dealer v0"/><providers><checkPaymentRequisites><payment id="180000"><from currency="643" amount="12.00"/><to currency="643" service="2" amount="12.00" account="9283407570"/><receipt id="180000" date="2022-10-31T21:00:01"/></payment></checkPaymentRequisites></providers></request>`;
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