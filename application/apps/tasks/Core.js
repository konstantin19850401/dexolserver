"use strict"
const path = require("path");
const fs = require('fs');
const https = require('https');
const request = require("request");
const bz2 = require('unbzip2-stream');
const tarfs = require('tar-fs');
const lineReader = require('line-by-line');

class Tasks {
	#name = "tasks";#core;#connector;#toolbox;#api;#HttpStatuses;
	constructor(...args) {
		this.#core = args[0];
		this.#connector = this.#core.Connector;
		this.#toolbox = this.#core.Toolbox;
		// this.#api = new Api(this.#core);
		this.#HttpStatuses = this.#core.HttpStatuses;
		this.#Init();
	}
	get Name() { return this.#name; }

	async #Init() {
		let expiredPassports = new ExpiredPassports(this.#core);
	}
	
}

module.exports = Tasks;

class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.apps.tasks";
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




class ExpiredPassports {
	#core;#pathArhive;#pathCsv;#url;
	#myInterface;#data = [];
	#startH;#inProcess = false;
	#lastStart;#cnt = 0;
	constructor(core) {
		this.#core = core;
		this.#pathArhive = `${this.#core.TempDir}/list_of_expired_passports.csv.bz2`;
		this.#pathCsv = `${this.#core.TempDir}/list_of_expired_passports.csv`;
		this.#url = `https://проверки.гувм.мвд.рф/upload/expired-passports/list_of_expired_passports.csv.bz2`;
		this.#Init();
	}
	get Reasons() {
		return {
			1: "ИСТЕК СРОК ДЕЙСТВИЯ",
			2: "ЗАМЕНЕН НА НОВЫЙ",
			3: "ВЫДАН С НАРУШЕНИЕМ",
			4: "ЧИСЛИТСЯ В РОЗЫСКЕ",
			5: "ИЗЪЯТ, УНИЧТОЖЕН",
			6: "В СВЯЗИ СО СМЕРТЬЮ ВЛАДЕЛЬЦА",
			8: "ТЕХНИЧЕСКИЙ БРАК"
		}
	}
	async #Init() {
		await this.#core.Connector.Request("dexol", `
            CREATE TABLE IF NOT EXISTS expired_passports (
                value VARCHAR(11) NOT NULL UNIQUE,
                code TINYINT(2) NOT NULL
            ) ENGINE = InnoDB
            PARTITION BY KEY(value) (
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
		this.#startH = 16; // час, после которого производится ежедневный запуск задачи
		let moment = this.#core.Toolbox.Moment();
		this.#lastStart = moment().add(-1, "days");
		this.#SetNextStartDate();
	}
	async #StartTask() {
		if (!this.#inProcess) {
			console.log("запуск задачи");
			this.#inProcess = true;
			// if (await this.#DownloadFile() && await this.#ExtractZip()) {
			// if (await this.#ExtractZip()) {
			// 	console.log("Скачали и распаковали");
			// 	this.#data = [];
			// 	this.#Update();
			// } else {
			// 	console.log("Ошибка. Не делаем");
			// }

			this.#data = [];
			this.#Update();
		}
	}
	async #DownloadFile() {
		return new Promise((resolve, reject)=> {
			let file = fs.createWriteStream(this.#pathArhive);
			https
				.get(this.#url, response=> {
					response.pipe(file)
						file
						.on("finish", ()=> {
							file.close();
							resolve(true);
						})
						.on("error", err=> { 
							fs.unlink(this.#pathArhive, () => console.log(err.message));
							reject(false);
						});
				})
				.on("error", err=> console.log("Ошибка скачивания ", err) && reject(false));
		})
	}
	async #ExtractZip() {
		return new Promise((resolve, reject)=> {
			try {
				fs.createReadStream(this.#pathArhive)
				.pipe(bz2())
				.pipe(fs.createWriteStream(this.#pathCsv))
				.on("finish", ()=> resolve(1))
				.on("error", ()=> resolve(0));
			} catch(e) {
				console.log("ошибка ", e);
				resolve(0);
			}
		})
	}
	async #Update() {
		this.#myInterface = new lineReader(this.#pathCsv);

		this.#myInterface.on('error', err=> console.log("ошибка ", error));

		this.#myInterface.on('line', async line=> {
			let arr = line.split(",");
			if (arr[0] != "PASSP_SERIES") {
				this.#cnt++;
				let pdata = arr[0].concat(arr[1]);
				let code = arr[2];
				let item = `('${pdata}', '${code}')`;
				this.#data.push(item);
				if (this.#data.length > 1000) {
					this.#myInterface.pause();
					await this.#InsertData();
				}
				if (this.#cnt % 10000000 == 0) console.log("Обработано "+ this.#cnt +" строк");
			}
		});

		this.#myInterface.on('end', async ()=> {
			await this.#InsertData();
			this.#inProcess = false;
			this.#SetNextStartDate();
		});
	}
	async #InsertData() {
		if (this.#data.length > 0) {
			let result = await this.#core.Connector.Request("dexol", `
				INSERT IGNORE INTO expired_passports (value, code) VALUES ${this.#data.join(",")}
			`);
		}
		this.#data = [];
		this.#myInterface.resume();
	}

	#SetNextStartDate() {
		this.#cnt = 0;
		let moment = this.#core.Toolbox.Moment();
		let date = moment();
		let ndate = moment();
		let hh = date.hour();
		if (date.diff(this.#lastStart, "days") > 0) {
			if (hh >= this.#startH && hh <= 24) {
				// если задача выполняется, то запустим ее через 10 мин, иначе - запускаем сразу
				if (this.#inProcess) setTimeout(()=> this.#SetNextStartDate(), ndate.add(10, "minutes").diff(date));
				else {
					this.#lastStart = date;
					this.#StartTask();
				}
			} else {
				let next = moment(date.format(`YYYY-MM-DDT${this.#startH}:01:00Z`), "YYYY-MM-DDTHH:mm");
				setTimeout(()=> this.#SetNextStartDate(), next.diff(date));
			}
		} else {
			let next = moment(date.format(`YYYY-MM-DDT${this.#startH}:01:00Z`), "YYYY-MM-DDTHH:mm").add(1, "days");
			console.log("задача в текущий день уже запускалась. Запустим через ", next.diff(date), " ms" );
			setTimeout(()=> this.#SetNextStartDate(), next.diff(date));
		}
	}
}