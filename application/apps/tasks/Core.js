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
		// let expiredPassports = new ExpiredPassports(this.#core);
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
	constructor(core) {
		this.#core = core;
		this.#pathArhive = `${this.#core.TempDir}/list_of_expired_passports.csv.bz2`;
		this.#pathCsv = `${this.#core.TempDir}/list_of_expired_passports.csv`;
		this.#url = `https://проверки.гувм.мвд.рф/upload/expired-passports/list_of_expired_passports.csv.bz2`;
		this.#Init();
	}
	async #Init() {
		await this.#core.Connector.Request("dexol", `
            CREATE TABLE IF NOT EXISTS expired_passports (
                value VARCHAR(11) NOT NULL UNIQUE
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

		if (await this.#DownloadFile() && await this.#ExtractZip()) {
			console.log("Скачали и распаковали");
			this.#data = [];
			this.#Update();
		} else {
			console.log("Ошибка. Не делаем");
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
			fs.createReadStream(this.#pathArhive)
				.pipe(bz2())
				.pipe(this.#pathCsv)
				.on("finish", ()=> resolve(true))
				.on("error", ()=> reject(false))
		})
	}
	async #Update() {
		this.#myInterface = new lineReader(this.#pathCsv);

		this.#myInterface.on('error', err=> {
			console.log("ошибка ", error);
		});

		this.#myInterface.on('line', async line=> {
			let item = `('${line.split(",").reduce((total, item)=> total = total.concat(item), "")}')`;
			if (item != "('PASSP_SERIESPASSP_NUMBER')") this.#data.push(item);
			if (this.#data.length > 1000) {
				this.#myInterface.pause();
				await this.#InsertData();
			}
		});

		this.#myInterface.on('end', async ()=> {
			console.log("закончили обработку");
			await this.#InsertData();
		});
	}
	async #InsertData() {
		if (this.#data.length > 0) {
			let result = await this.#core.Connector.Request("dexol", `
				INSERT IGNORE INTO expired_passports (value) VALUES ${this.#data.join(",")}
			`);
		}
		this.#data = [];
		this.#myInterface.resume();
	}
}