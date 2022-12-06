"use strict"
const FS = require('fs');
const DIR_CONNECTORS = `${__dirname}/connectors`;
const DIR_APPS = `${__dirname}/apps`;
const HTTP_STATUSES = require("./HttpStatuses");
const TOOLBOX = require("./Toolbox");
const Auth = require("./Auth");
const Apps = require("./Apps");
const Dicts = require("./Dicts");

class Core {
	#port;#express;#connectors = [];
	#users = [];#auth;#applications;#dicts = [];
	constructor(conf) {
		this.#port = conf.port;
		this.#express = conf.express;
		setInterval(()=> this.#GarbageCollector(), 1000)
	};

	get HttpStatuses() { return HTTP_STATUSES; }
	get Dicts() { return this.#dicts; }
	get Connector() { return this.#connectors.find(item=> item.Name == "mysql"); }
	get Toolbox() { return TOOLBOX; }
	get Applications() { return this.#applications; }

	Start() {
		this.#express.use(this.#AllowCrossDomain())
		this.#InitApplication();
	}
	#AllowCrossDomain() {
		// Запросы с удаленных ресурсов
		return function (req, res, next) {
			res.header('Access-Control-Allow-Origin', '*');
		    res.header('Access-Control-Allow-Credentials', 'true');
		    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
		    res.header('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, X-Requested-With, Range');
		    res.header('Access-Control-Expose-Headers', 'Content-Length');
		    next();
		};
	}
	async #InitCore() {
		this.#InitConnectors()
		&& this.#InitDefConnection()
		&& this.#InitApps()
		&& this.#InitRoutes()
		&& this.#InitValidators()
		&& await this.#InitDicts()
	}

	#InitConnectors() {
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ КОННЕКТОРОВ С БАЗОЙ ДАННЫХ`);
		try {
			let dirs = FS.readdirSync(DIR_CONNECTORS, { withFileTypes: true });
			for (let dir of dirs) {
				let connector = new (require(`${DIR_CONNECTORS}/${dir.name}/index`))();
				this.#connectors.push(connector);
			}
		} catch(e) {
			console.log("Критическая ошибка ", e);
			return false;
		}
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ КОННЕКТОРОВ С БАЗОЙ ДАННЫХ ЗАВЕРШЕН УСПЕШНО`);
		return true;
	}
	#InitDefConnection() {
		let mysql = this.#connectors.find(item=> item.Name == "mysql");
		mysql.AddBase({name: "dexol", host: "127.0.0.1", user: "dex", password: "12473513", database: "dexol_system"});
		mysql.AddBase({name: "mega", host: "192.168.0.33", user: "dex", password: "dex", database: "dex_mega"});
		return true;
	}
	#InitApps() {
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЙ`);
		try {
			this.#applications = new Apps(this);
			let dirs = FS.readdirSync(DIR_APPS, { withFileTypes: true });
			let connector = this.#connectors.find(item=> item.Name == "mysql");
			for (let dir of dirs) {
				let app = new (require(`${DIR_APPS}/${dir.name}/Core`))(this);
				app && this.#applications.AddApp(app) && console.log(`${"  ".repeat(2)} Инициализация приложения ${app.Name}`);
			}
		} catch(e) {
			console.log("Критическая ошибка ", e);
			return false;
		}
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЙ ЗАВЕРШЕНА УСПЕШНО`);
		return true;
	}
	#InitRoutes() {
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ РОУТИНГА`);
		try {
			this.#express.get("/cmd", async (req, res)=> await this.#Validation(req, res));
			this.#express.get("/subscription", async (req, res)=> await this.#Subscription(req, res));
		} catch(e) {
			console.log("Критическая ошибка ", e);
			return false;
		}
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ РОУТИНГА ЗАВЕРШЕНА УСПЕШНО`);
		return true;
	}
	#InitValidators() {
		console.log(`${"  ".repeat(1)}ЯДРО. ПЕРЕДАЧА КОННЕКТОРА СИСТЕМЕ АВТОРИЗАЦИИ`);
		let connector = this.#connectors.find(item=> item.Name == Auth.ConnectorName);
		if (connector) {
			this.#auth = new Auth(connector, HTTP_STATUSES, TOOLBOX);
			console.log(`${"  ".repeat(1)}ЯДРО. ПЕРЕДАЧА КОННЕКТОРА СИСТЕМЕ АВТОРИЗАЦИИ ЗАВЕРШЕНА УСПЕШНО`);
			return true;
		} else {
			console.log(`${"  ".repeat(1)}ЯДРО. ПЕРЕДАЧА КОННЕКТОРА СИСТЕМЕ АВТОРИЗАЦИИ ЗАВЕРШЕНА С ОШИБКОЙ. НЕ НАЙДЕН КОННЕКТОР`);
			return false;
		}
	}
	async #InitDicts() {
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ СПРАВОЧНИКОВ`);
		this.#dicts = new Dicts(this);
		console.log(`${"  ".repeat(1)}ЯДРО. ИНИЦИАЛИЗАЦИЯ СПРАВОЧНИКОВ ЗАВЕРШЕНА УСПЕШНО`);
		// setTimeout(()=> {
		// 	for (let dict of this.#dicts.List) console.log(dict.Structure);
		// }, 2000)
		return true;
	}

	#GarbageCollector() {
		let date = new Date().getTime();
		// для начала закроем все подписки, которые висят более minutes
		let minutes = 5;
		let subsctiptionTime = minutes * 60000;
		for (let user of this.#users) {
			if (date - user.LastSubscription > subsctiptionTime ) {
				if (user.IfOpenConnection) user.CloseConnection({status: HTTP_STATUSES.CLIENT_CLOSED_REQUEST, message: "Timeout subscription"});
			}
		}
		// если юзер есть, а соединения нет и такое более чем в 3 раза длинее по времени, чам subsctiptionTime, удалим такого юзера
		let waitTimer = subsctiptionTime * 3;
		this.#users = this.#users.filter(item=> date - item.LastSubscription < waitTimer);
	}


	#GetModule(com) {
		let comSplit = com.split(".");
		switch(comSplit[0]) {
			case "dexol":
				switch(comSplit[1]) {
					case "core":
						switch(comSplit[2]) {
							case "auth": return this.#auth;
							break;
							case "apps": return this.#applications;
							break;
							case "dicts": return this.#dicts;
							default: return null;
						}
					break;
					case "apps": return this.#applications.GetApp(comSplit[2]);
					break;
					default: return null;
				}
			break;
			default: return null;
		}
	}
	#Check(packet) {
		if ( packet.com == "dexol.core.auth" && packet.subcom == "initsession" ) return true;
		else if (!this.#users.find(item=> item.Uid == packet?.uid)) return false;
		return true;
	}
	async #Validation(req, res) {
		let packet = TOOLBOX.ParsingRequest(req);
		if ( !packet ) res.end(JSON.stringify({status: HTTP_STATUSES.BAD_REQUEST, message: "Wrong packet"}));
		else {
			if ( !packet?.com || !packet?.subcom ) res.end(JSON.stringify({status: HTTP_STATUSES.BAD_REQUEST, message: "Fields com/subcom required"}));
			else {
				if ( this.#Check( packet ) ) {
					let md = this.#GetModule(packet.com);
					md && md.Check(packet, this.#users, res);
				} else {
					res.end(JSON.stringify({com: packet.com, subcom: packet.subcom, status: HTTP_STATUSES.UNAUTHORIZED, message: "User not authorized"}));
				}
			}
		}
	}
	async #Subscription(req, res) {
		// console.log("подписка");
		let packet = TOOLBOX.ParsingRequest(req);
		if ( !packet ) res.end(JSON.stringify({status: HTTP_STATUSES.BAD_REQUEST, message: "Wrong packet"}));
		else {
			let user = this.#users.find(item => item.Uid == packet?.uid);
			if (!user) res.end(JSON.stringify({status: HTTP_STATUSES.UNAUTHORIZED, message: "User not authorized"}));
			else {
				user.Connection = res;
			}
		}
	}
	#InitApplication() {
		this.#express.listen(this.#port, ()=> {
			console.log(`ЗАПУСК СЕРВЕРА УСПЕШНО ОСУЩЕСТВЛЕН НА ПОРТУ ${this.#port}`);
			console.log(`СОБИРАЕМ ЯДРО`);
			this.#InitCore();
		});
	}
}
module.exports = Core;