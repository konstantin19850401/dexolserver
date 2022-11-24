"use strict"
class Api {
	#HTTP_STATUSES;#connector;#core;
	constructor(...args) {
		this.#core = args[0];
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#connector = this.#core.Connector;
	}
	#GetAppData(packet, users) {
		let user = users.find(item => item.Uid == packet.uid);
		let dicts = this.#core.Dicts.List;
		let data = {action: packet.data.action};
		let rpacket = new Packet({status: this.#HTTP_STATUSES.OK, data: data, hash: packet.hash});
		user.CloseConnection(rpacket.ToString());
	}
	#GetPaymentsList(packet, users, application) {
		let paymentsList = application.PaymentsList;
		let list = [];
		let ignore = ["list", "successCnt"];
		for (let item of paymentsList) {
			list.push(Object.fromEntries(Object.entries(item).filter(([key]) => ignore.indexOf(key) == -1)));
		}
		//packet.data.filter = [{name: "id", value: 12}, {name: "terminal", value: "10746127"}];
		if (packet.data.filter && Array.isArray(packet.data.filter)) {
			list = list.filter(item=> {
				return packet.data.filter.every(fitem=> item[fitem.name] == fitem.value)
			})
		}
		let data = {action: packet.data.action, list: list};
		let rpacket = new Packet({status: this.#HTTP_STATUSES.OK, data: data, hash: packet.hash});
		let user = users.find(item => item.Uid == packet.uid);
		user.CloseConnection(rpacket.ToString());
	}
	#GetPayment(packet, users, application) {
		let errs = [];
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		let data = {action: packet.data.action};
		if (!packet?.data?.id) errs.push("Вы не указали id записи");
		else {
			let payment = application.PaymentsList.filter(item=> item.id == packet.data.id);
			if (!payment) status = this.#HTTP_STATUSES.NOT_FOUND
			else {
				status = this.#HTTP_STATUSES.OK;
				data.payment = payment
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet.hash});
		let user = users.find(item => item.Uid == packet.uid);
		user.CloseConnection(rpacket.ToString());
	}
	async #NewTask(packet, users, application) {
		let errs = [];
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		let moment = this.#core.Toolbox.Moment();
		if (!packet?.data?.task?.person) errs.push("Вы не указали персону");
		if (packet?.data?.task?.delayed && packet.data.task.delayed == 1) {
			if (!packet?.data?.task?.dateStart) errs.push("Вы указали, что задача должна быть отложенной, но не указали дату начала исполнения задачи.");
			else {
				let date = moment(packet.data.dateStart);
				if (!date.isValid()) errs.push("Указанная дата отложенной задачи не валидна");
			}
		}
		// if (!packet?.data?.task?.turnType) errs.push("Вы не указали тип обработки очереди");
		// if (!packet?.data?.task?.operator) errs.push("Вы не указали оператора");

		if (!packet?.data?.task?.minInterval || !packet?.data?.task?.maxInterval) errs.push("Вы не указали один из интервалов или оба");
		else {
			if (!this.#core.Toolbox.IsNumber(packet.data.task.minInterval) || !this.#core.Toolbox.IsNumber(packet.data.task.maxInterval)) errs.push("Интервал это число!");
			else {
				if (packet.data.task.minInterval > packet.data.task.maxInterval) errs.push("Минимальный интервал не может быть больше максимального");
			}
		}

		if (!packet?.data?.task?.list && !Array.isArray(packet.data.task.list)) errs.push("Вы не указали список данных");

		let data = {action: packet.data.action};
		if (errs.length == 0) {
			let jdata = {list: [], minInterval: packet.data.task.minInterval, maxInterval: packet.data.task.maxInterval, operator: "", comment: packet?.data?.task?.comment || ""};
			// let jdata = {list: [], minInterval: packet.data.task.minInterval, maxInterval: packet.data.task.maxInterval, operator: packet.data.task.operator, comment: packet?.data?.task?.comment || ""};
			if (packet?.data?.task?.delayed == 1) {
				jdata.delayed = 1;
				jdata.dateStart = moment(packet?.data?.task?.dateStart).format("YYYY-MM-DDTHH:mm");
			}
			for (let item of packet.data.task.list) {
				if (!this.#core.Toolbox.IsNumber(item.num) || item.num.toString().length != 10) {
					errs.push("Ошибочная длина номера");
					break;
				}
				if (!this.#core.Toolbox.IsNumber(item.amount) || item.amount > 200) {
					errs.push("Ошибочная суммы пополнения");
					break;
				}
				item.hash = this.#core.Toolbox.GenerateUniqueHash();
				jdata.list.push(item);
			}
			if (errs.length == 0) {
				jdata.list = this.#core.Toolbox.ShuffleArray(jdata.list); // перемешаем
				let cdate = moment();
				let terminal = "10746127";
				let person = "13250871";
				let result = await this.#connector.Request("dexol", `
					INSERT INTO kiwi_payments_list
					SET terminal = '${terminal}', person = '${person}', data = '${JSON.stringify(jdata)}', date = '${cdate.format("YYYY-MM-DDTHH:mm:ss")}', status = '1'
				`);
				if (!result || result.affectedRows != 1) errs.push("Ошибка в процессе добавления записи");
				else {
					status = this.#HTTP_STATUSES.OK;
					await application.UpdateTerminalPaymentsList(terminal);
				}
			} else data.errs = errs;
		} else data.errs = errs;

		let rpacket = new Packet({status: status, data: data, hash: packet.hash});

		let user = users.find(item => item.Uid == packet.uid);
		user.CloseConnection(rpacket.ToString());
	}
	Check(packet, users, response, application) {
		let allowed = [
			{name: "getAppData",           method: (...args) => { this.#GetAppData(...args) } },
			{name: "getPaymentsList",      method: (...args) => { this.#GetPaymentsList(...args) } },
			{name: "getPayment",           method: (...args) => { this.#GetPayment(...args) } },
			{name: "newTask",              method: (...args) => { this.#NewTask(...args) } },
			// {name: }
		];
		if (!allowed.find(item=> item.name == packet?.data?.action)) {
			let p = {status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {action: packet?.data?.action, errs: ["Action not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			response.end(new Packet({status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.data.action).method(packet, users, application);
		}
	}
}
module.exports = Api;


class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.apps.kiwi";
		this.#packet.subcom = "api";
		this.#packet.data = args?.data;
		this.#packet.status = args?.status;
		this.#packet.message = args?.message;
		this.#packet.hash = args?.hash;
	}
	set Hash(hash) { this.#packet.hash = hash; }
	GetPacket() { return this.#packet; }
	ToString() { return JSON.stringify(this.#packet); }
}