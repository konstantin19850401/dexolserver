"use strict"
class Dicts {
	#core;#connector;#list = [];
	#HTTP_STATUSES;
	constructor(core) {
		this.#core = core;
		this.#connector = this.#core.Connector;
		this.#HTTP_STATUSES = this.#core.HttpStatuses;
		this.#Init();
	}
	get List() { return this.#list; }
	get Count() { return this.#list.length; }
	async #Init() {
		let rows = await this.#connector.Request("dexol", `SELECT * FROM dicts WHERE del = '0'`);
		for (let row of rows) this.#list.push(new Dict(row, this.#connector, this.#core.Toolbox, this.#list));
	}
	async #CreateCol(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict, list: [packet.data?.newCol]};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (!packet.data?.dict) errs.push("Вы не указали справочник, для структуры которого создается поле.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");
		else {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			errs = errs.concat(await dict.CreateCol(packet.data?.newCol));
			if (errs.length == 0) {
				status = this.#HTTP_STATUSES.OK;
				if (packet.data?.newCol?.foreignKey.toString() == "-1") data.list[0].foreignKey = "";
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #GetList(packet, users) {
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, list: []};
		for (let item of this.#list) {
			data.list.push({name: item.Name, title: item.Title, structure: item.Structure, list: item.List});
		}
		let rpacket = new Packet({status: this.#HTTP_STATUSES.OK, data: data, hash: packet.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #GetDict(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict, list: []};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");
		else {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			data.list = dict.Data;
			data.schema = dict.Structure;
			status = this.#HTTP_STATUSES.OK;
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #CreateDict(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		!packet.data?.dict && errs.push("Вы не указали параметры создаваемого справочника");

		(!packet.data?.dict?.name || packet.data?.dict?.name == "" || packet.data?.dict?.name?.length < 3 || packet.data?.dict?.name?.length > 50)
		&& errs.push("Поле Код обязательно для заполнения. Длина поля от 3 до 50 символов.")
		|| this.#list.find(item=> item.Name == packet.data?.dict?.name) && errs.push("Вы не можете создать справочник");

		(!packet.data?.dict?.title || packet.data?.dict?.title == "" || packet.data?.dict?.title?.length < 3 || packet.data?.dict?.title?.length > 100)
		&& errs.push("Поле Наименование обязательно для заполнения. Длина поля от 3 до 100 символов.");

		let data = {action: packet.data.action};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (errs.length == 0) {
			let result = await this.#connector.Request("dexol", `
				INSERT INTO dicts
				SET name = '${packet.data.dict.name}', title = '${packet.data.dict.title}', status = '1'
			`);
			if (result && result?.affectedRows == 1) {
				data.message = `Справочник ${packet.data.dict.title} создан`;
				data.dict = {name: packet.data.dict.name, title: packet.data.dict.title};
				status = this.#HTTP_STATUSES.OK;
				let rows = await this.#connector.Request("dexol", `SELECT * FROM dicts WHERE id = '${result.insertId}'`);
				this.#list.push(new Dict(rows[0], this.#connector, this.#core.Toolbox, this.#list));
			} else errs.push("Справочник не создан. Ошибка сервера.");
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #CreateRecord(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict, list: []};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");
		else {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			errs = errs.concat(await dict.AddRecord(packet.data?.fields));
			if (errs.length == 0) {
				status = this.#HTTP_STATUSES.OK;
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #DeleteRecords(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict, list: []};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");
		else {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			errs = errs.concat(await dict.DeleteRecords(packet.data?.list));
			if (errs.length == 0) {
				status = this.#HTTP_STATUSES.OK;
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #DeleteDict(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;
		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");
		else {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			let ifDelete = await dict.Delete();
			if (ifDelete == true) {
				status = this.#HTTP_STATUSES.OK;
				this.#list = this.#list.filter(item=> item.Name != packet.data.dict);
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #DeleteCol(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;

		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");

		(!packet?.data?.cols || !Array.isArray(packet?.data?.cols)) && errs.push("Вы не указали колонки, которые требуется удалить");

		if (errs.length == 0) {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			let cols = [];
			for (let item of packet.data.cols) {
				let obj = {name: item, del: 0};
				let result = await dict.DeleteCol(item);
				if (result) obj.del = 1;
				cols.push(obj);
			}
			data.cols = cols;
			if (cols.length != cols.filter(item=> item.del == 1).length) {
				errs.push("Не все значения были удалены");
				status = this.#HTTP_STATUSES.CONFLICT;
			} else status = this.#HTTP_STATUSES.OK;
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}
	async #GetDictItem(packet, users) {
		let errs = [];
		let user = users.find(item => item.Uid == packet.uid);
		let data = {action: packet.data.action, dict: packet.data?.dict};
		let status = this.#HTTP_STATUSES.BAD_REQUEST;

		if (!packet.data?.dict) errs.push("Вы не указали справочник.");
		else if (!this.#list.find(item=> item.Name == packet.data.dict)) errs.push("Вы указали не существующий справочник");

		if (!packet?.data?.id) errs.push("Вы не указали номер записи, которую запрашиваете.");
		else if (!this.#core.toolbox.IsNumber(packet.data.id)) errs.push("Номер записи должен быть числом");

		if (errs.length == 0) {
			let dict = this.#list.find(item=> item.Name == packet.data.dict);
			let item = dict.GetItem(packet.data.id);
			data.id = packet.data.id;
			if (item.length == 0) errs.push("Запрошенной записи не существует");
			else {
				data.item = item;
				status = this.#HTTP_STATUSES.OK;;
			}
		}
		if (errs.length > 0) data.errs = errs;
		let rpacket = new Packet({status: status, data: data, hash: packet?.hash});
		user.CloseConnection(rpacket.ToString());
	}

	Check(packet, users, response) {
		let allowed = [
			{name: "addDict",         method: (...args) => { this.#CreateDict(...args) } },
			{name: "addCol",          method: (...args) => { this.#CreateCol(...args) } },
			{name: "addRecord",       method: (...args) => { this.#CreateRecord(...args) } },
			{name: "delDict",         method: (...args) => { this.#DeleteDict(...args) } },
			{name: "delCol",          method: (...args) => { this.#DeleteCol(...args) } },
			{name: "delRecords",      method: (...args) => { this.#DeleteRecords(...args) } },
			{name: "list",            method: (...args) => { this.#GetList(...args) } },
			{name: "dictData",        method: (...args) => { this.#GetDict(...args) } },
			{name: "getRecord",       method: (...args) => { this.#GetDictItem(...args) } },
			{name: "editRecord",      method: (...args) => {  } },
		];
		if (!allowed.find(item=> item.name == packet?.data?.action)) {
			let p = {status: this.#HTTP_STATUSES.METHOD_NOT_ALLOWED, data: {action: packet?.data?.action, errs: ["Action not allowed"]}};
			response.end(new Packet(p).ToString());
		} else {
			response.end(new Packet({status: this.#HTTP_STATUSES.OK, message: "Ok"}).ToString());
			allowed.find(item=> item.name == packet.data.action).method(packet, users, response);
		}
	}
}
module.exports = Dicts;

class Packet {
	#packet = {};
	constructor(args) {
		this.#packet.com = args?.com || "dexol.core.dicts";
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

class Dict {
	#connector;#toolbox;#dicts;
	#name;#title;#list = [];#structure = [];
	constructor(row, connector, toolbox, dicts) {
		this.#connector = connector;
		this.#name = row.name;
		this.#title = row.title;
		this.#toolbox = toolbox;
		this.#dicts = dicts;
		setTimeout(()=> this.#InitStructure(), 300);
	}
	get Name() { return this.#name; }
	get Title() { return this.#title; }
	get Length() { return this.#list.length; }
	get Structure() { return this.#structure; }
	get Data() { return this.#list; }
	get List() { return this.#list.map(item=> { return {id: item.id, title: item.title} }) }
	GetItem(id) { return this.#list.find(item=> item.id == id); }

	async UpdateStructure() { await this.#InitStructure(); }
	async #InitStructure() {
		this.#structure = [];
		let rows = await this.#connector.Request("dexol", `SELECT * FROM dicts_cols WHERE dict = '${this.#name}' AND del = '0'`);
		for (let row of rows) {
			let item = {name: row.name, title: row.title};
			let data = row.data != "" && JSON.parse(row.data) || {};
			for (let key in data) item[key] = data[key];
			this.#structure.push(item);
		}
		await this.#InitData();
	}
	async #InitData() {
		this.#list = [];
		let rows = await this.#connector.Request("dexol", `
			SELECT id_record AS id, data, date, del
			FROM dicts_data
			WHERE dict = '${this.#name}' AND del = '0'`);
		for (let row of rows) {
			let item = {id: row.id, date: row.date, del: row.del};
			let data = row.data != "" && JSON.parse(row.data) || {};
			for (let sitem of this.#structure) {
				if (sitem.name != "id") item[sitem.name] = data[sitem.name] || "";
			}
			this.#list.push(item);
		}
	}
	IfIssetCol(name) {
		for (let item of this.#structure) {
			if (item.name == name) return true;
		}
		return false;
	}
	async CreateCol(data) {
		let errs = [], types = ["VARCHAR", "INT", "TIMESTAMP", "TEXT" ], ai = [0, 1];

		if (!data) errs.push("Вы не указали параметры поля для добавления в структуру.");
		else {
			(!data?.name || data.name.toString().length < 2 || data.name.toString().length > 50)
			&& errs.push("Поле Код обязательно для заполнения. Длина поля от 2 до 50 символов.");

			(!data?.title || data.title.toString().length < 2 || data.title.toString().length > 100)
			&& errs.push("Поле Наименование обязательно для заполнения. Длина поля от 2 до 100 символов.");

			(!data?.multiSelect && ai.indexOf(parseInt(data.multiSelect)) == -1)
			&& errs.push("Поле Мультивыбор не содеожит справочного значения.");

			if (!data?.type && types.indexOf(data.type) == -1) errs.push("Поле Тип обязательно для заполнения.");
			else {
				if (!data?.autoIncrement || ai.indexOf(parseInt(data.autoIncrement)) == -1) {
					errs.push("Поле Автоинкремент не содержит справочного значения.");
				} else {
					this.#structure.length == 0 && parseInt(data.autoIncrement) == 0 && errs.push("Первое поле в структуре справочника должно быть с типом автоинкремент.");
					data.type != "INT" && parseInt(data.autoIncrement) == 1 && errs.push("Для поля с автоинкрементом тип должен быть INT.");
				}
			}

			(!data?.colLength || !this.#toolbox.IsNumber(data?.colLength) || parseInt(data.colLength) < 1)
			&& errs.push("Поле Длина обязательно для заполнения. Поле является числом. Длина поля более 0.");

			this.IfIssetCol(data?.name) && errs.push("Такое поле уже есть");

			let foreignKey = false;
			if (data?.foreignKey && data.foreignKey.toString() != "-1") {
				let dict = this.#dicts.find(item=> item.Name == data.foreignKey);
				if (dict) {
					foreignKey = true;
					data.foreignKey = `${data.foreignKey}.id`;
				}
				else errs.push("Поле Мультивыбор указывает на не существующий справочник.");
			}

			if (errs.length == 0) {
				let params = {type: data.type, colLength: data.colLength, autoIncrement: data.autoIncrement, multiSelect: data.multiSelect};
				if (foreignKey) params.foreignKey = data.foreignKey;
				let result = await this.#connector.Request("dexol", `
					INSERT INTO dicts_cols
					SET dict = '${this.#name}', name = '${data.name}', title = '${data.title}', data = '${JSON.stringify(params)}'
				`);

				if (!result || result.affectedRows != 1) errs.push("Ошибка в процессе добавления поля в структуру справочника");
				else await this.UpdateStructure();
			}
		}
		return errs;
	}
	async AddRecord(data) {
		let errs = [], types = ["VARCHAR", "INT", "TIMESTAMP", "TEXT" ], ai = [0, 1];
		if (!data) errs.push("Вы не указали данные создаваемой записи");
		else {
			for (let item of this.#structure) {
				if (item.name != "id") {
					if (typeof data[item.name] === "undefined") errs.push(`Вы не указали поле ${item.title}`);
					else {
						if (item.foreignKey && item.foreignKey != "" && item.foreignKey.toString() != "-1") {
							this.#dicts.find(item=> item.Name == data.foreignKey) && errs.push("Поле Мультивыбор указывает на не существующий справочник.");
						} else {
							// сравним длину
							(data[item.name].toString().length < 2 || data[item.name].toString().length > item.colLength)
							&& errs.push(`Количество символов поля ${item.title} не соответствует допустимому значению. Минимум - 2, максимум - ${item.colLength}`);

							// сравним тип
						 	item.type == "INT" && !this.#toolbox.IsNumber(data[item.name])
						 	&& errs.push(`Тип поля ${item.title} не соответствует структурному`);
						}
					}
				}
			}
		}
		if (errs.length == 0) {
			let max = (this.#list.length > 0 && this.#list.reduce((a, b) => a.id_record > b.id_record ? a : b).id + 1) || 1;
			let result = await this.#connector.Request("dexol", `
				INSERT INTO dicts_data
				SET id_record = '${max}', dict = '${this.#name}', data = '${JSON.stringify(data)}', del = '0'
			`);
			if (!result || result.affectedRows != 1) errs.push("Ошибка в процессе добавления записи в справочник");
			else await this.#InitData();
		}
		return errs;
	}
	async DeleteRecords(list) {
		let errs = [];
		if (!list || !Array.isArray(list)) errs.push("Вы не указали удаляемые записи.");
		else {
			let result = await this.#connector.Request("dexol", `
				UPDATE dicts_data
				SET del = '1'
				WHERE dict = '${this.#name}' AND id_record IN (${list.join(",")}) AND del = '0'
			`);
			if (!result || result.changedRows != list.length) errs.push("Не все записи были удалены");
			await this.#InitData();
		}
		return errs;
	}
	async Delete() {
		let result = await this.#connector.Request("dexol", `
			UPDATE dicts
			SET del = '1'
			WHERE name = '${this.#name}' AND del = '0'
		`);
		if (!result || result.changedRows != 1) return false;
		return true;
	}
	async DeleteCol(colName) {
		let result = await this.#connector.Request("dexol", `
			UPDATE dicts_cols
			SET del = '1'
			WHERE dict = '${this.#name}' AND name = '${colName}' AND del = '0'
		`);
		if (!result || result.changedRows != 1) return false;
		await this.#InitStructure();
		return true;
	}
}