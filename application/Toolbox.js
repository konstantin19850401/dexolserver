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
                if (err) {
                	console.log("ошибка парсинга xml==> ", err, " пришедший xml=> ", xml);
                }
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
	// перемешать массив случайным образом
	static ShuffleArray(array) {
		if (!Array.isArray(array)) return;
		for (let i = array.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			[array[i], array[j]] = [array[j], array[i]];
		}
		return array;
	}
	// проверить паспорт
	static async CheckPassport( data, connector, person ) {
		let errs = [];
		let rxDate = /^(\d{1,2}).(\d{1,2}).(\d{4})$/;
		let moment = Toolbox.Moment();
		!data?.FizDocSeries && errs.push("Не указана серия документа удостоверяющего личность.");
		!data?.FizDocNumber && errs.push("Не указан номер документа удостоверяющего личность.");
		!data?.FizDocOrg && errs.push("Не указана организация, выдавшая документ.");
		!data?.FizDocType && errs.push("Не указан тип удостоверения личности.");
		(!data?.FizDocDate || !rxDate.test(data.FizDocDate) || !moment(data.FizDocDate, "DD.MM.YYYY").isValid()) && errs.push("Не указана дата выдачи документа.");
		(!data?.DocDate || !rxDate.test(data.DocDate) || !moment(data.DocDate, "DD.MM.YYYY").isValid()) && errs.push("Не указана дата договора.");
		if (errs.length == 0 && data.FizDocType == 1) {
			let rxSeries = /^[0-9]{4}$/;
			let rxNumber = /^[0-9]{6}$/;
			let rxCode = /^\d{3}-\d{3}$/;
			!rxSeries.test(data.FizDocSeries) && errs.push(`Для типа документа "Паспорт РФ" серия должна состоять из 4 цифр без пробелов.`);
			!rxNumber.test(data.FizDocNumber) && errs.push(`Для типа документа "Паспорт РФ" номер должен состоять из 6 цифр без пробелов.`);
			(!data?.FizDocOrgCode || !rxCode.test(data.FizDocOrgCode)) && errs.push("Не указан код подразделения или он имеет ошибочный формат.");
			if (errs.length == 0) {
				let rows = await connector.Request("dexol", `SELECT COUNT(*) as total FROM \`expired_passports\` WHERE value='${data.FizDocSeries}${data.FizDocNumber}'`);
				if (rows[0].total > 0) errs.push(`Паспорт с серией ${data.FizDocSeries} и номером ${data.FizDocNumber} находится в списках недействительных паспортов.`);
			}
		}
		if (errs.length == 0 && person) {
			(!person?.Birth || !rxDate.test(person.Birth) || !moment(person.Birth, "DD.MM.YYYY").isValid()) && errs.push("Не указана дата рождения.");
			if (errs.length == 0) {
				let datesIssue = [14,20,45];
				moment(person.Birth, "DD.MM.YYYY").isAfter(moment(data.DocDate, "DD.MM.YYYY")) && errs.push("Дата рождения не может быть больше даты договора.") ||
				moment(data.FizDocDate, "DD.MM.YYYY").isAfter(moment(data.DocDate, "DD.MM.YYYY")) && errs.push("Дата выдачи документа не может быть больше даты договора.") ||
				moment(person.Birth, "DD.MM.YYYY").isAfter(moment(data.FizDocDate, "DD.MM.YYYY")) && errs.push("Дата рождения не может быть больше даты выдачи документа.") ||
				moment(data.DocDate, "DD.MM.YYYY").diff(moment(person.Birth, "DD.MM.YYYY"), "year") <= 18 && errs.push("Абонент не может быть младше 18 лет.");
				for (let dateIssue of datesIssue) {
					let r = moment(data.FizDocDate, "DD.MM.YYYY").diff(moment(data.Birth, "DD.MM.YYYY"), "year") >= dateIssue &&
							moment(data.DocDate, "DD.MM.YYYY").diff(moment(person.Birth, "DD.MM.YYYY"), "year") >= dateIssue ||
							moment(data.FizDocDate, "DD.MM.YYYY").diff(moment(data.Birth, "DD.MM.YYYY"), "year") < dateIssue &&
							moment(data.DocDate, "DD.MM.YYYY").diff(moment(person.Birth, "DD.MM.YYYY"), "year") < dateIssue;
					if (!r) {
						let fromBirthtoDocDate = Math.abs(moment(data.DocDate, "DD.MM.YYYY").diff(moment(person.Birth, "DD.MM.YYYY"), "days"));
						let fromBirthtoFizDocDate = Math.abs(moment(data.FizDocDate, "DD.MM.YYYY").diff(moment(person.Birth, "DD.MM.YYYY"), "days"));
						Math.abs(fromBirthtoDocDate - fromBirthtoFizDocDate) > 27 && errs.push(`Паспорт просрочен на ${ Math.abs(fromBirthtoDocDate - fromBirthtoFizDocDate) } дней.`);
						break;
					}
				}
				let permissiblePeriod = 4;
				let langPeriod = permissiblePeriod == 1 ? "года" : "лет";
				let chDate = parseInt(moment(data.FizDocDate, "DD.MM.YYYY").year().toString().substring(2,4));
                let chFds = parseInt(data.FizDocSeries.toString().substring(2,4));
                Math.abs(chDate - chFds) > permissiblePeriod && errs.push(`Ошибочные данные паспорта. Разница между серией и годом выдачи более ${permissiblePeriod} ${langPeriod}.`);
			}
		}
		return errs;
	}
}

module.exports = Toolbox;