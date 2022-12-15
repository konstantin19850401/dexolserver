"use strict"
const path = require("path");
const fs = require('fs');
const https = require('https');
const request = require("request");
const bz2 = require('unbzip2-stream');
const tarfs = require('tar-fs');

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
	#core;
	constructor(core) {
		this.#core = core;
		this.#Init();
	}
	async #Init() {
		if (await this.#DownloadFile() && await this.#ExtractZip()) {
			console.log("Скачали и распаковали");
		} else {
			console.log("Ошибка. Не делаем");
		}

		// let ifDownload = true || await this.#DownloadFile();
		// if (ifDownload) {
		// 	let isExtract = await this.#ExtractZip();
		// } else console.log("Загрузка завершилась с ошибкой");
	}
	async #DownloadFile() {
		return new Promise((resolve, reject)=> {
			let dest = `${this.#core.TempDir}/list_of_expired_passports.csv.bz2`;
			let file = fs.createWriteStream(dest);
			https
				.get(`https://проверки.гувм.мвд.рф/upload/expired-passports/list_of_expired_passports.csv.bz2`, response=> {
					response.pipe(file)
						file
						.on("finish", ()=> {
							file.close();
							resolve(true);
						})
						.on("error", err=> { 
							fs.unlink(dest, () => console.log(err.message));
							reject(false);
						});
				})
				.on("error", err=> console.log("Ошибка скачивания ", err) && reject(false));

		})
	}
	async #ExtractZip() {
		return new Promise((resolve, reject)=> {
			let source = `${this.#core.TempDir}/list_of_expired_passports.csv.bz2`;
			let file = fs.createWriteStream(`${this.#core.TempDir}/list_of_expired_passports.csv`);
			fs.createReadStream(source).pipe(bz2()).pipe(file).on("finish", ()=> resolve(true)).on("error", ()=> reject(false));
		})
	}
}