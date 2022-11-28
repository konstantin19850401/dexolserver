"use strict"
const qs = require("querystring");
const url = require("url");
const crypto = require("crypto-js");
const soap = require("strong-soap").soap;
const xml2js = require("xml2js");
const moment = require("moment");

class Toolbox {
	constructor() {}
	static async SoapRequest(url, data) {
		return new Promise((resolve, reject)=> {
			let obj = {err: null, client: null};
			soap.createClient(url, data, (err, client)=> {
				if (err) {
					console.log("ошибка soap запроса ", err);
					obj.err = err;
				} else {
					obj.client = client;
				}
				resolve(obj);
			})
		});
	}
	static ParsingGet( request ) {
		try {
			let query =  qs.parse(url.parse(request.url).query);
			return JSON.parse(query.packet);
		} catch (e) {
			return null;
		}
	}
	// сделать async потом
	static ParsingPost( request ) {
		try {
			let body = "";
			let packet;
			request.on("data", chunk => body += chunk.toString());
			request.end("end", () => packet = JSON.parse(body));
			return packet;
		} catch (e) {
			return null;
		}
	}
	static ParsingRequest( request ) {
		return  request.method == "GET" && this.ParsingGet( request )
			|| request.method == "POST" && this.ParsingPost( request )
			|| null;
	}
	static GenerateUniqueHash() {
		return crypto.MD5((+new Date()).toString()).toString();
	}
	static IsNumber(num) {
		if (typeof num === "number") return num - num === 0;
		if (typeof num === "string" && num.trim() != "") return Number.isFinite ? Number.isFinite(+num) : isFinite(+num);
		return false;
	}
	static RandomPositiveInt(min, max) {
		if (!min) min = 0;
		if (!max) max = Number.MAX_VALUE;
		return Math.floor(Math.random() * (max - min)) + min;
	}
	static async XmlToString(xml) {
		return new Promise((resolve, reject)=> {
            xml2js.parseString(xml, function(err, obj) {
                if (err) console.log("ошибка парсинга xml==> ", err);
                resolve(obj);
            })
        })
	}
	static HtmlSpecialChars(str) {
		if (typeof(str) == "string") {
            str = str.replace(/&/g, "&amp;");
            str = str.replace(/"/g, "&#34;");
            str = str.replace(/'/g, "&#39;");
            str = str.replace(/</g, "<");
            str = str.replace(/>/g, ">");
            str = str.replace(/\\/gi, `/`);
        };
        return str;
	}
	static Moment() {

		return moment;
	}
	static ShuffleArray(array) {
		if (!Array.isArray(array)) return;
		for (let i = array.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}
}

module.exports = Toolbox;